/**
 * /api/feed/curated — Smarter addictive feed endpoint.
 *
 * Applies: seen tracking, freshness bias, explore/exploit, engagement
 * prediction, scroll depth adaptation, and content variety enforcement.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { parseProtocols } from '@degenfeed/utils';
import {
