/**
 * Tuning constants for the simulator engine.
 * All stop reasons are Norwegian HMI-style strings.
 */

// ---------------------------------------------------------------------------
// Stop reasons (Norwegian)
// ---------------------------------------------------------------------------

export const FAULT_REASONS = [
  'Driftsstans transportbånd',
  'Papirbrudd i presse',
  'Nødstopp aktivert',
  'Overbelastning motor',
  'Fasevakt utløst',
  'Floke i sorteringsmaskin',
  'Materialopphopning',
  'Hydraulikkfeil presse',
] as const

export const IDLE_REASONS = [
  'Bunker tom', // bunker-empty: always stopType='idle'
] as const

export const PLANNED_REASONS = [
  'Planlagt vedlikehold',
  'Skiftbytte',
  'Rengjøring',
] as const

// ---------------------------------------------------------------------------
// Stop duration distribution
// 8-10 stops per shift × weighted avg ~5-6 min ≈ 48 stop-minutes / 480 shift-minutes = 10% downtime
// ---------------------------------------------------------------------------

/** Stop duration bands in minutes: [min, max] */
export const STOP_DURATION_BANDS: [number, number][] = [
  [2, 5],    // 40% — minor jams, quick resets (avg 3.5 min)
  [5, 10],   // 30% — conveyor faults, minor adjustments (avg 7.5 min)
  [10, 20],  // 20% — press faults, hydraulic issues (avg 15 min)
  [20, 40],  // 10% — major faults, planned maintenance (avg 30 min)
]

/** Cumulative probability thresholds matching the bands above */
export const STOP_DURATION_WEIGHTS = [0.40, 0.30, 0.20, 0.10] as const

/** Per-minute probability of a fault/planned stop starting (tuned for ~90% availability).
 *  Weighted-average stop duration:
 *    0.40×3.5 + 0.30×7.5 + 0.20×15 + 0.10×30 = 1.4+2.25+3.0+3.0 = 9.65 min avg
 *  Bunker-empty: ~3 events × avg 7.5 min = ~22 min (4.6% downtime)
 *  Remaining downtime budget: 48-22 = 26 min from fault/planned stops
 *  Stops needed: 26 / 9.65 ≈ 2.7 stops → P = 2.7 / 480 ≈ 0.0056
 *  Use 0.0056 to hit ~90% availability with seed 42.
 */
export const P_STOP_PER_MINUTE = 0.0056

/** Bunker-empty parameters.
 * A large dosing bunker (>10 m³) at 12 t/h throughput takes ~2 hours to empty.
 * At full capacity it takes 120-150 min from a refill to run empty.
 * Each bunker-empty event lasts 3-12 min while the loader refills.
 * → Roughly 3-4 bunker-empty events per 8h shift, contributing ~5-6% idle downtime.
 */
export const BUNKER_REFILL_PERIOD_MIN = 120  // minutes from last refill to empty
export const BUNKER_EMPTY_MIN_MIN = 3        // min idle duration when empty
export const BUNKER_EMPTY_MAX_MIN = 12       // max idle duration when empty

// ---------------------------------------------------------------------------
// Motor current ranges (amperes)
// Bunker: 11 kW dosing motor drawing 10-15 A loaded / 4-6 A running empty.
// Empty-detection threshold ~8 A (sits between empty band 4-6 A and loaded band 10-15 A).
// ---------------------------------------------------------------------------

export const CURRENT_BUNKER_FULL_MIN = 10     // A (loaded)
export const CURRENT_BUNKER_FULL_MAX = 15     // A (loaded)
export const CURRENT_BUNKER_EMPTY_MIN = 4     // A (running but depleted)
export const CURRENT_BUNKER_EMPTY_MAX = 6     // A (running but depleted)
export const CURRENT_CONVEYOR_RUN_MIN = 25    // A
export const CURRENT_CONVEYOR_RUN_MAX = 35    // A
export const CURRENT_PRESS_PEAK_MIN = 60      // A
export const CURRENT_PRESS_PEAK_MAX = 90      // A
export const CURRENT_PRESS_IDLE_MIN = 15      // A
export const CURRENT_PRESS_IDLE_MAX = 20      // A

// ---------------------------------------------------------------------------
// Bale rates per fraction per 8h shift
// Total: 80 bales/8h-shift (~10 bales/h).
// Weight mix: 50% deink / 10% OCC / 8% tetra / 32% miks.
// ---------------------------------------------------------------------------

export const BALE_RATES_PER_SHIFT: Record<string, number> = {
  deink: 40,
  occ: 8,
  tetra: 6,
  miks: 26,
}

// ---------------------------------------------------------------------------
// Quality target
// ---------------------------------------------------------------------------

export const TARGET_AVAILABILITY = 0.9
