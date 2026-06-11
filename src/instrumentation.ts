/**
 * Next.js instrumentation hook — runs once per Node.js server bootstrap.
 *
 * Guards:
 *   1. NEXT_RUNTIME !== 'nodejs'  → skip edge / other runtimes
 *   2. globalThis.__SIMULATOR_STARTED__  → prevents HMR double-start (issue #51450)
 *
 * Dynamic import keeps the simulator out of the edge bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if ((globalThis as { __SIMULATOR_STARTED__?: boolean }).__SIMULATOR_STARTED__) return
  ;(globalThis as { __SIMULATOR_STARTED__?: boolean }).__SIMULATOR_STARTED__ = true
  const { startLive } = await import('./lib/simulator/live')
  startLive()
}
