/**
 * /api/content/[uri] — Resolve a df:// URI to the full post data.
 *
 * Accepts a URL-encoded df:// URI as the path segment and returns the
 * corresponding UnifiedPost. The resolution strategy:
 *   1. Check the post KV cache (populated by the feed pipeline).
 *   2. Fetch from the native protocol provider.
 *   3. Fall back to an RSS provider for unmatched protocols.
 */

import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import {
