/**
 * /api/github — GitHub Integration
 *
 * Connect GitHub accounts to DegenFeed for dev-focused creators.
 * Post repo releases, PRs, and stars to DegenFeed and bridge to all protocols.
 *
 * Endpoints:
 *   POST   /api/github/connect        { username, accessToken?, repo? }
 *   POST   /api/github/repo-activity  { owner, repo, events[] }
 *   DELETE /api/github/disconnect
 *   GET    /api/github/accounts       → list connected accounts
 *   POST   /api/github/bridge         { owner, repo, event { type, payload } }
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

function safeKey(s: string): string {
