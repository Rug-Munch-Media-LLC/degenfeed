/**
 * shorts-aggregator — Class-based aggregator for short-form video content.
 *
 * Fetches from all sources (YouTube Shorts, TikTok RSS, Instagram Reels,
 * PeerTube), normalizes to ShortPost, enriches with DegenFeed metadata,
 * ranks algorithmically, diversifies sources, and paginates.
 *
 * This is the core engine powering the /api/shorts/* endpoints.
 */

import {
import { rankShorts, type UserInterestProfile } from '@degenfeed/shorts-provider/scorer';

import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ShortPost extends ShortVideoItem {

export interface ShortsAggregatorOptions {

export interface ShortsFeedResponse {

// ─── Aggregator ─────────────────────────────────────────────────────────

export class ShortsAggregator {

