/**
 * @degenfeed/api-worker — Connected Accounts Types
 *
 * Shared types, KV helpers, and platform constants for centralized
 * platform OAuth connections (Medium, YouTube, LinkedIn, Reddit,
 * Instagram, TikTok, Pinterest, Substack).
 */

import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
