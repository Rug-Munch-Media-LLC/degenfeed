# syntax=docker/dockerfile:1
# DegenFeed Web — Next.js 16 + pnpm monorepo
# Multi-stage: deps → builder → runner
# Target: production standalone output

# Stage 1: Base — pnpm + node
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    corepack prepare pnpm@11.7.0 --activate

# Stage 2: Dependencies — install all workspace packages
FROM base AS deps
WORKDIR /app

# Copy dependency manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

# Install packages (lockfile may be ahead of package.json in active dev)
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Build native deps (sharp, esbuild, etc. — listed in pnpm-workspace allowBuilds)
RUN pnpm rebuild

# Stage 3: Builder — compile the Next.js app and all workspace deps
FROM deps AS builder
WORKDIR /app

# Copy source over installed dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/web/ ./apps/web/
COPY packages/ ./packages/

# Build the web app (next build with standalone output)
RUN pnpm --filter=degenfeed-web build

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

# Switch to unprivileged user
USER nextjs

# Environment
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "apps/web/server.js"]
