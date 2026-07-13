# Preferences API

## `GET /preferences`

Returns the authenticated user's preferences.

## `PUT /preferences`

Update user preferences.

**Body:**
```json
{
  "protocols_enabled": ["nostr", "farcaster", "bluesky"],
  "content_filters": { "nsfw": false, "media_only": false },
  "ranking_weights": { "recency": 0.4, "reach": 0.2, "network": 0.25, "content_type": 0.1, "diversity": 0.05 }
}
```
