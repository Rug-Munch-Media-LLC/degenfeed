/**
 * @degenfeed/api-worker — Nostr NIP-29 Groups Route Registration
 */

import type { Hono } from 'hono';
import type { Env } from '../../types';
import nostrGroups from '../nostr-groups';
import { withSession } from '../route-registry';

export function registerNostrGroupRoutes(app: Hono<{ Bindings: Env }>): void {
