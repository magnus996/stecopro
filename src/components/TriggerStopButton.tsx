'use client'

// Dev-only demo button: fires POST /api/dev/trigger-stop so push
// notifications can be demonstrated on command (a simulated fault
// only occurs every ~3h naturally). Rendered by /varsler in dev.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TriggerStopButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function trigger() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/dev/trigger-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Nødstopp aktivert', stopType: 'fault' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setResult('Kunne ikke utløse teststans.')
        return
      }
      setResult(
        `Teststans utløst (stopp #${data.stopId}). Varsel forsøkt sendt til ${data.attempted} enhet(er), levert til ${data.sent}.`,
      )
      router.refresh()
    } catch {
      setResult('Kunne ikke utløse teststans.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={trigger}
        disabled={busy}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {busy ? 'Utløser…' : 'Utløs teststans'}
      </button>
      {result && <p className="text-xs text-zinc-500 dark:text-zinc-400">{result}</p>}
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Kun for demo: registrerer et nødstopp og sender push-varsel til abonnerte enheter.
      </p>
    </div>
  )
}
