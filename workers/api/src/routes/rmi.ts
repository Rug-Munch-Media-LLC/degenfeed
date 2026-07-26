/**
 * /api/rmi/* — Bridge to the rmi-backend DataBus.
 *
 * Surfaces rmi-backend's institutional-grade news, intel, and data
 * to DegenFeed as a unified feed. The same provider is also exposed
 * to the worker for use in /api/feed/home aggregation.
 *
 * Endpoints:
 *   GET /api/rmi/news          → /api/v1/news/feed
 *   GET /api/rmi/news/headlines → /api/v1/news/headlines
 *   GET /api/rmi/news/sources   → /api/v1/news/sources
 *   GET /api/rmi/news/sentiment → /api/v1/news/sentiment
 *   GET /api/rmi/news/stats     → /api/v1/news/stats
 *   GET /api/rmi/health         → rmi-backend up check
 */

import type { RmiDataBusProvider, RmiFeedResponse } from '@degenfeed/feed-providers';
import { rmiUrl } from '@degenfeed/utils';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

function provider(env: Env): RmiDataBusProvider {
