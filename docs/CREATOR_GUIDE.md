# DegenFeed Creator Guide

**Monetize your content, grow your audience, and build your brand across 44+ open social protocols and services — all from one platform.**  
Launch your own creator coin, earn tips across 4 chains, livestream to 7 platforms, and keep every penny.

> **No platform fees. No lock-in. No one can deplatform you.**

---

## Table of Contents

1. [Getting Started as a Creator](#getting-started-as-a-creator)
2. [Launching a Creator Coin](#launching-a-creator-coin)
3. [The Bonding Curve](#the-bonding-curve)
4. [Vesting Schedules](#vesting-schedules)
5. [Earning from Tips](#earning-from-tips)
6. [Monetizing Livestreams](#monetizing-livestreams)
7. [Revenue Sharing with Communities](#revenue-sharing-with-communities)
8. [Cross-Platform Promotion Strategies](#cross-platform-promotion-strategies)
9. [Growing Your Audience](#growing-your-audience)
10. [Reputation System for Creators](#reputation-system-for-creators)
11. [Analytics & Insights](#analytics--insights)
12. [Best Practices](#best-practices)

---

## Getting Started as a Creator

### Prerequisites

1. **Sign in with a wallet** (EVM or Solana)
2. **Link your protocol accounts** — Nostr, Farcaster, Bluesky, Mastodon, Lens, etc.
3. **Complete your profile** — Bio, avatar, cover image, links

### Creator Dashboard

Your creator hub is at `/profile/monetization`. Here you can see:

- Total tips received
- Creator coin value and trading volume
- Livestream earnings
- Reputation score
- Analytics overview

---

## Launching a Creator Coin

Creator coins are ERC-20 (Base) or SPL (Solana) tokens that represent your personal economy. Fans buy, hold, and trade your coin to support you.

### Step 1: Navigate to Launch

Go to **/launch** or click **"Launch Coin"** from your profile.

### Step 2: Configure Your Coin

| Field | Description |
|-------|-------------|
| **Name** | Full name of your token (e.g., "Vitalik's Token") |
| **Symbol** | Ticker (e.g., "VITALIK") — 3-6 uppercase letters |
| **Chain** | Choose deployment chain (see below) |
| **Vesting Preset** | How your allocation unlocks (see [Vesting](#vesting-schedules)) |
| **Fee Recipient** | Wallet for platform fees (2.5% on trades) |
| **Community Treasury** | Address for split tip revenue (optional) |

### Supported Chains

| Chain | Token Type | Gas Cost | Wrapping |
|-------|-----------|----------|----------|
| **Base** | ERC-20 | ~$5-15 | Auto-wrap to Zora |
| **Solana** | SPL Token | ~$0.01 | Manual bridge |
| **Polygon (Lens)** | ERC-20 | ~$1-3 | Bridge to Base + Solana |

### Step 3: Deploy

Click **"Deploy Coin"** and confirm the transaction in your wallet. You'll pay gas for the contract deployment.

**What happens after deployment:**
1. Your coin contract is created (DegenFeedFactory on Base, Anchor program on Solana)
2. A bonding curve is initialized with your parameters
3. The coin is registered in the Cross-Chain Registry
4. On Farcaster: an announcement frame is published about your new coin
5. On Lens: the coin is linked to your Lens profile
6. The coin appears on your unified creator profile

### Step 4: Promote

Share your coin with your audience. Use the auto-generated share card and post across all your connected protocols.

---

## The Bonding Curve

Creator coins use a **sigmoid bonding curve** with 5 distinct eras. The price automatically rises as more coins are bought.

### Curve Eras

| Era | Supply Range | Price Behavior |
|-----|-------------|----------------|
| 🚀 **Steal Deal** | 0–160M | Basically free — sub-cent prices |
| 🌅 **Early Bird** | 160M–320M | Sub-dollar — early supporters get in cheap |
| 📈 **Ramp Up** | 320M–480M | Accelerating — price takes off |
| 🎯 **Fair Launch** | 480M–640M | Exponential growth |
| 🌙 **Moonshot** | 640M–800M | Peak — highest prices |

**Total Supply:** 1,000,000,000,000,000,000 (1 quintillion base units)
**Graduation Supply:** 800,000,000,000,000,000 (800 quadrillion)

### Key Metrics

- **Graduation progress** — How close the coin is to reaching full price
- **Market cap** — Current fully diluted market cap
- **Price** — Current coin price in ETH/SOL
- **Volume** — 24h trading volume

### Price Prediction Tools

- `predictPriceAfterBuys(amount)` — See price after X buys
- `buysUntilPriceTarget(target)` — How many buys to reach a target price
- `formatCurvePrice(price)` — Human-readable price display

### Anti-Exploit Protection

To prevent bot attacks and whale manipulation, the bonding curve has 3 phases:

| Phase | Duration | Max Buy | Mechanism |
|-------|----------|---------|-----------|
| **Phase 1** | First 5 min | 2% of supply | Tight limit |
| **Phase 2** | 5–30 min | 5% of supply | Medium limit |
| **Phase 3** | After 30 min | 10% of supply | Gradual unlock |

Additional protections:
- **Bundle detection** — Identifies and blocks coordinated buys
- **Cooldowns** — Per-wallet buy frequency limits
- **Dust protection** — Minimum buy amount prevents micro-transaction attacks

### Gamification

| Feature | Description |
|---------|-------------|
| **Badges** | Earn badges for milestones (First Buyer, Whale, Diamond Hands, etc.) |
| **Milestones** | Community milestones at 10%, 25%, 50%, 75%, 100% of graduation |
| **Flash Sales** | Time-limited discounts on early buys |
| **Referral Boosts** | Earn bonus tokens for referring buyers |
| **Streak Multiplier** | Buy multiple days in a row for increasing bonuses |

---

## Vesting Schedules

When you launch a creator coin, your **creator allocation** (a portion of the total supply) is locked according to the chosen vesting preset.

### Vesting Presets

| Preset | Initial Unlock | Cliff | Full Duration | Min Reputation |
|--------|---------------|-------|---------------|----------------|
| 🔒 **Trustless** | 0% | 30 days | 90 days | 0 |
| ⚖️ **Balanced** | 5% | 7 days | 60 days | 25 |
| 🌱 **Community** | 10% | 0 days | 30 days | 50 |
| ⚡ **Fast** | 20% | 0 days | 7 days | 75 |

### How Vesting Works

1. At deployment, your allocation is sent to a vesting vault
2. During the **cliff period**, no tokens can be claimed
3. After the cliff, tokens unlock **linearly** over the duration
4. You can claim unlocked tokens at any time
5. The **minimum reputation** requirement gates which presets you can use — higher reputation unlocks faster presets

### Reputation-Gated Presets

| Tier | Available Presets |
|------|------------------|
| Newcomer (0) | Trustless only |
| Contributor (50) | Trustless, Balanced |
| Active (200) | Trustless, Balanced, Community |
| Trusted (500) | All presets including Fast |
| Veteran (1000+) | All presets with best terms |

---

## Earning from Tips

### Setting Up Tipping

1. Go to **Profile** → **Monetization**
2. Configure your receiving wallets for each chain
3. Set up your **Lightning address** for Nostr zaps
4. Optionally set a **community treasury** address for split tips

### Tip Sources

| Source | How It Works |
|--------|-------------|
| **Direct ETH tips** | Anyone sends ETH via the DegenFeedTips contract on Base/Optimism/Arbitrum |
| **Solana tips** | Native SOL received directly to your wallet |
| **Lightning tips** | Nostr zaps via your Lightning address |
| **Creator coin tips** | Fans send your creator coin directly |
| **Lens collects** | Users collect your Lens publications |
| **Split tips** | 90% to you, 10% to your community treasury |

### Tip History

View all your received tips across all chains at `/activity/tips`. Export available at **Profile** → **Data**.

### Withdrawing Tips

Tips go directly to your connected wallets. No withdrawal process needed — they're yours instantly.

---

## Monetizing Livestreams

### Going Live

1. Go to **/live**
2. Click **"Go Live"**
3. Choose your stream type:
   - **Solo** — Just you
   - **Collab** — With co-streamers
   - **Coin Launch** — Launch event with your creator coin
   - **Space** — Audio-only conversation
4. Get your **RTMP key** and server URL for OBS
5. Configure stream quality (1080p, 720p, etc.)
6. Click **"Start Stream"**

### Stream Monetization

| Method | Description |
|--------|-------------|
| **Donations** | Viewers can tip during the stream |
| **Coin Launches** | Stream integrated with your creator coin launch |
| **Subscriber-only chat** | Premium subscribers get exclusive chat access |
| **Paid access** | Set a minimum tip to join (Premium feature) |

### Cross-Protocol Announcements

When you go live, DegenFeed automatically announces on:

- **ActivityPub** (GoToSocial / Mastodon)
- **Nostr** (kind 30311 live event)
- **AT Protocol** (Bluesky)
- **Farcaster** (interactive frame)
- **Telegram** (bot notification)

### Ending a Stream

1. Click **"End Stream"** on the stream controls
2. The recording is saved to PeerTube
3. Viewers can replay the VOD

---

## Revenue Sharing with Communities

### Community Treasuries

Set up a community treasury wallet that receives 10% of split tips. This creates a sustainable funding source for your community.

### Configuring Splits

When setting up tipping in **Profile** → **Monetization**:

1. Enable **"Split Tips"**
2. Set your **Community Treasury** address
3. Optionally set the split percentage (default: 90/10)

### Understanding the Split

For a 1 ETH split tip:
- **You receive:** 0.9 ETH (minus gas)
- **Community treasury receives:** 0.1 ETH

---

## Cross-Platform Promotion Strategies

### Maximize Your Reach

1. **Post to all protocols simultaneously**
   - Use the composer to publish to Nostr + Farcaster + Bluesky + Mastodon + Lens
   - Free tier: 3 protocols per post
   - Premium: unlimited protocols

2. **Use protocol-specific features**
   - **Farcaster:** Embed frames and use channels
   - **Nostr:** Use NIP-57 zaps for instant monetization
   - **Bluesky:** Use feeds and starter packs
   - **Lens:** Use collects and mirrors

3. **Schedule posts for optimal timing**
   - Use the scheduler in the composer
   - Analyze your best posting times in analytics

4. **Cross-link your communities**
   - Create a Feddy community and announce it on all protocols
   - Host spaces with guests from different protocols

### Announce a Creator Coin Launch

1. Pre-announce on all protocols 1 week before
2. Go live on launch day with a stream
3. Pin the launch announcement
4. Host an AMA space after launch
5. Use the flash sale feature for early buyers

### Content Repurposing

| Content Type | Protocol Fit |
|-------------|-------------|
| Short text | Nostr, Farcaster, Mastodon, Bluesky, Threads |
| Long-form | Lens, PeerTube, RSS |
| Images | All protocols (auto-attached) |
| Video | PeerTube, YouTube |
| Audio | Spaces (recorded), PeerTube |
| Links | All protocols (auto-embedded) |

---

## Growing Your Audience

### Cross-Protocol Identity

1. **Link all your identities** — When someone finds you on Nostr, they can follow you on Farcaster too
2. **Use the same handle** across protocols where possible
3. **Verify your wallet** on each protocol

### Reputation Building

Higher reputation tiers give you access to:
- Faster vesting presets for creator coins
- Higher daily posting limits
- Enhanced discovery in feeds
- Analytics access (Veteran+)
- Priority support (Trusted+)

### Engagement Tips

- **Reply to comments** across all protocols
- **Host regular spaces** to build community
- **Use the visual feed** — media-rich posts get more engagement
- **Cross-promote collaborators** — guest in each other's spaces
- **Share your analytics** transparently with your community

---

## Reputation System for Creators

### Why Reputation Matters

Reputation determines:
- Which vesting presets you can use
- How much you can post per day
- Whether your content gets boosted in feeds

| Tier | Post Limit | Creator Coin Presets |
|------|-----------|---------------------|
| Newcomer | 5/day | Trustless only |
| Contributor | 10/day | Trustless, Balanced |
| Active | 25/day | + Community |
| Trusted | 50/day | + Fast |
| Veteran | 100/day | All presets |
| Elite | 200/day | All presets |
| Legend | 500/day | All presets |

### Fast-Track Your Reputation

- **Create quality content** — Posts that get engagement earn more
- **Use cross-protocol bridge** — +15 rep per bridge action
- **Receive tips** — +5 rep per tip received
- **Stay active** — Consistent daily activity builds trust

---

## Analytics & Insights

### Creator Analytics (Veteran+)

Access at **Profile** → **Analytics**:

| Metric | Description |
|--------|-------------|
| **Total Reach** | Impressions across all protocols |
| **Engagement Rate** | Likes + replies + reposts / impressions |
| **Top Protocols** | Which networks drive the most engagement |
| **Tip Volume** | Total tips received (all chains) |
| **Coin Performance** | Price, volume, holders over time |
| **Audience Growth** | Follower count over time |
| **Best Posting Times** | When your audience is most active |

### Public Leaderboards

- **/leaderboard/creators** — Top creators by engagement
- **/leaderboard/tippers** — Top tippers by volume
- **/leaderboard/communities** — Most active communities

---

## Best Practices

### 🎯 Do's

- **Build before you launch** — Grow an audience before deploying a creator coin
- **Engage authentically** — Reply, repost, and participate across protocols
- **Use the composer** — Cross-post saves time and maximizes reach
- **Host regular spaces** — Audio builds deeper connections
- **Share your journey** — Transparency builds trust with your community
- **Set realistic vesting** — Trust the process; Balanced is a great default

### 🚫 Don'ts

- **Don't launch a coin without a community** — Nobody buys an empty token
- **Don't spam the same content** — Each protocol has different norms
- **Don't ignore protocol culture** — Nostr values sovereignty, Farcaster loves frames
- **Don't set unrealistic expectations** — Creator coins are not guaranteed investments
- **Don't neglect security** — Never share private keys or seed phrases

### 🛡️ Safety

- Creator coins are **not financial advice** — they're social tokens
- Past performance doesn't guarantee future results
- Bonding curve investments carry risk
- Always do your own research before buying any creator's coin

---

## Need Help?

- **Documentation:** [docs.degenfeed.xyz](https://docs.degenfeed.xyz)
- **Creator Community:** [app.degenfeed.xyz/c/creators](https://app.degenfeed.xyz/c/creators)
- **Support:** [app.degenfeed.xyz/c/support](https://app.degenfeed.xyz/c/support)
- **FAQ:** [app.degenfeed.xyz/faq](https://app.degenfeed.xyz/faq)
