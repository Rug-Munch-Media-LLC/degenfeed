/**
 * @degenfeed/api-worker — Podcast Curation Types
 */

export interface CuratedPodcast {
  id: string;
  title: string;
  host: string;
  category: 'crypto' | 'tech' | 'ai';
  rssUrl: string;
  website?: string;
  coverUrl?: string;
  description: string;
  language: string;
  episodeCount: number;
  lastFetchAt?: number;
}

export interface UnifiedPodcastEpisode {
  id: string;
  podcastId: string;
  podcastTitle: string;
  category: 'crypto' | 'tech' | 'ai';
  title: string;
  description: string;
  audioUrl: string;
  audioMimeType: string;
  audioSize: number;
  duration: number;
  episodeNumber?: number;
  seasonNumber?: number;
  coverUrl?: string;
  publishedAt: number;
  link?: string;
  guid: string;
  plays: number;
  source: 'curated' | 'creator';
}
