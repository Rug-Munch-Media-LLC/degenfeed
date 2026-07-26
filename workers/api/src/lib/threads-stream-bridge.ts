/**
 * @degenfeed/api-worker — Threads Stream Bridge
 *
 * Threads is Meta's microblogging platform that uses ActivityPub federation.
 * Integration works through our GoToSocial (GtS) instance at social.degenfeed.xyz:
 *   - Threads users who follow @degenfeed@social.degenfeed.xyz see our posts
 *   - Threads users can reply to our posts (replies appear in GoToSocial)
 *   - We can bridge those replies back into the DegenFeed stream chat
 *
 * Note: Threads does NOT support rich embeds natively (no link cards, no
 * video embeds). All stream links appear as plain URLs in Threads users' feeds.
 *
 * This bridge complements the direct Threads Graph API integration already in
 * publish-orchestrator.ts (which handles the Threads API directly). This bridge
 * handles the ActivityPub-federated path via GoToSocial, which enables:
 *   1. Threads users that follow our GtS instance see our stream announcements
 *   2. Replies from Threads users appear in our GtS notifications
 *   3. We can poll for and bridge those replies back to the stream chat
 */

import type { Space } from '@degenfeed/types';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { ChatMessage, LiveStream } from './stream-store';
import { addChatMessage } from './stream-store';

// ─── Types ──────────────────────────────────────────────────────────────

export type ThreadsBridgeConfig = {}
