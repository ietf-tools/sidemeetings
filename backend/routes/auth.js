import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'

/**
 * Drive the OIDC flow manually.
 * We do not use @fastify/oauth2's plugin registration here because we need
 * full control over the state parameter for CSRF protection.
 */
export default async function authRoutes(fastify) {
  // Primary provider (IETF Account).
  registerOidcRoutes(fastify, {
    name: 'ietf',
    loginPath: '/login',
    callbackPath: '/callback',
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    issuerUrl: process.env.OAUTH_ISSUER_URL,
    callbackUrl: process.env.OAUTH_CALLBACK_URL,
    authorizationUrl: process.env.OAUTH_AUTHORIZATION_URL,
    tokenUrl: process.env.OAUTH_TOKEN_URL,
    userinfoUrl: process.env.OAUTH_USERINFO_URL,
    linkAuthUserId: true
  })

  // TEMPORARY: secondary provider (Datatracker) during the OIDC migration.
  // Remove this block, the DATATRACKER_OAUTH_* env vars and the Datatracker button
  // on frontend/pages/login.vue once everyone has moved to IETF Account.
  registerOidcRoutes(fastify, {
    name: 'datatracker',
    loginPath: '/login2',
    callbackPath: '/callback2',
    clientId: process.env.DATATRACKER_OAUTH_CLIENT_ID,
    clientSecret: process.env.DATATRACKER_OAUTH_CLIENT_SECRET,
    issuerUrl: process.env.DATATRACKER_OAUTH_ISSUER_URL,
    callbackUrl: process.env.DATATRACKER_OAUTH_CALLBACK_URL,
    authorizationUrl: process.env.DATATRACKER_OAUTH_AUTHORIZATION_URL,
    tokenUrl: process.env.DATATRACKER_OAUTH_TOKEN_URL,
    userinfoUrl: process.env.DATATRACKER_OAUTH_USERINFO_URL,
    // Its `sub` differs from IETF Account's; don't overwrite the stored one.
    linkAuthUserId: false
  })

  // ── POST /api/auth/logout ─────────────────────────────────────────────────

  fastify.post('/logout', async (request, reply) => {
    await request.session.destroy()
    return { success: true }
  })

  // ── GET /api/auth/me ──────────────────────────────────────────────────────

  fastify.get(
    '/me',
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
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
    }
  )
}

/**
 * Register the login + callback routes for one OIDC provider. Users are
 * matched by email, so the same account can sign in through any provider.
 */
function registerOidcRoutes(fastify, config) {
  const {
    name,
    loginPath,
    callbackPath,
    clientId,
    clientSecret,
    issuerUrl,
    callbackUrl,
    authorizationUrl,
    tokenUrl,
    userinfoUrl,
    linkAuthUserId
  } = config
  const { FRONTEND_URL } = process.env

  // ─── Endpoint resolution ───────────────────────────────────────────────
  // The endpoints are NOT under the issuer path: Authentik's issuer is
  // .../application/o/<app>/ while authorize/token/userinfo live at
  // .../application/o/authorize/ etc. So we read them from the provider's
  // discovery document instead of concatenating onto the issuer. Individual
  // *_URL variables override discovery when set (all three set skips
  // the discovery request entirely).

  // Normalise issuer URL – ensure trailing slash for URL concatenation.
  function issuerBase() {
    return issuerUrl?.endsWith('/') ? issuerUrl : `${issuerUrl}/`
  }

  const overrides = {
    authorization_endpoint: authorizationUrl,
    token_endpoint: tokenUrl,
    userinfo_endpoint: userinfoUrl
  }

  // Cached as a promise so concurrent logins share one discovery request;
  // cleared on failure so a transient outage doesn't poison the cache.
  let discovery = null

  async function fetchDiscovery() {
    const url = `${issuerBase()}.well-known/openid-configuration`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`OIDC discovery failed: ${res.status} ${url}`)
    }
    return res.json()
  }

  /**
   * Resolve one OIDC endpoint, preferring the matching *_URL override.
   * @param {'authorization_endpoint'|'token_endpoint'|'userinfo_endpoint'} name
   * @returns {Promise<string>}
   */
  async function endpoint(name) {
    if (overrides[name]) return overrides[name]

    if (!discovery) {
      discovery = fetchDiscovery().catch((err) => {
        discovery = null
        throw err
      })
    }

    const doc = await discovery
    const value = doc[name]
    if (!value) {
      throw new Error(`OIDC discovery document has no ${name}`)
    }
    return value
  }

  // ── GET /api/auth/<loginPath> ─────────────────────────────────────────────

  fastify.get(loginPath, async (request, reply) => {
    let authorizationEndpoint
    try {
      authorizationEndpoint = await endpoint('authorization_endpoint')
    } catch (err) {
      fastify.log.error(err, `OIDC discovery failed (${name})`)
      return reply.redirect(`${FRONTEND_URL}/login?error=discovery_failed`)
    }

    const state = randomBytes(16).toString('hex')
    request.session.oauthState = `${name}:${state}`

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'openid email profile',
      state
    })

    const authorizeUrl = `${authorizationEndpoint}?${params.toString()}`
    return reply.redirect(authorizeUrl)
  })

  // ── GET /api/auth/<callbackPath> ──────────────────────────────────────────

  fastify.get(callbackPath, async (request, reply) => {
    const { code, state, error } = request.query

    if (error) {
      fastify.log.error({ error, provider: name }, 'OAuth callback error')
      return reply.redirect(`${FRONTEND_URL}/login?error=oauth_error`)
    }

    // Validate CSRF state.
    if (!state || `${name}:${state}` !== request.session.oauthState) {
      return reply.redirect(`${FRONTEND_URL}/login?error=invalid_state`)
    }
    delete request.session.oauthState

    // Exchange authorisation code for tokens.
    let tokenData
    try {
      const tokenRes = await fetch(await endpoint('token_endpoint'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: callbackUrl,
          client_id: clientId,
          client_secret: clientSecret
        })
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
      const userRes = await fetch(await endpoint('userinfo_endpoint'), {
        headers: { Authorization: `Bearer ${accessToken}` }
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

    const { sub, email, name: userName } = userInfo

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
            name: userName || existing[0].name,
            ...(linkAuthUserId && { authUserId: sub }),
            updatedAt: new Date()
          })
          .where(eq(users.email, email.toLowerCase()))
          .returning()
        user = updated[0]
      } else {
        const inserted = await db
          .insert(users)
          .values({
            email: email.toLowerCase(),
            name: userName || email,
            authUserId: linkAuthUserId ? sub : null
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
}
