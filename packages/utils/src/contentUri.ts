/**
 * @degenfeed/utils — Universal Content Addressing (df:// URIs)
 *
 * Every post on DegenFeed gets a universal df:// URI regardless of source
 * protocol. This is the backbone that enables cross-protocol replies,
 * threading, bookmarking, and sharing.
 *
 * Formats:
 *   df://{protocol}:{id}               — simple protocol with flat IDs
 *   df://{protocol}/{instance}/{id}    — federated protocols needing an instance
 *
 * Examples:
 *   df://nostr:note1abc123
 *   df://farcaster:0xabc123
 *   df://lens:0x01-0x02
 *   df://bluesky:at://did:plc:abc/app.bsky.feed.post/123
 *   df://mastodon:mastodon.social/1098765432
 *   df://lemmy:community.degenfeed.xyz/post/123
 *   df://peertube:video.degenfeed.xyz/w/abc123
 *   df://reddit:r/crypto/comments/abc123
 *   df://rss:degenfeed.xyz/abc123
 *   df://threads:abc123
 *   df://ponder:0x...
 *   df://ethereum:0x...
 *   df://solana:...
 */

export type ProtocolSource =
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'mastodon'
  | 'lemmy'
  | 'peertube'
  | 'reddit'
  | 'rss'
  | 'threads'
  | 'ponder'
  | 'ethereum'
  | 'solana';

/**
 * Encode protocol + id (+ optional instance) into a df:// URI.
 *
 * @param protocol - The source protocol
 * @param id - The native post identifier
 * @param instance - Optional instance/host for federated protocols
 */
export function encodeContentUri(protocol: ProtocolSource, id: string, instance?: string): string {
  if (instance) return `df://${protocol}/${instance}/${id}`;
  return `df://${protocol}:${id}`;
}

/**
 * Decode a df:// URI back into its components.
 *
 * Detection logic:
 * 1. If the first path segment (before any `/`) contains `:`, the URI is
 *    in `protocol:id` format — the protocol is the part before the first
 *    colon, and everything after is the id (no special handling of `://`
 *    in ids like bluesky AT URIs).
 * 2. Otherwise, it's `protocol/instance/id` format — protocol is first
 *    segment, instance is second, id is everything after.
 *
 * @param uri - A df:// URI string
 * @returns Decoded components or null if invalid
 */
export function decodeContentUri(
  uri: string,
): { protocol: ProtocolSource; id: string; instance?: string } | null {
  try {
    const stripped = uri.startsWith('df://') ? uri.slice(5) : uri;
    if (!stripped) return null;

    // Find the first path segment (before any /)
    const firstSlash = stripped.indexOf('/');
    const firstSegment = firstSlash >= 0 ? stripped.slice(0, firstSlash) : stripped;

    if (firstSegment.includes(':')) {
      // Format: df://protocol:id — id can contain colons and slashes
      const colonIndex = firstSegment.indexOf(':');
      const protocol = firstSegment.slice(0, colonIndex);
      const id = stripped.slice(protocol.length + 1);
      if (!protocol || !id) return null;
      return { protocol: protocol as ProtocolSource, id };
    }

    // Format: df://protocol/instance/id/...
    const parts = stripped.split('/');
    if (parts.length >= 3) {
      const protocol = parts[0];
      const instance = parts[1];
      const id = parts.slice(2).join('/');
      if (!protocol || !id) return null;
      return { protocol: protocol as ProtocolSource, instance, id };
    }

    // Try solitary protocol:id without path separators
    const colonIndex = stripped.indexOf(':');
    if (colonIndex > 0) {
      return {
        protocol: stripped.substring(0, colonIndex) as ProtocolSource,
        id: stripped.substring(colonIndex + 1),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Derive a df:// URI from existing post data.
 *
 * @param post - Post object with protocol, id, and optional instance/raw data
 */
export function getPostContentUri(post: {
  protocol: string;
  id: string;
  instance?: string;
  raw?: Record<string, unknown> | null;
}): string {
  let instance = post.instance;

  // Infer instance from raw data if not provided
  if (!instance && post.raw) {
    if (post.protocol === 'mastodon') {
      const uri = post.raw.uri as string | undefined;
      if (uri) {
        const match = uri.match(/https?:\/\/([^/]+)/);
        if (match) instance = match[1];
      }
    }
    if (post.protocol === 'bluesky') {
      // Bluesky AT URIs are self-describing — use as-is
    }
  }

  return encodeContentUri(
    post.protocol as ProtocolSource,
    // Strip protocol prefix from id if present to avoid double-encoding
    post.id.replace(/^(nostr:|farcaster:|lens:|bluesky:|mastodon:|reddit:|rss:|threads:)/, ''),
    instance,
  );
}
