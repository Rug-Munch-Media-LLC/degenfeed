/**
 * @degenfeed/utils — protocolTranslator
 *
 * AI-free, rule-based content translation between social graph protocols.
 * Reformats content to match each protocol's conventions, character limits,
 * and cultural norms for native-feeling cross-protocol posting.
 *
 * Usage:
 *   import { translateContent, PROTOCOL_FORMATS } from '@degenfeed/utils';
 *   const mastodonPost = translateContent(farcasterCast, 'farcaster', 'mastodon');
 */

// ─── Protocol format definitions ─────────────────────────────────────

export const PROTOCOL_FORMATS: Record<
  string,
  {
    maxLength: number;
    supportsMarkdown: boolean;
    supportsImages: boolean;
    supportsPolls: boolean;
    supportsFrames?: boolean;
    conventions: string;
  }
> = {
  nostr: {
    maxLength: 280,
    supportsMarkdown: false,
    supportsImages: true,
    supportsPolls: false,
    conventions: 'Short, direct. Use hashtags. Nostr-native tone.',
  },
  farcaster: {
    maxLength: 320,
    supportsMarkdown: false,
    supportsImages: true,
    supportsPolls: false,
    supportsFrames: true,
    conventions: 'Cast-style. Use $DEGEN mentions. Frame-forward.',
  },
  lens: {
    maxLength: 5_000,
    supportsMarkdown: true,
    supportsImages: true,
    supportsPolls: true,
    conventions: 'Long-form. Mirror/collect culture. Publication-style.',
  },
  mastodon: {
    maxLength: 500,
    supportsMarkdown: false,
    supportsImages: true,
    supportsPolls: true,
    conventions: 'CW for sensitive content. Hashtag-heavy. Instance-aware.',
  },
  bluesky: {
    maxLength: 300,
    supportsMarkdown: false,
    supportsImages: true,
    supportsPolls: false,
    conventions: 'Skeet-style. Short. Use facets for links.',
  },
  lemmy: {
    maxLength: 50_000,
    supportsMarkdown: true,
    supportsImages: false,
    supportsPolls: false,
    conventions: 'Threaded discussion. Title required. Community-focused.',
  },
  threads: {
    maxLength: 500,
    supportsMarkdown: false,
    supportsImages: true,
    supportsPolls: false,
    conventions: 'Meta platform style. Short text. Image-heavy. Mobile-first.',
  },
  reddit: {
    maxLength: 40_000,
    supportsMarkdown: true,
    supportsImages: true,
    supportsPolls: true,
    conventions: 'Community-focused. Title required. Markdown formatting. Subreddit-aware.',
  },
  peertube: {
    maxLength: 5_000,
    supportsMarkdown: true,
    supportsImages: true,
    supportsPolls: false,
    conventions: 'Video platform. Description-focused. Federation-aware. Channel-driven.',
  },
};

// ─── Protocol labels for bridge attribution ─────────────────────────

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  threads: 'Threads (Experimental)',
  mastodon: 'Mastodon',
  lemmy: 'Lemmy',
  rss: 'RSS',
  reddit: 'Reddit',
  ethereum: 'Ethereum',
  solana: 'Solana',
};

function formatProtocolLabel(p: string): string {
  return PROTOCOL_LABELS[p] ?? p;
}

// ─── Translation result type ────────────────────────────────────────

export interface TranslationResult {
  translated: string;
  truncated: boolean;
  originalLength: number;
  translatedLength: number;
  maxLength: number;
  strippedMarkdown: boolean;
  removedProtocolElements: string[];
  warning?: string;
}

// ─── Core translation logic ─────────────────────────────────────────

/**
 * Rule-based content translation between protocols.
 *
 * Translates content from one protocol's conventions to another:
 *  1. Truncates to target protocol's max character length (word-boundary aware)
 *  2. Strips markdown if the target protocol doesn't support it
 *  3. Removes protocol-specific elements that don't translate (e.g. $DEGEN → DEGEN)
 *  4. Adds a bridge attribution footer
 *
 * @param content  The original post text
 * @param fromProtocol  Source protocol key (e.g. 'farcaster')
 * @param toProtocol  Target protocol key (e.g. 'mastodon')
 * @returns  TranslationResult with the translated text and metadata
 */
export function translateContent(
  content: string,
  fromProtocol: string,
  toProtocol: string,
): TranslationResult {
  const target = PROTOCOL_FORMATS[toProtocol];
  const _source = PROTOCOL_FORMATS[fromProtocol];

  if (!target) {
    return {
      translated: content,
      truncated: false,
      originalLength: content.length,
      translatedLength: content.length,
      maxLength: Infinity,
      strippedMarkdown: false,
      removedProtocolElements: [],
      warning: `Unknown target protocol: ${toProtocol}`,
    };
  }

  let translated = content;
  const removedProtocolElements: string[] = [];
  let strippedMarkdown = false;

  // 1. Strip markdown if target doesn't support it
  if (!target.supportsMarkdown) {
    const hadMarkdown = /[*_`[~]/.test(translated);
    if (hadMarkdown) {
      translated = translated
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/`{1,3}(.+?)`{1,3}/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^>+\s/gm, '')
        .replace(/^[-*+]\s/gm, '')
        .replace(/^\d+\.\s/gm, '');
      strippedMarkdown = true;
    }
  }

  // 2. Remove protocol-specific elements
  if (fromProtocol === 'farcaster') {
    // Replace $DEGEN mentions with plain "DEGEN"
    const degenCount = (translated.match(/\$DEGEN/g) || []).length;
    if (degenCount > 0) {
      translated = translated.replace(/\$DEGEN/g, 'DEGEN');
      removedProtocolElements.push(`$$DEGEN (×${degenCount})`);
    }
    // Remove /tip commands
    translated = translated.replace(/\/tip\s+\S+/g, '').trim();
  }

  if (fromProtocol === 'nostr') {
    // Convert Nostr npub references to plain text
    translated = translated.replace(/npub1[02-9ac-hj-np-z]+/g, '[nostr user]');
    // Remove nip-05 references
    translated = translated.replace(/\S+@\S+\.\S{2,}/g, (match) => {
      // Only strip if it looks like a relay URL, not an email
      if (
        match.includes('//') ||
        match.endsWith('.com') ||
        match.endsWith('.xyz') ||
        match.endsWith('.io') ||
        match.endsWith('.org')
      ) {
        removedProtocolElements.push(match);
        return '';
      }
      return match;
    });
  }

  if (fromProtocol === 'bluesky') {
    // Strip AT:// URIs from inline content
    translated = translated.replace(/at:\/\/did:plc:\S+/g, '[bluesky post]');
  }

  if (fromProtocol === 'lens') {
    // Strip Lens Hub URLs
    translated = translated.replace(/https?:\/\/hub\.lens\.\S+/g, '');
  }

  // Clean up double spaces from removals
  translated = translated.replace(/\s{2,}/g, ' ').trim();

  // 3. Truncate to target max length (word-boundary aware)
  let truncated = false;
  if (target.maxLength && translated.length > target.maxLength) {
    truncated = true;
    const maxBodyLength = target.maxLength - 3; // reserve for ellipsis
    let truncatedText = translated.substring(0, maxBodyLength);

    // Find last word boundary
    const lastSpace = truncatedText.lastIndexOf(' ');
    if (lastSpace > maxBodyLength * 0.7) {
      truncatedText = truncatedText.substring(0, lastSpace);
    }

    translated = `${truncatedText.trim()}...`;
  }

  // 4. Add bridge attribution footer
  const footer = `\n\n_↻ Translated from ${formatProtocolLabel(fromProtocol)} to ${formatProtocolLabel(toProtocol)} via DegenFeed_`;
  translated += footer;

  // Verify final length
  if (target.maxLength && translated.length > target.maxLength) {
    // If the footer pushes us over, try a shorter footer
    const shortFooter = `\n\n_↻ ${formatProtocolLabel(fromProtocol)}→${formatProtocolLabel(toProtocol)}_`;
    translated = `${translated.slice(0, target.maxLength - shortFooter.length - 3).trim()}...${shortFooter}`;
  }

  return {
    translated,
    truncated,
    originalLength: content.length,
    translatedLength: translated.length,
    maxLength: target.maxLength,
    strippedMarkdown,
    removedProtocolElements,
  };
}

/**
 * Check if a translation would result in significant content loss.
 * Returns a warning string if the loss is > 20% of the original, or null.
 */
export function estimateTranslationLoss(
  content: string,
  fromProtocol: string,
  toProtocol: string,
): string | null {
  if (fromProtocol === toProtocol) return null;

  const target = PROTOCOL_FORMATS[toProtocol];
  if (!target) return null;

  if (content.length <= target.maxLength) return null;

  const lossPercent = Math.round(((content.length - target.maxLength) / content.length) * 100);

  if (lossPercent > 50) {
    return `This content will lose ${lossPercent}% of its length when translating to ${formatProtocolLabel(toProtocol)}. Consider editing manually.`;
  }
  if (lossPercent > 20) {
    return `Approximately ${lossPercent}% of the original content will be truncated when posting to ${formatProtocolLabel(toProtocol)}.`;
  }

  return null;
}
