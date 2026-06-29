import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'

/**
 * Build the Authentik (OIDC) authorise URL manually.
 * We do not use @fastify/oauth2's plugin registration here because we need
 * full control over the state parameter for CSRF protection.
 */
export default async function authRoutes(fastify) {
  const {
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_ISSUER_URL,
    OAUTH_CALLBACK_URL,
    FRONTEND_URL,
  } = process.env

  // Normalise issuer URL – ensure trailing slash for URL concatenation.
  function issuerBase() {
    return OAUTH_ISSUER_URL?.endsWith('/') ? OAUTH_ISSUER_URL : `${OAUTH_ISSUER_URL}/`
  }

  // ── GET /api/auth/login ───────────────────────────────────────────────────

  fastify.get('/login', async (request, reply) => {
    const state = randomBytes(16).toString('hex')
    request.session.oauthState = state

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: OAUTH_CLIENT_ID,
      redirect_uri: OAUTH_CALLBACK_URL,
      scope: 'openid email profile',
      state,
    })

    const authorizeUrl = `${issuerBase()}authorize?${params.toString()}`
    return reply.redirect(authorizeUrl)
  })

  // ── GET /api/auth/callback ────────────────────────────────────────────────

  fastify.get('/callback', async (request, reply) => {
    const { code, state, error } = request.query

    if (error) {
      fastify.log.error({ error }, 'OAuth callback error')
      return reply.redirect(`${FRONTEND_URL}/login?error=oauth_error`)
    }

    // Validate CSRF state.
    if (!state || state !== request.session.oauthState) {
      return reply.redirect(`${FRONTEND_URL}/login?error=invalid_state`)
    }
    delete request.session.oauthState

    // Exchange authorisation code for tokens.
    let tokenData
    try {
      const tokenRes = await fetch(`${issuerBase()}token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: OAUTH_CALLBACK_URL,
          client_id: OAUTH_CLIENT_ID,
          client_secret: OAUTH_CLIENT_SECRET,
        }),
      })

      if (!tokenRes.ok) {
        const text = await tokenRes.text()
        fastify.log.error({ status: tokenRes.status, body: text }, 'Token exchange failed')
        return reply.redirect(`${FRONTEND_URL}/login?error=token_exchange_failed`)
      }

      tokenData = await tokenRes.json()
    } catch (err) {
      fastify.log.error(err, 'Token exchange request failed')
      return reply.redirect(`${FRONTEND_URL}/login?error=token_request_failed`)
    }

    const accessToken = tokenData.access_token

    // Fetch userinfo.
    let userInfo
    try {
      const userRes = await fetch(`${issuerBase()}userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!userRes.ok) {
        fastify.log.error({ status: userRes.status }, 'Userinfo fetch failed')
        return reply.redirect(`${FRONTEND_URL}/login?error=userinfo_failed`)
      }

      userInfo = await userRes.json()
    } catch (err) {
      fastify.log.error(err, 'Userinfo request failed')
      return reply.redirect(`${FRONTEND_URL}/login?error=userinfo_request_failed`)
    }

    const { sub, email, name } = userInfo

    if (!email) {
      return reply.redirect(`${FRONTEND_URL}/login?error=no_email`)
    }

    // Upsert user in database by email.
    let user
    try {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1)

      if (existing.length > 0) {
        const updated = await db
          .update(users)
          .set({
            name: name || existing[0].name,
            authUserId: sub,
            updatedAt: new Date(),
          })
          .where(eq(users.email, email.toLowerCase()))
          .returning()
        user = updated[0]
      } else {
        const inserted = await db
          .insert(users)
          .values({
            email: email.toLowerCase(),
            name: name || email,
            authUserId: sub,
          })
          .returning()
        user = inserted[0]
      }
    } catch (err) {
      fastify.log.error(err, 'User upsert failed')
      return reply.redirect(`${FRONTEND_URL}/login?error=db_error`)
    }

    if (!user.isActive) {
      return reply.redirect(`${FRONTEND_URL}/login?error=account_blocked`)
    }

    // Persist session.
    request.session.userId = user.id
    request.session.isAdmin = user.isAdmin
    request.session.email = user.email

    return reply.redirect(`${FRONTEND_URL}/admin`)
  })

  // ── POST /api/auth/logout ─────────────────────────────────────────────────

  fastify.post('/logout', async (request, reply) => {
    await request.session.destroy()
    return { success: true }
  })

  // ── GET /api/auth/me ──────────────────────────────────────────────────────

  fastify.get('/me', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, request.session.userId))
      .limit(1)

    if (!user.length) {
      return reply.unauthorized('User not found')
    }

    const { id, email, name, isAdmin, isActive, createdAt } = user[0]
    return { id, email, name, isAdmin, isActive, createdAt }
  })
}
