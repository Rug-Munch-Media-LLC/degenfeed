# Postiz Integration

Postiz ([github.com/gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app))
is an open-source (AGPL-3.0) social media scheduler that we use as our
cross-protocol posting backend. Instead of maintaining per-protocol HTTP
clients, authentication flows, and rate-limit handling for each platform,
we delegate the actual publishing to Postiz.

## What Postiz Covers

| Platform    | Postiz Support     | Integration Type            |
|-------------|--------------------|-----------------------------|
| Mastodon    | ✅ `mastodon`      | OAuth2                      |
| Bluesky     | ✅ `bluesky`       | OAuth2                      |
| Threads     | ✅ `threads`       | App ID / Secret             |
| Nostr       | ✅ `nostr`         | nsec                        |
| Farcaster   | ✅ `warpcast`      | Warpcast API                |
| Lens        | ✅ `lens`          | Lens API                    |
| Reddit      | ✅ `reddit`        | OAuth2                      |
| LinkedIn    | ✅ `linkedin`      | OAuth2                      |
| Telegram    | ✅ `telegram`      | Bot token                   |
| Discord     | ✅ `discord`       | Bot token                   |
| Medium      | ✅ `medium`        | OAuth2                      |
| X/Twitter   | ✅ `x`             | OAuth1a                     |
| Instagram   | ✅ `instagram`     | Facebook Graph API          |
| YouTube     | ✅ `youtube`       | OAuth2                      |
| TikTok      | ✅ `tiktok`        | OAuth2                      |
| Pinterest   | ✅ `pinterest`     | OAuth2                      |
| Slack       | ✅ `slack`         | OAuth2                      |

**Total: 32 platforms supported** (25 with custom settings, 7 simple `__type` only).

## What Still Needs Custom Handling

| Feature/Aspect               | Why Custom                          |
|------------------------------|-------------------------------------|
| RSS feed reading             | Postiz doesn't ingest feeds         |
| Nostr client-side signing    | Postiz requires nsec (server-side)  |
| Per-user auth tokens         | Postiz uses its own OAuth channels  |
| Farcaster signed messages    | Postiz uses Warpcast API            |
| On-chain Lens posts          | Postiz relays via Lens API          |

## Architecture

```
User clicks "Post" in ComposeModal / FeedComposer
  │
  ▼
AuthProvider.handlePublish()
  │  POST /api/publish { text, targets, auth }
  ▼
Cloudflare Worker (workers/api/src/routes/publish.ts)
  │
  ├─ Postiz configured? ──yes──► PostizConnector.crossPost()
  │                               │
  │                               ├─ Platform has integration ID?
  │                               │   ├─ yes → POST /public/v1/posts to Postiz
  │                               │   └─ no  → perProtocolPublishSingle() fallback
  │                               │
  │                               └─ Postiz unreachable?
  │                                   └─ full fallback to per-protocol logic
  │
  └─ No Postiz ──► perProtocolPublish() (original per-platform switch)
```

## Self-Hosted Setup

### Prerequisites

- Docker Compose v2+
- 2GB RAM minimum, 4GB recommended
- A domain or subdomain pointing to your server (optional, for OAuth callbacks)
- `/path/to/degenfeed/.env` with `POSTIZ_JWT_SECRET` and any OAuth client keys

### Deployment

```bash
# Start the Postiz stack
cd /path/to/degenfeed/postiz
docker compose up -d

# Wait for startup (health checks run at 30s intervals)
docker compose logs -f postiz

# Postiz should be available at http://localhost:3105
```

### First-Time Setup

1. Open `http://localhost:3105` and create an admin account
2. Go to **Settings → Developers → Public API** and generate an API key
3. Set `POSTIZ_API_KEY` in `/path/to/degenfeed/.env`
4. In Postiz UI, add social channels (Settings → Channels → Connect)
5. Note each channel's integration ID (visible in the URL or API response)
6. Set `POSTIZ_INTEGRATIONS` in `/path/to/degenfeed/.env`:
   ```json
   {"mastodon":"int_abc123","bluesky":"int_def456"}
   ```

### Required Env Vars

```bash
# ── Postiz ────────────────────────────────────────────────────────
POSTIZ_BASE_URL=http://postiz:3000           # Docker network name
POSTIZ_API_KEY=pos_xxxxxxxxxxxxxxxxxxxxx     # From Postiz UI
POSTIZ_INTEGRATIONS='{"mastodon":"int_abc"}' # Platform → Integration ID map
```

### Optional OAuth Client Keys

For each platform you want to use, register an OAuth app and add the
credentials to your `.env`. Postiz exposes these env vars:

| Variable                     | Platform     |
|------------------------------|--------------|
| `MASTODON_CLIENT_ID`         | Mastodon     |
| `MASTODON_CLIENT_SECRET`     | Mastodon     |
| `LINKEDIN_CLIENT_ID`         | LinkedIn     |
| `LINKEDIN_CLIENT_SECRET`     | LinkedIn     |
| `REDDIT_CLIENT_ID`           | Reddit       |
| `REDDIT_CLIENT_SECRET`       | Reddit       |
| `THREADS_APP_ID`             | Threads      |
| `THREADS_APP_SECRET`         | Threads      |
| `X_API_KEY`                  | X/Twitter    |
| `X_API_SECRET`               | X/Twitter    |

## API Key Reference

### `POST /public/v1/posts`

Create and publish a post immediately or on a schedule.

**Headers:**
- `Authorization: <api-key>`

**Body:**
```json
{
  "type": "now",
  "date": "2026-07-18T12:00:00.000Z",
  "shortLink": false,
  "tags": [],
  "posts": [
    {
      "integration": { "id": "int_mastodon_abc" },
      "value": [
        {
          "content": "Hello from DegenFeed via Postiz!",
          "image": []
        }
      ],
      "settings": { "__type": "mastodon" }
    }
  ]
}
```

**Response:**
```json
{
  "postId": "post-uuid",
  "integration": "int_mastodon_abc"
}
```

### `GET /public/v1/integrations`

List all connected channels.

### `GET /public/v1/posts`

List posts with date range filtering.

## How Postiz Simplifies DegenFeed

Before Postiz, each platform needed:
- A custom API client (`@degenfeed/mastodon-sdk`, `@degenfeed/bluesky-sdk`, etc.)
- Server-side auth token management (access tokens, JWTs, typed data)
- Per-platform rate limiting
- Error handling for each API's quirks

With Postiz:
- **One API call** handles any combination of 32 platforms
- **OAuth is centralized** in Postiz's UI
- **Scheduling** is built-in (no custom cron logic)
- **Retries** and rate limits are handled by Postiz internally
- **Media uploads** are managed via Postiz's storage backend

## Connector Package

The `@degenfeed/postiz-connector` package provides:

- `PostizConnector` class with `crossPost()` and `healthCheck()` methods
- `createConnectorFromEnv()` factory for server-side usage
- Automatic fallback to per-protocol logic
- Full TypeScript types matching the Postiz API

```typescript
import { PostizConnector, createConnectorFromEnv } from '@degenfeed/postiz-connector';

// Server-side usage
const connector = createConnectorFromEnv(env);
if (connector) {
  const results = await connector.crossPost({
    content: 'Hello world!',
    platforms: ['mastodon', 'bluesky'],
  });
}
```

## Protocol Coverage Table

| Protocol  | Postiz? | Fallback? | Notes                              |
|-----------|---------|-----------|------------------------------------|
| Mastodon  | ✅      | ✅        | Either Postiz OAuth or GtSClient   |
| Bluesky   | ✅      | ✅        | Either Postiz OAuth or AT Protocol |
| Threads   | ✅      | ✅        | Both via AT Protocol               |
| Nostr     | ✅      | ❌        | Postiz uses nsec; client-side deprecated |
| Farcaster | ✅      | ✅        | Postiz via Warpcast; fallback via Hub |
| Lens      | ✅      | ✅        | Postiz via Lens API; fallback via broadcast |
| Reddit    | ✅      | ❌        | Only via Postiz OAuth              |
| RSS       | ❌      | ✅        | Read-only; never posted to         |
| Lemmy     | ❌      | ❌        | Not implemented                    |

## Future

- Add Postiz as a standalone MCP server for agent-based posting
- Explore Postiz Agent CLI (postiz-agent) for CLI-driven cross-posting
- Replace `@degenfeed/{mastodon,bluesky,threads}-sdk` packages if Postiz
  proves reliable in production
