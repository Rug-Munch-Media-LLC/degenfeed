// ─── Types ───────────────────────────────────────────────────────────

export interface BskyAuthor {
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

/** app.bsky.embed.record#view — quote post / embedded post view */
export interface BskyRecordView {
  uri: string;
  cid: string;
  author?: BskyAuthor;
  value?: {
    text?: string;
    createdAt?: string;
    embed?: Record<string, unknown>;
  };
  record?: Record<string, unknown>;
  embeds?: BskyEmbedView[];
  indexedAt?: string;
}

/** app.bsky.embed.video#view — native Bluesky video */
export interface BskyVideoView {
  playlist?: string;
  thumbnail?: string;
  duration?: number;
  aspectRatio?: { width: number; height: number };
}

interface BskyEmbedView {
  $type?: string;
  images?: BskyImageView[];
  external?: BskyExternalView;
  record?: BskyRecordView;
  /** Video embed view (Bluesky native video) */
  video?: BskyVideoView;
  // video embed (Bluesky native video) — legacy flat fields
  playlist?: string;
  thumbnail?: string;
  duration?: number;
}

/** Rich text facet (mention / link / hashtag) with UTF-8 byte offsets */
export interface BskyFacet {
  index: { byteStart: number; byteEnd: number };
  features: Array<{
    $type: string;
    uri?: string;
    did?: string;
    tag?: string;
  }>;
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
    /** Rich text facets (mentions/links/hashtags) */
    facets?: BskyFacet[];
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
  quoteCount?: number;
  indexedAt: string;
}

/** Raw firehose (Jetstream) post payload used by the realtime subscriber */
export interface JetstreamCommit {
  did: string;
  time_us: number;
  kind: 'commit';
  commit: {
    rev: string;
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    record?: {
      $type: string;
      text?: string;
      createdAt?: string;
      facets?: BskyFacet[];
      embed?: Record<string, unknown>;
      reply?: { parent: { uri: string }; root: { uri: string } };
    };
    cid?: string;
  };
}
