/**
 * @degenfeed/api-worker — Feddy Communities: Features
 *
 * Pinned posts, events, polls, wiki pages, badges, and extended roles.
 */

import { Hono } from 'hono';
import type { CommunityEvent, CommunityPoll } from '../lib/feddy-store';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
