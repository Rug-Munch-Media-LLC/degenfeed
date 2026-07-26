/**
 * @degenfeed/api-worker — Podcast RSS Feed Generator
 *
 * Generates iTunes-compatible RSS feeds for each podcast.
 * Fed via Castopod to ActivityPub followers.
 *
 * Supports:
 *   - iTunes podcast RSS 2.0
 *   - Episode metadata (title, description, duration, publish date)
 *   - Audio enclosure links with MIME types
 *   - Chapter markers (Podcast Namespace)
 *   - Cover art via iTunes image tag
 *   - ActivityPub outbox link for federation
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface PodcastFeedMeta {

export interface EpisodeEnclosure {

export interface ChapterMarker {

export interface PodcastEpisodeEntry {

// ─── Generator ─────────────────────────────────────────────────────────

/**
 * Build a complete iTunes-compatible podcast RSS 2.0 feed.
 */
export function generatePodcastRss(meta: PodcastFeedMeta, episodes: PodcastEpisodeEntry[]): string {

/**
 * Generate a single <item> block for a podcast episode.
 */
function generateEpisodeItem(ep: PodcastEpisodeEntry): string {

// ─── Utility ────────────────────────────────────────────────────────────

function escapeXml(str: string): string {

function escapeCdata(str: string): string {

function formatDuration(seconds: number): string {

/**
 * Generate a chapters JSON file URL for an episode.
 */
export function chapterFileUrl(feedUrl: string, episodeGuid: string): string {

/**
 * Generate an OPML subscription file for a list of podcast feeds.
 */
export function generateOpml(
  feeds: Array<{ title: string; feedUrl: string; imageUrl?: string }>,
): string {

