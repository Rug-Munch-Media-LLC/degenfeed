# syntax=docker/dockerfile:1
# DegenFeed Self-Hosted — Single-creator Docker image
# Multi-stage: base → deps → builder → runner
# Optimized for solo creator deployments on any VPS.
# One `docker compose up` runs everything.

# ── Stage 1: Base — pnpm + Node.js ──
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    corepack prepare pnpm@11.7.0 --activate

# ── Stage 2: Dependencies ──
FROM base AS deps
WORKDIR /app

# Copy dependency manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

# Install — allow unfrozen for self-hosted builds where lockfile may drift
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Rebuild native binaries
RUN pnpm rebuild

# ── Stage 3: Builder ──
FROM deps AS builder

# Build args — defaults for self-hosted; override at build time
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_API_URL

WORKDIR /app

# Re-affirm workspace configs
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy source code selectively (NOT node_modules, .next, .turbo)
COPY apps/web/src ./apps/web/src
COPY apps/web/package.json \
     apps/web/tsconfig.json \
     apps/web/next-env.d.ts \
     apps/web/next.config.mjs \
     apps/web/postcss.config.mjs \
     apps/web/tailwind.config.ts \
     ./apps/web/
COPY apps/web/public ./apps/web/public

# Build the web app
WORKDIR /app/apps/web
RUN pnpm run build
WORKDIR /app

# ── Stage 4: Runner ──
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 degenfeed && \
    adduser --system --uid 1001 degenfeed

# Copy standalone build output
COPY --from=builder --chown=degenfeed:degenfeed \
    /app/apps/web/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=degenfeed:degenfeed \
    /app/apps/web/.next/static ./apps/web/.next/static

# Copy public assets
COPY --from=builder --chown=degenfeed:degenfeed \
    /app/apps/web/public ./apps/web/public

# Switch to unprivileged user
USER degenfeed

# Environment
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["wget", "-qO-", "http://127.0.0.1:3000/api/health"]

CMD ["node", "apps/web/server.js"]
