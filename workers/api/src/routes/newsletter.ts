/**
 * /api/newsletter — DegenFeed Daily Intelligence Briefing
 *
 * A multi-protocol daily digest that aggregates the best content from
 * Nostr, Farcaster, Lens, Bluesky, Mastodon, RSS, and the RMI DataBus
 * into a single email-ready briefing. This is DegenFeed's flagship
 * intelligence product — not an RMI shill.
 *
 * Endpoints:
 *   POST   /api/newsletter/subscribe  { email, niches[], protocols[] }
 *   DELETE /api/newsletter/subscribe  { email }
 *   GET    /api/newsletter/digest     → JSON / HTML / plaintext daily digest
 *   GET    /api/newsletter/status     → subscriber count
 *
 * The digest is built from the same feed pipeline as the home page,
 * ranked by the v2 algorithm, and formatted for email consumption.
 */

import {
