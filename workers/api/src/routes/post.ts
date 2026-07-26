/**
 * /api/feed/post/[id] — Fetch a single post by ID.
 *
 * Searches all enabled providers for the post. Returns the first match.
 * Cached for 5 minutes in KV.
 */

import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import {
