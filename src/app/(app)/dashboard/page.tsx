import { verifySession } from '@/lib/dal'

export default async function DashboardPage() {
  const session = await verifySession()

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="rounded-lg bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-2 text-zinc-600">Innlogget som bruker-ID {session.userId} (rolle: {session.role})</p>
      </div>
    </div>
  )
}
