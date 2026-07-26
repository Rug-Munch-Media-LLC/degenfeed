/**
 * @degenfeed/api-worker — Unified Profile Data
 *
 * Data aggregation, search, suggestions, trending.
 */

import { aggregateProfile, SUPPORTED_SYNC_PROTOCOLS } from '../../lib/profile-sync';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import type { ProfileSearchResult } from './types';
import { filterAggregatedProfile, stripHtml } from './utils';

export async function handleAggregateProfile(
  request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
