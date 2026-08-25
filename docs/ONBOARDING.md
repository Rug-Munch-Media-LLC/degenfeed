# DegenFeed — User Onboarding Guide

> Welcome to the Web3 Social Universe. This guide walks you through everything you need to know — from your first visit to becoming a power user.

**Live app:** [app.degenfeed.xyz](https://app.degenfeed.xyz)  
**Docs:** [docs.degenfeed.xyz](https://docs.degenfeed.xyz)  
**Protocols integrated:** 44+ decentralized social protocols and services

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Your First Feed](#2-your-first-feed)
3. [Linking Your Identities](#3-linking-your-identities)
4. [Personalizing Your Feed](#4-personalizing-your-feed)
5. [Creating Content](#5-creating-content)
6. [Creator Coins](#6-creator-coins)
7. [Tipping & Monetization](#7-tipping--monetization)
8. [Livestreaming](#8-livestreaming)
9. [Audio Spaces](#9-audio-spaces)
10. [Communities (Feddy)](#10-communities-feddy)
11. [Short-Form Video (Shorts)](#11-short-form-video-shorts)
12. [Tips for New Users](#12-tips-for-new-users)
13. [Getting Help](#13-getting-help)

---

## 1. Getting Started

### No Account Required to Browse

You can start using DegenFeed immediately without creating an account. Visit **[app.degenfeed.xyz](https://app.degenfeed.xyz)** to browse the unified feed, view trending content, and explore what the platform can do.

### Creating an Account

When you're ready to participate, you have several options:

**Option A: Connect a Crypto Wallet (Recommended)**
- **EVM wallets:** MetaMask, WalletConnect, Coinbase Wallet, Rainbow, Trust Wallet
- **Solana wallets:** Phantom, Backpack, Solflare
- Click "Connect Wallet" in the top-right corner
- Sign the message to prove wallet ownership (no gas fee)
- Your wallet address becomes your primary identity

**Option B: Email Registration**
- Click "Sign Up" → "Email"
- Enter your email address
- Receive a magic link or verification code
- Set up your display name and avatar

**Option C: OAuth (Social Login)**
- Click "Sign Up" → choose Google, GitHub, Discord, or Twitter
- Authorize the connection
- Link a wallet later to unlock full features

### Setting Up Your Profile

1. Click your avatar → **Settings**
2. Choose a display name and bio
3. Upload a profile picture
4. Set your preferred theme (dark/light/system)
5. Configure notification preferences

---

## 2. Your First Feed

### Browsing the Unified Feed

The main feed is your window into 44+ protocols. By default, it shows content from all connected protocols ranked by DegenFeed's smart scoring algorithm.

**Feed tabs:**
| Tab | What it shows |
|-----|---------------|
| **For You** | Personalized recommendations based on your engagement |
| **Trending** | Content gaining velocity across all protocols |
| **News** | Curated from 353+ RSS sources across 7 categories |
| **Following** | Content from creators you follow |

### Filtering by Protocol

Use the protocol filter bar to narrow your feed:
- Click any protocol icon (⚡ Nostr, ◈ Farcaster, 🦋 Bluesky, 🐘 Mastodon, 📷 Pixelfed, etc.)
- Combine multiple filters to see cross-protocol conversations
- Use the "All" button to reset

### Interacting with Posts

Each post has action buttons:
- **Like** — Show appreciation (cross-protocol for supported platforms)
- **Repost/Share** — Amplify content to your followers
- **Reply** — Join the conversation
- **Bookmark** — Save for later
- **Tip** — Send crypto directly to the creator

> 💡 Tip: You can bookmark without an account. Other actions require connecting a wallet or account.

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate posts up/down |
| `l` | Like current post |
| `b` | Bookmark current post |
| `t` | Tip current post |
| `Enter` | Open post detail |
| `?` | Show keyboard shortcuts |

---

## 3. Linking Your Identities

One of DegenFeed's core features is **cross-protocol identity resolution** — link accounts across protocols so your followers can find you everywhere.

### How Identity Linking Works

```
Your Wallet ──── Identity Hub ──── Nostr npub
                                  ├── Farcaster FID
                                  ├── Bluesky DID
                                  ├── Mastodon @handle
                                  ├── Lens profile
                                  ├── Telegram ID
                                  ├── Discord ID
                                  ├── GitHub username
                                  └── + more
```

### Step-by-Step

1. Go to **Settings → Linked Accounts**
2. Click **"Connect"** on each protocol you use
3. For each protocol:
   - **Nostr:** Enter your npub or nsec (nsec stored encrypted, never exposed)
   - **Farcaster:** Sign in with Warpcast
   - **Bluesky:** Enter handle + app password
   - **Mastodon:** Enter instance URL + authorize OAuth
   - **Lens:** Sign with your wallet
   - **Telegram:** Start the @DegenFeedBot and link
   - **Discord/GitHub:** OAuth authorization
4. Your unified profile automatically resolves across all connected protocols

### Benefits of Linking

- **Unified inbox** — replies and mentions from all protocols in one place
- **Cross-posting** — write once, publish everywhere
- **Identity search** — people find you by any handle
- **Unified tipping** — receive tips on any protocol to your wallet

---

## 4. Personalizing Your Feed

### Following Creators

- Click the **+ Follow** button on any profile or post
- Follow across specific protocols or all at once
- Manage follows in **Settings → Following**

### Muting and Blocking

- **Mute a user** — hide their content from your feed
- **Mute a protocol** — temporarily hide all content from a protocol
- **Block a user** — prevent them from interacting with your content
- Manage in **Settings → Privacy**

### Custom Feeds

Premium users can create custom feeds:
1. Go to **Settings → Feeds**
2. Click **"Create Custom Feed"**
3. Choose protocols, categories, keywords, and authors
4. Save and access from the feed sidebar

### Notification Preferences

Configure what you're notified about:
- Likes and reposts
- Tips received
- Livestream starts from followed creators
- Space invitations
- Coin price movements
- Community activity

Access in **Settings → Notifications**.

---

## 5. Creating Content

### Cross-Platform Composer

The composer is your window to the multi-protocol web:

1. Click the **"+"** button or press `c`
2. Write your content (text, images, video)
3. Select target protocols:
   - Free tier: up to 3 protocols per post
   - Premium: unlimited protocols
4. Add media attachments (drag & drop supported)
5. Schedule for later (optional)
6. Click **"Post"** — DegenFeed publishes to each protocol simultaneously

### Supported Protocols for Posting

| Protocol | Text | Images | Video | Polls |
|----------|------|--------|-------|-------|
| Nostr | ✅ | ✅ | ✅ | ✅ |
| Farcaster | ✅ | ✅ | ✅ | ✅ |
| Bluesky | ✅ | ✅ | ✅ | — |
| Mastodon | ✅ | ✅ | ✅ | ✅ |
| Threads | ✅ | ✅ | — | — |
| Telegram | ✅ | ✅ | ✅ | ✅ |
| Discord | ✅ | ✅ | — | — |
| Matrix | ✅ | ✅ | ✅ | — |
| GitHub | ✅ | — | — | — |
| PeerTube | ✅ | ✅ | ✅ | — |
| Pixelfed | ✅ | ✅ | ✅ | — |
| Ghost/Mirror/Paragraph | ✅ | ✅ | — | — |
| + more | ✅ | ✅ | ✅ | varies |

### Scheduled Posting

1. Open the composer
2. Write your post and select targets
3. Click the clock icon
4. Choose date and time (timezone-aware)
5. DegenFeed publishes automatically

### Long-Form Publishing

For articles, blog posts, and long-form content:
1. Use the **"Write Article"** button
2. Rich text editor with headers, images, and embeds
3. Publish to WriteFreely, Ghost, Mirror.xyz, or Paragraph.xyz
4. Content federates via ActivityPub to Mastodon and other AP platforms

---

## 6. Creator Coins

DegenFeed lets any creator launch their own cryptocurrency token — no coding required.

### Launching a Coin

1. Go to **Launch** in the navigation
2. Choose your coin name and symbol
3. Select a chain: **Base** (ERC-20) or **Solana** (SPL)
4. Choose a vesting preset:

| Preset | Initial Unlock | Cliff | Duration | Min. Reputation |
|--------|---------------|-------|----------|-----------------|
| Trustless | 0% | 30 days | 90 days | 0 |
| Balanced | 5% | 7 days | 60 days | 25 |
| Community | 10% | 0 days | 30 days | 50 |
| Fast | 20% | 0 days | 7 days | 75 |

5. Pay the deployment fee (goes to liquidity)
6. Your coin is deployed automatically

### Bonding Curve

Your coin's price follows a **sigmoid bonding curve** with 5 eras:

| Era | Supply Range | Description |
|-----|-------------|-------------|
| 🚀 Steal Deal | 0 – 20% | Lowest prices, early supporters |
| 🌅 Early Bird | 20% – 40% | Still cheap, momentum building |
| 📈 Ramp Up | 40% – 60% | Price accelerates |
| 🚀 Fair Launch | 60% – 80% | Target price range |
| 🌙 Moonshot | 80% – 100% | Max price, max visibility |

### Trading

- **Buy:** Purchase creator coins with ETH (Base) or SOL (Solana)
- **Sell:** Sell coins back to the bonding curve
- **Slippage protection:** Set maximum slippage (default 5%)
- **Anti-exploit:** Per-wallet limits prevent whale manipulation

### Cross-Chain Bridging

Creator coins can be bridged between chains:
- **Base ↔ Solana** via Wormhole bridge
- **Base ↔ Polygon** via Wormhole bridge
- Register your coin in the Cross-Chain Registry for automatic lookup

---

## 7. Tipping & Monetization

### Supported Currencies

| Currency | Networks | Best For |
|----------|----------|----------|
| ⚡ Bitcoin (Lightning) | Lightning Network | Micro-tips, instant, near-zero fees |
| ETH | Base, Optimism, Arbitrum | Larger tips, EVM ecosystem |
| SOL | Solana | Fast, low-fee tips |
| USDC | Base, Solana | Stable value tipping |
| 🪙 Creator Coin | Any supported chain | Community engagement |

### Receiving Tips

1. Ensure your wallet is connected
2. Set up at least one receiving method:
   - **Lightning:** Add your LNURL or Lightning address in Settings
   - **EVM:** Your connected wallet address is used automatically
   - **Solana:** Your connected Solana wallet is used automatically
3. Creators can also set a default tip split (e.g., 90% to you, 10% to community fund)

### Sending Tips

1. Click the **Tip** button on any post or profile
2. Choose currency and amount
3. Add a message (optional)
4. Confirm in your wallet
5. **Zero platform fees** — 100% goes to the creator

### Batch Tipping

Send tips to up to 50 recipients in a single transaction:
1. Go to your following list
2. Select multiple creators
3. Set amounts per creator or total
4. Send once

### Streaming Payments

During livestreams, viewers can enable streaming payments:
1. Click **"Stream Tip"** during a live video
2. Set a per-minute rate
3. Payments flow automatically while you watch
4. Stop anytime

### Unified Leaderboard

See who's earning the most across all protocols:
- Top tipped creators
- Top tippers
- Trending coins by volume

---

## 8. Livestreaming

### Setup Requirements

- **DegenFeed account** with connected wallet
- **OBS Studio** (free) or compatible streaming software
- **Stable internet** (5+ Mbps upload recommended)

### Starting a Stream

1. Go to your **Creator Dashboard → Stream**
2. Choose stream type:
   - **Solo** — Just you
   - **Collab** — Invite co-streamers
   - **Coin Launch Event** — Celebrate your token launch
   - **Audio Space Stream** — Broadcast a space live
3. Set title, description, and category
4. Click **"Generate RTMP Key"**
5. Copy the RTMP URL and key into OBS
6. Click **"Go Live"**

### Cross-Protocol Announcements

When you go live, DegenFeed automatically announces on:
- **ActivityPub** (GoToSocial → fediverse)
- **Nostr** (kind 30311 event)
- **Bluesky** (post with stream link)
- **Farcaster** (embedded frame)
- **Telegram** (notification to subscribers)

### Chat During Streams

Real-time chat is powered by **Prosody XMPP**:
- Viewers can chat without creating an account
- Chat is bridged across connected protocols
- Moderation tools available for streamers

### Recording & Replays

Streams are automatically recorded and available on your PeerTube channel after the stream ends.

---

## 9. Audio Spaces

Audio Spaces are live, voice-only conversations that work across protocols.

### Creating a Space

1. Click **Spaces** in the navigation
2. Click **"Create Space"**
3. Set title and description
4. Choose max participants (up to 50)
5. Schedule for now or later
6. Select cross-protocol broadcast targets

### Joining a Space

- Browse **Live Spaces** from the Spaces page
- Click **"Join"** to enter as a listener
- Raise your hand if you want to speak
- Spaces work on Nostr, Farcaster, Bluesky, Lens, and Mastodon

### Roles

| Role | Permissions |
|------|-------------|
| **Host** | Full control: manage speakers, mute, end space |
| **Speaker** | Can talk, share screen |
| **Listener** | Can hear, chat via text, raise hand |

### Features

- **Recording** — Spaces can be recorded with automatic transcription
- **Scheduled spaces** — Set up future spaces with reminders
- **Cross-protocol** — Users join from any supported protocol
- **Revenue sharing** — Paid spaces with token-gated entry

---

## 10. Communities (Feddy)

Feddy is DegenFeed's cross-protocol community system.

### Finding Communities

- Browse from the **Communities** page
- Filter by category (DeFi, Art, Music, Tech, Gaming, etc.)
- Search by name or topic

### Joining a Community

1. Click **"Join"** on any community
2. If token-gated, connect a wallet holding the required token
3. Start participating in community discussions

### Creating a Community

1. Click **"Create Community"**
2. Choose a name and description
3. Set governance parameters (vote duration, quorum)
4. Configure token-gating (optional)
5. Choose which protocols the community spans

### Governance

Communities support on-chain governance:
- **Quadratic voting** — more votes cost more
- **Proposals** — create, debate, and vote
- **Treasury management** — community-controlled funds
- **Cross-protocol moderation** — moderators can act across all bridged platforms

---

## 11. Short-Form Video (Shorts)

### Browsing Shorts

The Shorts feed is a vertical, TikTok-style scrolling experience:
- Navigate via **Shorts** in the navigation
- Use keyboard arrows or swipe on mobile
- Like, comment, share, and tip directly from the shorts player

### Creating Shorts

1. Click the **"Upload Short"** button
2. Select a vertical video (9:16 aspect ratio recommended)
3. Add title, description, and tags
4. Choose whether to enable remix/duet
5. Set revenue sharing (optional)

### Remix & Duet

- **Remix:** Use another creator's short as source material
- **Duet:** Side-by-side with the original
- Both include automatic attribution
- Revenue sharing is configurable (default 50/50)

---

## 12. Tips for New Users

### Start Here

1. **Browse without an account first** — see if DegenFeed has the content you care about
2. **Connect one protocol at a time** — don't link everything at once; start with your most-used platform
3. **Try cross-posting** — write one post and publish to 2–3 protocols to see how it works
4. **Explore communities** — find communities that match your interests

### Power User Tips

- **Use keyboard shortcuts** — `j`/`k` to navigate, `l` to like, `c` to compose
- **Bookmark liberally** — build a reading list without account pressure
- **Create custom feeds** — filter by protocols, topics, and creators you care about most
- **Set up notifications** — enable Telegram or Matrix notifications for real-time engagement
- **Claim a vanity handle** — link your ENS or .sol name for a unified identity

### Monetization Quick Start

1. **Set up tipping** — configure Lightning address and wallet
2. **Publish consistently** — across 2–3 protocols to build audience
3. **Launch a coin** — when you have a following, launch your creator token
4. **Go live** — host a stream or audio space to deepen community engagement
5. **Create exclusivity** — use token-gated content for premium supporters

### Safety Tips

- **Never share private keys** — DegenFeed will never ask for your seed phrase
- **Verify tip addresses** — check the recipient before confirming transactions
- **Report suspicious content** — use the report button on any post
- **Use app passwords** — for Bluesky and Mastodon, use app passwords not your main password

---

## 13. Getting Help

### Documentation

- **Full docs:** [docs.degenfeed.xyz](https://docs.degenfeed.xyz)
- **API Reference:** [docs/API_REFERENCE.md](API_REFERENCE.md)
- **Creator Guide:** [docs/CREATOR_GUIDE.md](CREATOR_GUIDE.md)
- **Developer Guide:** [docs/DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
- **Self-Host Guide:** [docs/SELF_HOST_GUIDE.md](SELF_HOST_GUIDE.md)

### Community

- **Telegram:** [@DegenFeedBot](https://t.me/DegenFeedBot) to get started
- **Discord:** Join our community server (link in app)
- **Matrix:** Chat via Matrix at #degenfeed:matrix.degenfeed.xyz
- **Nostr:** Follow the DegenFeed npub for updates
- **Farcaster:** Follow /degenfeed channel

### Support

- **Email:** admin@rugmunch.io
- **Bug reports:** [Forgejo Issues](https://git.rugmunch.io/RugMunchMedia/degenfeed/issues)
- **Feature requests:** Use the feedback button in the app

---

*Welcome to the Web3 Social Universe. Post once, reach everywhere, earn from anywhere.*
