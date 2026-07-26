/**
 * content-dedup — Cross-protocol and URL-based deduplication.
 *
 * Enhanced with:
 *   - RSS content dedup (same article from multiple feeds)
 *   - Origin source preference (prefer original over aggregator)
 *   - Newsletter/RSS cross-dedup (same article via different protocols)
 *   - "Also on" tracking (crossProtocolSources across all sources)
 *   - Aggregator detection (Redlib, Lemmy, etc.)
 *   - Canonical URL matching for article-level dedup
 *
 * Same content posted on Nostr and Farcaster (or Reddit and RSS)
 * should only appear once. Uses content hashing + URL matching
 * and keeps the version with highest engagement.
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Known aggregator domains ─────────────────────────────────────

const AGGREGATOR_PATTERNS = [
  /redlib\./i, // Redlib (privacy Reddit frontend)
  /lemmy\..*/i, // Lemmy instances
  /reddit\.com/i, // Reddit native
  /news\.google\.com/i,
  /medium\.com/i,
  /substack\.com/i,
  /ghost\.org/i,
  /feedburner\.com/i,
  /feedproxy\.google\.com/i,
];

// ─── Source quality ranking (higher = better) ────────────────────
// Used to prefer the best source when content appears on multiple protocols

const SOURCE_QUALITY_RANK: Record<string, number> = {

// ─── Helpers ──────────────────────────────────────────────────────

function sha256(text: string): string {

function normalizeText(text: string): string {

function contentHash(post: UnifiedPost): string {

function extractUrls(text: string): string[] {

function engagementScore(post: UnifiedPost): number {

/**
 * Check if a URL is from an aggregator/republishing source.
 */
function isAggregatorUrl(url: string): boolean {

/**
 * Extract the canonical (article) URL from a post.
 * Filters out social media URLs to find the actual shared article.
 */
function extractCanonicalUrl(text: string): string | null {

/**
 * Get article title from embed metadata (for RSS/article dedup).
 */
function articleTitle(post: UnifiedPost): string | null {

// ─── Dedup Result ──────────────────────────────────────────────────

export interface DedupResult {

// ─── Main Dedup Function ──────────────────────────────────────────

export function deduplicateCrossProtocol(posts: UnifiedPost[]): DedupResult {

