# Frontend Architecture

## Apps

### `apps/web` — Next.js 15 Aggregator Client

The primary client application. Uses the Next.js App Router with React 19. Hosted on Cloudflare Pages.

**Key pages:**
- `/` — feed timeline
- `/news` — news aggregation
- `/post/[id]` — individual post view
- `/profile/[handle]` — cross-protocol profile
- `/composer` — multi-protocol post composer
- `/settings` — protocol connections and preferences

### `apps/landing` — Static Landing Page

Static site at `degenfeed.xyz`. Built with minimal dependencies. No JS runtime.

## Shared Packages

| Package | Purpose |
|---------|---------|
| `packages/ui` | React components (button, card, feed item, composer, modal) |
| `packages/auth` | Wallet sign-in (Solana + EVM), session management |
| `packages/storage` | Client-side KV, local storage, edge helpers |
| `packages/identity` | Resolve handles/npubs across protocols |
