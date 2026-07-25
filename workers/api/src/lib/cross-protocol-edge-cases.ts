/**
 * @degenfeed/api-worker — Cross-Protocol Edge Case Handler
 *
 * Handles protocol-specific edge cases:
 *  - Character limits per protocol
 *  - Media compatibility checks
 *  - Encryption wrapping for non-E2E protocols
 *  - Protocol-specific formatting conversion
 *  - Long message auto-splitting
 *  - Fallback routing when primary protocol fails
 */

import type { Env } from '../index';

// ─── Protocol Configurations ──────────────────────────────────────────────

export const PROTOCOL_CONFIGS: Record<
  string,
  {
    maxChars: number;
    supportsMedia: boolean;
    supportsEncryption: boolean;
    contentFormat: 'plaintext' | 'markdown' | 'html';
    maxMediaSizeMB: number;
  }
> = {
  nostr: {
    maxChars: 64000,
    supportsMedia: true,
    supportsEncryption: true,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 50,
  },
  farcaster: {
    maxChars: 320,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 10,
  },
  lens: {
    maxChars: 5000,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'markdown',
    maxMediaSizeMB: 25,
  },
  bluesky: {
    maxChars: 300,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  mastodon: {
    maxChars: 500,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'html',
    maxMediaSizeMB: 40,
  },
  matrix: {
    maxChars: 65536,
    supportsMedia: true,
    supportsEncryption: true,
    contentFormat: 'markdown',
    maxMediaSizeMB: 100,
  },
  discord: {
    maxChars: 2000,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'markdown',
    maxMediaSizeMB: 25,
  },
  telegram: {
    maxChars: 4096,
    supportsMedia: true,
    supportsEncryption: true,
    contentFormat: 'markdown',
    maxMediaSizeMB: 50,
  },
  hubzilla: {
    maxChars: 65536,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'html',
    maxMediaSizeMB: 50,
  },
  streams: {
    maxChars: 65536,
    supportsMedia: true,
    supportsEncryption: true,
    contentFormat: 'html',
    maxMediaSizeMB: 50,
  },
  guppe: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  epicyon: {
    maxChars: 50000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  ens: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  unstoppable: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  orbis: {
    maxChars: 10000,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'markdown',
    maxMediaSizeMB: 25,
  },
  snapshot: {
    maxChars: 50000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'markdown',
    maxMediaSizeMB: 0,
  },
  tally: {
    maxChars: 50000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'markdown',
    maxMediaSizeMB: 0,
  },
  juicebox: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  coinvise: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  unlock: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  bonfida: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },

  ion: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  keri: {
    maxChars: 50000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  veramo: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  storj: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  sia: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  filecoin: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  'swarm-eth': {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  syndicate: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  mintgate: {
    maxChars: 5000,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
};

// ─── Unbreakable Content Types ────────────────────────────────────────────

/** Content that should never be modified (encrypted blobs, signed payloads) */
const UNBREAKABLE_PREFIXES = ['{"type":"degenfeed.e2e"', '{"encrypted"', '-----BEGIN PGP'];

// ─── Message Edge Case Handler ────────────────────────────────────────────

export interface ProtocolMessageRequest {
  content: string;
  protocol: string;
  /** Source protocol (for format conversion) */
  sourceProtocol?: string;
  /** Whether content is encrypted */
  encrypted?: boolean;
  /** Media attachments */
  attachments?: Array<{ type: string; url?: string; name?: string }>;
}

export interface ProtocolMessageResult {
  parts: Array<{
    content: string;
    protocol: string;
    isTruncated: boolean;
    isPart: boolean;
    partIndex?: number;
    totalParts?: number;
    mediaFallback?: string;
  }>;
  warnings: string[];
  mediaDropped: Array<{ name: string; reason: string }>;
}

/**
 * Process a message for a specific protocol:
 * - Truncate/split long messages
 * - Strip incompatible formatting
 * - Handle media fallbacks
 * - Wrap encrypted content if needed
 */
export function processForProtocol(request: ProtocolMessageRequest): ProtocolMessageResult {
  const config = PROTOCOL_CONFIGS[request.protocol];
  const warnings: string[] = [];
  const mediaDropped: Array<{ name: string; reason: string }> = [];
  const parts: ProtocolMessageResult['parts'] = [];

  // Check if content is unbreakable (encrypted blobs, etc.)
  const isUnbreakable = UNBREAKABLE_PREFIXES.some((p) => request.content.startsWith(p));

  // Handle encrypted content wrapping
  let content = request.content;
  if (request.encrypted && config && !config.supportsEncryption) {
    content = wrapEncryptedBlob(content, request.protocol);
    warnings.push(`Encrypted content wrapped for ${request.protocol} (no native E2E)`);
  }

  // Handle format conversion
  if (!isUnbreakable && config) {
    content = convertFormat(content, request.sourceProtocol || 'plaintext', request.protocol);
    if (request.sourceProtocol && request.sourceProtocol !== request.protocol) {
      warnings.push(
        `Content converted from ${request.sourceProtocol} format to ${config.contentFormat}`,
      );
    }
  }

  // Handle media compatibility
  if (request.attachments && config) {
    for (const att of request.attachments) {
      if (!config.supportsMedia && att.type !== 'file') {
        mediaDropped.push({
          name: att.name || att.type,
          reason: `${request.protocol} does not support media attachments. Add a text reference instead.`,
        });
      }
    }
  }

  // Handle character limits / splitting
  if (config && !isUnbreakable) {
    const charLen = countChars(content);
    if (charLen > config.maxChars) {
      const splitMessages = splitContent(content, config.maxChars);
      for (let i = 0; i < splitMessages.length; i++) {
        parts.push({
          content: splitMessages[i],
          protocol: request.protocol,
          isTruncated: splitMessages.length > 1,
          isPart: splitMessages.length > 1,
          partIndex: i + 1,
          totalParts: splitMessages.length,
        });
      }
      if (splitMessages.length > 1) {
        warnings.push(
          `Message split into ${splitMessages.length} parts (${charLen} chars, limit ${config.maxChars})`,
        );
      }
      return { parts, warnings, mediaDropped };
    }
  }

  parts.push({
    content,
    protocol: request.protocol,
    isTruncated: false,
    isPart: false,
  });

  return { parts, warnings, mediaDropped };
}

// ─── Encryption Wrapping ──────────────────────────────────────────────────

/**
 * Wrap encrypted content for protocols without native E2E.
 * The receiving client recognizes this wrapper and decrypts.
 */
export function wrapEncryptedBlob(encryptedContent: string, protocol: string): string {
  const wrapper = {
    type: 'degenfeed.e2e',
    version: 1,
    payload: encryptedContent,
    protocol,
    note: 'This message was encrypted before sending. Install DegenFeed to decrypt.',
  };
  return JSON.stringify(wrapper);
}

// ─── Format Conversion ────────────────────────────────────────────────────

/**
 * Convert content between protocol formats.
 */
export function convertFormat(content: string, fromFormat: string, toProtocol: string): string {
  const config = PROTOCOL_CONFIGS[toProtocol];
  if (!config) return content;

  // Already in the right format
  if (config.contentFormat === fromFormat) return content;

  // Convert Markdown → plaintext for Nostr, Farcaster, Bluesky
  if (fromFormat === 'markdown' && config.contentFormat === 'plaintext') {
    return stripMarkdown(content);
  }

  // Convert plaintext → Markdown for Matrix (wrapping URLs etc.)
  if (fromFormat === 'plaintext' && config.contentFormat === 'markdown') {
    return wrapUrls(content);
  }

  return content;
}

/**
 * Strip Markdown formatting.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/(\*|_|~|`){1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>+\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\|/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wrap bare URLs in Markdown link syntax.
 */
export function wrapUrls(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])/g;
  return text.replace(urlRegex, (url) => `[${url}](${url})`);
}

// ─── Content Splitting ────────────────────────────────────────────────────

/**
 * Split content into multiple protocol-compliant parts.
 * Each part gets a [N/M] prefix for reassembly on the receiving end.
 */
export function splitContent(content: string, maxChars: number): string[] {
  const prefixOverhead = 8; // Room for "[3/10] "
  const effectiveMax = maxChars - prefixOverhead;

  if (effectiveMax <= 0) return [content.slice(0, maxChars)];

  const parts: string[] = [];
  const chars = [...content]; // Unicode-aware character array
  const totalParts = Math.ceil(chars.length / effectiveMax);

  for (let i = 0; i < totalParts; i++) {
    const start = i * effectiveMax;
    const end = Math.min(start + effectiveMax, chars.length);
    const segment = chars.slice(start, end).join('');
    const prefix = totalParts > 1 ? `[${i + 1}/${totalParts}] ` : '';
    parts.push(prefix + segment);
  }

  return parts;
}

// ─── Character Counting ───────────────────────────────────────────────────

/**
 * Count Unicode-aware characters (not bytes).
 */
export function countChars(text: string): number {
  return [...text].length;
}

// ─── Fallback Router ──────────────────────────────────────────────────────

export interface FallbackRoute {
  primary: string;
  fallbacks: string[];
  result: {
    used: string;
    attempted: string[];
    success: boolean;
    reason?: string;
  };
}

/**
 * Determine fallback routing for a message when primary protocol fails.
 */
export function getFallbackRoute(
  primaryProtocol: string,
  content: string,
  hasMedia: boolean,
): FallbackRoute {
  const fallbackOrder: Record<string, string[]> = {
    nostr: ['matrix', 'direct-ws', 'bluesky', 'mastodon'],
    farcaster: ['nostr', 'matrix', 'direct-ws'],
    lens: ['nostr', 'matrix', 'direct-ws'],
    matrix: ['direct-ws', 'nostr'],
    bluesky: ['mastodon', 'nostr', 'direct-ws'],
    mastodon: ['bluesky', 'nostr', 'direct-ws'],
  };

  const _config = PROTOCOL_CONFIGS[primaryProtocol];
  const fallbacks = fallbackOrder[primaryProtocol] || ['nostr', 'direct-ws'];

  // Filter fallbacks based on content constraints
  const viable = fallbacks.filter((fb) => {
    const fbConfig = PROTOCOL_CONFIGS[fb];
    if (!fbConfig) return false;
    if (hasMedia && !fbConfig.supportsMedia) return false;
    if (countChars(content) > fbConfig.maxChars) return false;
    return true;
  });

  return {
    primary: primaryProtocol,
    fallbacks: viable,
    result: {
      used: '',
      attempted: [],
      success: false,
    },
  };
}

// ─── Routing Verification ─────────────────────────────────────────────────

/**
 * Verify that a message can actually be routed through a protocol.
 * Returns the verified result or a modified version.
 */
export async function verifyAndRoute(
  env: Env,
  content: string,
  protocol: string,
  toId: string,
): Promise<{ ok: boolean; modifiedContent?: string; fallbackProtocol?: string; error?: string }> {
  // Check if protocol is available for this recipient
  const { MessageTransport } = await import('./message-transport');
  const transport = new MessageTransport();

  // Check transport preferences for recipient
  const prefs = await transport.getTransportPreferences(env, toId).catch(() => null);

  if (!prefs) {
    return { ok: false, error: 'Cannot determine recipient transport capabilities' };
  }

  // Verify the protocol is in the recipient's preferences
  const allProtocols = [prefs.defaultProtocol, ...prefs.fallbackProtocols];
  if (!allProtocols.includes(protocol as any)) {
    // Try the recipient's default
    return {
      ok: false,
      error: `${protocol} not available for recipient`,
      fallbackProtocol: prefs.defaultProtocol,
    };
  }

  // Check content constraints
  const config = PROTOCOL_CONFIGS[protocol];
  if (config && countChars(content) > config.maxChars) {
    return {
      ok: false,
      error: `Content too long for ${protocol} (${countChars(content)} > ${config.maxChars})`,
      fallbackProtocol: findCompatibleFallback(prefs, content),
    };
  }

  return { ok: true };
}

/**
 * Find a fallback protocol that can handle the content.
 */
function findCompatibleFallback(
  prefs: { defaultProtocol: string; fallbackProtocols: string[] },
  content: string,
): string | undefined {
  const all = [prefs.defaultProtocol, ...prefs.fallbackProtocols];
  for (const p of all) {
    const config = PROTOCOL_CONFIGS[p];
    if (config && countChars(content) <= config.maxChars) {
      return p;
    }
  }
  return undefined;
}
