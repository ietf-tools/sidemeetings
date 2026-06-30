# syntax=docker/dockerfile:1

# ─── Stage 1: build the Nuxt SPA ──────────────────────────────────────────────
# Installs all dependencies (including devDependencies) and runs `npm run build`,
# which `nuxt generate`s the static client into .output/public with apiUrl baked
# to the same-origin "/api".
FROM node:26-slim AS builder
WORKDIR /app

COPY .npmrc package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: runtime (Fastify API + precompiled client) ──────────────────────
FROM node:26-slim AS runtime
LABEL maintainer="IETF Tools Team <tools-discuss@ietf.org>"
ENV NODE_ENV=production
WORKDIR /app

# Production dependencies only — the frontend build toolchain stays in stage 1.
COPY .npmrc package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Backend source + the static client produced by the builder stage. Fastify
# serves .output/public from the same origin as the API (see backend/index.js).
COPY backend ./backend
COPY --from=builder /app/.output/public ./.output/public

USER node
EXPOSE 4000
CMD ["node", "backend/index.js"]
