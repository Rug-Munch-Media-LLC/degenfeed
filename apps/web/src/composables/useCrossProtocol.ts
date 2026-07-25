'use client';

/**
 * useCrossProtocol — Cross-protocol message formatting and edge case handling
 *
 * Handles:
 *  - Character limits per protocol (Nostr: 64K, Farcaster: 320, Lens: 5K, etc.)
 *  - Media compatibility (some protocols don't support media)
 *  - Encryption wrapping for non-encrypted protocols
 *  - Protocol-specific formatting (Markdown on Matrix, plaintext on Nostr)
 *  - Long message auto-splitting
 *  - Character counting with Unicode awareness
 */

/* ─── Protocol Configurations ─────────────────────────────────── */

export interface ProtocolConfig {
  id: string;
  label: string;
  /** Max content length (chars) */
  maxChars: number;
  /** Supports rich formatting (markdown, HTML) */
  supportsFormatting: boolean;
  /** Supports media attachments */
  supportsMedia: boolean;
  /** Supports native E2E encryption */
  supportsEncryption: boolean;
  /** Preferred content format */
  contentFormat: 'markdown' | 'plaintext' | 'html';
  /** Max media size in MB */
  maxMediaSizeMB: number;
}

export const PROTOCOL_CONFIGS: Record<string, ProtocolConfig> = {
  nostr: {
    id: 'nostr',
    label: 'Nostr',
    maxChars: 64000,
    supportsFormatting: false,
    supportsMedia: true,
    supportsEncryption: true,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 50,
  },
  farcaster: {
    id: 'farcaster',
    label: 'Farcaster',
    maxChars: 320,
    supportsFormatting: false,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 10,
  },
  lens: {
    id: 'lens',
    label: 'Lens',
    maxChars: 5000,
    supportsFormatting: true,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'markdown',
    maxMediaSizeMB: 25,
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    maxChars: 300,
    supportsFormatting: false,
    supportsMedia: false,
    supportsEncryption: false,
    contentFormat: 'plaintext',
    maxMediaSizeMB: 0,
  },
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    maxChars: 500,
    supportsFormatting: true,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'html',
    maxMediaSizeMB: 40,
  },
  matrix: {
    id: 'matrix',
    label: 'Matrix',
    maxChars: 65536,
    supportsFormatting: true,
    supportsMedia: true,
    supportsEncryption: true,
    contentFormat: 'markdown',
    maxMediaSizeMB: 100,
  },
  discord: {
    id: 'discord',
    label: 'Discord',
    maxChars: 2000,
    supportsFormatting: true,
    supportsMedia: true,
    supportsEncryption: false,
    contentFormat: 'markdown',
    maxMediaSizeMB: 25,
  },
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    maxChars: 4096,
    supportsFormatting: true,
    supportsMedia: true,
    supportsEncryption: true,
    contentFormat: 'markdown',
    maxMediaSizeMB: 50,
  },
};

/* ─── Unicode-Aware Character Counting ────────────────────────── */

/** Count actual visible characters (not bytes, handles grapheme clusters) */
export function countChars(text: string): number {
  // Use Intl.Segmenter if available for grapheme cluster awareness
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return [...segmenter.segment(text)].length;
    } catch {
      // Fall through
    }
  }
  // Fallback: spread handles most surrogate pairs
  return [...text].length;
}

/* ─── Content Truncation ──────────────────────────────────────── */

/**
 * Truncate content to fit a protocol's limit. Appends "…" if truncated.
 * Respects grapheme cluster boundaries.
 */
export function truncateForProtocol(content: string, protocol: string): string {
  const config = PROTOCOL_CONFIGS[protocol];
  if (!config) return content;

  const chars = countChars(content);
  if (chars <= config.maxChars) return content;

  // Truncate with grapheme awareness
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const segments = [...segmenter.segment(content)];
      const truncated = segments
        .slice(0, config.maxChars - 1)
        .map((s) => s.segment)
        .join('');
      return `${truncated}…`;
    } catch {
      // Fall through
    }
  }

  return `${[...content].slice(0, config.maxChars - 1).join('')}…`;
}

/* ─── Format Conversion ───────────────────────────────────────── */

/**
 * Convert content to protocol-appropriate format.
 * Strips Markdown for plaintext protocols, converts to HTML for HTML protocols.
 */
export function convertForProtocol(
  content: string,
  sourceFormat: string,
  targetProtocol: string,
): string {
  const config = PROTOCOL_CONFIGS[targetProtocol];
  if (!config) return content;

  if (config.contentFormat === 'plaintext') {
    return stripMarkdown(content);
  }

  if (config.contentFormat === 'html' && sourceFormat === 'markdown') {
    return simpleMarkdownToHtml(content);
  }

  return content;
}

/** Strip Markdown formatting, keeping only text content */
export function stripMarkdown(text: string): string {
  return text
    .replace(/(\*|_|~|`){1,3}/g, '') // Bold, italic, strikethrough, code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links: [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images: ![alt](url) → alt
    .replace(/^#{1,6}\s+/gm, '') // Headings
    .replace(/^>+\s+/gm, '') // Blockquotes
    .replace(/^[-*+]\s+/gm, '') // Unordered list items
    .replace(/^\d+\.\s+/gm, '') // Ordered list items
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/`([^`]+)`/g, '$1') // Inline code
    .replace(/\|/g, '') // Table separators
    .replace(/\n{3,}/g, '\n\n') // Collapse excessive newlines
    .trim();
}

/** Simple Markdown → HTML for protocols that prefer HTML (Mastodon) */
export function simpleMarkdownToHtml(md: string): string {
  const html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>');

  return html;
}

/* ─── Long Message Splitting ──────────────────────────────────── */

export interface MessagePart {
  index: number;
  total: number;
  content: string;
  isPartial: boolean;
  /** Original full message for reassembly */
  originalId?: string;
}

/**
 * Auto-split long messages into multiple parts for protocol limits.
 * Returns array of message parts.
 */
export function splitLongMessage(content: string, protocol: string): MessagePart[] {
  const config = PROTOCOL_CONFIGS[protocol];
  if (!config) return [{ index: 0, total: 1, content, isPartial: false }];

  const chars = countChars(content);
  if (chars <= config.maxChars) {
    return [{ index: 0, total: 1, content, isPartial: false }];
  }

  // Leave room for "[1/3] " prefix
  const prefixOverhead = 8;
  const maxPerPart = config.maxChars - prefixOverhead;

  const parts: MessagePart[] = [];
  const _remaining = content;

  // Use grapheme-aware splitting
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const allSegments = [...segmenter.segment(content)].map((s) => s.segment);
      const totalParts = Math.ceil(allSegments.length / maxPerPart);

      for (let i = 0; i < totalParts; i++) {
        const start = i * maxPerPart;
        const end = Math.min(start + maxPerPart, allSegments.length);
        const partContent = allSegments.slice(start, end).join('');
        const prefix = totalParts > 1 ? `[${i + 1}/${totalParts}] ` : '';
        parts.push({
          index: i,
          total: totalParts,
          content: prefix + partContent,
          isPartial: totalParts > 1,
        });
      }
      return parts;
    } catch {
      // Fall through
    }
  }

  // Fallback: simple character-based splitting
  const chars_arr = [...content];
  const totalParts = Math.ceil(chars_arr.length / maxPerPart);
  for (let i = 0; i < totalParts; i++) {
    const start = i * maxPerPart;
    const end = Math.min(start + maxPerPart, chars_arr.length);
    const partContent = chars_arr.slice(start, end).join('');
    const prefix = totalParts > 1 ? `[${i + 1}/${totalParts}] ` : '';
    parts.push({
      index: i,
      total: totalParts,
      content: prefix + partContent,
      isPartial: totalParts > 1,
    });
  }

  return parts;
}

/* ─── Encryption Compatibility ───────────────────────────────── */

/**
 * For protocols that don't support native E2E encryption, wrap the
 * encrypted payload in a protocol-appropriate container.
 */
export function wrapEncryptedForProtocol(encryptedPayload: string, protocol: string): string {
  const config = PROTOCOL_CONFIGS[protocol];

  if (config?.supportsEncryption) {
    // Protocol supports native encryption — use as-is
    return encryptedPayload;
  }

  // Wrap in a recognizable container for the receiving client to unwrap
  const wrapper = {
    type: 'degenfeed.e2e',
    version: 1,
    payload: encryptedPayload,
    protocol,
  };

  return JSON.stringify(wrapper);
}

/* ─── Media Compatibility ─────────────────────────────────────── */

export interface MediaFallback {
  canSend: boolean;
  fallbackText?: string;
  reason?: string;
}

/**
 * Check if media can be sent via a protocol. If not, provide fallback text.
 */
export function checkMediaCompatibility(mediaType: string, protocol: string): MediaFallback {
  const config = PROTOCOL_CONFIGS[protocol];
  if (!config) return { canSend: true };

  if (!config.supportsMedia) {
    return {
      canSend: false,
      fallbackText: `[${mediaType} — not supported on ${config.label}]`,
      reason: `${config.label} does not support media attachments`,
    };
  }

  return { canSend: true };
}

/* ─── Typing Indicator ────────────────────────────────────────── */

/**
 * Determine if typing indicators should be sent for a given protocol.
 */
export function supportsTypingIndicators(protocol: string): boolean {
  // Most decentralized protocols don't support typing indicators natively
  const supported = new Set(['matrix', 'discord', 'telegram', 'direct-ws']);
  return supported.has(protocol);
}
