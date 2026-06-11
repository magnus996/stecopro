import 'server-only'
import { cookies } from 'next/headers'
import { decrypt } from './session'
import type { SessionPayload } from './definitions'

/**
 * Read + verify the session cookie for ROUTE HANDLERS.
 * Returns the payload on success, or null on missing/invalid cookie.
 * Unlike verifySession() (dal.ts) this NEVER redirects — callers return
 * NextResponse.json({error}, {status:401}) themselves.
 */
export async function getApiSession(): Promise<SessionPayload | null> {
  const cookie = (await cookies()).get('session')?.value
  return decrypt(cookie)
}
