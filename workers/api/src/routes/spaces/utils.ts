/**
 * @degenfeed/api-worker — Spaces Utils
 */

import { liveIndexKey, spaceKey, upcomingIndexKey } from '../../kv-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';
import type { SpaceChatMessage, SpaceRecord } from './types';

function pastIndexKey(): string {
