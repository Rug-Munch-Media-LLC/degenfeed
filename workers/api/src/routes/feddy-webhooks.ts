/**
 * @degenfeed/api-worker — Feddy Communities: Federation & Webhooks
 *
 * Federation health, sync, webhook management, bot API keys,
 * RSS feed, Discord/Telegram links, and webhook delivery.
 */

import { Hono } from 'hono';
import type { BotScope, WebhookEvent } from '../lib/feddy-store';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
