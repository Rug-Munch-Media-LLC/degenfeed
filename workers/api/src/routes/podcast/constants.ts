/** Constants for the Podcast routes module. */
export const CASTOPOD_DEFAULT = 'http://127.0.0.1:8088';
export const PODCAST_CATEGORIES: string[] = [];
export function podcastKey(id: string): string { return `podcast:${id}`; }
export function podcastEpisodesKey(id: string): string { return `podcast:${id}:episodes`; }
export function episodeKey(id: string): string { return `podcast:episode:${id}`; }
export function creatorPodcastsKey(address: string): string { return `podcast:creator:${address.toLowerCase()}`; }
export const DISCOVER_CACHE_KEY = 'podcast:discover:cache';
export const TRENDING_CACHE_KEY = 'podcast:trending:cache';
