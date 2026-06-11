'use client'
import { useActionState } from 'react'
import { updatePlantConfig } from '@/actions/plant'
import type { UpdatePlantConfigState } from '@/actions/plant'
import type { PlantConfig } from '@/lib/dal'

type Props = {
  config: PlantConfig
}

export default function PlantConfigForm({ config }: Props) {
  const [state, formAction, isPending] = useActionState<UpdatePlantConfigState, FormData>(
    updatePlantConfig,
    undefined,
  )

  return (
    <form action={formAction} className="space-y-8">
      {/* Hidden plant id */}
      <input type="hidden" name="plantId" value={config.plant.id} />

      {/* Global error */}
      {state && 'errors' in state && state.errors?._ && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.errors._[0]}
        </p>
      )}

      {/* Success confirmation */}
      {state && 'success' in state && state.success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          Lagret
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Plant section                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Anlegg
        </h2>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="plant-name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Navn
            </label>
            <input
              id="plant-name"
              name="name"
              type="text"
              defaultValue={config.plant.name}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {state && 'errors' in state && state.errors?.name && (
              <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="plant-description"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Beskrivelse
            </label>
            <input
              id="plant-description"
              name="description"
              type="text"
              defaultValue={config.plant.description ?? ''}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {/* Nominal capacity */}
          <div>
            <label
              htmlFor="plant-capacity"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nominell kapasitet (t/h)
            </label>
            <input
              id="plant-capacity"
              name="nominalCapacityTph"
              type="number"
              step="0.1"
              min="0"
              defaultValue={config.plant.nominalCapacityTph ?? ''}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {state && 'errors' in state && state.errors?.nominalCapacityTph && (
              <p className="mt-1 text-sm text-red-600">{state.errors.nominalCapacityTph[0]}</p>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Fractions section                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Fraksjoner
        </h2>
        <div className="space-y-3">
          {config.fractions.map((f) => (
            <div key={f.id} className="flex items-center gap-3">
              <input type="hidden" name="fractionId" value={f.id} />
              <div className="flex-1">
                <label className="sr-only">Navn</label>
                <input
                  name="fractionName"
                  type="text"
                  defaultValue={f.name}
                  placeholder="Navn"
                  required
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div className="w-24">
                <label className="sr-only">Sorteringsrekkefølge</label>
                <input
                  name="fractionSortOrder"
                  type="number"
                  min="0"
                  defaultValue={f.sortOrder}
                  placeholder="Orden"
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          ))}
        </div>
        {config.fractions.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen fraksjoner registrert.</p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Machines section                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Maskiner
        </h2>
        <div className="overflow-x-auto">
          {config.machines.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Navn</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2">Nominell strøm (A)</th>
                </tr>
              </thead>
              <tbody>
                {config.machines.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-4">
                      <input type="hidden" name="machineId" value={m.id} />
                      <input
                        name="machineName"
                        type="text"
                        defaultValue={m.name}
                        placeholder="Navn"
                        required
                        className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      {/* type is read-only — changing it would break dashboard queries */}
                      <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {m.type}
                      </span>
                    </td>
                    <td className="py-2">
                      <input
                        name="machineCurrentA"
                        type="number"
                        step="0.1"
                        min="0"
                        defaultValue={m.nominalCurrentA ?? ''}
                        placeholder="—"
                        className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen maskiner registrert.</p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Submit                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? 'Lagrer…' : 'Lagre'}
        </button>
      </div>
    </form>
  )
}
