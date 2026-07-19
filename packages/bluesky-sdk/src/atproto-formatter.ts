/**
 * DegenFeed → AT Protocol post formatter.
 *
 * Transforms raw content (text, images, mentions, hashtags, links) into
 * properly structured AtProtoPost objects with correct byte-level facet offsets
 * and embed blocks. No external dependencies — pure `TextEncoder` + `fetch`.
 *
 * @module @degenfeed/bluesky-sdk/formatter
 */

// ── Types ────────────────────────────────────────────────────────────

export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: string; [key: string]: unknown }>;
}

export interface ImageEmbed {
  $type: 'app.bsky.embed.images';
  images: Array<{
    image: { $type: 'blob'; ref: { $link: string }; mimeType: string; size: number };
    alt: string;
  }>;
}

export interface ExternalEmbed {
  $type: 'app.bsky.embed.external';
  external: {
    uri: string;
    title: string;
    description: string;
    thumb?: { $type: 'blob'; ref: { $link: string }; mimeType: string; size: number };
  };
}

export interface RecordEmbed {
  $type: 'app.bsky.embed.record';
  record: { uri: string; cid: string };
}

export interface AtProtoPost {
  text: string;
  facets: Facet[];
  embed?: ImageEmbed | ExternalEmbed | RecordEmbed;
  langs?: string[];
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** UTF-8 byte length of a string (faster than TextEncoder for simple ASCII). */
function utf8ByteLength(str: string): number {
  // TextEncoder is available in all modern runtimes (Workers, Node 18+, Deno)
  return new TextEncoder().encode(str).length;
}

/**
 * Find UTF-8 byte offset of a substring at a given character position.
 * AT Protocol facets use byte offsets (not character offsets).
 */
function byteOffsetOf(text: string, charPos: number): number {
  return utf8ByteLength(text.slice(0, charPos));
}

/**
 * Build a standard mention facet (@handle → DID mention).
 */
function mentionFacet(byteStart: number, byteEnd: number, did: string): Facet {
  return {
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#mention', did }],
  };
}

/**
 * Build a hashtag facet (#topic).
 */
function hashtagFacet(byteStart: number, byteEnd: number, tag: string): Facet {
  return {
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
  };
}

/**
 * Build a link facet (URL).
 */
function linkFacet(byteStart: number, byteEnd: number, uri: string): Facet {
  return {
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri }],
  };
}

// ── Regex Patterns ───────────────────────────────────────────────────

/** Match @mentions — only word characters after @, exclude email-like. */
const MENTION_RE = /(^|\s)(@[a-zA-Z0-9.-]+)(?=\s|$|[.,!?;:])/g;

/** Match #hashtags — alphanumeric and underscores. */
const HASHTAG_RE = /(^|\s)(#[a-zA-Z0-9_]+)/g;

/** Match URLs — http/https only. */
const URL_RE = /(^|\s)(https?:\/\/[^\s<]+[^\s<.,!?;:)\]}>'"])/g;

// ── Main Formatting Function ─────────────────────────────────────────

/**
 * Format DegenFeed post content for AT Protocol.
 *
 * Scans `opts.text` for @mentions, #hashtags, and bare URLs,
 * resolves handles to DIDs (if required), and produces a correctly
 * structured `AtProtoPost` with byte-offset facets.
 *
 * @param opts.text       The post text (may contain @mentions, #tags, URLs)
 * @param opts.images     Optional pre-uploaded image references
 * @param opts.mentions   Pre-resolved mention handle → DID pairs
 * @param opts.hashtags   Explicit hashtag list (additionally detected in text)
 * @param opts.links      Explicit link list (additionally detected in text)
 * @param opts.maxLength  Truncation limit in characters (default 300, Bluesky limit)
 * @param opts.pdsUrl     PDS URL for handle resolution (default: public API)
 * @returns A ready-to-publish `AtProtoPost`
 */
export async function formatForAtProtocol(opts: {
  text: string;
  images?: Array<{ url: string; alt?: string; data?: Uint8Array }>;
  mentions?: Array<{ handle: string; did: string }>;
  hashtags?: string[];
  links?: Array<{ url: string; title?: string }>;
  maxLength?: number;
  pdsUrl?: string;
}): Promise<AtProtoPost> {
  const maxLen = opts.maxLength ?? 300;
  const text = opts.text.slice(0, maxLen);

  const facets: Facet[] = [];
  const mentionMap = new Map<string, string>();

  // Build a lookup of known handle→DID pairs
  if (opts.mentions) {
    for (const m of opts.mentions) {
      mentionMap.set(m.handle.toLowerCase(), m.did);
    }
  }

  // ── Detect @mentions ────────────────────────────────────
  const mentionMatches: Array<{ match: string; handle: string; charStart: number }> = [];
  MENTION_RE.lastIndex = 0;
  for (let m = MENTION_RE.exec(text); m !== null; m = MENTION_RE.exec(text)) {
    const prefix = m[1] ?? '';
    const mention = (m[2] ?? '').slice(1); // strip @
    const charStart = m.index + prefix.length;
    mentionMatches.push({ match: mention, handle: mention, charStart });
  }

  // Resolve any unknown handles via the PDS
  const resolutionPromises = mentionMatches.map(async (mm) => {
    if (!mentionMap.has(mm.handle.toLowerCase())) {
      try {
        const did = await resolveDIDMention(mm.handle, opts.pdsUrl);
        mentionMap.set(mm.handle.toLowerCase(), did);
      } catch {
        // Resolution failed — skip this mention
      }
    }
  });
  await Promise.all(resolutionPromises);

  for (const mm of mentionMatches) {
    const did = mentionMap.get(mm.handle.toLowerCase());
    if (!did) continue;
    const byteStart = byteOffsetOf(text, mm.charStart);
    const byteEnd = byteStart + utf8ByteLength(`@${mm.handle}`);
    facets.push(mentionFacet(byteStart, byteEnd, did));
  }

  // ── Detect #hashtags ────────────────────────────────────
  const seenHashtags = new Set<string>();
  HASHTAG_RE.lastIndex = 0;
  for (let h = HASHTAG_RE.exec(text); h !== null; h = HASHTAG_RE.exec(text)) {
    const prefix = h[1] ?? '';
    const tag = (h[2] ?? '').slice(1); // strip #
    const charStart = h.index + prefix.length;
    const dedupKey = tag.toLowerCase();

    if (seenHashtags.has(dedupKey)) continue;
    seenHashtags.add(dedupKey);

    const byteStart = byteOffsetOf(text, charStart);
    const byteEnd = byteStart + utf8ByteLength(`#${tag}`);
    facets.push(hashtagFacet(byteStart, byteEnd, tag));
  }

  // ── Detect URLs ─────────────────────────────────────────
  const seenUrls = new Set<string>();
  URL_RE.lastIndex = 0;
  for (let u = URL_RE.exec(text); u !== null; u = URL_RE.exec(text)) {
    const prefix = u[1] ?? '';
    const url = (u[2] ?? '').trim();
    const charStart = u.index + prefix.length;

    // Normalize trailing punctuation removal (already in regex)
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const byteStart = byteOffsetOf(text, charStart);
    const byteEnd = byteStart + utf8ByteLength(url);
    facets.push(linkFacet(byteStart, byteEnd, url));
  }

  // Sort facets by byteStart to ensure they are in order (protocol requirement)
  facets.sort((a, b) => a.index.byteStart - b.index.byteStart);

  // ── Handle embed ────────────────────────────────────────
  const embed =
    opts.images && opts.images.length > 0
      ? {
          $type: 'app.bsky.embed.images' as const,
          images: opts.images.slice(0, 4).map((img) => ({
            image: {
              $type: 'blob' as const,
              ref: { $link: img.url },
              mimeType: 'image/jpeg',
              size: 0,
            },
            alt: img.alt ?? '',
          })),
        }
      : undefined;

  return {
    text,
    facets,
    embed,
    langs: ['en'],
    createdAt: new Date().toISOString(),
  };
}

// ── Handle Resolution ────────────────────────────────────────────────

const BSKY_PUBLIC_URL = 'https://public.api.bsky.app';

/**
 * Resolve an AT Protocol handle to a DID.
 *
 * Disambiguated name to avoid collision with the built-in `atob()` global.
 *
 * @param handle   The handle to resolve (e.g. "alice.bsky.social")
 * @param pdsUrl   Optional PDS/public API URL (default: public.bsky.app)
 * @returns The resolved DID string (e.g. "did:plc:xxxx")
 */
export async function resolveDIDMention(handle: string, pdsUrl?: string): Promise<string> {
  const base = pdsUrl ?? BSKY_PUBLIC_URL;
  const clean = handle.replace(/^@/, '').trim();
  if (!clean) throw new Error('Empty handle');

  const res = await fetch(
    `${base}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(clean)}`,
    {
      headers: {
        accept: 'application/json',
        'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      },
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Handle resolution failed for "${clean}": ${res.status} ${errText.slice(0, 150)}`,
    );
  }

  const data = (await res.json()) as { did: string };
  return data.did;
}
