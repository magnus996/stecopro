import { NextResponse } from 'next/server'

/**
 * GET /api/push/vapid-public-key
 *
 * Returns the VAPID public key for the client to use when subscribing.
 * No authentication required (public key is intentionally public).
 * Key served via API endpoint — NOT NEXT_PUBLIC_* env var — so it can degrade
 * gracefully to 503 when keys are absent (keeps demo:setup green).
 */
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY

  if (!publicKey) {
    return NextResponse.json({ error: 'push_not_configured' }, { status: 503 })
  }

  return NextResponse.json({ publicKey })
}
