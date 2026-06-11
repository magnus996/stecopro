/**
 * Pure push-notification notifier.
 *
 * CRITICAL CONSTRAINTS:
 * - Takes `db` as a parameter — NEVER imports @/db or next/headers (runs in both
 *   live loop and request context).
 * - Timestamps in the DB are Unix SECONDS. Comparisons against Date.now() (ms)
 *   must explicitly multiply seconds × 1000 or divide ms by 1000.
 * - 5-minute in-memory throttle per tenant+reason prevents per-minute re-notification
 *   storms when the live tick closes and re-opens the same stop each minute.
 * - Filter: only fault OR (idle + "Bunker tom") → planned stops never notify.
 * - Missing VAPID keys → no-op + warn (degradation, keeps demo:setup green).
 * - Dead-subscription pruning: 404/410 → delete row; other errors logged but never thrown.
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/db/schema'
import { pushSubscriptions } from '@/db/schema'
import type { StopType } from '@/lib/ingest/interface'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebPushLike {
  sendNotification(subscription: object, payload: string | Buffer): Promise<unknown>
}

export interface NotifierDeps {
  webpush: WebPushLike
  now?: number
}

// ---------------------------------------------------------------------------
// In-memory 5-minute throttle
// Key: `${tenantId}:${reason}`, value: last-sent epoch ms
// ---------------------------------------------------------------------------
const throttleMap = new Map<string, number>()

const THROTTLE_MS = 5 * 60 * 1000 // 5 minutes

/** Test helper — clears the throttle map before each test. */
export function __resetThrottle(): void {
  throttleMap.clear()
}

// ---------------------------------------------------------------------------
// Real web-push instance (lazy singleton, configured once)
// ---------------------------------------------------------------------------
let _realWebpush: WebPushLike | null = null

function getRealWebpush(): WebPushLike | null {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subj = process.env.VAPID_SUBJECT

  if (!pub || !priv || !subj) {
    // Degradation: VAPID keys absent — caller decides what to do
    return null
  }

  if (_realWebpush) return _realWebpush

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const webpushLib = require('web-push') as typeof import('web-push')
  webpushLib.setVapidDetails(subj, pub, priv)
  _realWebpush = webpushLib
  return _realWebpush
}

// ---------------------------------------------------------------------------
// Oslo time formatter
// ---------------------------------------------------------------------------
const osloTimeFormatter = new Intl.DateTimeFormat('no', {
  timeZone: 'Europe/Oslo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function osloHHMM(ms: number): string {
  return osloTimeFormatter.format(new Date(ms))
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function notifyStop(
  db: BetterSQLite3Database<typeof schema>,
  args: {
    tenantId: number
    plantId: number
    plantName: string
    stopId: number
    reason: string
    stopType: StopType
    startAtMs: number
  },
  deps?: Partial<NotifierDeps>,
): Promise<{ attempted: number; sent: number; pruned: number }> {
  const ZERO = { attempted: 0, sent: 0, pruned: 0 }

  // ── Filter: only fault OR idle-with-Bunker-tom ─────────────────────────
  const { stopType, reason, tenantId, stopId, plantName, startAtMs } = args

  if (stopType === 'planned') return ZERO
  if (stopType === 'idle' && reason !== 'Bunker tom') return ZERO
  // stopType === 'fault' || (stopType === 'idle' && reason === 'Bunker tom') → continue

  // ── Throttle: 5 min per tenant+reason ─────────────────────────────────
  const now = deps?.now ?? Date.now()
  const throttleKey = `${tenantId}:${reason}`
  const lastSent = throttleMap.get(throttleKey)
  if (lastSent !== undefined && now - lastSent < THROTTLE_MS) {
    return ZERO
  }

  // ── Resolve web-push implementation ───────────────────────────────────
  const webpush = deps?.webpush ?? getRealWebpush()
  if (!webpush) {
    console.warn('[notifier] VAPID keys missing — skipping push notification')
    return ZERO
  }

  // ── Select subscriptions for this tenant ──────────────────────────────
  const subs = db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.tenantId, tenantId))
    .all()

  if (subs.length === 0) return ZERO

  // ── Build notification payload ─────────────────────────────────────────
  const title =
    stopType === 'fault'
      ? `⚠ Driftsstans: ${reason}`
      : `Bunker tom — fyll på innmating`
  const body = `${plantName} — kl. ${osloHHMM(startAtMs)}`
  const payload = JSON.stringify({
    title,
    body,
    url: `/stopp/${stopId}`,
    tag: `${tenantId}:${reason}`,
  })

  // ── Send to each subscription ──────────────────────────────────────────
  let sent = 0
  let pruned = 0

  const sendPromises = subs.map(async (sub) => {
    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    }
    try {
      await webpush.sendNotification(subscription, payload)
      sent++
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        // Dead subscription — prune it
        try {
          db.delete(pushSubscriptions)
            .where(
              and(
                eq(pushSubscriptions.endpoint, sub.endpoint),
                eq(pushSubscriptions.tenantId, tenantId),
              ),
            )
            .run()
          pruned++
        } catch (deleteErr) {
          console.error('[notifier] failed to delete dead subscription', deleteErr)
        }
      } else {
        console.error('[notifier] sendNotification failed', err)
      }
    }
  })

  await Promise.all(sendPromises)

  const attempted = subs.length

  // ── Update throttle ────────────────────────────────────────────────────
  throttleMap.set(throttleKey, now)

  return { attempted, sent, pruned }
}
