/**
 * /api/discord — Discord Bot Integration
 *
 * Connect Discord servers to DegenFeed for cross-posting stream
 * announcements, bridging chat messages, and creator coin alerts.
 *
 * Endpoints:
 *   POST   /api/discord/connect            { guildId?, channelId, webhookId?, webhookToken? }
 *   POST   /api/discord/channel/announce   { channelId, content, embeds? }
 *   GET    /api/discord/channels            → list connected channels
 *   DELETE /api/discord/disconnect          { channelId? }
 *   POST   /api/discord/bridge              { channelId, messageId, streamId }
 *   GET    /api/discord/oauth               → OAuth authorization URL
 *   GET    /api/discord/callback            → OAuth callback handler
 *   GET    /api/discord/guilds              → List user's Discord servers
 *   POST   /api/discord/bridge/enable       → Enable cross-posting to channel
 *   POST   /api/discord/community/create   → Create creator coin Discord server template
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import { consumeState, DISCORD_STATE_PREFIX, generateOAuthState, storeState } from './oauth-state';

function safeKey(s: string): string {
