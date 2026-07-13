# Worker API Architecture

The `degenfeed-api` Cloudflare Worker lives at `workers/api/`. It serves as the edge proxy and aggregation engine.

## Responsibilities

- **Feed assembly** — fetch posts from protocol sources, normalize, deduplicate, rank, and return paginated results
- **Authentication** — verify SIWS/SIWE signatures, issue session tokens
- **Publishing proxy** — relay signed posts to target protocols
- **Engagement** — likes, reposts, replies (protocol-native)
- **Notifications** — poll protocol notification endpoints and unify

## Tech Stack

- Hono (lightweight router)
- Itty KV (Cloudflare KV bindings for cache and sessions)
- WebCrypto API (signature verification)
