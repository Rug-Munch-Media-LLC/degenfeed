# New Protocol Integrations Summary
**Date:** 2026-07-26
**Integrations Added:** 7

## Protocols Integrated

| # | Protocol | Type | User Base | Self-Hostable | Auth Required | Content Type |
|---|----------|------|-----------|---------------|---------------|-------------|
| 1 | **Gancio** | Federated Events | Growing Fediverse | ✅ Docker compose | No | Event |
| 2 | **SoundCloud** | Music Streaming | 76M+ monthly | ❌ (RSS feed) | No | Audio |
| 3 | **Bandcamp** | Music Marketplace | 50M+ monthly | ❌ (RSS feed) | No | Audio |
| 4 | **Vimeo** | Video Platform | 200M+ users | ❌ (Public API) | No | Video |
| 5 | **Twitch** | Live Streaming | 30M+ daily | ❌ (Helix API) | Optional OAuth | Live/Video |
| 6 | **WordPress + ActivityPub** | CMS / Blogging | 835M+ sites | ✅ Docker compose | No | Article |
| 7 | **Nostr Groups (NIP-29)** | Decentralized Chat | Active Nostr community | ✅ Via existing relay | No | Chat/Group |

## What Each Integration Adds

| Protocol | Content Value | User Benefit |
|----------|-------------|-------------|
| Gancio | IRL event discovery (meetups, conferences, hackathons) | Find real-world events in your feed |
| SoundCloud | Music tracks and mixes from major curators | Music discovery without leaving feed |
| Bandcamp | New indie album releases across genres | Support independent artists |
| Vimeo | Curated professional videos (tech, creative) | High-quality video content |
| Twitch | Live stream notifications + trending clips | Gaming and IRL content |
| WordPress/AP | Blog posts from 43% of the web | Massive content stream |
| Nostr Groups | Decentralized group conversations | Community discussion in feed |

## Deployment Status

| Protocol | Provider File | Feed Page | Fork Script | Registered in Feeds | Registered Frontend |
|----------|-------------|-----------|-------------|--------------------|--------------------|
| Gancio | ✅ `gancio.ts` | ✅ `/feed/gancio` | ✅ `fork-gancio.sh` | ✅ | ✅ |
| SoundCloud | ✅ `soundcloud.ts` | ✅ `/feed/soundcloud` | ❌ (RSS only) | ✅ | ✅ |
| Bandcamp | ✅ `bandcamp.ts` | ✅ `/feed/bandcamp` | ❌ (RSS only) | ✅ | ✅ |
| Vimeo | ✅ `vimeo.ts` | ✅ `/feed/vimeo` | ❌ (API only) | ✅ | ✅ |
| Twitch | ✅ `twitch.ts` | ✅ `/feed/twitch` | ❌ (API only) | ✅ | ✅ |
| WordPress | ✅ `wordpress.ts` | ✅ `/feed/wordpress` | ✅ `fork-wordpress.sh` | ✅ | ✅ |
| Nostr Groups | ✅ `nostr-groups.ts` | ✅ `/feed/nostr-groups` | ❌ (uses existing relay) | ✅ | ✅ |
