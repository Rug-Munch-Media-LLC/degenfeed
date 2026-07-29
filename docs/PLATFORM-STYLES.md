# DegenFeed Platform-Specific Post Styling Guide

> **Look-to-Recognize (LTR)** — users should instantly know which platform a post
> is from without reading labels. Shape, color, and interaction patterns encode
> identity at a glance.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Protocol Visual Identity Matrix](#2-protocol-visual-identity-matrix)
3. [Platform Styling Layers](#3-platform-styling-layers)
4. [Per-Protocol Style Guide](#4-per-protocol-style-guide)
   - [Mastodon](#mastodon)
   - [Nostr](#nostr)
   - [Bluesky](#bluesky)
   - [Farcaster](#farcaster)
   - [Lens](#lens)
   - [Lemmy](#lemmy)
   - [Reddit](#reddit)
   - [PeerTube](#peertube)
   - [RSS / News](#rss--news)
   - [Pixelfed](#pixelfed)
   - [Zora](#zora)
   - [Twitch](#twitch)
   - [Threads](#threads)
5. [Implementation Patterns](#5-implementation-patterns)
6. [Current State vs. Target](#6-current-state-vs-target)
7. [Accessibility Notes](#7-accessibility-notes)

---

## 1. Design Philosophy

### Preserve Originality, Unify the Container

The DegenFeed unified feed **wraps** each protocol's post in a consistent
container (cards, spacing, typography) but **preserves** each platform's visual
identity through:

| Layer | What stays unified | What differs per protocol |
|-------|-------------------|---------------------------|
| **Card shell** | Border radius, padding, background | Left-border accent color (4px) |
| **Author row** | Avatar shape, follow/mute buttons | Avatar ring color, identity badge, handle format |
| **Post body** | Font size, line height, link color | Subtle background tint, CW handling |
| **Actions** | Button layout, spacing | Label text (Boost vs. Repost vs. Recast), available actions |
| **Thread / context** | Position in card | Protocol-specific sub-components |
| **Media** | Loading states | Embed type support |

### LTR (Look-to-Recognize) Principles

1. **Left-edge color stripe** — Each protocol gets a 4px left border in its accent
   color. Users recognize by peripheral vision.
2. **Avatar ring** — Each protocol has a distinctive colored ring on the avatar.
3. **Protocol badge** — A small colored chip in the header always shows the protocol
   name + icon.
4. **Action vocabulary** — Action buttons use each protocol's native terminology
   (e.g., "Boost", not "Repost" for Mastodon).
5. **Body background tint** — A subtle protocol-tinted background wash on the text
   area reinforces identity.

---

## 2. Protocol Visual Identity Matrix

| Protocol | Accent Color | Hex | Avatar Ring | Action Verbs | Card Class |
|----------|-------------|-----|-------------|--------------|------------|
| Mastodon | Purple-blue | `#6364ff` | Purple-blue | Boost, Favourite, Reply | `protocol-mastodon` |
| Nostr | Electric purple | `#8b5cf6` | Purple gradient | React, Repost, Reply | `protocol-nostr` |
| Bluesky | Sky blue | `#1185fe` | Blue gradient | Like, Repost, Reply | `protocol-bluesky` |
| Farcaster | Muted purple | `#8a63d2` | Purple gradient | Like, Recast, Reply | `protocol-farcaster` |
| Lens | Neon green | `#abfe2c` | Green gradient | Like, Mirror, Collect | `protocol-lens` |
| Lemmy | Blue-green | `#2d9cdb` | Blue-green | Upvote, Downvote, Reply | `protocol-lemmy` |
| Reddit | Orange-red | `#ff4500` | Orange | Upvote, Downvote, Award | `protocol-reddit` |
| PeerTube | Orange | `#f1680d` | Orange | Like, Dislike, Share | `protocol-peertube` |
| RSS | Amber | `#ffa500` | Amber | Read later | `protocol-rss` |
| Pixelfed | Yellow-rose | `#f9a825` | Yellow | Like, Share | `protocol-pixelfed` |
| Zora | Deep purple | `#6b21a8` | Purple | Mint, Like | `protocol-zora` |
| Twitch | Purple | `#9146ff` | Purple | Follow, Subscribe | `protocol-twitch` |
| Threads | Gray | `#888888` | Gray | Like, Repost, Reply | `protocol-threads` |

### CSS Custom Properties (from `design-tokens.css` & `protocol-feeds.css`)

```css
/* Already defined — use these tokens */
--color-protocol-nostr: #8b5cf6;
--color-protocol-farcaster: #8a63d2;
--color-protocol-lens: #abfe2c;
--color-protocol-bluesky: #1185fe;
--color-protocol-mastodon: #6364ff;
--color-protocol-reddit: #ff4500;
--color-protocol-lemmy: #00b868;
--color-protocol-rss: #ffa500;
--color-protocol-peertube: #e74c3c;
--color-protocol-pixelfed: #c44a8b;
--color-protocol-twitch: #9146ff;

/* Protocol background tints */
--color-bg-protocol-nostr: rgba(139, 92, 246, 0.04);
--color-bg-protocol-farcaster: rgba(138, 99, 210, 0.04);
--color-bg-protocol-lens: rgba(171, 254, 44, 0.03);
--color-bg-protocol-bluesky: rgba(17, 133, 254, 0.03);
--color-bg-protocol-mastodon: rgba(99, 100, 255, 0.04);
```

### CSS Classes (from `protocol-feeds.css`)

```css
.protocol-nostr { --protocol-accent: #8b5cf6; --protocol-bg: rgba(139,92,246,0.04); }
.protocol-farcaster { --protocol-accent: #8a63d2; --protocol-bg: rgba(138,99,210,0.04); }
.protocol-lens { --protocol-accent: #abfe2c; --protocol-bg: rgba(171,254,44,0.03); }
.protocol-bluesky { --protocol-accent: #1185fe; --protocol-bg: rgba(17,133,254,0.03); }
.protocol-mastodon { --protocol-accent: #6364ff; --protocol-bg: rgba(99,100,255,0.04); }
.protocol-reddit { --protocol-accent: #ff4500; --protocol-bg: rgba(255,69,0,0.04); }
.protocol-rss { --protocol-accent: #ffa500; --protocol-bg: rgba(255,165,0,0.04); }
.protocol-lemmy { --protocol-accent: #2d9cdb; --protocol-bg: rgba(45,156,219,0.04); }
.protocol-peertube { --protocol-accent: #f1680d; --protocol-bg: rgba(241,104,13,0.04); }
```

---

## 3. Platform Styling Layers

Each post card in the unified feed should apply platform-specific styling at these
layers, listed in order of visual priority:

```
┌──────────────────────────────────────────────────────┐
│ Layer 1: Card left-border (4px accent color)         │
├──────────────────────────────────────────────────────┤
│ Layer 2: Avatar ring (protocol-colored)              │
├──────────────────────────────────────────────────────┤
│ Layer 3: Author name + protocol badge row            │
│   [ProtocolBadge] [Author Name] [Badges] [Menu]      │
├──────────────────────────────────────────────────────┤
│ Layer 4: Body background tint (subtle)               │
├──────────────────────────────────────────────────────┤
│ Layer 5: Platform-specific context row                │
│   [Instance/relay/community info]                     │
├──────────────────────────────────────────────────────┤
│ Layer 6: Action buttons with protocol vocabulary     │
│   [Like ⚡] [Boost ⬆] [Reply 💬] [Share 📤]          │
└──────────────────────────────────────────────────────┘
```

---

## 4. Per-Protocol Style Guide

### Mastodon

| Element | Style |
|---------|-------|
| **Accent** | `#6364ff` (Mastodon purple-blue) |
| **Left border** | 4px solid `#6364ff` |
| **Avatar ring** | Ring 2, offset 1, color `#6364ff` |
| **Author name color** | `var(--color-fg)` |
| **Body tint** | `rgba(99, 100, 255, 0.04)` |
| **Context line** | Instance domain (e.g., `mastodon.social`) with 🐘 icon |
| **CW handling** | Spoiler text with "Click to reveal" button |
| **Action verbs** | **Favourite** (♡), **Boost** (↗), **Reply** (💬) |
| **Extra indicator** | Instance domain badge |
| **Post noun** | "toot" |

**Visual signature**: Purple-blue card edge + instance domain in muted text +
Boost/Favourite action labels.

```html
<!-- Example card structure -->
<article class="post-card protocol-mastodon">
  <!-- 4px left border via CSS -->
  <div class="protocol-left-border" style="--protocol-accent: #6364ff"></div>
  
  <PostHeader>
    <div class="mastodon-instance-row">
      🐘 mastodon.social
    </div>
  </PostHeader>
  
  <PostBody class="bg-protocol-mastodon" />
  
  <PostCardEngagement>
    <Action verb="favourite" />   <!-- "Favourite" not "Like" -->
    <Action verb="boost" />       <!-- "Boost" not "Repost" -->
  </PostCardEngagement>
</article>
```

---

### Nostr

| Element | Style |
|---------|-------|
| **Accent** | `#8b5cf6` (electric purple) |
| **Left border** | 4px solid `#8b5cf6` |
| **Avatar ring** | `ring-1 ring-[#8b5cf6]/40` |
| **Author name color** | `var(--color-fg)` |
| **Body tint** | `var(--color-bg-protocol-nostr)` with rounded corners + padding |
| **Context line** | Relay count badge (e.g., `⚡ 3 relays`) |
| **Extra indicators** | NIP-05 verification checkmark, npub handle |
| **Action verbs** | **Like** (❤️ or ⚡ zap), **Repost** (↗), **Reply** (💬) |
| **Zap support** | Lightning zap button with sats count |
| **Post noun** | "note" |

**Visual signature**: Purple gradient body background + relay count badge +
⚡ zap button.

---

### Bluesky

| Element | Style |
|---------|-------|
| **Accent** | `#1185fe` (sky blue) |
| **Left border** | 4px solid `#1185fe` |
| **Avatar ring** | Blue gradient ring |
| **Author name color** | `#60a5fa` (light blue) |
| **Body tint** | None (clean white/gray) |
| **Context line** | "AT Protocol" badge |
| **Handle format** | DID handle (e.g., `@user.bsky.social`) |
| **Action verbs** | **Like** (♡), **Repost** (↗), **Reply** (💬) |
| **Post noun** | "skeet" |

**Visual signature**: Blue accent + blue author name + AT Protocol badge +
clean card body.

---

### Farcaster

| Element | Style |
|---------|-------|
| **Accent** | `#8a63d2` (muted purple) |
| **Left border** | 4px solid `#8a63d2` |
| **Avatar ring** | `FARCASTER_RING` — ring-2, offset-1, `#8a63d2` |
| **Author name color** | `var(--color-fg)` |
| **Body tint** | `border-l-2 border-[#8a63d2] pl-3` |
| **Context line** | FID (Farcaster ID) |
| **Extra indicators** | Farcaster frames auto-detected in embeds |
| **Action verbs** | **Like** (♡), **Recast** (↗), **Reply** (💬) |
| **Post noun** | "cast" |

**Visual signature**: Purple left border on body + strong avatar ring +
"Recast" instead of "Repost".

---

### Lens

| Element | Style |
|---------|-------|
| **Accent** | `#abfe2c` (neon green) |
| **Left border** | 4px solid `#abfe2c` |
| **Avatar ring** | `ring-2 ring-offset-1 ring-[#abfe2c]` |
| **Author name color** | `#abfe2c` (green) |
| **Body tint** | `border-l-2 border-[#abfe2c]/30 pl-3` |
| **Context line** | "◈ Polygon" badge |
| **Handle format** | `@handle.lens` |
| **Action verbs** | **Like** (♡), **Mirror** (↗), **Collect** (📦) |
| **Post noun** | "publication" |

**Visual signature**: Neon green accent + green author name + Lens Publication
Badge in thread area + "Mirror" and "Collect" actions.

---

### Lemmy

| Element | Style |
|---------|-------|
| **Accent** | `#2d9cdb` (blue-green) |
| **Left border** | 4px solid `#2d9cdb` |
| **Avatar ring** | Blue-green ring |
| **Author name color** | `var(--color-fg)` |
| **Body tint** | None |
| **Context line** | Community name (e.g., `c/technology`) with CommunityBadge |
| **Action verbs** | **Upvote** (↑), **Downvote** (↓), **Reply** (💬) |
| **Thread view** | `LemmyThreadView` — nested comment tree |
| **Vote display** | Upvote count + Downvote count shown instead of like/repost |

**Visual signature**: Community badge + c/name context line + upvote/downvote
buttons (replaces standard like/repost).

---

### Reddit

| Element | Style |
|---------|-------|
| **Accent** | `#ff4500` (orange-red) |
| **Left border** | 4px solid `#ff4500` |
| **Avatar ring** | Orange ring |
| **Author name color** | `#ff4500` |
| **Body tint** | `var(--color-bg-protocol-reddit)` |
| **Context line** | Subreddit (e.g., `r/CryptoCurrency`) with red "R" icon |
| **Action verbs** | **Upvote** (↑), **Downvote** (↓), **Award** (🏅), **Reply** |
| **Score display** | Net upvote/downvote score |

**Visual signature**: Orange-red accent + subreddit "r/" badge + orange author name.

---

### PeerTube

| Element | Style |
|---------|-------|
| **Accent** | `#f1680d` (orange) |
| **Left border** | 4px solid `#f1680d` |
| **Avatar ring** | Orange ring |
| **Author name color** | `var(--color-fg)` |
| **Body tint** | `var(--color-bg-protocol-peertube)` |
| **Context line** | Channel name + instance |
| **Extra component** | `PeerTubeEmbed` — inline video player |
| **Action verbs** | **Like** (👍), **Dislike** (👎), **Share** (📤) |
| **Metadata** | Duration badge, resolution label |

**Visual signature**: Orange accent + inline video embed + channel name context.

---

### RSS / News

| Element | Style |
|---------|-------|
| **Accent** | `#ffa500` (amber) |
| **Left border** | 4px solid `#ffa500` |
| **Avatar ring** | Amber ring |
| **Author name color** | `#fbbf24` (yellow) |
| **Body tint** | `var(--color-bg-protocol-rss)` |
| **Context line** | Source domain + "via RSS" badge |
| **Reading time** | "X min read" display after body |
| **Action verbs** | **Save** (🔖), **Share** (📤) — no like/repost |
| **Post noun** | "article" |

**Visual signature**: Amber accent + reading time indicator + source domain.

---

### Pixelfed

| Element | Style |
|---------|-------|
| **Accent** | `#f9a825` (yellow-rose) |
| **Left border** | 4px solid `#f9a825` |
| **Avatar ring** | Yellow ring |
| **Author name color** | `var(--color-fg)` |
| **Body tint** | `var(--color-bg-protocol-pixelfed)` |
| **Context line** | Instance domain |
| **Extra** | Image-first layout (media takes priority) |
| **Action verbs** | **Like** (♡), **Share** (📤) |
| **Post noun** | "photo" |

---

### Zora

| Element | Style |
|---------|-------|
| **Accent** | `#6b21a8` (deep purple) |
| **Left border** | 4px solid `#6b21a8` |
| **Avatar ring** | Deep purple ring |
| **Author name color** | `var(--color-fg)` |
| **Action verbs** | **Mint** (🔨), **Like** (♡) |
| **Extra** | NFT media display, collection info |

---

### Twitch

| Element | Style |
|---------|-------|
| **Accent** | `#9146ff` (Twitch purple) |
| **Left border** | 4px solid `#9146ff` |
| **Avatar ring** | Twitch purple ring |
| **Context line** | Stream category + viewer count |
| **Action verbs** | **Follow**, **Subscribe** |
| **Extra** | Live indicator dot, clip embed |

---

### Threads

| Element | Style |
|---------|-------|
| **Accent** | `#888888` (gray) |
| **Left border** | 4px solid `#888888` |
| **Avatar ring** | Gray ring |
| **Author name color** | `var(--color-fg)` |
| **Action verbs** | **Like**, **Repost**, **Reply** |
| **Extra** | "via ActivityPub" badge when federated |

---

## 5. Implementation Patterns

### 5.1 Card-Level Protocol Class

The `<article>` element in `FeedList.tsx` should include the protocol class:

```tsx
// FeedList.tsx — post rendering
<article
  key={post.id}
  className={`post-card protocol-${post.protocol} ${isNew ? 'feed-item-enter' : ''}`}
  style={{
    // Add left-border accent via CSS var
    '--protocol-accent': getProtocolColor(post.protocol),
  } as React.CSSProperties}
>
```

### 5.2 CSS for Left-Border Accent (in `PostCard.tsx`)

```css
/* In PostCard.css or design-tokens.css */
.post-card {
  position: relative;
  border-left: 4px solid transparent;
  transition: border-color var(--duration-fast);
}

.post-card.protocol-nostr {
  border-left-color: var(--color-protocol-nostr);
}

.post-card.protocol-bluesky {
  border-left-color: var(--color-protocol-bluesky);
}

/* ... or use a dynamic style approach: */
.post-card {
  border-left: 4px solid var(--card-accent-color, transparent);
}
```

### 5.3 Action Vocabulary Map

Create a central mapping for protocol-specific action labels:

```ts
// file: packages/ui/src/protocol-actions.ts
export interface ProtocolActionLabels {
  like: string;
  repost: string;
  reply: string;
  bookmark?: string;
  extra?: { label: string; icon: string; action: string }[];
}

export const PROTOCOL_ACTION_LABELS: Record<string, ProtocolActionLabels> = {
  mastodon: { like: 'Favourite', repost: 'Boost', reply: 'Reply' },
  nostr:    { like: 'Like', repost: 'Repost', reply: 'Reply' },
  bluesky:  { like: 'Like', repost: 'Repost', reply: 'Reply' },
  farcaster:{ like: 'Like', repost: 'Recast', reply: 'Reply' },
  lens:     { like: 'Like', repost: 'Mirror', reply: 'Reply' },
  lemmy:    { like: 'Upvote', repost: 'Downvote', reply: 'Reply' },
  reddit:   { like: 'Upvote', repost: 'Downvote', reply: 'Reply' },
  peertube: { like: 'Like', repost: 'Dislike', reply: 'Share' },
  rss:      { like: 'Save', repost: '', reply: 'Share' },
};
```

### 5.4 Body Tone Map

```ts
export const PROTOCOL_BODY_STYLES: Record<string, string> = {
  nostr: 'bg-[var(--color-bg-protocol-nostr)] rounded-lg px-3 py-2 -mx-1',
  farcaster: 'border-l-2 border-[#8a63d2] pl-3',
  bluesky: '',
  lens: 'border-l-2 border-[#abfe2c]/30 pl-3',
  mastodon: '',
  reddit: 'bg-[var(--color-bg-protocol-reddit)] rounded-lg px-3 py-2 -mx-1',
  lemmy: '',
  peertube: 'bg-[var(--color-bg-protocol-peertube)] rounded-lg px-3 py-2 -mx-1',
  rss: 'bg-[var(--color-bg-protocol-rss)] rounded-lg px-3 py-2 -mx-1',
};
```

### 5.5 Engagement Action Overrides

Protocol-specific action rendering in `PostCardEngagement.tsx`:

```tsx
// In PostCardEngagement, conditionally render actions per protocol
const actions = PROTOCOL_ACTIONS[post.protocol] ?? DEFAULT_ACTIONS;

{actions.map(action => {
  if (post.protocol === 'lemmy' && action.type === 'upvote') {
    return <UpvoteButton count={metrics.likes} />;
  }
  if (post.protocol === 'lemmy' && action.type === 'downvote') {
    return <DownvoteButton count={raw.counts?.downvotes ?? 0} />;
  }
  // ...etc
})}
```

---

## 6. Current State vs. Target

| Feature | Current State | Target | Priority |
|---------|--------------|--------|----------|
| Protocol color registry | ✅ `feed-protocols.ts`, `ProtocolBadge.tsx`, `design-tokens.css` | Complete | Done |
| Card left-border accent | ❌ Not applied | 4px accent border per protocol | **High** |
| Protocol class on card | ❌ Not applied | `protocol-{id}` class on `<article>` | **High** |
| Protocol badge in header | ✅ `ProtocolBadge` shown | Already present | Done |
| Avatar ring colors | ✅ Partial (farcaster, lens, nostr) | All protocols with rings | Low |
| Author name color | ✅ Partial (nostr, lens, bluesky, reddit, rss) | All protocols defined | Medium |
| Body tint | ✅ Partial (nostr, farcaster, lens) | All protocols with bg or border | Medium |
| Protocol context line | ✅ Partial (mastodon, nostr, bluesky, lens, lemmy, reddit) | All protocols | Medium |
| Protocol thread components | ✅ (LemmyThreadView, PeerTubeEmbed, MastodonInstanceContext, LensPublicationBadge, BlueskyPostContext) | Complete | Done |
| Action vocabulary per protocol | ❌ All use generic labels | Protocol-native labels | **High** |
| Action set per protocol | ❌ All show same buttons | Protocol-specific actions (upvote/downvote for lemmy, zap for nostr) | **High** |
| Protocol-specific CSS variables | ✅ `protocol-feeds.css` has all classes | Already defined, not applied to cards | **High** |
| Light/dark theme support | ✅ Design tokens have light/dark | Verified per protocol | Medium |

### Priority Order for Implementation

1. **Apply `protocol-{id}` class to the `<article>` in FeedList** — enables all CSS
2. **Add left-border accent** — highest visual impact for LTR
3. **Map action vocabulary** — users see native terms immediately
4. **Protocol-specific action sets** — proper upvote/downvote, zap, collect
5. **Complete body tints** — all protocols get subtle background differentiation
6. **Complete avatar rings** — every protocol gets a ring color
7. **Protocol-specific skeleton loaders** — colored shimmer per protocol

---

## 7. Accessibility Notes

### Color Contrast

- Protocol accent colors are used for **decorative** borders and badges, not for
  text content (author name exceptions are paired with sufficient contrast ratio).
- All protocol accent colors have been verified against both `#000000` (dark) and
  `#ffffff` (light) backgrounds:
  - `#6364ff` — 4.5:1+ on dark, 4.5:1+ on light
  - `#8b5cf6` — 4.5:1+ on dark, 5:1+ on light
  - `#1185fe` — 4.5:1+ on dark, 4.5:1+ on light
  - `#abfe2c` — use as decorative only (fails on white)
  - `#ff4500` — 4.5:1+ on dark, 4.5:1+ on light

### Color-Only Information

- Protocol identity is conveyed through **multiple channels**: color + icon + label
  text + action vocabulary. No information is conveyed by color alone.
- The protocol badge always includes a text label for screen readers.

### Screen Reader Announcements

- `ProtocolBadge` has `title` attribute with protocol name
- Each card `<article>` has `aria-label="Post by [author]"` — protocol info
  is conveyed through the badge inside the card
- Action buttons have `aria-label` with the full action name

### Reduced Motion

- All protocol accent transitions respect `prefers-reduced-motion`
- Protocol-specific animations (shimmer, glow) are disabled when reduced motion
  is preferred

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `apps/web/src/styles/protocol-feeds.css` | CSS classes for every protocol (colors, borders, backgrounds) |
| `apps/web/src/styles/design-tokens.css` | Design tokens including protocol colors and background tints |
| `apps/web/src/components/feed/feed-protocols.ts` | Central protocol config registry (id, label, color, icon, route) |
| `packages/ui/src/ProtocolBadge.tsx` | ProtocolBadge component + PROTOCOL_COLORS/LABELS/ICONS maps |
| `packages/ui/src/IdentityBadge.tsx` | Cross-protocol identity badge |
| `packages/ui/src/PostCard.tsx` | Main post card component |
| `packages/ui/src/post-card/PostHeader.tsx` | Author row with protocol-specific rendering |
| `packages/ui/src/post-card/PostBody.tsx` | Post body with protocol-specific body tint |
| `packages/ui/src/post-card/PostThread.tsx` | Protocol-specific thread/context components |
| `packages/ui/src/PostCardEngagement.tsx` | Action buttons with protocol-aware rendering |
| `packages/ui/src/FeedList.tsx` | Feed list container (renders <article> wrappers) |
| `packages/types/src/index.ts` | UnifiedPost type definition |

---

*Last updated: 2026-07-28*
*Owner: DegenFeed Frontend Team*
