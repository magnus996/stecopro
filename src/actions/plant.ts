'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { db } from '@/db'
import { plants, fractions, machines } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const PlantFieldsSchema = z.object({
  plantId: z.coerce.number().int().positive(),
  name: z.string().min(1, 'Navn er påkrevd'),
  description: z.string().optional(),
  nominalCapacityTph: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().positive('Kapasitet må være positiv').nullable().optional(),
  ),
})

// ---------------------------------------------------------------------------
// updatePlantConfig — role-gated, tenant-scoped plant/fraction/machine edit
// ---------------------------------------------------------------------------

export type UpdatePlantConfigState =
  | { success: true }
  | { errors: Record<string, string[]> }
  | undefined

export async function updatePlantConfig(
  prevState: UpdatePlantConfigState,
  formData: FormData,
): Promise<UpdatePlantConfigState> {
  // 1. Verify session and ROLE GATE: operators are blocked
  const session = await verifySession()
  if (session.role === 'operator') {
    return { errors: { _: ['Ikke tilgang'] } }
  }

  // 2. Parse and validate plant fields
  const parsed = PlantFieldsSchema.safeParse({
    plantId: formData.get('plantId'),
    name: formData.get('name'),
    description: formData.get('description'),
    nominalCapacityTph: formData.get('nominalCapacityTph'),
  })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }
  const { plantId, name, description, nominalCapacityTph } = parsed.data

  // 3. UPDATE plants — scoped to session.tenantId (security boundary per RESEARCH Pitfall 1)
  await db
    .update(plants)
    .set({
      name,
      description: description ?? null,
      nominalCapacityTph: nominalCapacityTph ?? null,
    })
    .where(
      and(
        eq(plants.id, plantId),
        eq(plants.tenantId, session.tenantId),
      )
    )

  // 4. UPDATE fractions (parallel arrays from form)
  const fractionIds = formData.getAll('fractionId')
  const fractionNames = formData.getAll('fractionName')
  const fractionSortOrders = formData.getAll('fractionSortOrder')

  for (let i = 0; i < fractionIds.length; i++) {
    const fId = Number(fractionIds[i])
    const fName = String(fractionNames[i] ?? '').trim()
    const fSortOrder = Number(fractionSortOrders[i] ?? 0)
    if (!fId || !fName) continue  // skip rows with empty name
    await db
      .update(fractions)
      .set({ name: fName, sortOrder: fSortOrder })
      .where(
        and(
          eq(fractions.id, fId),
          eq(fractions.tenantId, session.tenantId),
        )
      )
  }

  // 5. UPDATE machines — do NOT touch machine.type (used by dashboard queries)
  const machineIds = formData.getAll('machineId')
  const machineNames = formData.getAll('machineName')
  const machineCurrentAs = formData.getAll('machineCurrentA')

  for (let i = 0; i < machineIds.length; i++) {
    const mId = Number(machineIds[i])
    const mName = String(machineNames[i] ?? '').trim()
    const mCurrentA = machineCurrentAs[i] === '' || machineCurrentAs[i] === null
      ? null
      : Number(machineCurrentAs[i])
    if (!mId) continue
    await db
      .update(machines)
      .set({
        name: mName || undefined,
        nominalCurrentA: mCurrentA,
      })
      .where(
        and(
          eq(machines.id, mId),
          eq(machines.tenantId, session.tenantId),
        )
      )
  }

  // 6. Revalidate and return success
  revalidatePath('/admin/plant')
  return { success: true }
}
