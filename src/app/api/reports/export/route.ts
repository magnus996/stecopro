import { cookies } from 'next/headers'
import { decrypt } from '@/lib/session'
import { getPlants, getShiftReportList } from '@/lib/dal'
import type { NextRequest } from 'next/server'

/** Format a Date as 'dd.MM.yyyy' in Oslo timezone. */
function toOsloDDMMYYYY(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * GET /api/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a semicolon-delimited UTF-8-BOM CSV of shift-level production data.
 * Norwegian semicolon convention: Norwegian Excel uses ';' as delimiter because
 * ',' is the decimal separator in nb-NO locale. UTF-8 BOM ensures Excel opens
 * the file with correct encoding without the import wizard (Pitfall 5).
 *
 * Access: produksjonsleder+ (operators → 403).
 */
export async function GET(request: NextRequest) {
  // --- Auth: read and decrypt session directly (clean 401 instead of redirect) ---
  const cookieStore = await cookies()
  const cookie = cookieStore.get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  // --- Role gate: operators cannot access the analysis CSV ---
  if (session.role === 'operator') {
    return new Response('Forbidden', { status: 403 })
  }

  // --- Parse and validate date params ---
  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return new Response('Bad Request: from and to are required', { status: 400 })
  }

  // Basic YYYY-MM-DD format validation
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  if (!datePattern.test(from) || !datePattern.test(to)) {
    return new Response('Bad Request: dates must be YYYY-MM-DD', { status: 400 })
  }

  // --- Resolve tenant plant (tenant-scoped via DAL getPlants) ---
  const plants = await getPlants()
  const plant = plants[0] ?? null
  if (!plant) {
    return new Response('Bad Request: no plant found for tenant', { status: 400 })
  }

  // --- Fetch shift data ---
  const rows = await getShiftReportList(plant.id, from, to)

  // --- Build CSV ---
  const SEP = ';'
  const BOM = '﻿'  // UTF-8 BOM: 0xEF 0xBB 0xBF in UTF-8

  const header = [
    'Dato',
    'Skift',
    'OEE %',
    'Tilgjengelighet %',
    'Ytelse %',
    'Oppetid (min)',
    'Planlagt (min)',
    'Stopp (antall)',
    'Stoppetid (min)',
    'Totalt baler',
  ].join(SEP)

  const body = rows
    .map((r) => {
      const dato = toOsloDDMMYYYY(r.startAt)
      const skift = r.shiftType === 'day' ? 'Dag' : 'Kveld'
      const oeePct = (r.oee * 100).toFixed(1)
      const availPct = (r.availability * 100).toFixed(1)
      const perfPct = (r.performance * 100).toFixed(1)
      const uptimeMin = Math.round(r.uptimeRunSeconds / 60)
      const plannedMin = Math.round(r.uptimePlannedSeconds / 60)
      const stopCount = r.stopCount
      const stopMin = Math.round(r.stopSeconds / 60)
      const bales = r.totalBales
      return [dato, skift, oeePct, availPct, perfPct, uptimeMin, plannedMin, stopCount, stopMin, bales].join(SEP)
    })
    .join('\n')

  const csv = BOM + header + '\n' + body

  const filename = `produksjonsrapport_${from}_${to}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
