/**
 * @degenfeed/peertube-provider — Shared types
 *
 * Extracted from index.ts to break circular dependency between
 * index.ts and federated.ts.
 */

/** A video returned by the PeerTube REST API. */
export interface PeerTubeVideo {
  id: number;
  uuid: string;
  name: string;
  url: string;
  category: { id: number; label: string } | null;
  licence: { id: number; label: string } | null;
  language: { id: number; label: string } | null;
  description: string;
  shortDescription: string;
  isLive: boolean;
  duration: number; // seconds
  views: number;
  likes: number;
  dislikes: number;
  publishedAt: string; // ISO 8601
  updatedAt: string;
  originallyPublishedAt: string | null;
  channel: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar: { path: string } | null;
  } | null;
  thumbnailPath: string | null;
  previewPath: string | null;
  embedPath: string;
  tags: string[];
  files: Array<{
    id: number;
    resolution: { id: number; label: string };
    size: number;
    downloadUrl: string;
    fileUrl: string;
    torrentUrl: string;
    torrentDownloadUrl: string;
  }>;
}

/** Paginated response from the PeerTube /api/v1/videos endpoint. */
export interface PeerTubeVideoResponse {
  total: number;
  data: PeerTubeVideo[];
}

/** Options for fetchPeerTubeVideos. */
export interface PeerTubeFetchOptions {
  /** PeerTube instance base URL. Defaults to our instance. */
  baseUrl?: string;
  /** Number of videos to return (max 100). Default 20. */
  limit?: number;
  /** Sort parameter. Default "-publishedAt" (newest first). */
  sort?: string;
  /** Category ID filter (see PeerTube API docs for categories). */
  categoryId?: number;
  /** Language filter (ISO 639-1 code, e.g. "en"). */
  language?: string;
  /** Tag filter (comma-separated). */
  tags?: string;
  /** Search query (full-text search on video name/description). */
  search?: string;
  /** Page number (1-indexed). Default 1. */
  start?: number;
  /** Only include live streams. */
  isLive?: boolean;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}
