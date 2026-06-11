'use client'

import { useActionState } from 'react'
import { registerShipment, type RegisterShipmentState } from '@/actions/inventory'

interface Fraction {
  id: number
  name: string
  stock: number
}

interface ShipmentFormProps {
  plantId: number
  fractions: Fraction[]
}

export default function ShipmentForm({ plantId, fractions }: ShipmentFormProps) {
  const [state, formAction, isPending] = useActionState<RegisterShipmentState, FormData>(
    registerShipment,
    undefined,
  )

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Registrer utsendelse
      </h2>

      {state && 'success' in state && state.success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800">
          Utsendelse registrert
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {/* Hidden plant id */}
        <input type="hidden" name="plantId" value={plantId} />

        {/* Fraction select */}
        <div>
          <label htmlFor="fractionId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Fraksjon
          </label>
          <select
            id="fractionId"
            name="fractionId"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {fractions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.stock} på lager)
              </option>
            ))}
          </select>
          {state && 'errors' in state && state.errors?.fractionId && (
            <p className="mt-1 text-sm text-red-600">{state.errors.fractionId[0]}</p>
          )}
        </div>

        {/* Bale count */}
        <div>
          <label htmlFor="baleCount" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Antall baler
          </label>
          <input
            id="baleCount"
            name="baleCount"
            type="number"
            min="1"
            required
            placeholder="0"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          {state && 'errors' in state && state.errors?.baleCount && (
            <p className="mt-1 text-sm text-red-600">{state.errors.baleCount[0]}</p>
          )}
        </div>

        {/* Optional note */}
        <div>
          <label htmlFor="note" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notat <span className="font-normal text-zinc-400">(valgfritt)</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            placeholder="F.eks. sjåfør, destinasjon …"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? 'Registrerer…' : 'Registrer utsendelse'}
        </button>
      </form>
    </div>
  )
}
