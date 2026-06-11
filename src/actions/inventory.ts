'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { verifySession, getStockByFraction } from '@/lib/dal'
import { db } from '@/db'
import { baleShipments } from '@/db/schema'

const ShipmentSchema = z.object({
  plantId: z.coerce.number().int().positive(),
  fractionId: z.coerce.number().int().positive(),
  baleCount: z.coerce.number().int().positive('Antall må være et positivt heltall'),
  note: z.string().max(500).optional(),
})

export type RegisterShipmentState =
  | { success: true } | { errors: Record<string, string[]> } | undefined

export async function registerShipment(
  prevState: RegisterShipmentState,
  formData: FormData,
): Promise<RegisterShipmentState> {
  const session = await verifySession()  // all authenticated roles may register
  const parsed = ShipmentSchema.safeParse({
    plantId: formData.get('plantId'),
    fractionId: formData.get('fractionId'),
    baleCount: formData.get('baleCount'),
    note: formData.get('note') || undefined,
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  const { plantId, fractionId, baleCount, note } = parsed.data

  // Stock guard — cannot ship more than in stock (getStockByFraction is tenant-scoped)
  const stock = await getStockByFraction(plantId)
  const row = stock.find(s => s.fractionId === fractionId)
  if (!row) return { errors: { fractionId: ['Ukjent fraksjon'] } }
  if (baleCount > row.stock) {
    return { errors: { baleCount: [`Kan ikke sende ${baleCount} baler — kun ${row.stock} på lager`] } }
  }

  await db.insert(baleShipments).values({
    tenantId: session.tenantId,
    plantId,
    fractionId,
    baleCount,
    shippedAt: new Date(),
    note: note ?? null,
    createdById: session.userId,
  })
  revalidatePath('/inventory')
  revalidatePath('/dashboard')
  return { success: true }
}
