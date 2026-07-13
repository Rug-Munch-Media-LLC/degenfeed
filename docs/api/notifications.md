# Notifications API

## `GET /notifications`

Returns aggregated notifications from all connected protocols.

**Query parameters:**
- `cursor` — pagination cursor
- `limit` — items per page (default 20)

**Response:**
```json
{
  "notifications": [
    { "type": "like", "protocol": "farcaster", "from": "...", "post_id": "..." }
  ],
  "next_cursor": "...",
  "unread_count": 5
}
```
