/**
 * @degenfeed/api-worker - Feed route registration
 *
 * Register Feed-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import { jsonResponse, ok, serverError } from '../../response-helpers';
import blueskyFeedGen from '../../routes/bluesky-feed-generator';
import { handleCommunities } from '../../routes/communities';
import { handleAltFeed, handleNewsletterFeed, handleTopFeed } from '../../routes/curated';
import type { Env } from '../../types';
import {
