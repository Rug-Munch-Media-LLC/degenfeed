/**
 * feed-enricher — Post enrichment, dedup, content filtering, and auto-moderation.
 *
 * Owns spam filtering + niche enrichment at ingestion, cross-provider
 * deduplication, category/content-type filters, per-user mute filters,
 * the crypto relevance gate, English-language filtering, Nostr
 * engagement enrichment via nostr.band, and auto-moderation hooks.
 */

import {
import type { UnifiedPost } from '@degenfeed/types';

import { getPostContentUri } from '@degenfeed/utils';

// ─── Auto-moderation state ────────────────────────────────────────────

/**
 * Set of banned user IDs (protocol-scoped, e.g. "nostr:abc...").
 * In production this is populated from KV by the feed fetcher.
 */
const _bannedUsers = new Set<string>();

/**
 * Set of removed post IDs.
 */
const _removedPosts = new Set<string>();

/**
 * Set of flagged post IDs that have already been reported.
 * Avoids repeated flagging.
 */
const _flaggedPosts = new Set<string>();

export function setBannedUsers(users: Set<string>): void {

export function setRemovedPosts(posts: Set<string>): void {

export function addFlaggedPost(postId: string): void {

export function isBannedUser(userId: string): boolean {

export function isRemovedPost(postId: string): boolean {

// ─── Auto-moderation tags ─────────────────────────────────────────────

// Tag names we attach to post metadata for downstream use
export const MODERATION_TAGS = {

// ─── Original enrichment code ─────────────────────────────────────────

/**
 * Drops definite spam (score >= 0.9), auto-rejects banned users and
 * removed posts, auto-flags posts with high spamScore or scam patterns,
 * and marks borderline posts with a spamScore so the ranking engine
 * can demote them instead of hard-filtering. Enriches with niche tags
 * and attaches a df:// URI.
 */
export function sanitizePosts(posts: UnifiedPost[]): UnifiedPost[] {

// ─── Everything below is unchanged from the original ──────────────────

export function filterByCategory(posts: UnifiedPost[], category: string): UnifiedPost[] {

/** Content type filter: video|article|image|thread|link|text */
export function filterByContentType(posts: UnifiedPost[], type: string): UnifiedPost[] {

export interface BaseFilterOptions {

/** Deduplicates the merged provider posts, then applies category and content-type filters. */
export function prepareBasePosts(
  posts: UnifiedPost[],
  opts: BaseFilterOptions = {},
): UnifiedPost[] {

/** Filters out muted authors, muted/blocked communities, and posts containing muted words. */
export function applyMuteFilters(
  posts: UnifiedPost[],
  mutedAuthors: Set<string>,
  mutedWords: Set<string>,
  mutedCommunities?: Set<string>,
  blockedCommunities?: Set<string>,
): UnifiedPost[] {

/**
 * Language preference: check the ?lang param and Accept-Language
 * header, defaulting to English-only. Users opt into all languages
 * with ?lang=all.
 */
export function prefersEnglish(langParam: string, acceptLang: string): boolean {

export interface UserFilterOptions {

/** Applies mute, relevance, and language filters in the legacy order. */
export function applyUserFilters(posts: UnifiedPost[], opts: UserFilterOptions): UnifiedPost[] {

/**
 * Fetches Nostr zap/reaction counts from nostr.band and merges them
 * into post metrics in place, for engagement enrichment before
 * scoring. Non-critical — failures are logged and swallowed.
 */
export async function enrichNostrEngagement(posts: UnifiedPost[]): Promise<void> {

export interface EnrichOptions extends BaseFilterOptions, Partial<UserFilterOptions> {

/**
 * Full enrichment pipeline: dedup → category/type filters → mute
 * filters → relevance gate → language filter → Nostr engagement
 * enrichment. The orchestrator may instead call the granular steps
 * when it needs to interleave side effects (post KV writes, user
 * context loading) between stages.
 */
export async function enrichPosts(
  posts: UnifiedPost[],
  opts: EnrichOptions = {},
): Promise<UnifiedPost[]> {

