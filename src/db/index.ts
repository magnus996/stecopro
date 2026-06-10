import 'server-only'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

// For better-sqlite3, each thread/process needs its own Database() connection.
// We always create a fresh connection per module evaluation.
// In dev mode (HMR), the module may re-evaluate, but since better-sqlite3
// connections are cheap, that's acceptable.
const sqlite = new Database(process.env.DB_FILE_NAME ?? './stecopro.db')

export const db = drizzle(sqlite, { schema })
