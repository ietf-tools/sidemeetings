import { db } from '../db/index.js'
import { users, bookings } from '../db/schema.js'
import { eq, ilike, or, sql, desc, ne } from 'drizzle-orm'

export default async function usersRoutes(fastify) {
  // ── GET /api/users/ ───────────────────────────────────────────────────────
  // All users with booking count; supports ?q= search. Admin only.
  fastify.get('/', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { q } = request.query

    const conditions = []
    if (q) {
      conditions.push(
        or(
          ilike(users.name, `%${q}%`),
          ilike(users.email, `%${q}%`)
        )
      )
    }

    let query = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        authUserId: users.authUserId,
        isActive: users.isActive,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        bookingCount: sql`(SELECT COUNT(*) FROM bookings WHERE bookings.organizer_id = ${users.id})`.mapWith(Number),
      })
      .from(users)
      .orderBy(users.name)

    if (conditions.length) {
      query = query.where(or(...conditions))
    }

    return query
  })

  // ── POST /api/users/ ──────────────────────────────────────────────────────
  // Create a user. Admin only.
  fastify.post('/', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { name, email, isAdmin } = request.body

    if (!name || !email) {
      return reply.badRequest('name and email are required')
    }

    // Check for duplicate email.
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (existing.length) {
      return reply.conflict('A user with this email already exists')
    }

    const [user] = await db
      .insert(users)
      .values({
        name,
        email: email.toLowerCase(),
        isAdmin: isAdmin ?? false,
      })
      .returning()

    return reply.code(201).send(user)
  })

  // ── GET /api/users/:id ────────────────────────────────────────────────────
  // Single user. Admin only.
  fastify.get('/:id', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { id } = request.params

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!user) {
      return reply.notFound('User not found')
    }

    return user
  })

  // ── PUT /api/users/:id ────────────────────────────────────────────────────
  // Update a user. Admin only.
  fastify.put('/:id', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { id } = request.params

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!existing.length) {
      return reply.notFound('User not found')
    }

    const { name, email, isAdmin } = request.body

    const updateData = { updatedAt: new Date() }

    if (name !== undefined) {
      updateData.name = name
    }
    if (email !== undefined) {
      // Ensure no duplicate email if changing it.
      const dup = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1)

      if (dup.length && dup[0].id !== id) {
        return reply.conflict('A user with this email already exists')
      }
      updateData.email = email.toLowerCase()
    }
    if (isAdmin !== undefined) {
      updateData.isAdmin = isAdmin
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning()

    return updated
  })

  // ── DELETE /api/users/:id ─────────────────────────────────────────────────
  // Delete a user. Admin only. Cannot delete self.
  fastify.delete('/:id', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { id } = request.params
    const selfId = request.session.userId

    if (id === selfId) {
      return reply.badRequest('You cannot delete your own account')
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!existing.length) {
      return reply.notFound('User not found')
    }

    await db.delete(users).where(eq(users.id, id))

    return { success: true }
  })

  // ── PATCH /api/users/:id/block ────────────────────────────────────────────
  // Block a user (isActive=false). Admin only. Cannot block self.
  fastify.patch('/:id/block', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { id } = request.params
    const selfId = request.session.userId

    if (id === selfId) {
      return reply.badRequest('You cannot block your own account')
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!existing.length) {
      return reply.notFound('User not found')
    }

    const [updated] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    return updated
  })

  // ── PATCH /api/users/:id/unblock ──────────────────────────────────────────
  // Unblock a user (isActive=true). Admin only.
  fastify.patch('/:id/unblock', {
    preHandler: fastify.authenticateAdmin,
  }, async (request, reply) => {
    const { id } = request.params

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!existing.length) {
      return reply.notFound('User not found')
    }

    const [updated] = await db
      .update(users)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    return updated
  })
}
