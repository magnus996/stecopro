/**
 * Vitest tests for notifier.ts
 *
 * Uses in-memory better-sqlite3 + drizzle with the push_subscriptions schema.
 * Injects a fake web-push so no real HTTP calls are made.
 *
 * Covers:
 *   - Filter (planned, fault, idle-Bunker-tom, idle-other)
 *   - 5-min throttle per tenant+reason (clock injection via deps.now)
 *   - Dead-subscription pruning (statusCode 404/410 → row deleted)
 *   - Error tolerance (generic Error → resolves, does not reject)
 *   - Missing VAPID keys → all-zero, no throw
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { pushSubscriptions } from '@/db/schema'
import { notifyStop, __resetThrottle } from './notifier'

// ---------------------------------------------------------------------------
// Test DB setup helpers
// ---------------------------------------------------------------------------

function makeTestDb(): BetterSQLite3Database<typeof schema> {
  const sqlite = new Database(':memory:')

  // Create minimal schema needed by the notifier.
  // Column names must match Drizzle ORM's SQL column names (camelCase fields
  // without explicit column() names become snake_case in SQLite).
  // $defaultFn is applied by Drizzle in JS — the SQLite DDL still needs the column.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      "createdAt" INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      "createdAt" INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      "createdAt" INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(endpoint)
    );
  `)

  return drizzle(sqlite, { schema })
}

/** Insert a test push subscription and return the row. */
function insertSub(
  db: BetterSQLite3Database<typeof schema>,
  opts: { tenantId: number; userId: number; endpoint: string; p256dh?: string; auth?: string },
) {
  db.insert(pushSubscriptions)
    .values({
      tenantId: opts.tenantId,
      userId: opts.userId,
      endpoint: opts.endpoint,
      p256dh: opts.p256dh ?? 'p256dh-test',
      auth: opts.auth ?? 'auth-test',
    })
    .run()
}

/** Fake web-push that always succeeds. */
function makeFakeWebpush() {
  return {
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  }
}

// Fixed base time for throttle tests (epoch ms)
const BASE_NOW = 1_700_000_000_000

const COMMON_ARGS = {
  tenantId: 1,
  plantId: 1,
  plantName: 'Testanlegg',
  stopId: 42,
  startAtMs: BASE_NOW,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notifyStop — filter', () => {
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    db = makeTestDb()
    __resetThrottle()
    insertSub(db, { tenantId: 1, userId: 1, endpoint: 'https://push.example.com/sub1' })
  })

  it('planned stop → attempted=0 (never notifies)', async () => {
    const fakeWp = makeFakeWebpush()
    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'Planlagt stans', stopType: 'planned' },
      { webpush: fakeWp, now: BASE_NOW },
    )
    expect(result.attempted).toBe(0)
    expect(result.sent).toBe(0)
    expect(fakeWp.sendNotification).not.toHaveBeenCalled()
  })

  it('fault stop → attempted = number of subscriptions', async () => {
    const fakeWp = makeFakeWebpush()
    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: fakeWp, now: BASE_NOW },
    )
    expect(result.attempted).toBe(1)
    expect(result.sent).toBe(1)
    expect(fakeWp.sendNotification).toHaveBeenCalledTimes(1)
  })

  it('idle stop with reason "Bunker tom" → attempted > 0', async () => {
    const fakeWp = makeFakeWebpush()
    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'Bunker tom', stopType: 'idle' },
      { webpush: fakeWp, now: BASE_NOW },
    )
    expect(result.attempted).toBeGreaterThan(0)
    expect(result.sent).toBe(1)
  })

  it('idle stop with OTHER reason → attempted=0', async () => {
    const fakeWp = makeFakeWebpush()
    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'Lunsj', stopType: 'idle' },
      { webpush: fakeWp, now: BASE_NOW },
    )
    expect(result.attempted).toBe(0)
    expect(fakeWp.sendNotification).not.toHaveBeenCalled()
  })
})

describe('notifyStop — 5-minute throttle', () => {
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    db = makeTestDb()
    __resetThrottle()
    insertSub(db, { tenantId: 1, userId: 1, endpoint: 'https://push.example.com/sub2' })
  })

  it('second call within 5 min → attempted=0 (throttled)', async () => {
    const fakeWp = makeFakeWebpush()

    // First call at BASE_NOW
    const r1 = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: fakeWp, now: BASE_NOW },
    )
    expect(r1.attempted).toBe(1)

    // Second call 4 min later (within 5-min window) — should be throttled
    const r2 = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: fakeWp, now: BASE_NOW + 4 * 60 * 1000 },
    )
    expect(r2.attempted).toBe(0)
    // sendNotification was only called once
    expect(fakeWp.sendNotification).toHaveBeenCalledTimes(1)
  })

  it('call >5 min later → not throttled, sends again', async () => {
    const fakeWp = makeFakeWebpush()

    // First call
    await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: fakeWp, now: BASE_NOW },
    )

    // Second call 6 min later (after throttle window)
    const r2 = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: fakeWp, now: BASE_NOW + 6 * 60 * 1000 },
    )
    expect(r2.attempted).toBeGreaterThan(0)
    expect(fakeWp.sendNotification).toHaveBeenCalledTimes(2)
  })

  it('throttle is per tenant+reason — different reason is not throttled', async () => {
    const fakeWp = makeFakeWebpush()

    // First call with reason A
    await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'reasonA', stopType: 'fault' },
      { webpush: fakeWp, now: BASE_NOW },
    )

    // Call with reason B immediately after — different key, not throttled
    const r2 = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'reasonB', stopType: 'fault' },
      { webpush: fakeWp, now: BASE_NOW + 1000 },
    )
    expect(r2.attempted).toBeGreaterThan(0)
  })
})

describe('notifyStop — dead-subscription pruning', () => {
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    db = makeTestDb()
    __resetThrottle()
  })

  it('statusCode 410 → subscription deleted, pruned=1, call resolves', async () => {
    insertSub(db, { tenantId: 1, userId: 1, endpoint: 'https://push.example.com/dead' })

    const deadWebpush = {
      sendNotification: vi.fn().mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 })),
    }

    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: deadWebpush, now: BASE_NOW },
    )

    expect(result.pruned).toBe(1)
    expect(result.sent).toBe(0)
    // Row should be deleted
    const remaining = db.select().from(pushSubscriptions).all()
    expect(remaining).toHaveLength(0)
  })

  it('statusCode 404 → subscription deleted, pruned=1', async () => {
    insertSub(db, { tenantId: 1, userId: 1, endpoint: 'https://push.example.com/notfound' })

    const deadWebpush = {
      sendNotification: vi.fn().mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 })),
    }

    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: deadWebpush, now: BASE_NOW },
    )

    expect(result.pruned).toBe(1)
  })

  it('mixed: one dead 410, one live → pruned=1, sent=1, resolves', async () => {
    insertSub(db, { tenantId: 1, userId: 1, endpoint: 'https://push.example.com/dead2' })
    insertSub(db, { tenantId: 1, userId: 1, endpoint: 'https://push.example.com/live' })

    let callCount = 0
    const mixedWebpush = {
      sendNotification: vi.fn().mockImplementation(async (sub: { endpoint: string }) => {
        callCount++
        if (sub.endpoint === 'https://push.example.com/dead2') {
          throw Object.assign(new Error('Gone'), { statusCode: 410 })
        }
        return { statusCode: 201 }
      }),
    }

    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: mixedWebpush, now: BASE_NOW },
    )

    expect(result.attempted).toBe(2)
    expect(result.sent).toBe(1)
    expect(result.pruned).toBe(1)
    // Only the dead one removed
    const remaining = db.select().from(pushSubscriptions).all()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].endpoint).toBe('https://push.example.com/live')
  })
})

describe('notifyStop — error tolerance', () => {
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    db = makeTestDb()
    __resetThrottle()
    insertSub(db, { tenantId: 1, userId: 1, endpoint: 'https://push.example.com/err' })
  })

  it('generic Error from sendNotification → resolves (does not reject), sent=0', async () => {
    const errorWebpush = {
      sendNotification: vi.fn().mockRejectedValue(new Error('Network failure')),
    }

    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: errorWebpush, now: BASE_NOW },
    )

    expect(result.sent).toBe(0)
    expect(result.pruned).toBe(0)
    // attempted = 1 (we had one subscription)
    expect(result.attempted).toBe(1)
  })

  it('sendNotification throws synchronously → still resolves', async () => {
    const throwingWebpush = {
      sendNotification: vi.fn().mockImplementation(() => {
        throw new Error('Sync throw')
      }),
    }

    // Should not throw
    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      { webpush: throwingWebpush, now: BASE_NOW },
    )
    expect(result.sent).toBe(0)
  })
})

describe('notifyStop — missing VAPID keys', () => {
  let db: BetterSQLite3Database<typeof schema>
  let originalPub: string | undefined
  let originalPriv: string | undefined
  let originalSubj: string | undefined

  beforeEach(() => {
    db = makeTestDb()
    __resetThrottle()
    insertSub(db, { tenantId: 1, userId: 1, endpoint: 'https://push.example.com/vapid-test' })

    // Save and clear VAPID env vars
    originalPub = process.env.VAPID_PUBLIC_KEY
    originalPriv = process.env.VAPID_PRIVATE_KEY
    originalSubj = process.env.VAPID_SUBJECT
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_SUBJECT
  })

  afterEach(() => {
    // Restore VAPID env vars
    if (originalPub !== undefined) process.env.VAPID_PUBLIC_KEY = originalPub
    else delete process.env.VAPID_PUBLIC_KEY
    if (originalPriv !== undefined) process.env.VAPID_PRIVATE_KEY = originalPriv
    else delete process.env.VAPID_PRIVATE_KEY
    if (originalSubj !== undefined) process.env.VAPID_SUBJECT = originalSubj
    else delete process.env.VAPID_SUBJECT
  })

  it('VAPID keys unset, no injected webpush → all-zero, does not throw', async () => {
    const result = await notifyStop(
      db,
      { ...COMMON_ARGS, reason: 'driftsstans', stopType: 'fault' },
      // No webpush injected — relies on env
    )
    expect(result.attempted).toBe(0)
    expect(result.sent).toBe(0)
    expect(result.pruned).toBe(0)
  })
})
