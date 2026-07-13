# Features API

## `GET /features`

Returns available features and their status.

**Response:**
```json
{
  "features": {
    "tipping": true,
    "composer": true,
    "news": true,
    "notifications": { "nostr": true, "farcaster": true, "lens": false }
  },
  "protocols": ["nostr", "farcaster", "lens", "bluesky", "mastodon", "threads", "reddit", "rss", "lemmy"]
}
```
