/**
 * @routes/vine-shorts — Vine-like Shorts: Fun, Curated, Always Fresh
 *
 * "Bring Vine back" — 6-second looping videos with Web3-native features.
 *
 * Vine-style experience:
 *   - 6-second default format (up to 60s supported)
 *   - Looping video playback
 *   - "Vibe" score: humor, creativity, originality, replay value
 *   - Categories: Comedy, Music, Art, Magic, Tricks, Pets, Fails, Dance, Crypto, Memes
 *   - Original sound creator attribution
 *   - "Revine" (repost) button
 *   - Vine Star badges for top creators
 *   - Daily/Weekly Top Vines leaderboards
 *   - Featured Vine (daily editorial pick)
 *   - Vine challenges: "#DegenVine challenge — best crypto meme wins 100K sats"
 *
 * Content Aggregation (Always Fresh):
 *   - Loops (self-hosted) — primary
 *   - Reddit — r/funny, r/cryptocurrency, r/videos, r/perfectlycutscreams
 *   - YouTube Shorts — trending in crypto/tech/comedy
 *   - Instagram Reels — via RSS-Bridge
 *   - TikTok — via RSS-Bridge
 *   - Twitter/X — video posts
 *   - Farcaster — video casts
 *   - Nostr — NIP-71 video events
 *   - Bluesky — video posts
 *   - Pixelfed — video posts
 *   - PeerTube — short videos
 *   - Zora — video NFTs
 *   - Flashes (AT Protocol shorts) — via Firehose
 *
 * Endpoints:
 *   GET    /api/shorts/vine          — Vine-style curated feed
 *   GET    /api/shorts/vibe          — Vibe-scored content
 *   GET    /api/shorts/queue         — Pre-loaded content queue
 *   POST   /api/shorts/queue/refresh — Refresh queue
 *   POST   /api/shorts/revine        — Revine (repost) a short
 *   GET    /api/shorts/vine/top      — Daily/Weekly Top Vines leaderboard
 *   POST   /api/shorts/vine/feature  — Submit for featured consideration
 *   GET    /api/shorts/vine/challenges — Active Vine challenges
 *   POST   /api/shorts/vine/challenges/join — Join a challenge
 *   GET    /api/shorts/vine/stars    — Vine Star leaderboard
 *   GET    /api/shorts/vine/categories — Vine categories
 *   POST   /api/shorts/vine/sound/:id/attribute — Attribute original sound creator
 */
import { detectNiches } from '@degenfeed/feed-core';
import {
