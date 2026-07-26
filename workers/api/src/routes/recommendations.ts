/**
 * @routes/recommendations — Recommendation API endpoints
 *
 * Routes:
 *   GET    /api/recommendations/videos     — Personalized video recommendations
 *   GET    /api/recommendations/shorts     — Personalized shorts recommendations
 *   GET    /api/recommendations/streams    — Live stream recommendations
 *   GET    /api/recommendations/related    — "Because you watched" (query: ?source=&id=)
 *   GET    /api/recommendations/trending   — Personalized trending
 *   GET    /api/recommendations/discover   — Discover new creators
 *   POST   /api/recommendations/interaction — Record user interaction
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
