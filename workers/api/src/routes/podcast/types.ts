/** Types for the Podcast routes module. */
export interface Podcast {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  author?: string;
  categories: string[];
  language: string;
  episodes: number;
  feedUrl?: string;
  websiteUrl?: string;
  createdAt: number;
}
export interface PodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: number;
  publishedAt: number;
  coverUrl?: string;
}
