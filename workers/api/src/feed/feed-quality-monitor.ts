/**
 * @degenfeed/api-worker — Feed Quality Monitoring
 *
 * Monitors per-protocol content flow and alerts when feeds go empty.
 *
 * Tracks:
 *   1. Per-protocol content count (last N fetch cycles)
 *   2. Empty feed alerts (any protocol with 0 posts for >1 hour)
 *   3. Provider health integration into feed quality scoring
 *
 * Alerts are written to KV for observability dashboards and the
 * /api/bridge/health endpoint.
 */

import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────

const FEED_MONITOR_PREFIX = 'feed:monitor:v1:';
const EMPTY_FEED_ALERT_PREFIX = 'feed:alert:v1:';
const PROTOCOL_COUNT_PREFIX = 'feed:counts:v1:';
const ALERT_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const MAX_COUNT_HISTORY = 24; // keep last 24 samples

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProtocolCountSample {

export interface EmptyFeedAlert {

export interface FeedQualityReport {

// ─── Helpers ────────────────────────────────────────────────────────────

function protocolCountKey(protocol: string): string {

function alertKey(protocol: string): string {

function monitorKey(protocol: string): string {

// ─── Record a protocol fetch result ──────────────────────────────────

export async function recordProtocolFetch(
  env: Env,
  protocol: string,
  postCount: number,
): Promise<void> {

// ─── Check and manage empty feed alerts ─────────────────────────────

async function checkEmptyFeedAlert(
  env: Env,
  protocol: string,
  samples: ProtocolCountSample[],
  now: number,
): Promise<void> {

function getConsecutiveEmpty(samples: ProtocolCountSample[]): number {

// ─── Mark a protocol as having content (for alerts) ─────────────────

export async function resolveFeedAlert(env: Env, protocol: string): Promise<void> {

// ─── Generate quality report ────────────────────────────────────────

export async function getFeedQualityReport(env: Env): Promise<FeedQualityReport> {

// ─── KV-backed Webhook for empty feed alerts ───────────────────────

export async function notifyEmptyFeedAlert(env: Env, alert: EmptyFeedAlert): Promise<void> {

