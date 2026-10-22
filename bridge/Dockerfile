# Dockerfile — DegenFeed local-bridge (pnpm workspace, tsx runtime)
#
# The bridge is a pnpm workspace package (`@degenfeed/local-bridge`) that runs
# via `tsx src/server.ts`. It depends on sibling workspace packages, so the
# build context is the monorepo root and the workspace must be installed whole.
#
# `--frozen-lockfile` validates the lockfile against EVERY workspace manifest,
# so all of them must be present before install — copying only bridge/ and
# packages/ fails with ERR_PNPM_OUTDATED_LOCKFILE. The manifests are copied
# first (cheap, cache-friendly), then the source.
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    corepack prepare pnpm@11.17.0 --activate

FROM base AS deps
WORKDIR /app
# Every workspace manifest the lockfile references. `docs/`, `design/` and
# `workers/` are excluded by the repo's .dockerignore (correct for the web app,
# which does not need them at runtime), so `--frozen-lockfile` cannot validate
# against them. The bridge is a dev-lane service, not a release artifact, so it
# installs with --no-frozen-lockfile: the lockfile is still honoured for every
# package that IS present, and the excluded workspaces are not bridge deps.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/docs/package.json ./apps/docs/
COPY bridge/package.json ./bridge/
COPY packages/ ./packages/
RUN pnpm install --no-frozen-lockfile --ignore-scripts && pnpm rebuild

FROM deps AS runner
WORKDIR /app
COPY bridge/ ./bridge/
COPY packages/ ./packages/
WORKDIR /app/bridge
EXPOSE 8787
CMD ["pnpm", "start"]
