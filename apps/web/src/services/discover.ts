/**
 * @degenfeed/web — Discover API Service
 */

import type { ApiResponse } from '../types/api';
import { api } from './api';

export interface DiscoverSection<T = unknown> {
  title: string;
  key: string;
  items: T[];
  loaded: boolean;
  error?: string;
}

/** Fetch a discover section by URL */
export async function fetchDiscoverSection<T>(url: string): Promise<ApiResponse<T[]>> {
  return api.get<T[]>(url);
}

/** Fetch the "new this week" data for discover page */
export async function fetchDiscoverNew(): Promise<ApiResponse<unknown>> {
  return api.get<unknown>('/api/discover/new');
}
