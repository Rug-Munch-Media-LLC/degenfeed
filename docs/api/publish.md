# Publishing API

## `POST /publish`

Publish a post to one or more protocols.

**Body:**
```json
{
  "content": "Hello from DegenFeed!",
  "protocols": ["nostr", "farcaster"],
  "media": [],
  "reply_to": null
}
```

**Response:** `{ "id": "...", "results": { "nostr": "published", "farcaster": "published" } }`
