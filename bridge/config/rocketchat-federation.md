# Rocket.Chat Matrix Federation — DegenFeed Integration

Rocket.Chat (v6.0+) supports native Matrix federation via the `@rocket.chat/federation` package.
This allows DegenFeed users to join Rocket.Chat communities through Matrix protocol without
running a separate bridge service.

## Architecture

```
DegenFeed User <-> CrossProtocolRouter <-> Matrix HS (matrix.degenfeed.xyz)
                                                  |
                                                  v
                                Rocket.Chat Server (open.rocket.chat)
                                    (Matrix federation enabled)
```

## Rocket.Chat Setup (on the Rocket.Chat server)

### 1. Enable Matrix Federation

In Rocket.Chat Admin Panel → Federation → Matrix:

1. Enable **Matrix Federation** (`Federation_Matrix_enabled: true`)
2. Set **Matrix Home Server URL** (`Federation_Matrix_homeserver_url: "https://matrix.degenfeed.xyz"`)
3. Set **Matrix Bridge URL** (`Federation_Matrix_bridge_url: "https://matrix.degenfeed.xyz"`)
4. Generate and configure the **Matrix Application Service** token
5. Set homeserver domain: `matrix.degenfeed.xyz`

### 2. Configure Matrix HS to accept Rocket.Chat

In your Synapse `homeserver.yaml`:

```yaml
app_service_config_files:
  - /data/appservice-rocketchat.yaml
```

Create `/data/appservice-rocketchat.yaml`:

```yaml
id: rocketchat
as_token: "${RCSECRET_AS_TOKEN}"
hs_token: "${RCSECRET_HS_TOKEN}"
namespaces:
  users:
    - exclusive: false
      regex: "@rocket.*:matrix\\.degenfeed\\.xyz"
  aliases:
    - exclusive: false
      regex: "#rc_.*:open\\.rocket\\.chat"
  rooms: []
url: "https://matrix.degenfeed.xyz/api/v1/gateway/bridge"
sender_localpart: "rocketchat_bot"
rate_limited: false
```

### 3. Configure Rocket.Chat Channels for Federation

Each Rocket.Chat channel that should be accessible from DegenFeed
needs Matrix federation enabled in its channel settings:

- Channel → Settings → Federation → Enable Federation
- The channel will get a Matrix room alias like:
  `#rc_<channel_id>:open.rocket.chat`

## DegenFeed Integration

### Connecting to a Rocket.Chat Channel

From DegenFeed unified chat, users can:

1. **Discover** Rocket.Chat communities via the chat discovery API:
   ```
   GET /api/chat/discover/protocol/rocketchat
   ```

2. **Join** by specifying the Rocket.Chat server and channel:
   ```
   POST /api/rocketchat/connect
   { "serverUrl": "https://open.rocket.chat", "channelId": "general" }
   ```

3. **Send messages** to the federated Matrix room alias:
   ```
   #rc_general:open.rocket.chat
   ```

### How It Works

1. DegenFeed user sends a message to `#rc_general:open.rocket.chat` via Matrix
2. The Rocket.Chat federation bridge picks up the event and forwards it
3. Rocket.Chat users see the message in their native chat
4. Messages from Rocket.Chat flow back via the federation bridge
5. DegenFeed receives them via Matrix → CrossProtocolRouter → user's inbox
6. Each message displays with the Rocket.Chat protocol badge

## Troubleshooting

| Issue | Check |
|-------|-------|
| Can't find Rocket.Chat room | Ensure Matrix federation is enabled on the RC channel |
| Messages not flowing | Check Synapse appservice config and RC federation settings |
| 404 on room alias | Room must be public with federation enabled |
| Auth errors | AS/HS tokens must match between Synapse and Rocket.Chat configs |

## References

- [Rocket.Chat Matrix Federation Docs](https://docs.rocket.chat/use-rocket.chat/workspace-administration/federation/federation-with-matrix)
- [Matrix Application Service API](https://spec.matrix.org/latest/application-service-api/)
