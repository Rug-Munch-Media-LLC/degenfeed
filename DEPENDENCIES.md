# DegenFeed Web — Dependency Version Manifest

> **Last Updated:** 2026-07-25  
> **Node:** 22.23.1 | **pnpm:** 11.17.0 | **Package Manager:** pnpm@11.7.0  
> **Repository:** `/srv/work/repos/degenfeed-web`

## Node.js Dependencies

### Monorepo Root (`package.json`)

| Package | Current | Latest | Priority | Type | Notes |
|---------|---------|--------|----------|------|-------|
| `@biomejs/biome` | ^2.5.5 | 2.5.5 | ✅ Up-to-date | dev | Linter/formatter |
| `@playwright/test` | ^1.61.1 | 1.61.1 | ✅ Up-to-date | dev | E2E testing |
| `turbo` | ^2.10.6 | 2.10.6 | ✅ Up-to-date | dev | Monorepo orchestration |
| `typescript` | ^5.9.3 | 7.0.2 | 🔴 HIGH | dev | TS 7.0 has breaking changes |
| `vite` | ^6.4.3 | 8.1.5 | 🔴 HIGH | dev | Vite 7+ requires migration |
| `vitest` | ^3.2.6 | 4.1.10 | 🟡 MEDIUM | dev | Compatible API |
| `wrangler` | ^4.114.0 | 4.114.0 | ✅ Up-to-date | dev | Cloudflare Workers CLI |
| `happy-dom` | ^20.11.1 | 20.11.1 | ✅ Up-to-date | dev | DOM environment |
| `jsdom` | ^29.1.1 | 29.1.1 | ✅ Up-to-date | dev | DOM environment |

### App — `apps/web/package.json`

| Package | Current | Latest | Priority | Type | Notes |
|---------|---------|--------|----------|------|-------|
| `next` | ^16.2.11 | 16.2.11 | ✅ Up-to-date | dep | Next.js 16 stable |
| `react` | ^19.2.8 | 19.2.8 | ✅ Up-to-date | dep | React 19 |
| `react-dom` | ^19.2.8 | 19.2.8 | ✅ Up-to-date | dep | |
| `@capacitor/core` | ^8.4.2 | 8.4.2 | ✅ Up-to-date | dep | Mobile bridge |
| `@telegram-apps/sdk` | ^3.11.8 | 3.11.8 | ✅ Up-to-date | dep | |
| `@simplewebauthn/browser` | ^11.0.0 | 13.3.0 | 🔴 HIGH | dep | Major API changes in v12+ |
| `tailwindcss` | ^3.4.19 | 4.3.3 | 🔴 HIGH | dev | v4 breaks completely (new engine) |
| `@cloudflare/next-on-pages` | ^1.13.16 | DEPRECATED | 🔴 HIGH | dev | Needs replacement |
| `vitest` | ^4.1.10 | 4.1.10 | ✅ Up-to-date | dev | |

### Worker — `workers/api/package.json`

| Package | Current | Latest | Priority | Type | Notes |
|---------|---------|--------|----------|------|-------|
| `hono` | ^4.12.32 | 4.12.32 | ✅ Up-to-date | dep | Web framework |
| `viem` | ^2.55.8 | 2.55.8 | ✅ Up-to-date | dep | Ethereum interactions |
| `@noble/curves` | ^1.9.7 | 2.2.0 | 🟡 MEDIUM | dep | v2 has breaking API changes |
| `@noble/hashes` | ^1.8.0 | 2.2.0 | 🟡 MEDIUM | dep | v2 has breaking API changes |
| `@simplewebauthn/server` | ^11.0.0 | 13.3.2 | 🔴 HIGH | dep | Major API changes |
| `@cloudflare/workers-types` | ^5.20260724.1 | 5.20260724.1 | ✅ Up-to-date | dev | Just updated |
| `@hono/node-server` | ^1.19.15 | 2.0.11 | 🟡 MEDIUM | dev | Major bump for Hono v4 compat |
| `stripe` | ^17.7.0 | 22.3.2 | 🟡 MEDIUM | dep | Minor API changes |

### SDK Packages

| Package | Current | Latest | Priority | Notes |
|---------|---------|--------|----------|-------|
| `zod` (monetization, creator-coin) | ^3.25.76 | 4.4.3 | 🟡 MEDIUM | v4 has new API |
| `@coral-xyz/anchor` (creator-coin, zora-sdk) | ^0.30.1 | 0.32.1 | 🟡 MEDIUM | Solana framework |
| `@scure/base` (nostr-sdk) | ^1.2.6 | 2.2.0 | 🟡 MEDIUM | Encoding lib |
| `style-dictionary` (design) | ^4.4.0 | 5.5.0 | 🟡 MEDIUM | Design tokens |

## Docker Images

### Web Application Images

| Image | Tag | Status | Notes |
|-------|-----|--------|-------|
| `degenfeed-web:latest` | local build | ✅ Built from `apps/web/Dockerfile` | Node 22 Alpine |
| `degenfeed/self-host:latest` | local build | ✅ Built from `scripts/self-host/Dockerfile` | Self-hosted variant |
| `ghcr.io/rugmunchmedia/degenfeed-web` | `${IMAGE_TAG:-latest}` | ✅ Published to GHCR | Prod deployments |

### Infrastructure Images (Pinned)

| Image | Tag | Previous | Priority | Notes |
|-------|-----|----------|----------|-------|
| `caddy` | `2.11.4-alpine` | `2-alpine` | ✅ Updated | Auto TLS |
| `nginx` | `1.30.4-alpine` | `1.27-alpine` | ✅ Updated | Reverse proxy |
| `redis` | `7.2.15-alpine` | `7-alpine` | ✅ Updated | Cache/queue |
| `postgres` | `17.4-alpine` | `16-alpine` | ✅ Updated | Primary DB |
| `mariadb` | `11.7.2` | `11.4` | ✅ Updated | MariaDB |
| `prom/prometheus` | `v3.13.1` | `latest` | ✅ Updated | Monitoring |
| `grafana/grafana` | `13.1.1` | `latest` | ✅ Updated | Monitoring |
| `quay.io/prometheus/node-exporter` | `v1.9.2` | `latest` | ✅ Updated | Node metrics |
| `cloudflare/cloudflared` | `2025.9.0` | `latest` | ✅ Updated | Tunnel |
| `minio/minio` | `RELEASE.2025-09-07T16-13-09Z` | `latest` | ✅ Updated | S3 storage |

### Self-Hosted Protocol Images

| Image | Previous Tag | New Tag | Priority | Notes |
|-------|-------------|---------|----------|-------|
| **superseriousbusiness/gotosocial** | `latest` | `0.22.1` | ✅ Updated | ActivityPub |
| **getmeili/meilisearch** | `v1.49` | `v1.50.0` | ✅ Updated | Search engine |
| **ghost** | `5-alpine` | `6.54.0-alpine` | ⚠️ **MAJOR** | v5→v6 breaking changes |
| **chocobozzz/peertube** | `production-bullseye` | `v8.2.3` | ✅ Updated | Video platform |
| **gabekangas/owncast** | `latest` | `0.2.5` | ✅ Updated | Live streaming |
| **rssbridge/rss-bridge** | `2024-02-02` | `2025-08-05` | ✅ Updated | RSS proxy |
| **scsibug/nostr-rs-relay** | `latest` | `0.10.0` | ✅ Updated | Nostr relay |
| **matrixdotorg/synapse** | `latest` | `v1.157.1` | ✅ Updated | Matrix server |
| **quay.io/redlib/redlib** | `latest` | `0.36.0` | ✅ Updated | Reddit frontend |
| **castopod/castopod** | `1.13.3` | `1.13.3` | ✅ Up-to-date | Podcast hosting |
| **ghcr.io/jippi/docker-pixelfed** | `v0.12.7-...` | `v0.12.7-...` | ✅ Up-to-date | Photo sharing |

### Fork Images (Custom Builds)

| Image | Status | Notes |
|-------|--------|-------|
| `degenfeed-peertube-fork:latest` | 🔧 Custom build | Fork of PeerTube |
| `degenfeed-owncast-fork:latest` | 🔧 Custom build | Fork of Owncast |
| `degenfeed-lemmy-fork:latest` | 🔧 Custom build | Fork of Lemmy |
| `degenfeed-pixelfed-fork:latest` | 🔧 Custom build | Fork of Pixelfed |
| `degenfeed-funkwhale-fork:latest` | 🔧 Custom build | Fork of Funkwhale |
| `degenfeed-castopod-fork:latest` | 🔧 Custom build | Fork of Castopod |
| `degenfeed-writefreely-fork:latest` | 🔧 Custom build | Fork of WriteFreely |
| `degenfeed-pleroma-fork:latest` | 🔧 Custom build | Fork of Pleroma |
| `degenfeed-hubble:patched` | 🔧 Custom build | Farcaster Hub |

### Infrastructure Support Images

| Image | Tag | Notes |
|-------|-----|-------|
| `asonix/pictrs` | `0.5` | Image hosting for Lemmy |
| `ghcr.io/bluesky-social/pds` | `latest` | Bluesky AT Protocol PDS |
| `ghcr.io/scsibug/nostr-rs-relay` | `0.10.0` | Nostr relay (secondary) |
| `writeas/writefreely` | `latest` | Federated blog |
| `framasoft/mobilizon` | `latest` | Events platform |

## Security Audit Summary

| Severity | Count | Details |
|----------|-------|---------|
| 🔴 Critical | 1 | vitest <3.2.6 (patched in our version) |
| 🟠 High | 4 | bigint-buffer, valibot (transitive), vite (transitive), sharp (transitive) |
| 🟡 Medium | 0 | |
| ℹ️ Low | 0 | |

### Resolved Vulnerabilities
- **vitest GHSA-5xrq-8626-4rwp** (Critical) — Patched in ^3.2.6 ✅
- **vite GHSA-fx2h-pf6j-xcff** (High) — Patched in ^6.4.3 ✅
- **sharp GHSA-f88m-g3jw-g9cj** (High) — Requires next.js build update

### Ongoing (transitive, blocking on upstream)
- **bigint-buffer GHSA-3gc7-fjrx-p6mg** — Blocked on @solana/spl-token upgrade
- **valibot GHSA-vqpr-j7v3-hqw9** — Blocked on @telegram-apps/sdk upgrade

## Breaking Changes — Manual Review Required

### High Priority
1. **ghost v5 → v6** (`6.54.0-alpine`)
   - Changes: New admin UI, template engine changes, API v6
   - Files affected: `scripts/self-host/docker-compose.yml`, `deploy/docker-compose.prod.yml`, `scripts/infra/docker-compose.full.yml`
   - Migration guide: https://ghost.org/docs/faq/upgrade-to-ghost-6/

2. **typescript 5.9 → 7.0**
   - 48 workspace packages affected
   - Breaking: new `using` declarations, isolatedDeclarations required

3. **tailwindcss 3.4 → 4.3**
   - New CSS-first config, no `tailwind.config.ts`
   - Files: All `.tsx` components with Tailwind classes

4. **vite 6.4 → 8.1**
   - Environment variable handling changed
   - Plugin API changes

### Medium Priority
5. **@simplewebauthn v11 → v13** — API redesign
6. **@noble/curves v1→v2, @noble/hashes v1→v2** — ESM-only, API changes
7. **@hono/node-server v1→v2** — Hono v4 compatibility
8. **stripe v17→v22** — API version changes
9. **zod v3→v4** — New parsing API

## Update Policy

| Bump Type | Action | CI Required | Manual Review |
|-----------|--------|-------------|---------------|
| Patch (1.0.x) | Auto-update by Renovate | ✅ | ❌ |
| Minor (1.x.0) | Auto-update by Renovate | ✅ | ❌ |
| Major (x.0.0) | Manual PR | ✅ | ✅ Required |

## Update Commands

```bash
# Safe updates (minor/patch)
pnpm update --recursive

# Major updates (review each)
pnpm install typescript@latest
pnpm install tailwindcss@latest
pnpm install vite@latest

# Docker images
docker compose pull --ignore-buildable
docker compose up -d

# Self-hosted protocols
bash /srv/degenfeed/scripts/update-all-protocols.sh
