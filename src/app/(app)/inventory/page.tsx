// Lager (Inventory) page — Server Component.
// Fetches stock per fraction and shipment history for the plant.

import { getCurrentUser, getPlants, getStockByFraction, getShipmentHistory } from '@/lib/dal'
import ShipmentForm from './ShipmentForm'

/** Format a Date as 'dd.MM HH:mm' in Oslo timezone. */
function toOsloFullDateTime(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default async function InventoryPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const plants = await getPlants()
  const plant = plants[0] ?? null

  if (!plant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Lager</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen anlegg</p>
        </div>
      </div>
    )
  }

  const stock = await getStockByFraction(plant.id)
  const history = await getShipmentHistory(plant.id, 20)

  const totalProduced = stock.reduce((s, r) => s + r.produced, 0)
  const totalShipped = stock.reduce((s, r) => s + r.shipped, 0)
  const totalStock = stock.reduce((s, r) => s + r.stock, 0)

  // Serialise shipment dates to strings before passing to markup
  const historyRows = history.map((h) => ({
    id: h.id,
    dato: toOsloFullDateTime(h.shippedAt),
    fraksjon: h.fractionName,
    antall: h.baleCount,
    notat: h.note ?? '—',
  }))

  // Fraction list for the form (id, name, current stock)
  const fractionOptions = stock.map((s) => ({
    id: s.fractionId,
    name: s.name,
    stock: s.stock,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Lager — {plant.name}
      </h1>

      {/* Lagerstatus table */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Lagerstatus
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Fraksjon</th>
              <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Produsert</th>
              <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Sendt</th>
              <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">På lager</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {stock.map((r) => (
              <tr key={r.fractionId}>
                <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{r.name}</td>
                <td className="py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{r.produced}</td>
                <td className="py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{r.shipped}</td>
                <td className="py-1.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{r.stock}</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-200 dark:border-zinc-700">
              <td className="pt-2 font-semibold text-zinc-900 dark:text-zinc-50">Totalt</td>
              <td className="pt-2 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{totalProduced}</td>
              <td className="pt-2 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{totalShipped}</td>
              <td className="pt-2 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{totalStock}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Shipment registration form */}
      <ShipmentForm plantId={plant.id} fractions={fractionOptions} />

      {/* Utsendelseshistorikk */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Utsendelseshistorikk
        </h2>
        {historyRows.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Ingen utsendelser registrert</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Dato</th>
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Fraksjon</th>
                <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Antall</th>
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Notat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {historyRows.map((h) => (
                <tr key={h.id}>
                  <td className="py-1.5 text-zinc-600 dark:text-zinc-400">{h.dato}</td>
                  <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{h.fraksjon}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50">{h.antall}</td>
                  <td className="py-1.5 text-zinc-500 dark:text-zinc-400">{h.notat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
