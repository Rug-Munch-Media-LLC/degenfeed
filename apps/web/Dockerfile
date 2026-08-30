# syntax=docker/dockerfile:1
# DegenFeed Web — Next.js 16 + pnpm monorepo
# Multi-stage: deps → builder → runner
# Target: production standalone output

# Stage 1: Base — pnpm + node
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    corepack prepare pnpm@11.17.0 --activate

# Stage 2: Dependencies — install all workspace packages
FROM base AS deps
WORKDIR /app

# Copy dependency manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

# Install packages pinned to the committed lockfile for reproducible builds.
# CI installs with --frozen-lockfile; the Docker image must match exactly so
# `next build` here reproduces what CI validated.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build native deps (sharp, esbuild, etc. — listed in pnpm-workspace allowBuilds)
RUN pnpm rebuild

# Stage 3: Builder — compile the Next.js app and all workspace deps
FROM deps AS builder

# Build args for NEXT_PUBLIC_* vars (inlined at build time by Next.js)
ARG NEXT_PUBLIC_ADMIN_WALLETS
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
# API proxy target is baked into rewrites() at BUILD time — must be set here.
# The bridge runs as a HOST process on :8787, so containers reach it via
# host.docker.internal (the old docker-DNS host http://degenfeed-api:3001 is
# dead). On Linux hosts the runtime must add the gateway mapping:
#   extra_hosts: ["host.docker.internal:host-gateway"]
# ENV passes the ARG through to `next build` so the env var reaches the app.
ARG API_PROXY_TARGET=http://host.docker.internal:8787
ENV API_PROXY_TARGET=$API_PROXY_TARGET

WORKDIR /app

# node_modules (with pnpm symlinks) AND workspace package sources already
# present from deps stage. DO NOT bulk-copy apps/web/ or packages/ because
# Docker resolves their symlinks, breaking pnpm's internal linking.
# Copy only web app source files selectively.

# Re-affirm workspace configs (pnpm needs these to resolve workspace references)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy only source code & configs (NOT node_modules, .next, .turbo)
COPY apps/web/src ./apps/web/src
COPY apps/web/package.json \
     apps/web/tsconfig.json \
     apps/web/next-env.d.ts \
     apps/web/next.config.mjs \
     apps/web/postcss.config.mjs \
     apps/web/tailwind.config.ts \
     ./apps/web/
COPY apps/web/public ./apps/web/public

# Build the web app directly via pnpm (avoid root package's turbo run build recursion)
# TypeScript is authoritative: type errors fail the image build (ignoreBuildErrors: false).
WORKDIR /app/apps/web
RUN pnpm run build
WORKDIR /app

# Stage 4: Runner — minimal production image
FROM base AS runner
WORKDIR /app

# Create non-root user (nextjs uid 1001)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/web/.next/standalone ./

# Copy static assets (Next.js separates these from standalone)
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/web/.next/static ./apps/web/.next/static

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/web/public ./apps/web/public

# Copy startup entrypoint — pre-warms feed caches so the first user request
# after a container restart is fast (avoids ~20s bridge provider aggregation)
COPY --chown=nextjs:nodejs \
    apps/web/docker-entrypoint.sh ./apps/web/docker-entrypoint.sh
RUN chmod +x apps/web/docker-entrypoint.sh

# Switch to unprivileged user
USER nextjs

# Environment
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["wget", "-qO-", "http://127.0.0.1:3000/api/health"]

CMD ["sh", "apps/web/docker-entrypoint.sh"]
