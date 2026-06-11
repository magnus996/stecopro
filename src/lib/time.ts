/**
 * Oslo-timezone shift attribution helpers.
 * All functions derive Oslo local time from UTC via Intl.DateTimeFormat —
 * never compare raw UTC hours to shift boundaries (handles DST automatically).
 */

/** Returns the Oslo local hour (0-23) for a given UTC timestamp. */
export function osloHour(utcMs: number): number {
  return parseInt(
    new Intl.DateTimeFormat('no', {
      timeZone: 'Europe/Oslo',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(utcMs))
  )
}

/** Returns 'day' (07-15), 'evening' (15-22), or null for the given UTC timestamp. */
export function getShiftType(utcMs: number): 'day' | 'evening' | null {
  const h = osloHour(utcMs)
  if (h >= 7 && h < 15) return 'day'
  if (h >= 15 && h < 22) return 'evening'
  return null
}

/**
 * Returns UTC millisecond bounds for the shift window on the given Oslo local date.
 * DST-correct: probes the actual UTC offset for Europe/Oslo on that specific date.
 *
 * @param osloDateStr - Oslo local date in 'YYYY-MM-DD' format
 * @param shiftType   - 'day' (07:00–15:00) or 'evening' (15:00–22:00)
 */
export function getShiftBoundsUtc(
  osloDateStr: string,
  shiftType: 'day' | 'evening'
): { startMs: number; endMs: number } {
  const [year, month, day] = osloDateStr.split('-').map(Number)
  const [startH, endH] = shiftType === 'day' ? [7, 15] : [15, 22]

  // Probe the actual UTC offset for Europe/Oslo on this specific date (handles DST).
  // new Date(year, month-1, day, startH, 0, 0) creates a local-machine Date,
  // but toLocaleString with different TZ options gives us the wall-clock difference.
  const probe = new Date(year, month - 1, day, startH, 0, 0)
  const utcStr = probe.toLocaleString('en-US', { timeZone: 'UTC' })
  const osloStr = probe.toLocaleString('en-US', { timeZone: 'Europe/Oslo' })
  const offsetMs = new Date(osloStr).getTime() - new Date(utcStr).getTime()

  return {
    startMs: Date.UTC(year, month - 1, day, startH, 0, 0) - offsetMs,
    endMs: Date.UTC(year, month - 1, day, endH, 0, 0) - offsetMs,
  }
}
