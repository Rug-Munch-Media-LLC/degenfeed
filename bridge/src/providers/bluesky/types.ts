// ─── Types ───────────────────────────────────────────────────────────

interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface BskyImageView {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: { width: number; height: number };
}

interface BskyExternalView {
  uri: string;
  title?: string;
  description?: string;
  thumb?: string;
}

interface BskyEmbedView {
  $type?: string;
  images?: BskyImageView[];
  external?: BskyExternalView;
  record?: Record<string, unknown>;
  // video embed (Bluesky native video)
  playlist?: string;
  thumbnail?: string;
  duration?: number;
}

export interface BskyFeedResponse {
  feed?: Array<{ post: BskyPostView }>;
  posts?: BskyPostView[];
  cursor?: string;
}

export interface BskyPostView {
  uri: string;
  cid: string;
  author: BskyAuthor;
  record: {
    text: string;
    createdAt: string;
    embed?: {
      $type?: string;
      external?: { uri: string; title?: string; description?: string };
      images?: Array<{
        image: { ref: { link: string } };
        alt: string;
        aspectRatio?: { width: number; height: number };
      }>;
    };
    reply?: { parent: { uri: string }; root: { uri: string } };
  };
  /** The post's embed view (includes resolved URLs, not just CIDs) */
  embed?: BskyEmbedView;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}
