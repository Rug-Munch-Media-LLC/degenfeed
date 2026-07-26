/**
 * /api/feed/for-you — TikTok-style recommendation engine v3.1
 *
 * Research synthesis:
 *   TikTok: watch time, completion rate, shares, profile visits, "not interested"
 *   Twitter/X: engagement prediction, author diversity, topic authority, recency
 *   Instagram: interests, relationship, timeliness, frequency, following, usage
 *
 * V3.1 improvements:
 *   1. Explicit ranking weights: recency(40%) + engagement(30%) + relevance(20%) + diversity(10%)
 *   2. Fresh content boost: posts <1hr old get +20% score
 *   3. Boredom breaker: every 15 posts, injects a high-quality post from unfamiliar category
 *   4. Niche detection: crypto/defi posts rank higher for crypto-interested users
 *   5. Cold start: new users → high-engagement content across all categories
 *   6. Dwell time: KV-tracked view duration → boosts similar content
 *   7. Feedback: "Show less/more like this" → topic/creator weight adjustment
 *   8. Engagement prediction v2: 9-factor model with dwell + feedback signals
 *   9. Creator diversity: max 3 per creator per page, rotation enforced
 *   10. Algorithm transparency: each post gets a human-readable "why" reason
 *
 * Also provides topic preference management + dwell recording + feedback endpoints.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { parseProtocols } from '@degenfeed/utils';
import {
