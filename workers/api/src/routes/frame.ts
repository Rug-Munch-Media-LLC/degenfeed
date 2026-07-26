/**
 * Farcaster Frame resolver — fetches frame HTML and parses fc:frame meta tags.
 *
 * GET /api/frame/resolve?url=https://...
 * POST /api/frame/action — submits frame button action (POST to frame's postUrl)
 */

import { jsonResponse } from '../response-helpers';
import { isValidFetchUrl, safeFetch } from '../sanitize';
import type { Env } from '../types';

type FrameData = {};
