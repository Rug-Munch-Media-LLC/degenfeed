/**
 * @degenfeed/api-worker — Cross-Publish Orchestrator
 *
 * Unified publisher for one-click multi-protocol publishing.
 * Accepts a MasterPost + protocol list + optional schedule time,
 * calls each protocol adapter, publishes in parallel, and returns results.
 *
 * Depends on the existing publish-orchestrator.ts for actual SDK calls,
 * and on @degenfeed/cross-protocol-bridge for content adaptation.
 */

import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import { adaptForProtocols } from '@degenfeed/cross-protocol-bridge';
import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';
import type { PublishInput } from './publish-orchestrator';
import { orchestratePublish } from './publish-orchestrator';

// ─── Types ────────────────────────────────────────────────────────────────

export type CrossPublishRequest = {}
