/**
 * /api/cross-reply — Cross-protocol reply bridge.
 *
 * Reply to a post on ANY protocol from ANY other protocol.
 * This is the key differentiator: reply to a Lens post from Nostr,
 * reply to a Farcaster cast from Mastodon, etc.
 *
 * POST /api/cross-reply
 * Body: { parentPostUri, parentProtocol, replyProtocol, content, walletAddress }
 *
 * Bridge directions (source → target):
 *   Mastodon→Nostr   — reply on Mastodon to a Nostr post
 *   Nostr→Farcaster  — reply on Nostr to a Farcaster post, echos to Farcaster
 *   Nostr→Mastodon   — reply on Nostr to a Mastodon post, echos to Mastodon
 *   Farcaster→Mastodon — reply on Farcaster to a Mastodon post, echos to Mastodon
 *
 * Flow:
 *   1. Resolve the parent post's protocol-specific ID from the df:// URI
 *   2. Get the user's identity on the reply protocol
 *   3. Format the reply with cross-protocol attribution
 *   4. Post through the appropriate protocol SDK
 *   5. Echo the reply back to the parent's protocol (when the bridge
 *      has the signing capability — currently Mastodon echo via GtSClient)
 *   6. Store bridge records in KV for the status aggregator
 *   7. Return success with the new post URI
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { ALLOWED_PROTOCOLS, hasSuspiciousPayload, sanitizeString } from '../sanitize';
import type { Env } from '../types';

type CrossReplyRequest = {}
