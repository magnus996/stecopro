import { z } from 'zod'
import type { UserRole } from '@/db/schema'

// Re-export UserRole for use across auth modules
export type { UserRole }

// Session payload stored in the JWT cookie
export type SessionPayload = {
  userId: number
  tenantId: number
  role: UserRole
  expiresAt: Date
}

// Zod schema for login form validation
export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})
