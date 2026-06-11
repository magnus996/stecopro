import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/session'

export async function POST(): Promise<NextResponse> {
  await deleteSession()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
}

// GET variant used as a redirect target when a session cookie is
// cryptographically valid but its user no longer exists in the database
// (e.g. after demo:setup reseeds). Clearing the cookie here breaks the
// /login <-> /dashboard redirect loop.
export async function GET(): Promise<NextResponse> {
  await deleteSession()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
}
