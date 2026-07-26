/**
 * @degenfeed/api-worker — Twitch Curated Live Source
 *
 * Pulls live streams from curated Twitch channels across crypto, tech, and gaming niches.
 * Uses Twitch Helix API with client credentials flow OR RSS fallback.
 *
 * Features:
 *   - 30+ curated crypto/tech/gaming channels
 *   - Live detection via Helix API
 *   - Viewer count via stream metadata
 *   - Category tagging (game name → category mapping)
 *   - RSS/undocumented API fallback when no API key
 *
 * Rules:
 *   - Error handling on every API call
 *   - Rate limit tracking
 *   - Response validation
 *   - No silent failures
 */

import type { Env } from '../../types';
import type { LiveSource, UnifiedLiveStream } from '../live-aggregator';

// ─── Curated Channels ───────────────────────────────────────────────────

export const CURATED_TWITCH_CHANNELS: TwitchCuratedChannel[] = [
  // ═══ Crypto / Web3 ═══
  { slug: 'coinbureau', category: 'crypto', tags: ['crypto', 'news', 'education'] },
  { slug: 'bitboy_crypto', category: 'crypto', tags: ['crypto', 'news'] },
  { slug: 'altcoindaily', category: 'crypto', tags: ['crypto', 'news', 'defi'] },
  { slug: 'cryptobanter', category: 'crypto', tags: ['crypto', 'talk', 'news'] },
  { slug: 'ivanontech', category: 'crypto', tags: ['crypto', 'education', 'defi'] },
  { slug: 'cryptosociety', category: 'crypto', tags: ['crypto', 'community'] },
  { slug: 'taoshi', category: 'crypto', tags: ['crypto', 'trading', 'analysis'] },
  { slug: 'gcrcommunity', category: 'crypto', tags: ['crypto', 'news'] },
  { slug: 'thedefiedge', category: 'crypto', tags: ['crypto', 'defi', 'yield'] },
  { slug: 'rektcapital', category: 'crypto', tags: ['crypto', 'news'] },
  { slug: 'davidbrickell', category: 'crypto', tags: ['crypto', 'bitcoin'] },
  { slug: 'cryptocito', category: 'crypto', tags: ['crypto', 'education', 'solana'] },
  { slug: 'dappstar', category: 'crypto', tags: ['crypto', 'dapps', 'ethereum'] },
  { slug: 'degentrading', category: 'crypto', tags: ['crypto', 'trading', 'memecoins'] },
  { slug: '0xsame', category: 'crypto', tags: ['crypto', 'defi', 'analysis'] },
  { slug: 'jordanfish', category: 'crypto', tags: ['crypto', 'bitcoin', 'tech'] },

  // ═══ Tech / Coding ═══
  { slug: 'theprimeagen', category: 'tech', tags: ['tech', 'coding', 'vim'] },
  { slug: 'teej_dv', category: 'tech', tags: ['tech', 'coding', 'react'] },
  { slug: 'piratesoftware', category: 'tech', tags: ['tech', 'gamedev', 'coding'] },
  { slug: 'tsoding', category: 'tech', tags: ['tech', 'coding', 'rust'] },
  { slug: '2cdo', category: 'tech', tags: ['tech', 'coding', 'typescript'] },
  { slug: 'georgehotz', category: 'tech', tags: ['tech', 'hacking', 'ai'] },
  { slug: 'codinggarden', category: 'tech', tags: ['tech', 'coding', 'webdev'] },
  { slug: 'lunnieth', category: 'tech', tags: ['tech', 'rust', 'systems'] },
  { slug: 'andrew_faught', category: 'tech', tags: ['tech', 'startup', 'sre'] },
  { slug: 'wasmcommunity', category: 'tech', tags: ['tech', 'wasm', 'webassembly'] },
  { slug: 'thealtf4stream', category: 'tech', tags: ['tech', 'speedrun', 'retro'] },
  { slug: 'blowfish', category: 'tech', tags: ['tech', 'security', 'gamedev'] },
  { slug: 'handmade_hero', category: 'tech', tags: ['tech', 'gamedev', 'coding'] },

  // ═══ Gaming (Web3 / Crypto-adjacent) ═══
  { slug: 'parallel', category: 'gaming', tags: ['gaming', 'web3', 'tcg'] },
  { slug: 'playdeadeye', category: 'gaming', tags: ['gaming', 'web3', 'fps'] },
  { slug: 'illuvium', category: 'gaming', tags: ['gaming', 'web3', 'rpg'] },
  { slug: 'godsunchained', category: 'gaming', tags: ['gaming', 'web3', 'tcg'] },
  { slug: 'sorare', category: 'gaming', tags: ['gaming', 'web3', 'fantasy'] },
  { slug: 'axieinfinity', category: 'gaming', tags: ['gaming', 'web3', 'p2e'] },
  { slug: 'bigtime', category: 'gaming', tags: ['gaming', 'web3', 'action'] },
  { slug: 'mytikok', category: 'gaming', tags: ['gaming', 'web3', 'mobile'] },
  { slug: 'sipher', category: 'gaming', tags: ['gaming', 'web3', 'rpg'] },
  { slug: 'cryptoblades', category: 'gaming', tags: ['gaming', 'web3', 'rpg'] },

  // ═══ IRL / Talk Shows ═══
  { slug: 'julien', category: 'talk', tags: ['irl', 'talk', 'community'] },
  { slug: 'forsen', category: 'talk', tags: ['irl', 'talk', 'gaming'] },
  { slug: 'xqc', category: 'talk', tags: ['irl', 'talk', 'gaming'] },
  { slug: 'asmongold', category: 'talk', tags: ['talk', 'mmo', 'reactions'] },
  { slug: 'hasanabi', category: 'talk', tags: ['talk', 'news', 'politics'] },
];

interface TwitchCuratedChannel {

// ─── Twitch API Types ───────────────────────────────────────────────────

interface TwitchStream {

interface TwitchUser {

interface TwitchTokenResponse {

// ─── Category Map ───────────────────────────────────────────────────────

const CATEGORY_GAME_MAP: Record<string, string> = {

function mapGameToCategory(gameName: string, fallbackCategory: string): string {

// ─── App Access Token ───────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getTwitchAppToken(env: Env): Promise<string | null> {

// ─── Fetch Live Streams ────────────────────────────────────────────────

export async function fetchCuratedTwitchStreams(env: Env): Promise<UnifiedLiveStream[]> {

/**
 * Discover new Twitch channels by category for the "All" feed.
 * Pulls top live streams in crypto/gaming/tech categories.
 */
export async function fetchTwitchByCategory(
  env: Env,
  gameIds?: string[],
): Promise<UnifiedLiveStream[]> {

// ─── Source Health Tracking ─────────────────────────────────────────────

async function trackSourceHealth(
  env: Env,
  source: LiveSource,
  streamCount: number,
  latencyMs: number,
  error?: string,
): Promise<void> {

