export type StopType = 'fault' | 'idle' | 'planned'
export type ShiftType = 'day' | 'evening'

export interface IngestAdapter {
  /** Record one minute of motor current draw for a machine. runState: true=running, false=stopped. */
  reportReading(machineId: number, recordedAt: Date, currentA: number, runState: boolean): void

  /** Plant-level stop begins. Returns the new stop_events row id. reason is an HMI string (Norwegian). */
  reportStop(plantId: number, startAt: Date, reason: string, stopType: StopType): number

  /** Close an open stop_events row by id. */
  reportStopEnded(stopEventId: number, endAt: Date): void

  /** One completed bale. machineId is the press (nullable allowed). weightKg optional. */
  reportBale(plantId: number, fractionId: number, machineId: number | null, occurredAt: Date, weightKg?: number): void

  /** Idempotently upsert a shift row; returns its id. */
  ensureShift(plantId: number, shiftType: ShiftType, startAt: Date, endAt: Date): number

  /** Flush any buffered writes (no-op for adapters that write immediately). */
  flush(): void
}
