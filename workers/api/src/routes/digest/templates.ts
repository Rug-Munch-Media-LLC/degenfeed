/**
 * @degenfeed/api-worker — Digest HTML Templates
 *
 * Rich HTML newsletter builder for digest delivery.
 */

import type { DigestResponse } from './types';

function escapeHtml(s: string): string {
