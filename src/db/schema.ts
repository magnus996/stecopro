import { sqliteTable as table } from 'drizzle-orm/sqlite-core'
import { int, text, real, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// UserRole union — reused across DAL, session, and action code
export type UserRole = 'operator' | 'produksjonsleder' | 'admin' | 'system_admin'

// ---------------------------------------------------------------------------
// tenants — one row per customer
// ---------------------------------------------------------------------------
export const tenants = table('tenants', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  slug: text().notNull(),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex('tenants_slug_idx').on(t.slug),
])

// ---------------------------------------------------------------------------
// users — login accounts; every user belongs to exactly one tenant
// ---------------------------------------------------------------------------
export const users = table('users', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  email: text().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text().notNull(),
  role: text().notNull().$type<UserRole>(),
  active: integer({ mode: 'boolean' }).notNull().default(true),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex('users_email_idx').on(t.email),
  index('users_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// plants — a sorting plant belonging to a tenant
// ---------------------------------------------------------------------------
export const plants = table('plants', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  name: text().notNull(),
  description: text(),
  nominalCapacityTph: real('nominal_capacity_tph'), // tonnes per hour
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  index('plants_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// machines — motors / conveyors / presses inside a plant
// type: 'bunker' | 'conveyor' | 'press' | 'optical_sorter' | ...
// ---------------------------------------------------------------------------
export const machines = table('machines', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  name: text().notNull(),
  type: text().notNull(),
  nominalCurrentA: real('nominal_current_a'),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  index('machines_plant_idx').on(t.plantId),
  index('machines_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// fractions — material quality categories (Deink, OCC, etc.)
// ---------------------------------------------------------------------------
export const fractions = table('fractions', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  name: text().notNull(),
  sortOrder: int('sort_order').notNull().default(0),
}, (t) => [
  index('fractions_plant_idx').on(t.plantId),
  index('fractions_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// shifts — day (07–15) and evening (15–22) shift records
// ---------------------------------------------------------------------------
export const shifts = table('shifts', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  shiftType: text('shift_type').notNull(), // 'day' | 'evening'
  startAt: integer({ mode: 'timestamp' }).notNull(),
  endAt: integer({ mode: 'timestamp' }).notNull(),
}, (t) => [
  index('shifts_plant_time_idx').on(t.plantId, t.startAt),
  index('shifts_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// bale_events — one row per completed bale press cycle
// machineId is nullable: the press that produced the bale (if known)
// ---------------------------------------------------------------------------
export const baleEvents = table('bale_events', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  fractionId: int('fraction_id').notNull().references(() => fractions.id),
  machineId: int('machine_id').references(() => machines.id), // nullable
  occurredAt: integer({ mode: 'timestamp' }).notNull(),
  weightKg: real('weight_kg'),
}, (t) => [
  index('bale_events_plant_time_idx').on(t.plantId, t.occurredAt),
  index('bale_events_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// stop_events — one row per plant stop; endAt null = ongoing
// stopType: 'fault' | 'idle' | 'planned'
// ---------------------------------------------------------------------------
export const stopEvents = table('stop_events', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  startAt: integer({ mode: 'timestamp' }).notNull(),
  endAt: integer({ mode: 'timestamp' }), // null = ongoing
  reason: text(),
  stopType: text('stop_type').notNull(), // 'fault' | 'idle' | 'planned'
}, (t) => [
  index('stop_events_plant_time_idx').on(t.plantId, t.startAt),
  index('stop_events_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// time_series_readings — 1-min resolution motor current draw per machine
// Designed as the write target for a future OPC UA adapter
// ---------------------------------------------------------------------------
export const timeSeriesReadings = table('time_series_readings', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  machineId: int('machine_id').notNull().references(() => machines.id),
  recordedAt: integer({ mode: 'timestamp' }).notNull(),
  currentA: real('current_a'),           // motor current draw in Amps
  runState: integer({ mode: 'boolean' }), // 1 = running, 0 = stopped
}, (t) => [
  index('ts_machine_time_idx').on(t.machineId, t.recordedAt),
  index('ts_tenant_time_idx').on(t.tenantId, t.recordedAt),
])
