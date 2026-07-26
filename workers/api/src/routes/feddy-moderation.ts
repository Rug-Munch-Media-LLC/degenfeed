/**
 * @degenfeed/api-worker — Feddy Communities: Moderation
 *
 * Reports, appeals, moderation log, keyword filters, link blocklist,
 * and federation blocklist management.
 */

import { Hono } from 'hono';
import type { Appeal, Report, ReportCategory } from '../lib/feddy-store';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
