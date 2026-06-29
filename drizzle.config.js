import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

console.log(process.env.DATABASE_URL)

export default defineConfig({
  dialect: 'postgresql',
  schema: './backend/db/schema.js',
  out: './backend/db/migrations',
  dbCredentials: { url: 'postgresql://sidemeetings:abcd1234@db:5432/sidemeetings' }
})
