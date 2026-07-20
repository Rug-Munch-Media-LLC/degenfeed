# DegenFeed User Guide

**Your guide to the unified open social web.**  
From first login to cross-platform posting, tipping, creator coins, and live streaming — everything you need to master decentralized social media.

> **Live at [app.degenfeed.xyz](https://app.degenfeed.xyz) | No account required to browse.**

---

## Table of Contents

1. [Creating an Account](#creating-an-account)
2. [Connecting Your Wallets](#connecting-your-wallets)
3. [Linking Social Protocol Accounts](#linking-social-protocol-accounts)
4. [Navigating the Feed](#navigating-the-feed)
5. [Posting Cross-Platform](#posting-cross-platform)
6. [Tipping Creators](#tipping-creators)
7. [Receiving Tips](#receiving-tips)
8. [Joining Audio Spaces](#joining-audio-spaces)
9. [Watching Livestreams](#watching-livestreams)
10. [Creating a Feddy Community](#creating-a-feddy-community)
11. [Using the Visual Feed](#using-the-visual-feed)
12. [Watching Short-Form Videos](#watching-short-form-videos)
13. [Searching Across Protocols](#searching-across-protocols)
14. [Managing Notifications](#managing-notifications)
15. [Direct Messaging](#direct-messaging)
16. [Reputation & Tiers](#reputation--tiers)
17. [Bookmarking Content](#bookmarking-content)
18. [Premium Subscription](#premium-subscription)
19. [Settings & Preferences](#settings--preferences)

---

## Creating an Account

DegenFeed uses **wallet-based authentication**. You don't need a username/password.

### Step 1: Visit app.degenfeed.xyz

Navigate to [app.degenfeed.xyz](https://app.degenfeed.xyz) in your browser.

### Step 2: Click "Sign In"

You'll see the sign-in button in the top-right corner.

### Step 3: Connect Your Wallet

Choose your wallet type:

- **EVM Wallet** (MetaMask, Coinbase Wallet, Rainbow, WalletConnect, etc.)
- **Solana Wallet** (Phantom, Backpack, Solflare, etc.)

A signature request will appear — this is **free** (no gas fee). You're signing a message to prove you own the wallet, not submitting a transaction.

### Step 4: You're In!

Once signed, you'll be redirected to your personalized feed. Your session persists across visits.

> **Security note:** DegenFeed never has access to your private keys. All signing happens locally in your wallet.

---

## Connecting Your Wallets

You can connect multiple wallets to link identities across chains.

1. Go to your **Profile** → **Settings**
2. Click **"Connect Wallet"**
3. Choose **Ethereum** or **Solana**
4. Sign the message in your wallet

Each connected wallet becomes part of your unified identity. Tips sent to any linked wallet reach you.

---

## Linking Social Protocol Accounts

To read feeds, post, and tip across protocols, link your accounts.

### Supported Protocols

| Protocol | What You Can Do |
|----------|----------------|
| Nostr | Read feed, post, tip via Lightning |
| Farcaster | Read feed, post, trade creator coins |
| Bluesky | Read feed, post, tip |
| Mastodon | Read feed, post, tip, livestream |
| Lens | Read feed, tip, trade creator coins |
| Threads | Read feed, post |
| PeerTube | Watch streams, post, tip |
| Telegram | Receive notifications |

### How to Link

1. Go to **Settings** → **Connected Accounts**
2. For each protocol, click **"Connect"**
3. Follow the authentication flow:
   - **Nostr:** Enter your nsec/npub or use extension (nos2x, Alby)
   - **Farcaster:** Sign in with Warpcast
   - **Bluesky:** Enter handle + app password
   - **Mastodon:** Enter instance URL + authorize
   - **Lens:** Sign with your wallet
   - **Threads:** OAuth authorization
   - **Telegram:** Connect via @DegenFeedBot

> **Pro tip:** Use an **app password** for Bluesky and Mastodon rather than your main password.

---

## Navigating the Feed

The main feed at `/feed` aggregates posts from all connected protocols.

### Feed Tabs

| Tab | Description |
|-----|-------------|
| **For You** | Personalized feed based on your engagement |
| **Following** | Posts from people you follow |
| **Trending** | Viral content across all protocols |
| **News** | Curated news from 353+ RSS sources |
| **Recent** | Chronological feed |

### Protocol Filters

Click any protocol pill to see only posts from that network:

- `#Nostr` — Only Nostr notes
- `#Farcaster` — Only Farcaster casts
- `#Bluesky` — Only Bluesky posts
- `#Lens` — Only Lens publications
- etc.

### Category Filters

Narrow your feed by topic: **DeFi**, **AI**, **Bitcoin**, **Ethereum**, **Solana**, **Security**, **Macro**.

### Feed Actions

On each post you can:

- **Like** — Show appreciation (cross-protocol)
- **Repost** — Share to your followers
- **Reply** — Start a thread
- **Bookmark** — Save for later
- **Tip** — Send crypto (see [Tipping section](#tipping-creators))
- **Share** — Copy link or share externally

---

## Posting Cross-Platform

Write once, publish everywhere.

### Step 1: Open the Composer

Click the **"What's happening?"** box at the top of your feed, or click the **+** button.

### Step 2: Write Your Post

Type your content in the composer. You can include:

- **Text** — Up to 2000 characters
- **Images** — Drag & drop or click to upload (max 4 per post)
- **Links** — Auto-embedded previews
- **Hashtags** — Cross-protocol discoverability

### Step 3: Select Target Protocols

Choose which protocols to publish to:

| Protocol | Requires |
|----------|----------|
| ✅ Nostr | nsec or extension connected |
| ✅ Farcaster | Warpcast connected |
| ✅ Bluesky | Handle + app password |
| ✅ Mastodon | Instance + token |
| ✅ Lens | Wallet signed |
| ✅ Threads | OAuth connected |

**Free tier:** Up to 3 protocols per post.
**Premium:** Unlimited protocols.

### Step 4: Schedule (Optional)

Click the clock icon to set a future publish time.

### Step 5: Publish

Click **"Post"** or press `Cmd+Enter`. Your content is published simultaneously to all selected protocols.

> **Note:** For Nostr and Farcaster, posts are signed locally in your browser and never touch our servers. For other protocols, auth tokens are used.

---

## Tipping Creators

Support creators across any protocol with crypto tips.

### How to Tip

1. Find a post you want to support
2. Click the **💸** or **Tip** button below the post
3. Choose your **currency**:

| Currency | Network | Notes |
|----------|---------|-------|
| ETH | Base / Optimism / Arbitrum | Via DegenFeedTips contract |
| SOL | Solana | Native SOL |
| USDC | Base / Solana | Stable value |
| Creator Coin | Base / Solana | Creator-specific tokens |
| BTC (Lightning) | Lightning Network | Instant, low fee |
| Lens Collect | Polygon | Collect the post to tip |

4. Enter the amount
5. Confirm in your wallet

### Tip Types

- **Direct tip** — 100% goes to the creator
- **Split tip** — 90% to creator, 10% to community treasury
- **Batch tip** — Split among multiple recipients in one transaction
- **Tip with message** — On-chain memo

### Supported Wallets

- MetaMask, Rainbow, Coinbase Wallet (EVM)
- Phantom, Backpack (Solana)
- Alby, Wallet of Satoshi (Lightning)

---

## Receiving Tips

To receive tips, ensure you have:

1. **Linked wallet** — The wallet used to sign in
2. **Lightning address** — For Nostr zaps (set in Nostr profile)
3. **Creator coin** — If you've launched one (see [Creator Guide](CREATOR_GUIDE.md))

Your unified tip history is available at `/activity/tips`.

---

## Joining Audio Spaces

Audio Spaces are live, multi-participant voice conversations.

### Find a Space

1. Go to **/spaces** or click **"Spaces"** in the navigation
2. Browse **Live** and **Upcoming** spaces
3. Click any space card to join

### Participate

- **Listeners** — Hear the conversation
- **Speakers** — Request the stage by raising your hand
- **Hosts** — Control who speaks, mute participants

### Features

- Real-time reactions (hearts, emojis, claps)
- Recording & transcription (host-enabled)
- Cross-protocol broadcasting
- Scheduled spaces with reminders

### Create a Space (Creators)

1. Go to **/spaces**
2. Click **"Create Space"**
3. Set title, description, and schedule
4. Choose which protocols to broadcast to
5. Click **"Launch"**

---

## Watching Livestreams

DegenFeed streams are powered by self-hosted **PeerTube** at video.degenfeed.xyz.

### Find a Stream

1. Go to **/live** or click **"Live"** in the navigation
2. Browse by category:
   - **All** — Everything live now
   - **Coin Launches** — Token launch events
   - **Spaces** — Audio spaces
   - **Solo** — Solo streams
   - **Collab** — Collaborative streams
3. Featured streams appear in the hero carousel

### Watch a Stream

Click any stream card to go to its dedicated page at `/live/[creator]`.

### Chat

Live chat is powered by Prosody XMPP at chat.degenfeed.xyz.

---

## Creating a Feddy Community

Feddy communities are cross-protocol community spaces.

### Step 1: Navigate to Feddy

Go to **/feddy** or click **"Communities"** in the navigation.

### Step 2: Create a Community

1. Click **"Create Community"**
2. Enter:
   - **Name** — URL-friendly name (e.g., `bitcoin-degens`)
   - **Display Name** — Human-readable title
   - **Description** — What's the community about?
   - **Protocols** — Which protocols to include
3. Click **"Create"**

### Step 3: Invite Members

Share the community link or invite people directly.

### Step 4: Moderate

As the creator, you can:
- Pin posts
- Remove members
- Set community rules
- Customize the feed view

---

## Using the Visual Feed

The visual feed displays images and video from all protocols in a rich media grid.

1. Go to **/visual** or click **"Visual"** in the navigation
2. Browse the masonry-style grid of rich media
3. Click any item to open the lightbox viewer

Media is auto-detected from post content across all protocols.

---

## Watching Short-Form Videos

Short-form videos are aggregated from PeerTube federated instances.

1. Go to **/shorts** or click **"Shorts"** in the navigation
2. Scroll vertically to browse (TikTok-style)
3. Use keyboard arrows to navigate
4. Click to interact (like, comment, share)

---

## Searching Across Protocols

### Global Search

1. Click the search icon or press `/`
2. Type your query
3. Results appear from all connected protocols
4. Filter by protocol using the pills

### Identity Search

Search for people by handle across protocols:

```
Search: "vitalik.eth"
Results:
  • Farcaster: vitalik.eth (FID: 123)
  • Lens: vitalik.lens
  • Nostr: npub1...
```

---

## Managing Notifications

Your unified notification inbox collects activity from all protocols.

1. Click the **bell** icon in the navigation
2. View notifications grouped by type:
   - **Likes** — Someone liked your post
   - **Reposts** — Someone shared your post
   - **Replies** — Someone replied to your post
   - **Follows** — New followers
   - **Tips** — You received a tip
   - **Mentions** — Someone mentioned you

### Push Notifications

Enable push notifications in **Settings** → **Notifications** to receive alerts even when you're not on DegenFeed.

---

## Direct Messaging

Send and receive messages across protocols.

1. Go to **/messages** or click **Messages** in the navigation
2. Click **"New Message"**
3. Search for a recipient by handle
4. Type your message and send

Your conversations are protocol-native where possible.

---

## Reputation & Tiers

DegenFeed has a 7-tier reputation system that rewards positive participation.

### Earning Reputation

| Action | Reputation | Daily Cap |
|--------|-----------|-----------|
| Create a post | +10 | 50 |
| Receive a like | +2 | 20 |
| Receive a tip | +5 | 30 |
| Gain a follower | +3 | 15 |
| Cross-protocol bridge | +15 | 30 |

### Reputation Tiers

| Tier | Min Rep | Benefits |
|------|---------|----------|
| 🌱 Newcomer | 0 | Basic access |
| ⭐ Contributor | 50 | Enhanced discovery, badge display |
| 🔷 Active | 200 | Custom feeds |
| 🛡️ Trusted | 500 | Priority support |
| 🏆 Veteran | 1,000 | Analytics access |
| 💎 Elite | 2,500 | All benefits |
| 👑 Legend | 5,000 | All benefits + highest limits |

### Stake Reputation

Stake your reputation on a post to boost its visibility. If the post performs well, you get a bonus. If it's flagged, your stake is slashed.

### Track Your Progress

View your reputation at **Profile** → **Achievements**.

---

## Bookmarking Content

Save posts to read later:

1. Click the **bookmark** icon on any post
2. Access your bookmarks at **Profile** → **Bookmarks**
3. Organize with folders (Premium)

---

## Premium Subscription

### Free Tier
- Read feeds from all protocols
- Post to up to 3 protocols at once
- Standard rate limits (1,000 req/h)
- Basic reputation features

### Premium Tier
- Post to unlimited protocols
- Higher rate limits (10,000 req/h)
- Advanced analytics
- Custom feed configurations
- Priority support
- Extended bookmark folders

### Upgrade

1. Go to **Settings** → **Subscription**
2. Choose the Premium plan
3. Complete payment (ETH, SOL, or card via Stripe)

---

## Settings & Preferences

Access all settings from your profile menu → **Settings**.

### Profile Settings

- Display name
- Bio / description
- Avatar (NFT or uploaded)
- Cover image

### Preferences

- **Theme** — Dark (default), Light, System
- **Language** — Interface language
- **Feed defaults** — Default sort, default protocol filters
- **Notification settings** — Which events trigger notifications
- **Privacy** — Who can see your likes, follows, etc.

### Connected Accounts

Manage your protocol connections. Reconnect or disconnect at any time.

### Muted Users

**Settings** → **Muted** — Manage your mute list.

### Data Export

**Profile** → **Data** — Export your data (posts, tips, activity).

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `?` | Show keyboard shortcuts |
| `/` | Focus search |
| `n` | New post |
| `j` | Next post |
| `k` | Previous post |
| `l` | Like / unlike |
| `b` | Bookmark |
| `Enter` | Open post |
| `Esc` | Close modal |

---

## Mobile

DegenFeed is available as a mobile app via **Capacitor** (iOS + Android). Install from your browser's "Add to Home Screen" menu for a native-like PWA experience.

---

*Need help? Join our [Community](https://app.degenfeed.xyz/c/support) or check the [FAQ](https://app.degenfeed.xyz/faq).*
