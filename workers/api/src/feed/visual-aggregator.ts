/**
 * visual-aggregator — Fetches from all visual sources (Pixelfed, Zora,
 * Bluesky, Nostr media, Farcaster media, GoToSocial), normalizes to
 * VisualPost, merges, deduplicates, ranks, and paginates.
 *
 * This is the core engine powering the unified visual feed.
 */

import { GtSClient, type GtSStatus } from '@degenfeed/mastodon-sdk';
import type { VisualFeedOptions, VisualPost, VisualSource } from '@degenfeed/types';
import type { Env } from '../types';

// ─── Timeout helpers ──────────────────────────────────────────────────

async function fetchWithTimeout(url: string, opts: RequestInit & { timeout?: number } = {}) {

// ─── Visual badge registry ─────────────────────────────────────────────

const BADGES: Record<string, { emoji: string; color: string; label: string }> = {

function badgeFor(source: string) {

// ─── Normalizer helpers ───────────────────────────────────────────────

import type { Protocol, UnifiedIdentity } from '@degenfeed/types';

function makeMinimalIdentity(
  protocol: string,
  id: string,
  name: string,
  avatarUrl?: string,
  handle?: string,
): UnifiedIdentity {

function makeEngagement(likes = 0, reposts = 0, replies = 0) {

function makeMetrics(likes = 0, reposts = 0, replies = 0) {

// ─── Source 1: Pixelfed via GoToSocial federation + direct API ─────────

async function fetchPixelfedContent(env: Env, limit: number): Promise<VisualPost[]> {

function normalizeGtSStatusToVisual(status: GtSStatus, instanceUrl: string): VisualPost | null {

// ─── Source 2: Zora NFTs via Zora API (GraphQL) ───────────────────────

const ZORA_API_URL = 'https://api.zora.co/graphql';

async function fetchZoraNFTs(_env: Env, limit: number): Promise<VisualPost[]> {

// ─── Source 3: Bluesky media posts via AT Protocol ────────────────────

async function fetchBlueskyMedia(env: Env, _limit: number): Promise<VisualPost[]> {

// ─── Source 4: GoToSocial media posts (our own users) ─────────────────

async function fetchGoToSocialMedia(env: Env, limit: number): Promise<VisualPost[]> {

// ─── Source 5: Nostr media posts ──────────────────────────────────────

async function fetchNostrMedia(env: Env, limit: number): Promise<VisualPost[]> {

function extractImageUrl(content: string): string | null {

// ─── Source 6: Farcaster media casts ──────────────────────────────────

async function fetchFarcasterMedia(env: Env, limit: number): Promise<VisualPost[]> {

// ─── Utility functions ─────────────────────────────────────────────────

function calcAspectRatio(meta: Record<string, unknown> | null | undefined): number {

function stripHtml(html: string): string {

// ─── Ranking and merging ───────────────────────────────────────────────

function rankPosts(posts: VisualPost[], sort: string): VisualPost[] {

function deduplicateVisualPosts(posts: VisualPost[]): VisualPost[] {

// ─── Filter by media type ──────────────────────────────────────────────

function applyFilter(posts: VisualPost[], filter?: string): VisualPost[] {

// ─── Main export ──────────────────────────────────────────────────────

/**
 * Fetches from all visual sources, normalizes, merges, deduplicates,
 * ranks, filters, and paginates.
 */
export async function getVisualFeed(
  env: Env,
  opts: VisualFeedOptions,
): Promise<{

/**
 * Returns trending visual content — highest-engagement posts across
 * all sources within the last 7 days.
 */
export async function getTrendingVisualFeed(
  env: Env,
  limit = 30,
): Promise<{

/**
 * Returns personalized visual feed — content from followed creators
 * plus recommended content.
 */
export async function getForYouVisualFeed(
  env: Env,
  opts: { limit?: number; followingOnly?: boolean; creatorFilter?: string[] },
): Promise<{

