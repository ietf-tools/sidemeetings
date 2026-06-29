# IETF Side Meetings — Setup Guide

## Architecture

```
repo/
├── backend/    Node.js 26 + Fastify + Drizzle + PostgreSQL 18
└── frontend/   Nuxt 4 SPA + Tailwind CSS
```

## Prerequisites

- Node.js ≥ 26
- PostgreSQL 18
- An Authentik instance with an OAuth2 application configured

## Backend

```bash
cd backend
npm install

# Copy and fill in env vars
cp .env.example .env

# Push schema to database (development)
npm run db:push

# Start dev server (port 4000)
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random string ≥ 32 chars for cookie signing |
| `FRONTEND_URL` | Nuxt app origin (e.g. `http://localhost:3000`) |
| `PORT` | Port to listen on (default: `4000`) |
| `OAUTH_CLIENT_ID` | Authentik OAuth2 client ID |
| `OAUTH_CLIENT_SECRET` | Authentik OAuth2 client secret |
| `OAUTH_ISSUER_URL` | Authentik application URL (e.g. `https://auth.example.com/application/o/sidemeetings/`) |
| `OAUTH_CALLBACK_URL` | OAuth2 redirect URI (e.g. `http://localhost:4000/api/auth/callback`) |

### Authentik configuration

1. In Authentik admin, create a new **OAuth2/OpenID Provider**.
2. Set the redirect URI to `http://localhost:4000/api/auth/callback` (or your production URL).
3. Copy the **Client ID** and **Client Secret** into `.env`.
4. Set `OAUTH_ISSUER_URL` to the provider's **OpenID Configuration URL** base (e.g. `https://auth.example.com/application/o/sidemeetings/`).

The auth flow uses standard OIDC — the backend manually builds the authorize URL, exchanges the code, and fetches userinfo.

### API overview

All routes are under `/api/`.

| Prefix | Description |
|---|---|
| `/api/auth` | Login, callback, logout, me |
| `/api/dashboard` | Dashboard stats (admin) |
| `/api/meetings` | Meeting CRUD (admin) |
| `/api/meetings/:id/rooms` | Rooms per meeting (admin) |
| `/api/rooms/:id` | Room CRUD + slot calculation (admin) |
| `/api/meetings/:id/bookings` | Bookings per meeting (admin) |
| `/api/bookings/:id` | Booking detail + state changes |
| `/api/users` | User management (admin) |
| `/api/settings` | Global settings (admin) |
| `/api/public/*` | Authenticated non-admin endpoints (booking wizard) |

### Database schema

Six tables: `meetings`, `rooms`, `users`, `bookings`, `settings`, `activity_log`.

Key relationships:
- Rooms belong to a meeting (cascade delete)
- Bookings belong to a meeting + room + organizer (cascade delete on meeting/room)
- `bookings.ends_at` is a generated column: `starts_at + duration * interval '1 minute'`
- `users.is_active = false` means the user is blocked

## Frontend

```bash
cd frontend
npm install

# Copy and configure
cp .env.example .env

# Start dev server (port 3000)
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `NUXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:4000/api`) |

### Routes

| Path | Description |
|---|---|
| `/login` | Sign in page |
| `/auth/callback` | OAuth2 callback handler |
| `/admin` | Dashboard |
| `/admin/bookings` | Bookings list |
| `/admin/bookings/:id` | Booking detail & edit |
| `/admin/rooms` | Rooms & schedule grid |
| `/admin/meetings` | Meetings management |
| `/admin/users` | User management |
| `/admin/settings` | Email & notification settings |
| `/request` | 4-step booking wizard (for end users) |

### Design system

Dark "Midnight" theme. Primary font: **Hanken Grotesk**. Mono font: **IBM Plex Mono**.

Accent color: `#2dd4bf` (teal). Loaded via Tailwind custom colors (`accent`, `ok`, `warn`, `bad`, `surface`, `sidebar-*`, etc.).

Temporal API is polyfilled for browsers via `temporal-polyfill`.
