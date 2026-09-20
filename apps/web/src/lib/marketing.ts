/**
 * @degenfeed/web — Client-Side Marketing Helpers
 *
 * Generates share text, UTM links, and social proof for the DegenFeed
 * viral marketing engine. Mirrors the server-side helpers in
 * workers/api/src/lib/marketing.ts for client-side use.
 */

// ─── Types ───────────────────────────────────────────────────────────────

export type ProtocolId =
  | 'degenfeed'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'mastodon'
  | 'peertube'
  | 'lemmy'
  | 'twitter'
  | 'threads';

export type SharePlatform =
  | 'twitter'
  | 'farcaster'
  | 'bluesky'
  | 'mastodon'
  | 'nostr'
  | 'copy'
  | 'native';

export interface ShareConfig {
  symbol: string;
  name: string;
  coinUrl: string;
  creatorHandle?: string;
  holderCount?: number;
  volumeUsd?: number;
  refCode?: string;
}

export interface TipNoteConfig {
  amount: string;
  protocol: ProtocolId;
  currency?: string;
  refCode?: string;
  customNote?: string;
  isPremium?: boolean;
  removeAttribution?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────

const PLATFORM_URL = 'https://degenfeed.xyz';

// ─── UTM Builder ─────────────────────────────────────────────────────────

export function buildUtmUrl(
  baseUrl: string,
  medium: string,
  campaign: string,
  content?: string,
): string {
  const params = new URLSearchParams({
    utm_source: 'degenfeed',
    utm_medium: medium,
    utm_campaign: campaign,
  });
  if (content) params.set('utm_content', content);
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${params.toString()}`;
}

/**
 * Build a share URL with referral code.
 */
export function buildShareUrl(path: string, refCode?: string): string {
  if (!refCode) return `${PLATFORM_URL}${path}`;
  return `${PLATFORM_URL}${path}?ref=${refCode}`;
}

// ─── Share Text Generator ────────────────────────────────────────────────

/**
 * Generate share text for a creator coin.
 */
export function generateShareText(config: ShareConfig, platform: SharePlatform): string {
  const { symbol, name, coinUrl, holderCount, volumeUsd, refCode } = config;

  const url = refCode ? buildShareUrl(`/launch/${symbol}`, refCode) : coinUrl;

  const holders = holderCount ? ` | ${holderCount} holders` : '';
  const volume = volumeUsd ? ` | $${formatCompact(volumeUsd)} volume` : '';

  const base = `🚀 $${symbol} (${name}) just launched on DegenFeed! Fair bonding curve — get in early!${holders}${volume}`;

  switch (platform) {
    case 'twitter':
      return `${base} ⚡ Powered by DegenFeed\n\n${url}\n\n#DegenFeed #CreatorCoins #Web3`;
    case 'farcaster':
      return `${base} ⚡ Powered by DegenFeed\n\n${url}`;
    case 'bluesky':
      return `${base} ⚡ Powered by DegenFeed\n\n${url}`;
    case 'mastodon':
      return `${base} ⚡ Powered by DegenFeed\n\n${url}`;
    case 'nostr':
      return `${base} ⚡ Powered by DegenFeed\n\n${url}`;
    case 'copy':
    case 'native':
    default:
      return `${base} ⚡ Powered by DegenFeed\n\n${url}`;
  }
}

/**
 * Generate share text for a tip (showing what you tipped).
 */
export function generateTipShareText(
  amount: string,
  recipientLabel: string,
  protocol: ProtocolId,
  refCode?: string,
): string {
  const url = refCode
    ? buildShareUrl('/earn', refCode)
    : buildUtmUrl(PLATFORM_URL, 'share', 'tip-share', protocol);

  return `⚡ I just tipped ${amount} to ${recipientLabel} via DegenFeed — cross-platform creator monetization!\n\n${url}`;
}

// ─── Viral Loop Messages ─────────────────────────────────────────────────

export function getViralLoopMessages(coinSymbol: string, refCode: string): string[] {
  return [
    `Share $${coinSymbol} to earn a 1% bonus on every buy referred by your link!`,
    `Tag 3 friends who'd love $${coinSymbol} to unlock exclusive content!`,
    `Top 10 referrers this week get featured on the DegenFeed homepage! Your ref: ${refCode}`,
  ];
}

// ─── Social Badge ────────────────────────────────────────────────────────

export interface BadgeData {
  symbol: string;
  holderCount: number;
  volumeUsd: number;
  bondingProgress: number;
}

/**
 * Get the URL for a live-updating social badge SVG.
 */
export function getBadgeUrl(symbol: string, refCode?: string): string {
  const params = refCode ? `?ref=${refCode}` : '';
  return `${PLATFORM_URL}/api/badge/${encodeURIComponent(symbol)}${params}`;
}

/**
 * Get the embed HTML for a social badge.
 */
export function getBadgeEmbedHtml(symbol: string, refCode?: string): string {
  const url = getBadgeUrl(symbol, refCode);
  return `<a href="${PLATFORM_URL}/launch/${encodeURIComponent(symbol)}" target="_blank" rel="noopener"><img src="${url}" alt="$${symbol} on DegenFeed" width="280" height="80" /></a>`;
}

// ─── Powered By Footer ───────────────────────────────────────────────────

export function getPoweredByText(short?: boolean): string {
  return short ? '⚡ DegenFeed' : '⚡ Powered by DegenFeed';
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
