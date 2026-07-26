/**
 * @degenfeed/api-worker — Cross-Instance Login
 *
 * Users can use their DegenFeed credentials to login to external instances
 * of supported protocols. This is how ActivityPub/AT Protocol federation
 * works — we make it seamless.
 *
 * Routes:
 *   POST /api/accounts/cross-login/mastodon — Login to any Mastodon instance
 *   POST /api/accounts/cross-login/bluesky  — Login to any Bluesky client
 *   POST /api/accounts/cross-login/farcaster — Sign in to any Farcaster client
 *   POST /api/accounts/cross-login/matrix   — Login to any Matrix homeserver
 *   POST /api/accounts/cross-login/peertube — Login to any PeerTube instance
 *   POST /api/accounts/cross-login/lemmy    — Login to any Lemmy instance
 *   POST /api/accounts/cross-login/pixelfed — Login to any Pixelfed instance
 *   GET  /api/accounts/cross-login/credentials — Get federation credentials
 *   GET  /api/accounts/cross-login/sso-token   — Get SSO token for external auth
 *
 * Each endpoint returns the credentials/token needed to authenticate
 * on the target instance using the user's DegenFeed identity.
 */

import { sealForWallet } from '../lib/crypto-seal';
import { log } from '../logger';
import { checkPremiumStatus } from '../premium';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

type CrossLoginRequest = {}
