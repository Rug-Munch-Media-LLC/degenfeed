# Engagement API

## `POST /engage/:action`

Perform an engagement action.

**Actions:** `like`, `repost`, `reply`

**Body:**
```json
{
  "post_id": "...",
  "protocol": "nostr",
  "content": "optional reply text"
}
```

**Response:** `{ "status": "ok", "protocol_id": "..." }`
