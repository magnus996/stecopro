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

// ---------------------------------------------------------------------------
// bale_shipments — outbound shipment records per fraction
// Stock per fraction = produced bale_events − shipped baleCount
// ---------------------------------------------------------------------------
export const baleShipments = table('bale_shipments', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  fractionId: int('fraction_id').notNull().references(() => fractions.id),
  baleCount: int('bale_count').notNull(),
  shippedAt: integer({ mode: 'timestamp' }).notNull(),
  note: text(),
  createdById: int('created_by_id').references(() => users.id),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  index('bale_shipments_plant_time_idx').on(t.plantId, t.shippedAt),
  index('bale_shipments_tenant_idx').on(t.tenantId),
  index('bale_shipments_fraction_idx').on(t.fractionId),
])

// ---------------------------------------------------------------------------
// Phase 7: PWA operator tables
// ---------------------------------------------------------------------------

// push_subscriptions — Web Push subscription registrations per user/device
// endpoint is UNIQUE (upsert on re-subscribe from same device)
// ---------------------------------------------------------------------------
export const pushSubscriptions = table('push_subscriptions', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  userId: int('user_id').notNull().references(() => users.id),
  endpoint: text().notNull(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  userAgent: text('user_agent'),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex('push_subscriptions_endpoint_idx').on(t.endpoint),
  index('push_subscriptions_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// photos — uploaded operator photos; files stored under ./uploads/{tenantId}/
// Served only via authenticated GET /api/photos/[id] with tenant check
// ---------------------------------------------------------------------------
export const photos = table('photos', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  userId: int('user_id').notNull().references(() => users.id),
  filePath: text('file_path').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: int('size_bytes').notNull(),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  index('photos_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// stop_acknowledgements — idempotent ack per user+stop (REPT-01)
// UNIQUE(stopEventId, userId) enforces one ack per user per stop
// ---------------------------------------------------------------------------
export const stopAcknowledgements = table('stop_acknowledgements', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  stopEventId: int('stop_event_id').notNull().references(() => stopEvents.id),
  userId: int('user_id').notNull().references(() => users.id),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex('stop_ack_event_user_idx').on(t.stopEventId, t.userId),
  index('stop_ack_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// stop_comments — operator comments and/or stop reason corrections (REPT-02)
// comment OR correctedReason required — enforced by Zod at API layer (07-04)
// photoId is nullable FK to photos (photos declared above)
// ---------------------------------------------------------------------------
export const stopComments = table('stop_comments', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  stopEventId: int('stop_event_id').notNull().references(() => stopEvents.id),
  userId: int('user_id').notNull().references(() => users.id),
  comment: text(),
  correctedReason: text('corrected_reason'),
  photoId: int('photo_id').references(() => photos.id),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  index('stop_comments_event_idx').on(t.stopEventId),
  index('stop_comments_tenant_idx').on(t.tenantId),
])

// ---------------------------------------------------------------------------
// shift_notes — free-text shift notes per plant (REPT-03)
// No shiftId FK — shift derived from plantId+createdAt via src/lib/time.ts
// photoId is nullable FK to photos
// ---------------------------------------------------------------------------
export const shiftNotes = table('shift_notes', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  userId: int('user_id').notNull().references(() => users.id),
  content: text().notNull(),
  photoId: int('photo_id').references(() => photos.id),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  index('shift_notes_plant_time_idx').on(t.plantId, t.createdAt),
  index('shift_notes_tenant_idx').on(t.tenantId),
])
