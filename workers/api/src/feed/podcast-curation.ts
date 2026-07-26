/**
 * @degenfeed/api-worker — Top 100 Podcast Curation
 *
 * Curated list of the top 100 podcasts across Crypto/Web3, Tech, and AI.
 * Each entry includes verified RSS feed URLs for episode aggregation.
 *
 * KV schema:
 *   podcast:curated:{podcastId}         → CuratedPodcast metadata
 *   podcast:curated:index:crypto        → JSON array of crypto podcast IDs
 *   podcast:curated:index:tech          → JSON array of tech podcast IDs
 *   podcast:curated:index:ai            → JSON array of AI podcast IDs
 *   podcast:curated:episode:{episodeId} → UnifiedPodcastEpisode
 *   podcast:curated:trending            → Trending episodes cache
 *   podcast:curated:latest              → Latest episodes cache
 *   podcast:curated:last-fetch          → ISO timestamp of last RSS fetch
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface CuratedPodcast {

export interface UnifiedPodcastEpisode {

// ─── Curated Podcast List ───────────────────────────────────────────────
// 100 podcasts across 3 categories. RSS URLs verified as of 2026-07.

const CRYPTO_PODCASTS: CuratedPodcast[] = [
  {
  {
];

const TECH_PODCASTS: CuratedPodcast[] = [
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

const AI_PODCASTS: CuratedPodcast[] = [
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

// ─── Aggregated Export ───────────────────────────────────────────────────

export const ALL_CURATED_PODCASTS: CuratedPodcast[] = [
  ...CRYPTO_PODCASTS,
  ...TECH_PODCASTS,
  ...AI_PODCASTS,
];

export const CURATED_PODCASTS_BY_CATEGORY: Record<string, CuratedPodcast[]> = {

// ─── Helpers ─────────────────────────────────────────────────────────────

export function getCuratedPodcastById(id: string): CuratedPodcast | undefined {

export function getCuratedPodcastsByCategory(category: string): CuratedPodcast[] {

export function getCuratedPodcastStats(): Record<string, number> {

