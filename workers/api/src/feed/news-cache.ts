/**
 * news-cache — Caching layer for news aggregation results.
 *
 * Provides a uniform interface over Cloudflare KV for caching
 * aggregation results, source health data, and per-source article counts.
 *
 * Separated from news-aggregator.ts during de-godding.
 */

import type { Env } from '../types';

export interface NewsCache {

export function createNewsCache(env: Env): NewsCache {

export function newsCacheKey(...parts: string[]): string {

export const CACHE_TTL = {

