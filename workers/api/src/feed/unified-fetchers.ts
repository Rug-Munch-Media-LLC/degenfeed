/**
 * unified-fetchers — Direct API fetchers for Lemmy, PeerTube, and YouTube.
 *
 * These are called by the unified feed orchestrator and bypass the main
 * provider registry because they fetch from specific self-hosted instances
 * rather than the generic protocol providers.
 */

import type { UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

// ─── Shared helpers ───────────────────────────────────────────────

function makeMinimalIdentity(
  protocol: string,
  id: string,
  name: string,
  handle?: string,
  avatarUrl?: string,
): UnifiedIdentity {

function makeMetrics(likes = 0, reposts = 0, replies = 0, quotes = 0, views = 0) {

const EMPTY_METRICS = makeMetrics();
const EMPTY_ENGAGEMENT = {

// ─── Lemmy API fetcher ─────────────────────────────────────────────

interface LemmyApiPost {

interface LemmyApiResponse {

const LEMMY_INSTANCE = 'https://community.degenfeed.xyz';

export async function fetchLemmyPosts(
  section: string,
  cursor?: string,
  limit = 50,
): Promise<{ posts: UnifiedPost[]; nextCursor?: string }> {

// ─── PeerTube API fetcher ──────────────────────────────────────────

interface PeerTubeApiVideo {

interface PeerTubeApiResponse {

const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

export async function fetchPeerTubeVideos(limit = 30): Promise<UnifiedPost[]> {

// ─── YouTube RSS fetcher ───────────────────────────────────────────
// YouTube offers video data in RSS. Each <entry> maps to a video.

const YOUTUBE_FEEDS = [
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCAl9Ld79qaZxp9JzEOwd3aA', // Bankless
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw', // Coin Bureau
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC7-gGJFlRPPSK4hBbbST6YA', // Whiteboard Crypto
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCznv7Vf9nBdXFXz2L9n7bLQ', // Altcoin Daily
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCcQ_2g7TDmI7Tpc4PqFFY_w', // Benjamin Cowen
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCqZQJzTlBvT5GpB1mqGzMxw', // Two Minute Papers
  // ── Added 2026-07-18: more crypto & tech channels for 20+ posts ──
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCvCp6vKY5j1M8WI6Ju1M-mg', // CoinMarketCap
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC_ykYChH3vQMKZXAnLzY_dg', // Blockworks Macro
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCk7Bk-94Coz6msS3Uqf_T8g', // CryptosRUs
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCtu1DO2TgR3KtByZq8GCO0A', // The DeFi Dad
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCiW2zY5Jw4gMZQfBkH3WjQA', // Paul Barron Network
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC2StwEhlLoe8F0P5CPjY8yQ', // InvestAnswers
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC0cmU2R5Uc-LM7NNVEXBqCg', // Aantonop
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCUpq7R80N3Oxv_aNGFgVxGg', // CoinGecko
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC0vBXGSgV28M40FVmMcRSMQ', // Cryptonauts
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCJH1J9xSMJQsYCsVOGn4_9g', // Unchained Podcast
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCKm3ouG_qZ5wXBLQ8VDFtlA', // The Prof G Show
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCln2YLHyaRoQHm7lRUS5Kzg', // Real Vision Crypto
];

export async function fetchYouTubeVideos(
  limit = 30,
): Promise<{ posts: UnifiedPost[]; errors: string[] }> {

function parseYouTubeRss(xml: string, feedUrl: string): UnifiedPost[] {

function extractXmlTag(xml: string, tag: string): string {

function extractXmlAttr(xml: string, tag: string, attr: string): string {

function decodeXmlEntities(str: string): string {

