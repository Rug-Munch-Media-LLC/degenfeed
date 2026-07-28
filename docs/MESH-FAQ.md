# DegenFeed Mesh — Frequently Asked Questions

> **One account. Eight-plus decentralized networks. Your data, your rules.**
>
> Last updated: 2026-07-28

---

## What is the DegenFeed Mesh?

DegenFeed gives you **one account that works across 8+ decentralized social networks**. When you sign up at [social.degenfeed.xyz](https://social.degenfeed.xyz), you automatically get accounts on GoToSocial (Mastodon-compatible), Bluesky (AT Protocol), Nostr, Lemmy, Pixelfed, PeerTube, WriteFreely, and more — all with the **same username**.

We call it the *Mesh* because every node is interconnected. Post a microblog update and it flows to Mastodon, Nostr, and Bluesky. Upload a video and it lands on PeerTube, distributed through the fediverse. Your followers on any service can see your content, reply, and interact — all without needing an account on every platform.

## How does it work?

When you register, our concierge system creates accounts on every self-hosted service simultaneously:

1. **You sign up** at [social.degenfeed.xyz](https://social.degenfeed.xyz) using the Elk Mastodon client or directly via the DegenFeed app at [app.degenfeed.xyz](https://app.degenfeed.xyz)
2. **We provision accounts** on GoToSocial, Bluesky PDS, Nostr relay, Lemmy, PeerTube, Pixelfed, WriteFreely, and all other mesh services — all with your chosen username
3. **Our federation hub** (@degenfeed/crossplatform-register) links all your identities together. Your GoToSocial handle (`@you@social.degenfeed.xyz`) is the primary identity that maps to every other service
4. **The bridge infrastructure** synchronizes content across protocols. Post via ActivityPub and it reaches Nostr. Post via Nostr and it appears on Bluesky. Cross-posting happens at the infrastructure level — you don't need to think about it
5. **The Elk client** at social.degenfeed.xyz gives you a familiar Mastodon-like interface for the ActivityPub side of the mesh
6. **The DegenFeed app** at [app.degenfeed.xyz](https://app.degenfeed.xyz) aggregates everything — Mesh content plus Nostr, Farcaster, Lens, RSS, and 40+ other protocols — into one unified ranked feed

```
┌─ YOUR IDENTITY ──────────────────────────────────────────────┐
│                                                               │
│  @you@social.degenfeed.xyz  (GoToSocial — primary ActivityPub)│
│                                                               │
│  Maps to:                                                     │
│    @you@video.degenfeed.xyz         (PeerTube — video)        │
│    @you@community.degenfeed.xyz     (Lemmy — communities)     │
│    @you@photos.degenfeed.xyz        (Pixelfed — photos)       │
│    @you@blog.degenfeed.xyz         (WriteFreely — blogging)   │
│    @you@pds.degenfeed.xyz           (AT Protocol — Bluesky)   │
│    @you@relay.degenfeed.xyz         (Nostr relay)             │
│    @you@live.degenfeed.xyz          (Owncast — live streams)  │
│    @you@events.degenfeed.xyz        (Mobilizon — events)      │
│    @you@music.degenfeed.xyz         (Funkwhale — music)       │
│    @you@books.degenfeed.xyz         (BookWyrm — books)        │
│    @you@podcast.degenfeed.xyz       (Castopod — podcasts)     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Do I own my data?

**Yes. Every byte.**

Every service in the mesh is self-hosted on our infrastructure, but **you own your account and your content**. This means:

- **You can export your data** from any service at any time using standard ActivityPub data export tools
- **You can move to another provider** — your GoToSocial account can migrate to any Mastodon/GoToSocial instance. Your Bluesky PDS data can move to another PDS host. Your Nostr keypair goes wherever you go
- **Nothing is locked in** — we use open protocols exclusively. ActivityPub, AT Protocol, Nostr — all designed for portability from day one
- **You keep your followers** — ActivityPub and AT Protocol are designed so your social graph follows you when you move
- **Your content is not mined** — we don't train models on your posts, we don't sell your data, we don't algorithmically exploit your attention

> **The Mesh is yours.** We just run the servers.

## What services do I get?

### Free Plan — $0

| Service | Domain | What it does |
|---------|--------|-------------|
| **GoToSocial** | social.degenfeed.xyz | Mastodon-compatible microblogging (primary identity) |
| **Bluesky PDS** | pds.degenfeed.xyz | Your own AT Protocol personal data server — independent from Bluesky's infra |
| **Nostr Relay** | relay.degenfeed.xyz | Dedicated Nostr relay for your notes and zaps |
| **PeerTube** | video.degenfeed.xyz | Video hosting, livestreaming, and short-form video |
| **Lemmy** | community.degenfeed.xyz | Link aggregation, discussion forums, communities |
| **Pixelfed** | photos.degenfeed.xyz | Photo sharing (Instagram-like) |
| **WriteFreely** | blog.degenfeed.xyz | Long-form blogging (Medium-like) |
| **Owncast** | live.degenfeed.xyz | Live streaming with OBS, chat, and tipping |
| **Mobilizon** | events.degenfeed.xyz | Event management and RSVPs |
| **Castopod** | podcast.degenfeed.xyz | Podcast hosting and distribution |
| **Funkwhale** | music.degenfeed.xyz | Music sharing and listening |
| **BookWyrm** | books.degenfeed.xyz | Book reviews and reading lists |
| **Ghost CMS** | articles.degenfeed.xyz | Full-featured blog/ newsletter publishing |
| **Matrix** | matrix.degenfeed.xyz | Encrypted chat and messaging (Discord-like) |
| **RSS/Atom** | — | Auto-generated RSS feeds for all your content |

### Paid Upgrades

- **Standard ($8 one-time)** — Adds Farcaster and Lens Protocol accounts
- **Complete ($15 one-time)** — Standard + custom Lens handle + ENS name
- **Premium ($10/month)** — Everything in Complete + unlimited cross-posting, priority support, and analytics

See [docs.degenfeed.xyz](https://docs.degenfeed.xyz) for current pricing.

## Can I use each service separately?

**Yes.** Every service in the mesh is a standalone platform. You can:

- Browse Mastodon at **social.degenfeed.xyz** using the Elk client
- Watch and upload videos at **video.degenfeed.xyz**
- Join communities at **community.degenfeed.xyz**
- Share photos at **photos.degenfeed.xyz**
- Publish blog posts at **blog.degenfeed.xyz**
- Listen to music at **music.degenfeed.xyz**
- Host events at **events.degenfeed.xyz**
- Chat privately at **matrix.degenfeed.xyz**
- Read and publish newsletters at **articles.degenfeed.xyz**

Each service has its own native interface. You can use them independently, or use the unified DegenFeed app at [app.degenfeed.xyz](https://app.degenfeed.xyz) to see everything in one feed.

## What happens if I want to leave?

You can leave anytime. Here's what that looks like:

- **Export your data** — every service provides standard export tools (ActivityPub JSON, AT Protocol CAR files, Nostr key export)
- **Migrate your account** — GoToSocial supports standard Mastodon account migration. Your followers can follow your new account automatically
- **Move your PDS** — Bluesky's AT Protocol is designed so you can self-host your PDS or move to any provider
- **Take your Nostr key** — your Nostr private key is yours. Point it at any relay
- **Download your videos** — PeerTube supports bulk video export
- **We'll delete your data** — request deletion and we wipe all service data within 30 days

**We don't lock you in.** The Mesh is built on open protocols specifically so you can leave whenever you want.

## How is this different from just signing up for each service individually?

There are five key differences:

| | Signing up individually | DegenFeed Mesh |
|--|------------------------|----------------|
| **Setup time** | 15-30 minutes per service | One registration, instant |
| **Same username** | Different usernames everywhere | `@you` on every service |
| **Cross-posting** | Manual or third-party tools | Automatic via bridge infra |
| **Unified feed** | Multiple tabs, multiple apps | One feed at app.degenfeed.xyz |
| **Identity linking** | No built-in cross-service identity | Federation hub links everything |

In short: the Mesh removes the friction of managing 8+ decentralized services while preserving the principles — you own your data, you can leave anytime, everything is open protocol.

## Do I need to be technical to use the Mesh?

**No.** If you can sign up for a social media account, you can use the Mesh.

- The Elk client at **social.degenfeed.xyz** looks and feels like Mastodon/Twitter
- The DegenFeed app at **app.degenfeed.xyz** is a familiar social media interface
- Registration handles everything behind the scenes
- Each service has its own simple interface if you want to use them individually

If you *are* technical, you can self-host the entire stack, run your own Nostr relay, manage your PDS independently, and even contribute code at [git.rugmunch.io/RugMunchMedia](https://git.rugmunch.io/RugMunchMedia).

## Do you sell my data? Run ads? Have VC funding?

**No. None of that.**

| Question | Answer |
|----------|--------|
| Do you sell user data? | **Never.** We don't sell, share, or rent your data. Period. |
| Do you run ads? | **No.** Zero advertising. No trackers. No ad network. |
| Do you have VC funding? | **No.** We are entirely self-funded (Rug Munch Media LLC, Wyoming). |
| Do you train AI on my posts? | **No.** Your content is your own. We do not train models on it. |
| Do you algorithmically manipulate my feed? | **No.** The feed ranking is transparent. You control your filters and algorithm tuning. |

Our revenue model:
- **Premium subscriptions** ($10/month) for power users who want Farcaster, Lens, unlimited cross-posting, and analytics
- **Creator coin launch fees** (one-time gas costs, no platform markup)
- **No data selling. No ads. No enshittification.**

## What protocols does the DegenFeed app support beyond the Mesh?

The DegenFeed app at [app.degenfeed.xyz](https://app.degenfeed.xyz) aggregates **44+ protocols and services** into one feed, including:

| Protocol | Feed | Cross-post | Tips | Creator Coins |
|----------|------|-----------|------|---------------|
| **Mesh (all 14+ services)** | ✅ | ✅ | ✅ | — |
| **Nostr** | ✅ | ✅ | ✅ (Lightning) | — |
| **Farcaster** | ✅ | ✅ | ✅ | ✅ (Base) |
| **Bluesky** | ✅ | ✅ | ✅ | — |
| **Lens Protocol** | ✅ | — | ✅ | ✅ (Polygon) |
| **Threads (Instagram)** | ✅ | ✅ | — | — |
| **Reddit** | ✅ | — | — | — |
| **YouTube** | ✅ | — | — | — |
| **Telegram** | ✅ | ✅ | — | — |
| **Discord** | ✅ | ✅ | — | — |
| **Matrix** | ✅ | ✅ | — | — |
| **GitHub** | ✅ | ✅ | — | — |
| **RSS/Atom (353+ sources)** | ✅ | — | — | — |
| **Hacker News** | ✅ | — | — | — |
| **Zora** | ✅ | — | ✅ | ✅ (Wrap) |

Post once, reach everywhere. Earn tips in ETH, SOL, USDC, or Lightning. No platform fees.

## Is the Mesh open source?

**Yes.** Every line of code is open source under AGPL-3.0:

- **DegenFeed web app:** [git.rugmunch.io/RugMunchMedia/degenfeed-web](https://git.rugmunch.io/RugMunchMedia/degenfeed-web)
- **Bridge infrastructure:** Part of the degenfeed-web monorepo
- **Mirrors:** [GitHub](https://github.com/RugMunchMedia/degenfeed) | [Codeberg](https://codeberg.org/degenfeed/degenfeed-web)
- **License:** GNU Affero General Public License v3.0

You can inspect, fork, self-host, and contribute. The infrastructure that *runs* the mesh (GoToSocial, PeerTube, etc.) is itself open-source software — we just operate it.

## How do I get started?

1. **Visit** [social.degenfeed.xyz](https://social.degenfeed.xyz) or [app.degenfeed.xyz](https://app.degenfeed.xyz)
2. **Sign up** — choose your username. That one name becomes your identity across all services
3. **Connect a wallet** (EVM or Solana) — optional for basic use, required for tipping and creator coins
4. **Start posting** — your content automatically flows to the mesh
5. **Browse the unified feed** at app.degenfeed.xyz to see content from all 44+ protocols
6. **Customize** — tune your feed algorithms, set up cross-posting preferences, and manage your federated identities

See the full [User Guide](USER_GUIDE.md) for step-by-step instructions.

---

## Still have questions?

- **Documentation:** [docs.degenfeed.xyz](https://docs.degenfeed.xyz)
- **Status:** [status.degenfeed.xyz](https://status.degenfeed.xyz)
- **Contact:** admin@degenfeed.xyz
- **Security:** security@degenfeed.xyz
- **Source:** [git.rugmunch.io/RugMunchMedia](https://git.rugmunch.io/RugMunchMedia)
