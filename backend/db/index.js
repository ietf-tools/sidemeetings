import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'
import * as schema from './schema.js'

const client = postgres(process.env.DATABASE_URL)
export const db = drizzle(client, { schema })

// Apply any pending Drizzle migrations from backend/db/migrations against the
// live connection. Called at startup when AUTO_MIGRATE is enabled.
export async function runMigrations() {
  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
  await migrate(db, { migrationsFolder })
}
