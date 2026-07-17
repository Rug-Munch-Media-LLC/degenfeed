# Publishing API

## `POST /api/publish`

Publish a post to one or more protocols. This endpoint is the single entry
point for all cross-protocol posting, routing through Postiz (if configured)
with automatic fallback to per-protocol logic.

### Body

```json
{
  "text": "Hello from DegenFeed!",
  "targets": ["nostr", "farcaster", "bluesky", "mastodon"],
  "auth": {
    "mastodon": "access-token-here",
    "mastodon_instance": "https://social.degenfeed.xyz",
    "bluesky_jwt": "access-jwt-here",
    "bluesky_did": "did:plc:..."
  },
  "signedMessage": "pre-signed-farcaster-message-hex",
  "typedDataId": "lens-typed-data-id",
  "signature": "lens-signed-signature"
}
```

### Response (via Postiz)

```json
{
  "results": {
    "mastodon": { "ok": true, "hash": "postiz-post-id" },
    "bluesky": { "ok": true, "hash": "postiz-post-id" },
    "nostr": { "ok": false, "error": "No Postiz integration configured for nostr" }
  },
  "via": "postiz"
}
```

### Response (fallback)

```json
{
  "results": {
    "mastodon": { "ok": true },
    "farcaster": { "ok": false, "error": "Client must sign cast..." },
    "bluesky": { "ok": true }
  }
}
```

### Routing

| Platform    | Postiz | Fallback                    |
|-------------|--------|-----------------------------|
| Mastodon    | ✅     | GtSClient (access token)    |
| Bluesky     | ✅     | AT Protocol createRecord    |
| Threads     | ✅     | AT Protocol createRecord    |
| Nostr       | ✅     | ❌ Deprecated (client-side)  |
| Farcaster   | ✅     | Hub submitMessage           |
| Lens        | ✅     | Lens API broadcast          |
| Reddit      | ✅     | ❌ Not implemented           |

### Env Configuration

See [Postiz Integration](../postiz-integration.md) for setup instructions.
