import 'server-only'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof drizzle<typeof schema>> }

export const db =
  globalForDb.db ?? drizzle(new Database(process.env.DB_FILE_NAME ?? './stecopro.db'), { schema })

if (process.env.NODE_ENV !== 'production') globalForDb.db = db
