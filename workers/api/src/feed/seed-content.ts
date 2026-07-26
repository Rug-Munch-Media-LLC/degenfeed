/**
 * Seed / Demo Content for Worker API
 *
 * Served when ALL providers return empty data. Ensures the feed
 * never shows empty. Posts are tagged with _demo=true so the
 * frontend can show an "example" badge.
 */

import type { UnifiedPost } from '@degenfeed/types';

const NOW = Date.now();
const HOUR = 3600_000;

// ─── Author templates ─────────────────────────────────────────────────────

const DEMO_AUTHORS = [
  { displayName: 'Crypto Bot', handle: 'cryptobot', bio: 'Demo account' },
  { displayName: 'DeFi Dad', handle: 'defidad', bio: 'Demo account' },
  { displayName: 'NFT King', handle: 'nftking', bio: 'Demo account' },
  { displayName: 'BTC Maxi', handle: 'btcmaxi', bio: 'Demo account' },
  { displayName: 'ETH Builder', handle: 'ethbuilder', bio: 'Demo account' },
  { displayName: 'AI Researcher', handle: 'airesearcher', bio: 'Demo account' },
  { displayName: 'DeFi Llama', handle: 'defillama', bio: 'Demo account' },
  { displayName: 'Memecoin Trader', handle: 'memetrader', bio: 'Demo account' },
];

const DEMO_POST_TEMPLATES: Array<{ text: string; niches: string[] }> = [
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
  {
];

/**
 * Generate seed/demo posts for the feed.
 * Rotates content based on time for variety across requests.
 * Post.raw._demo = true so frontend can display an "example" badge.
 */
export function getSeedContent(limit: number, protocol?: string): UnifiedPost[] {

/**
 * Check if the given posts list is effectively empty
 * (all real providers returned nothing).
 */
export function isEffectivelyEmpty(posts: UnifiedPost[]): boolean {

