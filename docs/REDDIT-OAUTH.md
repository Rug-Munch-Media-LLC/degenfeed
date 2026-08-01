# Reddit OAuth2 Setup

> Eliminates 429 rate limits on Reddit feeds. Registered "script" apps get
> **600 requests per 10 minutes** vs 60 for unauthenticated access.

## Step 1: Create a Reddit App

1. Go to **https://www.reddit.com/prefs/apps**
2. Scroll to the bottom and click **"Create App"** or **"Create Another App"**
3. Fill in:
   - **name**: `DegenFeed`
   - **App type**: `script` (NOT web app — script type uses password grant)
   - **description**: `DegenFeed social aggregator feed`
   - **About url**: `https://degenfeed.xyz`
   - **redirect uri**: `http://localhost:8080` (required field, not actually used for script apps)
4. Click **"Create app"**

## Step 2: Get Your Credentials

After creating the app, you'll see:
- A line with `personal use script` — the string just below that is your **client_id**
- Click **"edit"** to reveal the **client_secret**

Also have ready:
- Your Reddit **username** (the one you're logged in with)
- Your Reddit **password**

## Step 3: Store in gopass

```bash
gopass insert degenfeed/reddit/client_id
# Paste the client_id string

gopass insert degenfeed/reddit/client_secret
# Paste the client secret

gopass insert degenfeed/reddit/username
# Your Reddit username

gopass insert degenfeed/reddit/password
# Your Reddit password
```

## Step 4: Add to Systemd Service

The bridge (`degenfeed-bridge.service`) runs as a systemd service.
Add the env vars via a drop-in override:

```bash
mkdir -p /etc/systemd/system/degenfeed-bridge.service.d
```

Create `/etc/systemd/system/degenfeed-bridge.service.d/override.conf`:

```ini
[Service]
Environment="REDDIT_CLIENT_ID=$(gopass show degenfeed/reddit/client_id)"
Environment="REDDIT_CLIENT_SECRET=$(gopass show degenfeed/reddit/client_secret)"
Environment="REDDIT_USERNAME=$(gopass show degenfeed/reddit/username)"
Environment="REDDIT_PASSWORD=$(gopass show degenfeed/reddit/password)"
```

Then reload and restart:

```bash
systemctl daemon-reload
systemctl restart degenfeed-bridge
```

Alternatively, add the vars directly to `/path/to/degenfeed/.env`:

```bash
# /path/to/degenfeed/.env
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
```

And update the systemd service to load them:

```bash
# Add to [Service] section of /etc/systemd/system/degenfeed-bridge.service:
EnvironmentFile=/path/to/degenfeed/.env
```

## Step 5: Verify

After restarting the bridge, check the logs and feed:

```bash
# Check the bridge logs for token acquisition
journalctl -u degenfeed-bridge --no-pager -n 50 | grep -i reddit

# Test the Reddit feed endpoint
curl -s http://127.0.0.1:8787/api/feed/reddit | python3 -c "
import json, sys
d = json.load(sys.stdin)
posts = d.get('posts', [])
print(f'Posts: {len(posts)}')
for p in posts[:3]:
    print(f'  - {p[\"text\"][:80]}')
"

# Expected behavior:
# - Without OAuth: 0-2 posts (rate limited, 800ms delays)
# - With OAuth: 10-30+ posts (no delays, 7 subreddits queried)
```

## Architecture

```
reddit-auth.ts  ←  Reads REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
       ↓
  RedditOAuth singleton
       ↓
  POST https://www.reddit.com/api/v1/access_token
       ↓  (password grant + Basic auth)
  Bearer token (cached, auto-refresh on 401)
       ↓
  GET https://oauth.reddit.com/r/{subreddit}/hot.json
       ↓  (Authorization: Bearer <token>)
  JSON response (600 req/10min vs 60 unauthenticated)
       ↓
  redlib.ts (fetchRedditPosts) → UnifiedPost[]
```

## Implementation Files

| File | Purpose |
|------|---------|
| `bridge/src/providers/reddit-auth.ts` | RedditOAuth class — token fetch, caching, refresh, API fetch |
| `bridge/src/providers/redlib.ts` | Updated to use OAuth as primary strategy, fallback chain |

## Rate Limits

| Mode | Requests | Window |
|------|----------|--------|
| Unauthenticated (no OAuth) | 60 | 10 minutes |
| OAuth2 (script app) | 600 | 10 minutes |
| OAuth2 + OAuth scope | 600 | 10 minutes |

With OAuth, we query 7 subreddits in parallel (no 800ms delay), easily staying
within the 600/10min limit.
