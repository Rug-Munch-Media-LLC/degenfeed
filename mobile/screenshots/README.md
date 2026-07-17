# DegenFeed App Store Screenshots

This directory contains screenshot mockups and the generation script for App Store and Play Store submission.

## Device Requirements

### Apple App Store

| Device | Screen Size | Pages Required | File Suffix |
|--------|------------|----------------|-------------|
| iPhone 6.7" (iPhone 14/15/16 Pro Max) | 1290×2796 px | Feed, Post, Discover, Profile, Messages | `iphone6.7` |
| iPhone 6.5" (iPhone 14/15 Plus, iPhone 14 Pro) | 1242×2688 px | Feed, Post, Discover, Profile, Messages | `iphone6.5` |
| iPhone 5.5" (iPhone 8 Plus) | 1242×2208 px | Feed, Post, Discover, Profile, Messages | `iphone5.5` |
| iPad 12.9" (iPad Pro 6th gen) | 2048×2732 px | Feed, Discover | `ipad12.9` |

### Google Play Store

| Device | Screen Size | Pages Required | File Suffix |
|--------|------------|----------------|-------------|
| Phone | 1080×2340 px | Feed, Post, Discover, Profile, Messages | `phone` |
| Tablet 7" | 1200×1920 px | Feed, Discover | `tablet7` |
| Tablet 10" | 1600×2560 px | Feed, Discover | `tablet10` |

## Naming Convention

```
degenfeed-{page}-{device-suffix}.png
```

Examples:
- `degenfeed-feed-iphone6.7.png`
- `degenfeed-discover-ipad12.9.png`
- `degenfeed-profile-phone.png`

## Page Descriptions

| Page | Content | Key Visual Elements |
|------|---------|-------------------|
| **Feed** | Main unified timeline | Dark bg, avatar list, cross-protocol post cards, DeGen green accents |
| **Post** | Compose/Post view | Text input, protocol selector toggles (Nostr, Farcaster, Lens, Bluesky), post button |
| **Discover** | Trending/Discover content | Grid of trending topics, popular creators, "what's hot" cards |
| **Profile** | User profile | Avatar, npub address, follower counts, protocol connections, post history |
| **Messages** | Direct messages | Conversation list, chat bubbles, protocol indicators on each message |

## Generation

### Using the Node script

```bash
node generate-screenshots.mjs
```

Requires:
- Node.js 20+
- Canvas support (natively on macOS, `apt install libcairo2-dev` on Linux)

### Placeholder generation (no dependencies)

A Set of placeholder images can be generated using ImageMagick:

```bash
# Install ImageMagick
brew install imagemagick   # macOS
apt install imagemagick    # Linux

# Run placeholder generator
bash generate-placeholders.sh
```

### Design Mockups (Figma)

For production screenshots, it's recommended to use the Figma design file:
`design/screenshots.fig`

Export from Figma:
1. Open the design file
2. Select the screenshot frame
3. File → Export → Select size (2x or 3x for Retina)
4. Name according to the naming convention above
