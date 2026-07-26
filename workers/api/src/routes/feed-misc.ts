/**
 * Auxiliary feed routes — single-provider feeds, Reddit proxy, and
 * provider health. Split from routes/feed.ts (re-exported there for
 * backward compatibility); the home-feed orchestrator lives in
 * routes/feed.ts.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import {
