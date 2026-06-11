import 'server-only'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

// For better-sqlite3, each thread/process needs its own Database() connection.
// We always create a fresh connection per module evaluation.
// In dev mode (HMR), the module may re-evaluate, but since better-sqlite3
// connections are cheap, that's acceptable.
const sqlite = new Database(process.env.DB_FILE_NAME ?? './stecopro.db')

// WAL mode: allows concurrent reads during writes (needed when live simulator writes
// while dashboard reads). busy_timeout prevents SQLITE_BUSY on contention.
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')
sqlite.pragma('synchronous = NORMAL')

export const db = drizzle(sqlite, { schema })
