/**
 * @degenfeed/degenchat — DegenChat brand
 *
 * Brand constants used by the web UI: name, tagline, colors.
 */

export const DEGENCHAT_NAME = 'DegenChat' as const;
export const DEGENCHAT_TAGLINE = 'Chat across every protocol' as const;
export const DEGENCHAT_COLOR = '#00FF41' as const;

/** Protocol colors used in the DegenChat logo (7 protocols = 7 dots). */
export const DEGENCHAT_BRAND_COLORS = [
  '#8b5cf6', // nostr
  '#6A47E4', // farcaster
  '#6364FF', // mastodon
  '#0285FF', // bluesky
  '#ABFE2C', // lens
  '#0DBD8B', // matrix
  '#0022FF', // xmpp
] as const;
