import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const SETTINGS_ID = 1

const DEFAULT_SETTINGS = {
  id: SETTINGS_ID,
  fromEmail: null,
  replyTo: null,
  approvers: []
}

export default async function settingsRoutes(fastify) {
  // ── GET /api/settings/ ────────────────────────────────────────────────────
  // Get settings row (id=1), creating defaults if missing. Admin only.
  fastify.get(
    '/',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (_request, _reply) => {
      const [row] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1)

      if (!row) {
        // Insert defaults and return them.
        const [created] = await db.insert(settings).values(DEFAULT_SETTINGS).returning()
        return created
      }

      return row
    }
  )

  // ── PUT /api/settings/ ────────────────────────────────────────────────────
  // Upsert settings. Admin only.
  fastify.put(
    '/',
    {
      preHandler: fastify.authenticateAdmin
    },
    async (request, _reply) => {
      const { fromEmail, replyTo, approvers } = request.body

      const upsertData = {
        id: SETTINGS_ID,
        updatedAt: new Date()
      }

      if (fromEmail !== undefined) {
        upsertData.fromEmail = fromEmail || null
      }
      if (replyTo !== undefined) {
        upsertData.replyTo = replyTo || null
      }
      if (approvers !== undefined) {
        upsertData.approvers = Array.isArray(approvers) ? approvers : []
      }

      const [upserted] = await db
        .insert(settings)
        .values({ ...DEFAULT_SETTINGS, ...upsertData })
        .onConflictDoUpdate({
          target: settings.id,
          set: upsertData
        })
        .returning()

      return upserted
    }
  )
}
