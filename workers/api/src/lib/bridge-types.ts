/**
 * @degenfeed/api-worker — Cross-Protocol Bridge Types
 */

import type { Protocol } from '@degenfeed/types';
import type { MediaAttachment } from './format-translator';

// ─── Bridge Types ───────────────────────────────────────────────────────

export interface BridgeContentInput {
  sourceUri: string;
  sourceProtocol: Protocol;
  sourceNativeId: string;
  text: string;
  title?: string;
  images?: MediaAttachment[];
  links?: string[];
  hashtags?: string[];
  auth?: Record<string, string>;
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
  targets?: Protocol[];
}

export interface BridgeResult {
  ok: boolean;
  sourceProtocol: string;
  sourceNativeId: string;
  targetProtocol: string;
  nativeId?: string;
  nativeUri?: string;
  error?: string;
  txHash?: string;
  costCredits?: number;
}

export interface BridgeReport {
  results: BridgeResult[];
  successCount: number;
  failureCount: number;
  startedAt: number;
  completedAt: number;
}

export interface SourceContent {
  text: string;
  title?: string;
  images?: MediaAttachment[];
  links?: string[];
  hashtags?: string[];
}

export interface CrossProtocolReply {
  parentUri: string;
  sourceProtocol: string;
  replyNativeId: string;
  text: string;
  authorName?: string;
  createdAt: number;
}

export type BridgeDirectionHandler = (
  source: SourceContent,
  targetAuth: Record<string, string>,
  env: Env,
) => Promise<{
  ok: boolean;
  nativeId?: string;
  nativeUri?: string;
  error?: string;
}>;

// Re-export Env type
import type { Env } from '../types';

export type { Env };
