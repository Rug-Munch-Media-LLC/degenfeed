/**
 * DegenFeed post content formatter for Telegram.
 *
 * Telegram enforces a 4096-character limit per message and uses a subset
 * of HTML / MarkdownV2 for formatting. These helpers ensure content fits,
 * strips unsupported tags, and wraps mentions in valid formats.
 */

// ─── Constants ─────────────────────────────────────────────────────

export const TELEGRAM_MAX_LENGTH = 4096;

/**
 * Supported HTML tags in Telegram messages.
 * @see https://core.telegram.org/bots/api#html-style
 */
const SUPPORTED_HTML_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ins',
  's',
  'strike',
  'del',
  'span',
  'tg-spoiler',
  'a',
  'code',
  'pre',
  'blockquote',
]);

/**
 * HTML attributes that Telegram preserves per tag.
 */
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href'],
  span: ['class'],
  code: ['class'],
  pre: ['class'],
  blockquote: ['expandable'],
};

// ─── Formatting ────────────────────────────────────────────────────

/**
 * Format text for Telegram, respecting the maximum message length.
 * Cuts off at Telegram's 4096-character limit, preserving whole words
 * and closing any unclosed tags when truncating.
 *
 * @param text      - Input text (may contain HTML or MarkdownV2).
 * @param opts      - Formatting options.
 * @param opts.maxLength  - Character limit (default 4096).
 * @param opts.parseMode  - Target parse mode for truncation awareness.
 * @returns The formatted string safe for Telegram.
 */
export function formatForTelegram(
  text: string,
  opts?: {
    maxLength?: number;
    parseMode?: 'HTML' | 'MarkdownV2';
  },
): string {
  const maxLen = opts?.maxLength ?? TELEGRAM_MAX_LENGTH;
  const mode = opts?.parseMode ?? 'HTML';

  if (text.length <= maxLen) return text;

  // Truncate intelligently based on parse mode
  const truncated = truncateWithTagBalance(text, maxLen, mode);
  return truncated;
}

/**
 * Strip HTML tags that Telegram does not support.
 * Preserves supported tags and their allowed attributes.
 */
export function stripUnsupportedTags(text: string, targetParseMode: 'HTML' | 'MarkdownV2'): string {
  if (targetParseMode === 'MarkdownV2') {
    // MarkdownV2 has stricter escaping rules; strip all HTML
    // since it won't render anyway in Markdown mode
    return text.replace(/<[^>]*>/g, '');
  }

  // HTML mode: strip unsupported tags but keep content
  return text.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName) => {
    const tag = tagName.toLowerCase();
    if (SUPPORTED_HTML_TAGS.has(tag)) {
      // Validate attributes for supported tags
      return stripUnsupportedAttrs(match, tag);
    }
    // Unsupported tag: remove it entirely, keeping inner content
    return '';
  });
}

/**
 * Escape text for MarkdownV2 mode.
 * MarkdownV2 requires escaping certain characters with backslash.
 */
export function escapeMarkdownV2(text: string): string {
  // Characters that must be escaped: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * Escape text for HTML mode.
 * Escapes <, >, & that aren't part of recognized tags.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build a Telegram-formatted post notification from DegenFeed content.
 * Strips unsupported tags, truncates to max length, and ensures
 * the content is suitable for the target parse mode.
 */
export function buildTelegramContent(
  content: string,
  opts?: {
    maxLength?: number;
    parseMode?: 'HTML' | 'MarkdownV2';
    stripTags?: boolean;
  },
): string {
  const mode = opts?.parseMode ?? 'HTML';
  let text = content;

  // Optionally strip unsupported tags first
  if (opts?.stripTags !== false) {
    text = stripUnsupportedTags(text, mode);
  }

  // Apply escaping for MarkdownV2
  if (mode === 'MarkdownV2') {
    text = escapeMarkdownV2(text);
  } else {
    text = escapeHtml(text);
  }

  // Truncate
  return formatForTelegram(text, opts);
}

// ─── Internal Helpers ──────────────────────────────────────────────

/**
 * Truncate text at the given length, attempting to balance HTML tags
 * so the resulting string is still valid for Telegram's parser.
 */
function truncateWithTagBalance(text: string, maxLen: number, mode: 'HTML' | 'MarkdownV2'): string {
  if (text.length <= maxLen) return text;

  // Find a good break point: try to end at a word boundary
  let cut = maxLen;
  while (cut > maxLen - 40 && cut > 0) {
    const ch = text[cut];
    if (ch === ' ' || ch === '\n' || ch === '.' || ch === ',' || ch === '!' || ch === '?') {
      break;
    }
    cut--;
  }
  if (cut <= 0) cut = maxLen;

  let truncated = text.slice(0, cut);

  if (mode === 'HTML') {
    // Close any unclosed tags
    truncated = closeOpenTags(truncated);
  }

  // Add ellipsis if we cut content
  if (truncated.length < text.length) {
    truncated += '…';
  }

  return truncated;
}

/**
 * Close any unclosed HTML tags in the string.
 * Keeps track of open tags and appends closing tags in reverse order.
 */
function closeOpenTags(html: string): string {
  const tagStack: string[] = [];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    if (!match[1]) continue;
    const fullTag = match[0];
    const tagName = match[1]?.toLowerCase();

    if (!SUPPORTED_HTML_TAGS.has(tagName)) continue;

    if (fullTag.startsWith('</')) {
      // Closing tag: pop from stack if it matches the last opened
      if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
        tagStack.pop();
      }
    } else if (!fullTag.endsWith('/>')) {
      // Opening tag (not self-closing): push onto stack
      // Skip void elements
      if (!['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tagName)) {
        tagStack.push(tagName);
      }
    }
  }

  // Close remaining open tags in reverse order
  let result = html;
  for (let i = tagStack.length - 1; i >= 0; i--) {
    result += `</${tagStack[i]}>`;
  }

  return result;
}

/**
 * Strip attributes that Telegram doesn't support on a given HTML tag.
 */
function stripUnsupportedAttrs(tag: string, tagName: string): string {
  const allowed = ALLOWED_ATTRS[tagName];
  if (!allowed || allowed.length === 0) {
    // No attributes allowed: strip everything between tag name and >
    return tag.replace(/\s[^>]*>/g, '>');
  }

  // Preserve only allowed attributes
  const allowedSet = new Set(allowed);
  return tag.replace(
    /(\s+)([a-zA-Z-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g,
    (match, _whitespace, attrName) => {
      return allowedSet.has(attrName) ? match : '';
    },
  );
}
