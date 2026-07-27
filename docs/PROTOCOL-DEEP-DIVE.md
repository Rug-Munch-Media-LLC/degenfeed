# DegenFeed Protocol Deep-Dive Research

**Author:** AI Protocol Research Agent  
**Date:** 2026-07-28  
**Status:** Comprehensive — covers ActivityPub/Mastodon (GTS), AT Protocol/Bluesky, Nostr, and Farcaster  
**Research Method:** Primary spec reading (W3C ActivityPub, atproto.com, Nostr NIPs, Farcaster protocol) + codebase audit of bridge implementations

---

## Table of Contents

1. [ActivityPub / Mastodon (GoToSocial)](#1-activitypub--mastodon-gotosocial)
2. [AT Protocol / Bluesky](#2-at-protocol--bluesky)
3. [Nostr](#3-nostr)
4. [Farcaster](#4-farcaster)
5. [Cross-Protocol Integration Map](#5-cross-protocol-integration-map)
6. [Gap Analysis: Implementation vs. Spec](#6-gap-analysis-implementation-vs-spec)

---

## 1. ActivityPub / Mastodon (GoToSocial)

### 1.1 Identity

**Spec how it works:**
- Users are identified by **ActivityPub Actor URIs** — globally unique HTTPS URLs (e.g., `https://social.degenfeed.xyz/users/alice`)
- Each actor has an `id` (URI), `preferredUsername`, `inbox`, `outbox`, `followers`, `following` collections
- Identity verification is done via **WebFinger** (`/.well-known/webfinger?resource=acct:alice@degenfeed.xyz`) which returns the Actor URI and public key
- Public keys for HTTP Signature verification are embedded in the Actor object (in `publicKey` field)
- Actors can also have `alsoKnownAs` for cross-protocol identity linking (used by Mastodon 4.x+)
- **HTTP Signatures** (draft-cavage-http-signatures) are used for server-to-server authentication — every federation request must be signed by the sending server's actor key

**DegenFeed's implementation (GTS):**
- GTS runs at `social.degenfeed.xyz` on port 8082, v0.22.0, with WebFinger at `/.well-known/webfinger`
- Our `gts-routes.ts` proxies WebFinger lookups and account discovery
- `federation-hub.ts` has a `discoverIdentity()` function that crosses GTS identity with other protocols
- **Gap:** We use `client_credentials` OAuth for the bridge, but client_credentials grants **cannot read user timelines**. The spec requires user-level OAuth tokens (via OAuth 2.0 authorization code flow with `read:statuses` scope)
- **Gap:** We don't store or verify HTTP Signatures on incoming federation requests
- **Gap:** Our `alsoKnownAs` discovery is manually set up through `federationHub.discoverIdentity()` — there's no automated cross-protocol identity resolution

### 1.2 Content

**Spec how it works:**
- A "post" is a **Note** (or Article, Video, etc.) wrapped in a **Create** Activity
- Data structure (ActivityStreams 2.0 JSON-LD):
  ```json
  {
    "@context": "https://www.w3.org/ns/activitystreams",
    "type": "Create",
    "actor": "https://social.example/alyssa/",
    "object": {
      "type": "Note",
      "id": "https://social.example/alyssa/posts/49e2d03d",
      "attributedTo": "https://social.example/alyssa/",
      "content": "<p>Hello world!</p>",
      "to": ["https://www.w3.org/ns/activitystreams#Public"],
      "cc": ["https://social.example/alyssa/followers/"],
      "inReplyTo": "https://other.example/ben/posts/51085",
      "published": "2026-07-28T00:00:00Z",
      "url": "https://social.example/alyssa/hello-world",
      "attachment": [{ "type": "Image", "url": "https://social.example/media/123", "mediaType": "image/png" }],
      "tag": [{ "type": "Hashtag", "name": "#crypto" }, { "type": "Mention", "href": "https://other.example/ben/" }]
    }
  }
  ```
- **Replies/threads:** The `inReplyTo` field points to the parent Note's URI. Threads are reconstructed by following `inReplyTo` chains. Servers also maintain conversation collections (`context` property, `conversation` extension)
- **Media attachments:** The `attachment` array holds `Image`, `Video`, `Audio`, or `Document` objects. Mastodon/GTS also exposes media via `media_attachments` in the Mastodon API (REST wrapper)
- **Content size limits:** GTS: 15,000 characters per status, 8 media attachments, 40MB per image, 40MB per video

**DegenFeed's implementation:**
- Our `crossposter-sources.ts` fetches GTS posts via the Mastodon API (`/api/v1/timelines/public?local=true&limit=1`) and maps them to `UnifiedPost`
- **Gap:** We strip HTML tags from ActivityPub content (`s.content.replace(/<[^>]*>/g, '')`), losing rich formatting, mentions, and hashtags
- **Gap:** We don't parse `inReplyTo` — thread context is completely lost when bridging from ActivityPub
- **Gap:** We don't use ActivityStreams JSON-LD directly; we use the Mastodon REST API layer which is a lossy transformation
- **Gap:** We don't parse `tag` arrays for mentions and hashtags — these should be preserved in the unified format
- **Gap:** GTS supports `content` as both HTML and plain text via `content_type` field, but our fetcher doesn't check this

### 1.3 Federation/Relay

**Spec how it works:**
- **Server discovery:** Servers discover each other when a user follows a remote user. The following server fetches the remote actor's `id` (via WebFinger), then delivers activities to their `inbox`
- **Content propagation:** When Alice posts, her server delivers to:
  1. All followers' inboxes (or sharedInbox for efficiency)
  2. All mentioned actors (`to`, `cc` fields)
  3. The Public collection (`https://www.w3.org/ns/activitystreams#Public`) — makes content publicly accessible via GET on the outbox
- **Relay mechanism:** Activity-Relay servers forward activities from one server to many. They subscribe to relay instances and receive all public activities
- **Shared inbox:** `sharedInbox` is used for efficient fan-out — multiple actors on the same server share one inbox for public-addressed activities
- **Forwarding:** Servers MUST forward activities from their inbox to recipients that were not originally addressed (e.g., if someone replies to a public post, the reply server must deliver to the original post's reply followers)

**DegenFeed's implementation:**
- We have a self-hosted Activity-Relay at `relay.degenfeed.xyz:8084`
- **Gap:** The relay is **idle** — subscribed to no upstream relays
- **Gap:** GTS has no user accounts, so there are no followers, no outbound delivery, and no federation happening
- **Gap:** Our `federation-hub.ts` does identity discovery but doesn't participate in the actual server-to-server delivery protocol (HTTP Signatures, inbox forwarding)
- **Gap:** We don't implement `sharedInbox` delivery — all our GTS interactions go through the REST API, not the ActivityPub federation layer

### 1.4 API Patterns

**Mastodon-compatible REST API (what GTS exposes):**
- Core endpoints (all prefixed with `/api/v1/`):
  - `GET /instance` — instance info (we use this)
  - `POST /accounts` — account registration
  - `POST /oauth/token` — OAuth token exchange
  - `GET /timelines/public` — public timeline
  - `GET /timelines/home` — home timeline (needs user auth)
  - `GET /accounts/:id/statuses` — account's posts
  - `POST /accounts/:id/follow` — follow
  - `POST /statuses` — create post
  - `GET /trends` — trending tags/posts
  - `GET /search` — search accounts/statuses
  - `GET /follows` — account relationships
  - `GET /blocks` — blocked accounts
  - `GET /mutes` — muted accounts
  - `POST /migration` — account migration
- **Authentication:** OAuth 2.0 (authorization code grant + client credentials grant)
  - App registration: `POST /api/v1/apps`
  - Token: `POST /oauth/token` with `grant_type=authorization_code` or `client_credentials`
  - Scopes: `read`, `write`, `follow`, `push` (granular: `read:statuses`, `write:statuses`, etc.)
- **Rate limiting:** GTS default: 300 requests per 5 minutes per IP. Auth-dependent tiers

**DegenFeed's implementation:**
- We register apps (`registerGtsApp`) and get tokens via `client_credentials` or password grant
- **Gap:** Our bridge uses `client_credentials` which grants app-level access — can't read user timelines. We need user-level tokens for `/api/v1/timelines/home`
- **Gap:** We don't implement the full OAuth authorization code flow — users can't grant consent from the frontend
- **Gap:** Our feed fetching from GTS returns empty because there are no active user accounts posting content

### 1.5 Integration Strategy

**What we're NOT using that we should:**
1. **ActivityPub Actor JSON-LD directly** — We rely on the Mastodon REST API which is a lossy abstraction
2. **`inReplyTo` threading** — Threads from the fediverse are completely flattened in our bridge
3. **Hashtag and Mention parsing** — `tag` arrays in ActivityStreams are ignored
4. **HTTP Signatures** — We don't verify or sign any server-to-server requests
5. **Follower-aware delivery** — We don't track who follows whom across the fediverse
6. **`alsoKnownAs`** — This is the ActivityPub standard for cross-protocol identity linking, and we should use it to link GTS accounts with Nostr/Farcaster/Bluesky identities

**Strengths we should exploit:**
- GTS 0.22.0 is lightweight and Mastodon-API compatible
- ActivityPub is the most mature decentralized protocol — leverage the relay network
- Public timeline is accessible without auth — we should create bot accounts that post crypto content to populate the GTS feed

**Correct our mapping:**
- **Current:** `MastodonPost` → strip HTML → `UnifiedPost.text`
- **Should be:** `ActivityStreams(Note)` → parse `content` with type awareness, extract `tag` → mentions, hashtags, extract `attachment` → media embeds, extract `inReplyTo` → thread context
- **Cross-poster transform (nostr target):** We add `\n\n— originally from ${post.protocol}` — should preserve ActivityPub tags as Nostr tags
- **Cross-poster transform (bluesky target):** We strip to plain text — should preserve link facets from ActivityPub attachments

---

## 2. AT Protocol / Bluesky

### 2.1 Identity

**Spec how it works:**
- **Primary identifier:** **DID** (Decentralized Identifier) — `did:plc:ewvi7nxzyoun6zhxrhs64oiz` or `did:web:user.example.com`
- **Human-friendly handle:** DNS-based handle (e.g., `user.example.com`) resolved via `/.well-known/atproto-did` TXT record or `_atproto` DNS subdomain
- **Identity resolution:** DID document (fetched from PLC directory or `did:web` HTTPS endpoint) contains:
  - `verificationMethod` — signing keys (`#atproto` key for repo commits and auth)
  - `service` — PDS endpoint (`#atproto_pds`)
  - `alsoKnownAs` — the handle(s) associated with the DID
- **Handle-to-DID resolution:** `handle` → DNS `_atproto` TXT record or `/.well-known/atproto-did` → DID
- **DID-to-handle resolution:** DID document → `alsoKnownAs` → parse `at://handle` URI
- **Bi-directional verification:** Both sides must match — the DID must claim the handle AND the handle must resolve back to the DID

**DegenFeed's implementation:**
- We have a self-hosted PDS at `pds.degenfeed.xyz:3012`
- Bluesky provider maps `post.author.did` as the primary identity key
- We store `keys: { did: post.author.did, atprotoDid: post.author.did }` in the unified format
- **Gap:** Our PDS handle resolution fails — `degenfeed.xyz` handle doesn't resolve. We need to register the atproto handle/DID document
- **Gap:** We don't resolve DID documents to get signing keys — critical for verifying repo commits and auth
- **Gap:** We don't implement PLC directory operations for DID creation/rotation
- **Gap:** The Bluesky provider has a hardcoded `CURATED_ACTORS` list — no federated identity discovery

### 2.2 Content

**Spec how it works:**
- A "post" is an **app.bsky.feed.post record** stored in a user's **repository** (Merkle Search Tree)
- Record structure:
  ```json
  {
    "$type": "app.bsky.feed.post",
    "text": "Hello world!",
    "createdAt": "2026-07-28T00:00:00.000Z",
    "facets": [{
      "index": { "byteStart": 0, "byteEnd": 12 },
      "features": [{ "$type": "app.bsky.richtext.facet#link", "uri": "https://example.com" }]
    }],
    "embed": {
      "$type": "app.bsky.embed.images",
      "images": [{ "alt": "photo", "image": { "$type": "blob", "ref": { "$link": "bafkreid..." }, "mimeType": "image/jpeg", "size": 100000 } }]
    },
    "reply": { "parent": { "uri": "at://did:plc:.../app.bsky.feed.post/recordkey", "cid": "bafy..." }, "root": { "uri": "...", "cid": "..." } }
  }
  ```
- **Replies/threads:** The `reply` object references the parent and root posts via AT-URIs (`at://did/collection/rkey`) and CIDs
- **Media attachments:** Handled via `embed` field — can be `app.bsky.embed.images`, `app.bsky.embed.external` (link cards), `app.bsky.embed.video`, or `app.bsky.embed.record` (quote posts)
- **Content size limits:** 300 characters for text (the Bluesky app limit — PDS may allow more); 1MB per blob; up to 4 images per post
- **Facets:** Rich text annotations (links, mentions, hashtags) are NOT embedded in text — they're separate facet records with byte offsets into the text
- **Embedded media:** Video is stored as a blob in the user's repository with a `video/mp4` MIME type

**DegenFeed's implementation:**
- Bluesky provider fetches via `app.bsky.feed.getAuthorFeed` and `app.bsky.feed.searchPosts` on `public.api.bsky.app`
- ATProto provider fetches via `app.bsky.feed.getFeedSkeleton` on the same endpoint
- `postToUnified()` mapper extracts text, images (from both `embed.images` and `record.embed.images`), and link cards
- **Gap:** We don't parse **facets** — Bluesky uses byte-offset-based facets for links, mentions, and hashtags, but we only extract URLs via regex on the text (which is lossy)
- **Gap:** We don't parse **reply** structure — thread context is lost
- **Gap:** We don't handle **video embeds** (`app.bsky.embed.video`) — the types only cover images and external links
- **Gap:** Our Bluesky types (`BskyPostView`) don't include `record.reply` properly mapped
- **Gap:** The `atproto.ts` provider uses `app.bsky.feed.getFeedSkeleton` which returns minimal data (no resolved embeds). It should use `app.bsky.feed.getFeed` instead
- **Gap:** We don't handle **quote posts** (`app.bsky.embed.record` with `embed.record.embed` nesting)

### 2.3 Federation/Relay

**Spec how it works:**
- **Architecture:** PDS → Relay → AppView. Three-tier separation
- **PDS (Personal Data Server):** Hosts user repositories, handles auth, proxies client requests
- **Relay:** Subscribes to PDS hosts, aggregates all repo events into a **firehose** (WebSocket, `com.atproto.sync.subscribeRepos`)
- **AppView:** Indexes the firehose, provides application-specific views (feeds, search, notifications)
- **Content propagation:** 
  1. User posts to PDS → PDS stores record in repo, creates signed commit
  2. PDS emits event on its firehose
  3. Relay subscribes to PDS firehose, aggregates, emits combined firehose
  4. AppView subscribes to relay firehose, indexes records, serves client requests
- **Sync mechanism:** 
  - Full repo export: `com.atproto.sync.getRepo` returns CAR file
  - Diff: `com.atproto.sync.subscribeRepos` sends commit diffs
  - Record-level sync with MST inversion for verification
- **Identity events:** `#identity` — DID/handle changes; `#account` — hosting status; `#commit` — repo updates

**DegenFeed's implementation:**
- We have a PDS but no relay subscription and no firehose consumer
- **Gap:** We don't subscribe to the Bluesky relay firehose (`bsky.network` or `jetstream`) — we use REST API polling instead of streaming
- **Gap:** Without firehose consumption, we miss real-time updates and have no reliable sync mechanism
- **Gap:** Our PDS is isolated — not connected to the Bluesky network relay (PDS needs to register with the network)
- **Gap:** We don't implement the `com.atproto.sync.*` endpoints for repo sync

### 2.4 API Patterns

**XRPC (Cross-system RPC):**
- All endpoints under `/xrpc/<NSID>` 
- **Query** (GET): Cacheable, no side effects. Params as URL query string
- **Procedure** (POST): Mutable state
- Authentication: OAuth (primary, with `atproto-proxy` header for service proxying) or legacy JWT (access + refresh tokens)
- **Core endpoints we use:**
  - `app.bsky.feed.getAuthorFeed` — author's posts
  - `app.bsky.feed.searchPosts` — search
  - `app.bsky.feed.getFeedSkeleton` — feed generator output
  - `com.atproto.server.describeServer` — server info
  - `com.atproto.sync.getLatestCommit` — repo status
- **Core endpoints we should use:**
  - `com.atproto.sync.subscribeRepos` — firehose WS
  - `com.atproto.repo.getRecord` — single record fetch
  - `com.atproto.identity.resolveHandle` — handle→DID resolution
  - `app.bsky.feed.getPostThread` — full thread with replies
  - `com.atproto.repo.uploadBlob` — blob upload for posting
- **Rate limiting:** PDS-specific. Bluesky public API: 3000 req/5 min (tier-dependent)

**DegenFeed's implementation:**
- Both providers use the public Bluesky API (`public.api.bsky.app`)
- **Gap:** We don't authenticate with the PDS for user-specific operations (posting, timeline)
- **Gap:** Our `atproto.ts` provider doesn't resolve AT-URIs — it uses URL string manipulation instead
- **Gap:** We don't implement blob upload (`com.atproto.repo.uploadBlob`) which is required for posting media to Bluesky
- **Gap:** Cross-poster transform for Bluesky creates simple `app.bsky.feed.post` records but doesn't handle media embeds or facets correctly

### 2.5 Integration Strategy

**What we're NOT using that we should:**
1. **Firehose subscription** — Real-time content flow via `com.atproto.sync.subscribeRepos` instead of REST polling
2. **Facet parsing** — Byte-offset-based facets for links, mentions, hashtags (critical for rich text fidelity)
3. **Reply/thread structure** — `record.reply.parent` and `record.reply.root` for thread reconstruction
4. **Video embeds** — `app.bsky.embed.video` is now supported natively
5. **AT-URI resolution** — `at://did:plc:.../app.bsky.feed.post/rkey` format for linking content
6. **DID resolution** — Resolving DID documents for key verification and PDS location
7. **Blob upload** — Needed for cross-posting media to Bluesky

**Strengths we should exploit:**
- Bluesky's self-authenticating data model (MST + signed commits) means we can verify content without trusting the server
- The PDS → Relay → AppView separation means we can run a lightweight AppView that indexes only crypto content
- Lexicon schemas are versioned and self-documenting — we can validate content against schemas

**Correct our mapping:**
- **Current:** `BskyPostView.record.text` → `UnifiedPost.text`; regex for URLs
- **Should be:** Parse `record.facets` for typed annotations; map `record.embed.images` → image embeds; extract `record.reply` → thread metadata; parse `embed.record` → quote post handling
- **Cross-poster transform:** Must upload blobs first via `com.atproto.repo.uploadBlob`, then create post record with blob references; must construct proper facets for links

---

## 3. Nostr

### 3.1 Identity

**Spec how it works:**
- **Primary identifier:** **Public key** (32-byte hex-encoded secp256k1 Schnorr public key). Example: `npub1gaexaxkv0lc5jlq52usvvgr7wqeunmyg7x4h0npmq5x9xx5w604sg5rexr` (bech32-encoded)
- **Human-readable handle:** **NIP-05** — `name@domain.com` resolved via `https://domain.com/.well-known/nostr.json?name=name` which returns `{ "names": { "name": "<pubkey-hex>" } }`
- **NIP-05 verification:** The `.well-known/nostr.json` must be served over HTTPS and may include a `relays` mapping for preferred relay hinting
- **No central registry** — identity is purely cryptographic: you are your private key
- **Cross-protocol linking:** NIP-05 can be used to prove ownership of a DNS domain (linking to web identity). NIP-13 (Proof-of-Work) for anti-spam. NIP-26 (Delegated Event Signing) for delegated authority

**DegenFeed's implementation:**
- Nostr provider stores `keys: { nostrPubkey: event.pubkey }` and `handles: { nostr: hexToBech32(event.pubkey) }`
- **Gap:** We don't resolve NIP-05 handles — all Nostr identities are shown as truncated hex pubkeys (`0x1234...abcd`)
- **Gap:** We don't verify NIP-05 — no `.well-known/nostr.json` lookup
- **Gap:** The `hexToBech32` function is a stub that truncates hex — it doesn't properly encode to bech32 (npub format)
- **Gap:** Nostr events in our NIP-52 calendar fetcher have proper pubkeys, but our main Nostr provider fetches through the `nostr-events.ts` file which only handles calendar events (kind 31922), not text notes (kind 1)

### 3.2 Content

**Spec how it works:**
- A "post" is an **Event** with `kind: 1` (text note)
- Event data structure:
  ```json
  {
    "id": "<32-bytes hex sha256 of serialized event>",
    "pubkey": "<32-bytes hex public key>",
    "created_at": <unix timestamp>,
    "kind": 1,
    "tags": [
      ["e", "<event-id>", "<relay-url>", "<marker>"],
      ["p", "<pubkey>", "<relay-url>"],
      ["t", "crypto"],
      ["r", "https://example.com"],
      ["proxy", "<id>", "<protocol>"]
    ],
    "content": "Hello Nostr! Check this out: https://example.com",
    "sig": "<64-bytes hex Schnorr signature>"
  }
  ```
- **Replies/threads:** `["e", "<parent-event-id>", "<relay-url>", "reply"]` tag for replies; `["e", "<root-event-id>", "<relay-url>", "root"]` for the thread root
- **Mentions:** `["p", "<pubkey>", "<relay-url>"]` tags for mentioned users
- **Media attachments:** Not directly in events. Media URLs are in the `content` string or in `imeta` tags (NIP-92). Images often embedded as markdown in content
- **Content size limits:** No protocol-level limit. Relay-specific: most relays accept up to 64KB for kind 1 events
- **Replaceable events (kind 0, 3, etc.):** Only the latest version stored by relays
- **Ephemeral events (kind 20000-29999):** Not stored, only relayed
- **Addressable events (kind 30000-39999):** Identified by kind + pubkey + `d` tag

**DegenFeed's implementation:**
- The `nostr-events.ts` provider only handles **NIP-52 calendar events** (kind 31922) — it's an event calendar, not the main text note feed
- **Gap:** We have **no provider that fetches kind 1 text notes** — our primary Nostr feed is missing!
- **Gap:** We don't parse `e` tags for thread context — replies are flat
- **Gap:** We don't parse `p` tags for mentions
- **Gap:** We don't parse `t` tags for hashtags
- **Gap:** Our cross-poster transform for Nostr creates kind 1 events but doesn't add proper tag structure:
  - Should add `["t", "degenfeed"]` for hashtag indexing
  - Should add `["proxy", post.id, post.protocol]` for cross-protocol provenance
  - Should add `["r", post.protocol]` for source protocol reference
- **Gap:** The Nostr provider only uses WebSocket to relays — no NIP-11 relay info document fetching, no NIP-42 AUTH for authenticated writes

### 3.3 Federation/Relay

**Spec how it works:**
- **No server-to-server federation** — Nostr uses a **relay-based** model
- Clients connect to relays via WebSocket. Relays store and serve events
- **Content propagation:** Events are published (`EVENT` message) to relays by clients. Clients query relays (`REQ` message) with subscription filters. Relays send matching events back
- **Relay discovery:** NIP-11 provides relay metadata document via HTTP GET on the relay's domain. NIP-65 suggests relay lists. NIP-05 provides relay hints
- **Gossip:** No automatic propagation between relays. Events are only on relays they're published to. Clients must connect to multiple relays to get comprehensive coverage
- **Filter-based subscriptions:** Clients subscribe with filters: `{ "kinds": [1], "authors": [...], "#t": ["crypto"], "limit": 50 }`
- **EOSE:** End of Stored Events marker — indicates initial query results are done, real-time events follow

**DegenFeed's implementation:**
- Connects to 5 external relays: `damus.io`, `nos.lol`, `primal.net`, `purplepag.es`, plus local `127.0.0.1:8085`
- **Gap:** No self-hosted relay — we depend entirely on external relays. Our `nostr-relay` is defined in docker-compose but not deployed (GHCR auth blocked)
- **Gap:** We don't implement **NIP-42 AUTH** — means we can't write to authenticated relays
- **Gap:** Our WebSocket implementation has a single 8-second timeout and no reconnection logic — real Nostr clients maintain persistent connections
- **Gap:** The subscription filter only requests kind 31922 (calendar events), not kind 1 (text notes) which is the main feed
- **Gap:** We don't support NIP-11 relay discovery — we hardcode relay URLs

### 3.4 API Patterns

**WebSocket message protocol (no REST):**
- Client → Relay: `["EVENT", <event>]`, `["REQ", <sub_id>, <filters>]`, `["CLOSE", <sub_id>]`
- Relay → Client: `["EVENT", <sub_id>, <event>]`, `["OK", <event_id>, <true|false>, <message>]`, `["EOSE", <sub_id>]`, `["CLOSED", <sub_id>, <message>]`, `["NOTICE", <message>]`
- **Authentication:** No auth for reads (most relays). NIP-42 AUTH optional for writes. Some relays require payment or NIP-05
- **Rate limits:** Relay-specific. Standard prefixes for OK/CLOSED: `duplicate`, `pow`, `blocked`, `rate-limited`, `invalid`, `restricted`, `error`
- **Filter attributes:** `ids`, `authors`, `kinds`, `#<single-letter>`, `since`, `until`, `limit`

**DegenFeed's implementation:**
- Uses WebSocket in Node.js to fetch events from relays
- **Gap:** No REST fallback for relays that support NIP-15 (end-of-stored-events notice)
- **Gap:** Our Nostr "provider" (`nostr-events.ts`) is a calendar event fetcher, not a general Nostr provider. The actual Nostr text note provider is referenced as a provider path but doesn't exist as a proper kind-1 fetching implementation
- **Gap:** No NIP-11 relay metadata query to discover relay capabilities

### 3.5 Integration Strategy

**What we're NOT using that we should:**
1. **NIP-01 kind 1 text notes** — We have NO provider for core Nostr content
2. **NIP-05 identity resolution** — Every Nostr user could be linked to a domain
3. **NIP-10 "e" tag markers** — `"root"`, `"reply"`, `"mention"` markers for proper thread handling
4. **NIP-04 encrypted DMs** — Private messaging capability
5. **NIP-46 NIP-07 (Nostr Connect)** — Signing with browser extension
6. **NIP-57 Lightning Zaps** — We have code for zaps but it's not wired to the bridge
7. **NIP-58 Badges** — Reputation/verification badges
8. **NIP-65 Relay Lists** — Discover user's preferred relays
9. **NIP-92 Media Attachments** — Proper media embedding with `imeta` tags

**Strengths we should exploit:**
- Nostr is the most censorship-resistant (no servers can delete events)
- Cryptographic identity is universal — the same pubkey can be used across applications
- Event kinds allow unbounded extensibility
- Relays are commodity — we can spin up a relay easily once GHCR auth is resolved

**Correct our mapping:**
- **Current:** `nostr-events.ts` only fetches calendar events (kind 31922)
- **Should be:** Create a `nostr-text-notes.ts` provider that fetches kind 1 events, parses `["e"]` for replies, `["p"]` for mentions, `["t"]` for hashtags
- **Current cross-poster transform:** Creates `{ kind: 1, content, created_at, tags: [["t","degenfeed"],["t","crosspost"],["r",protocol],["proxy",id,protocol]] }`
- **Should be:** Also include `["e", originalEventId, relayUrl, "reply"]` for reply context; `["p", ...]` for mentioned users; preserve original protocol tags

---

## 4. Farcaster

### 4.1 Identity

**Spec how it works:**
- **Primary identifier:** **FID** (Farcaster ID) — a sequential uint64 assigned on-chain. Example: `fid: 2` (Varun Srinivasan)
- **On-chain identity:** FIDs are minted via the **IdRegistry** smart contract (Ethereum mainnet). Each FID is owned by an Ethereum address
- **Signer keys:** Ed25519 keypairs registered via `SignerRegistry` on-chain. Users register signers to authorize message posting. Signer registration is an on-chain event
- **Username:** Off-chain messages of type `USER_DATA_ADD` with type `USER_DATA_TYPE_USERNAME` (value 6). Usernames are NOT unique (though Warpcast enforces uniqueness via a separate `UserNameProof` contract)
- **Farcaster epoch:** Timestamps are seconds since 2021-01-01T00:00:00Z (Farcaster Epoch)
- **Identity verification:** On-chain handshake — signer keys are verified against the FID's registered signers via the on-chain event log. Messages include `fid`, `signer`, and `signature` for verification
- **Sign in With Farcaster (SIWF):** EIP-4361-based flow where users prove ownership of a Farcaster signer key

**DegenFeed's implementation:**
- Farcaster provider uses `fid` as primary key: `keys: { fid: String(fid) }`, `handles: { farcaster: userData.username }`
- SIWF implemented with EIP-4361 message format and Hubble `/v1/signerByAddress` verification
- **Gap:** We only verify the signer exists on Hubble — we don't verify the signature against the registered public key
- **Gap:** We don't resolve on-chain identity events directly — we depend on Hubble having indexed the chain
- **Gap:** FID registration (`/v1/register`) is implemented but untested — depends on Hubble having a funded operator key
- **Gap:** We use a curated list of ~50 FIDs — no dynamic user discovery via the Farcaster network

### 4.2 Content

**Spec how it works:**
- A "post" is a **Cast** — created via `CastAdd` message (protobuf)
- Message structure (protobuf → JSON):
  ```json
  {
    "data": {
      "type": "MESSAGE_TYPE_CAST_ADD",
      "fid": 2,
      "timestamp": 94608000,
      "network": "FARCASTER_NETWORK_MAINNET",
      "castAddBody": {
        "text": "Hello, Farcaster!",
        "embeds": [{ "url": "https://example.com" }],
        "mentions": [228, 339],
        "mentionsPositions": [12, 24],
        "parentCastId": { "fid": 226, "hash": "0xa48dd..." },
        "parentUrl": "chain://eip155:1/erc721:0x..."
      }
    },
    "hash": "0x27f49c6928...",
    "hashScheme": "HASH_SCHEME_BLAKE3",
    "signature": "0x4f67a836...",
    "signatureScheme": "SIGNATURE_SCHEME_ED25519",
    "signer": "0x69104ef2..."
  }
  ```
- **Replies/threads:** `parentCastId` or `parentUrl` in CastAddBody. `parentCastId` references the parent cast by FID + hash. Threads are reconstructed by following parent references
- **Media attachments:** Embeds are URLs in the `embeds` array (max 2). Images/videos hosted externally (IPFS, Arweave, or traditional CDN)
- **Mentions:** `mentions` array (FIDs) + `mentionsPositions` array (byte offsets into text)
- **Content size limits:** 
  - `text`: max 1024 bytes (UTF-8)
  - 320 bytes for `CAST` type, 321-1024 for `LONG_CAST`, >1024 for `TEN_K_CAST`
  - `embeds`: max 2 entries
  - `mentions`: max 10 FIDs
  - No embedded images natively — all media via external URLs

**DegenFeed's implementation:**
- Hubble fetch: `/v1/castsByFid?fid=X&pageSize=Y`
- Maps `body.text` to `UnifiedPost.text`
- Maps `body.embeds` to link embeds
- **Gap:** We don't parse `mentions` and `mentionsPositions` — mentions are lost in the bridge
- **Gap:** We don't map `parentCastId` — reply/thread context is lost
- **Gap:** Our Farcaster cross-poster transform has a 320-char limit (correct for standard casts) but doesn't handle `LONG_CAST` or `TEN_K_CAST` types
- **Gap:** The cross-poster embeds URLs from the source post but doesn't include `mentions` or `mentionsPositions`
- **Gap:** We generate synthetic post IDs (`farcaster:hubble:${fid}:${ts}:${text.slice(0,20)}`) instead of using the actual cast hash — makes deduplication unreliable

### 4.3 Federation/Relay

**Spec how it works:**
- **Hub-based architecture:** Hubs are servers that store the full Farcaster message graph
- **Sync protocol:** Hubs synchronize via a **gossip protocol** using CRDTs (Conflict-free Replicated Data Types)
- **CRDT merge rules:** Each message has a `(fid, timestamp, hash)` ordering. Last-write-wins with timestamp then hash tiebreaker
- **Message graph:** CRDTs for each message type (CastAdd, Reaction, Link, etc.). Merkle trie for efficient sync
- **L2 chain:** Farcaster uses a custom L2 (Snapchain) for recent messages, anchored to Ethereum mainnet for identity events
- **Hubs connect to each other via libp2p** for peer-to-peer gossip
- **Sync mechanism:** Hubs compute diffs of their message Merkle trie and exchange missing messages

**DegenFeed's implementation:**
- Connects to self-hosted Hubble at `127.0.0.1:2281` with fallback to `hubble.degenfeed.xyz:2281`
- Also uses Neynar API (`api.neynar.com`) as external fallback
- **Gap:** Our Hubble status check only tracks `isSyncing`, `rootHash`, `peerId` — we don't verify actual sync completeness
- **Gap:** We don't participate in the gossip protocol — we're a read-only REST consumer
- **Gap:** No CRDT-based merge logic — we treat all Hub responses as authoritative without verification
- **Gap:** The Neynar fallback depends on `NEYNAR_API_KEY` with limited free tier (25k calls/month)

### 4.4 API Patterns

**Hubble REST API (gRPC + HTTP):**
- **HTTP endpoints:**
  - `GET /v1/info` — hub status (we use)
  - `GET /v1/castsByFid?fid=X&pageSize=Y` — casts (we use)
  - `GET /v1/userDataByFid?fid=X` — profile (we use)
  - `GET /v1/signerByAddress?address=X` — signer lookup (we use)
  - `POST /v1/submitMessage` — submit signed message (we have but don't use in bridge)
  - `GET /v1/castsByParent?parentFid=X&parentHash=Y` — thread replies
  - `GET /v1/reactionsByFid` — reactions for a user
  - `GET /v1/reactionsByTarget` — reactions on a cast
  - `GET /v1/linksByFid` — follows/social graph
  - `GET /v1/userDataByFid` — profile data
  - `GET /v1/onChainEvents` — on-chain identity events
- **Authentication:** No auth for read endpoints. Write requires signed protobuf messages (Ed25519)
- **Rate limiting:** Self-hosted Hubble: generous (120 req/min configured). Neynar: free tier 25k calls/month

**DegenFeed's implementation:**
- Uses `/v1/info`, `/v1/castsByFid`, `/v1/userDataByFid`, `/v1/signerByAddress`
- **Gap:** We don't use `/v1/castsByParent` for thread reconstruction
- **Gap:** We don't use `/v1/submitMessage` for writing — cross-posting to Farcaster is unimplemented
- **Gap:** We rate-limit ourselves to 120 req/min which is conservative — Hubble can handle more
- **Gap:** No gRPC usage — the HTTP REST API is a subset of gRPC capabilities

### 4.5 Integration Strategy

**What we're NOT using that we should:**
1. **`/v1/castsByParent`** — Thread reconstruction from Farcaster
2. **`mentions` + `mentionsPositions`** — User mentions in casts
3. **Reactions (Likes/Recasts)** — Our `metrics.reposts` and `metrics.likes` are always 0 from Hubble
4. **`/v1/submitMessage`** — Write path for cross-posting TO Farcaster
5. **On-chain events** — Identity verification via `IdRegistry` and `SignerRegistry` events
6. **Frames** — Farcaster's mini-app framework (we have a `frames-v2.ts` SDK but Farcaster provider doesn't parse frame embeds)
7. **LONG_CAST / TEN_K_CAST** — Proper handling of long-form content
8. **Snapchain direct integration** — Since Farcaster is migrating to Snapchain (a custom L2), direct RPC integration might replace Hubble dependency

**Strengths we should exploit:**
- CRDT-based consensus means eventual consistency without central coordination
- On-chain identity provides cryptographically verified authorship
- Casts have explicit parent referencing for perfect thread reconstruction
- Self-hosted Hubble gives us full network access without API keys

**Correct our mapping:**
- **Current:** Maps `castAddBody.text` to `UnifiedPost.text`, ignores everything else
- **Should be:** Parse `mentions`/`mentionsPositions` → mentions array with byte offsets; parse `parentCastId` → thread context; parse `embeds[].url` → link embeds; use actual cast hash as post ID
- **Cross-poster transform:** Must create proper `CastAddBody` protobuf with `mentions`, `mentionsPositions`, `embeds`; sign with Ed25519 key; submit via `/v1/submitMessage`

---

## 5. Cross-Protocol Integration Map

### 5.1 Identity Cross-Reference

| Aspect | ActivityPub | AT Protocol | Nostr | Farcaster |
|--------|-------------|-------------|-------|-----------|
| **Primary ID** | Actor URI (HTTPS URL) | DID (`did:plc:*` or `did:web:*`) | Public key (32-byte hex) | FID (uint64, on-chain) |
| **Human handle** | `@user@domain` (WebFinger) | `user.domain` (DNS-based handle) | `name@domain` (NIP-05) | Username (USER_DATA, no uniqueness) |
| **ID verification** | HTTP Signatures + WebFinger | DID document + handle resolution | Cryptographic signature | On-chain IdRegistry + SignerRegistry |
| **Key type** | RSA/Ed25519 (per-actor) | K-256 or P-256 (per-DID) | secp256k1 Schnorr (per-keypair) | Ed25519 (per-signer, registered on-chain) |
| **Mutable?** | No (URI is permanent) | Partially (DID is permanent, handle mutable) | No (pubkey is permanent) | FID is permanent |
| **Cross-link standard** | `alsoKnownAs` | `alsoKnownAs` in DID doc | NIP-05 (DNS) | UserNameProof contract |

### 5.2 Content Model Comparison

| Aspect | ActivityPub | AT Protocol | Nostr | Farcaster |
|--------|-------------|-------------|-------|-----------|
| **Post name** | Note (in Create activity) | `app.bsky.feed.post` record | Event (kind 1) | Cast (CastAdd message) |
| **Data format** | JSON-LD (ActivityStreams) | CBOR/IPLD (DRISL) + JSON | JSON | Protocol Buffers |
| **Text limit** | 15K (GTS), varies | 300 chars (Bluesky app) | 64KB (relay-dependent) | 320/1024/10K chars (CastType) |
| **Thread model** | `inReplyTo` URI chain | `reply.parent` + `reply.root` | `e` tags with markers | `parentCastId` (FID + hash) |
| **Media** | `attachment` array (typed) | `embed` (images/external/video/record) | URLs in content + `imeta` | URLs in `embeds` array |
| **Mentions** | `tag` array (Mention type) | `facets` (byte-offset features) | `p` tags | `mentions` array + positions |
| **Hashtags** | `tag` array (Hashtag type) | `facets` (byte-offset features) | `t` tags | No explicit hashtag tags (in text) |

### 5.3 Network Architecture Comparison

| Aspect | ActivityPub | AT Protocol | Nostr | Farcaster |
|--------|-------------|-------------|-------|-----------|
| **Topology** | Server-to-server federation | PDS → Relay → AppView | Client-relay (many relays) | Hub-to-Hub (gossip) |
| **Discovery** | WebFinger + follow-based | DID resolution + relay firehose | NIP-11 relay info + NIP-05 | On-chain registry + Hub gossip |
| **Propagation** | Server delivers to followers' inboxes | Relay firehose → AppView index | Client publishes to relays | CRDT sync between Hubs |
| **Auth (server)** | HTTP Signatures | OAuth + inter-service JWT | None (NIP-42 AUTH optional) | Ed25519 signatures |
| **Auth (client)** | OAuth 2.0 | OAuth + JWT + app passwords | None | Signed protobuf messages |
| **Consistency** | Strong (server-authoritative) | Strong (MST + signed commits) | Weak (best-effort relay) | Eventual (CRDT + last-write-wins) |
| **Censorship res.** | Moderate (depends on server admin) | Moderate (PDS admin controls data) | Strong (any relay can store) | Moderate (Hub operator) |

---

## 6. Gap Analysis: Implementation vs. Spec

### 6.1 Critical Gaps

| # | Gap | Protocol | Impact | Fix Priority |
|---|-----|----------|--------|-------------|
| **G1** | No Nostr kind-1 text note provider | Nostr | Core Nostr feed missing entirely | 🔴 CRITICAL |
| **G2** | No HTML tag stripping preserves only partial content | ActivityPub | Rich formatting lost (bold, links, mentions) | 🔴 CRITICAL |
| **G3** | No facet parsing for Bluesky | AT Protocol | Links/mentions/hashtags lost | 🔴 CRITICAL |
| **G4** | Farcaster mentions + reply context ignored | Farcaster | Social graph data lost | 🔴 CRITICAL |
| **G5** | Cross-poster transforms don't use protocol-native formats (facets, tags, mentions, embeds) | All | Cross-posted content is low-fidelity | 🔴 CRITICAL |

### 6.2 High-Priority Gaps

| # | Gap | Protocol | Fix Priority |
|---|-----|----------|-------------|
| **H1** | GTS OAuth uses client_credentials (can't read user timelines) | ActivityPub | 🟡 HIGH |
| **H2** | No Bluesky firehose subscription | AT Protocol | 🟡 HIGH |
| **H3** | No Nostr relay deployed | Nostr | 🟡 HIGH |
| **H4** | Farcaster metrics always 0 (no reaction fetching) | Farcaster | 🟡 HIGH |
| **H5** | Thread/reply context lost across all bridges | All | 🟡 HIGH |
| **H6** | Synthetic IDs instead of protocol-native content hashes | All | 🟡 HIGH |

### 6.3 Medium-Priority Gaps

| # | Gap | Protocol | Fix Priority |
|---|-----|----------|-------------|
| **M1** | No NIP-05 resolution for Nostr handles | Nostr | 🟡 MEDIUM |
| **M2** | Bluesky video embeds not parsed | AT Protocol | 🟡 MEDIUM |
| **M3** | No quote post handling (Bluesky + Farcaster) | AT Protocol, Farcaster | 🟡 MEDIUM |
| **M4** | Farcaster LONG_CAST/TEN_K_CAST not handled | Farcaster | 🟡 MEDIUM |
| **M5** | ActivityPub attachment array not parsed for media types | ActivityPub | 🟡 MEDIUM |
| **M6** | Cross-protocol identity linking (alsoKnownAs) not automated | All | 🟡 MEDIUM |

### 6.4 Recommended Fix Order

```
Week 1: 🔴 CRITICAL Fixes
┌─────────────────────────────────────────────────────────────────┐
│ 1. Create Nostr kind-1 text note provider (nostr-text-notes.ts)   │
│ 2. Implement Bluesky facet parsing in mapper.ts                   │
│ 3. Implement Farcaster mentions+mentionsPositions + parentCastId  │
│ 4. Fix all cross-poster transforms to use protocol-native formats │
└─────────────────────────────────────────────────────────────────┘

Week 2: 🟡 HIGH Fixes
┌─────────────────────────────────────────────────────────────────┐
│ 5. Switch GTS OAuth to user-level tokens (authorization_code)    │
│ 6. Subscribe to Bluesky relay firehose (jetstream or direct)     │
│ 7. Deploy self-hosted Nostr relay (resolve GHCR auth)            │
│ 8. Implement reaction/engagement metrics fetching for Farcaster   │
│ 9. Add thread context to UnifiedPost model across all providers  │
└─────────────────────────────────────────────────────────────────┘

Week 3: 🟡 MEDIUM Fixes
┌─────────────────────────────────────────────────────────────────┐
│ 10. NIP-05 resolution for Nostr                                 │
│ 11. Bluesky video embed + quote post support                    │
│ 12. Farcaster LONG_CAST/TEN_K_CAST support                      │
│ 13. ActivityPub attachment/tag parsing                          │
│ 14. alsoKnownAs-based cross-protocol identity linking           │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 Cross-Cutting Recommendation: UnifiedPost Evolution

The current `UnifiedPost` type is too simple. It needs to be extended to preserve protocol-native features:

```typescript
// Current (too lossy)
interface UnifiedPost {
  id: string;
  protocol: string;
  author: { id, handles, displayName, ... };
  text: string;
  embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }>;
  createdAt: number;
  metrics: { likes, reposts, replies, quotes };
  // ... engagement, niches, raw
}

// Proposed: ProtocolAwareUnifiedPost
interface ProtocolAwareUnifiedPost extends UnifiedPost {
  // Thread context (currently missing)
  replyTo?: { protocol: string; id: string; author?: string };
  threadRoot?: { protocol: string; id: string };
  
  // Tags/annotations (currently lost)
  mentions: Array<{ id: string; protocol: string; displayName?: string; byteOffset?: number }>;
  hashtags: string[];
  
  // Rich facets (currently stripped)
  facets?: Array<{
    type: 'link' | 'mention' | 'hashtag';
    byteStart: number;
    byteEnd: number;
    value: string; // URL, pubkey/DID, or tag name
  }>;
  
  // Protocol-native media (beyond just URL embeds)
  attachments?: Array<{
    type: 'image' | 'video' | 'audio' | 'document' | 'link-card';
    url: string;
    mimeType?: string;
    alt?: string;
    width?: number;
    height?: number;
    thumbnail?: string;
    duration?: number;
  }>;
  
  // Protocol-native identity
  nativeIdentity: {
    activitypub?: { actorUri: string; inbox: string };
    atproto?: { did: string; repoRev: string };
    nostr?: { pubkey: string; npub: string };
    farcaster?: { fid: number; signer: string };
  };
}
```

---

## Sources

### Primary Specs
1. ActivityPub W3C Recommendation (2018-01-23): https://www.w3.org/TR/activitypub/
2. AT Protocol Specs: https://atproto.com/specs/atp
   - Data Model: https://atproto.com/specs/data-model
   - Repository: https://atproto.com/specs/repository
   - DID: https://atproto.com/specs/did
   - HTTP API (XRPC): https://atproto.com/specs/xrpc
   - Sync: https://atproto.com/specs/sync
3. Nostr NIP-01 (Basic Protocol): https://github.com/nostr-protocol/nips/blob/master/01.md
4. Farcaster Protocol Specification: https://github.com/farcasterxyz/protocol/blob/main/docs/SPECIFICATION.md
5. Farcaster Messages (Snapchain): https://snapchain.farcaster.xyz/reference/datatypes/messages
6. Farcaster Hub APIs: https://deepwiki.com/farcasterxyz/docs/4.1-hub-apis

### DegenFeed Codebase
7. GTS Instance Info: `GET http://127.0.0.1:8082/api/v1/instance`
8. Bridge Nostr Events: `bridge/src/providers/nostr-events.ts`
9. Bridge Farcaster: `bridge/src/providers/farcaster.ts`
10. Bridge Bluesky: `bridge/src/providers/bluesky/index.ts`, `fetchers.ts`, `mapper.ts`, `types.ts`, `helpers.ts`
11. Bridge ATProto: `bridge/src/providers/atproto.ts`
12. Bridge GTS Routes: `bridge/src/server/gts-routes.ts`
13. Crossposter Types: `bridge/src/lib/crossposter-types.ts`
14. Crossposter Transforms: `bridge/src/lib/crossposter-transforms.ts`
15. Crossposter Sources: `bridge/src/lib/crossposter-sources.ts`
16. Protocol Audit: `docs/PROTOCOL_AUDIT.md`
17. Protocol Status: `docs/PROTOCOL_STATUS.md`
18. Protocol Checklist: `docs/PROTOCOL-CHECKLIST.md`

---

*Generated: 2026-07-28 | Research confidence: HIGH (primary specs + codebase audit) | Next review: Quarterly or before any major protocol version migration*
