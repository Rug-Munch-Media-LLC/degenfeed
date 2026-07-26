/**
 * @degenfeed/api-worker — Stream Management & Announcement
 *
 * When a creator goes live, this module handles:
 *   1. Recording the stream metadata
 *   2. Announcing the stream to ALL linked protocols
 *   3. Broadcasting to the DegenFeed WebSocket
 *
 * Routes:
 *   POST /announce  — create and announce a stream to all linked protocols
 *   GET  /:id       — get stream record by ID
 */

import { Hono } from 'hono';
import { aggregateAllStreams } from '../feed/live-aggregator';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
