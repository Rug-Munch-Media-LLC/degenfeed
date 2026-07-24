/**
 * @degenfeed/web — Spaces API Service
 */

import type { ApiResponse } from '../types/api';
import { api } from './api';

export interface Space {
  id: string;
  title: string;
  host: string;
  description?: string;
  participantCount: number;
  status: 'live' | 'upcoming' | 'past';
  startsAt?: string;
  speakers?: string[];
  topics?: string[];
}

export interface JoinResult {
  success: boolean;
  spaceId: string;
  role: 'listener' | 'speaker';
}

/** Fetch live spaces */
export async function fetchLiveSpaces(): Promise<ApiResponse<Space[]>> {
  return api.get<Space[]>('/api/spaces/live');
}

/** Fetch upcoming spaces */
export async function fetchUpcomingSpaces(): Promise<ApiResponse<Space[]>> {
  return api.get<Space[]>('/api/spaces/upcoming');
}

/** Fetch past spaces */
export async function fetchPastSpaces(): Promise<ApiResponse<Space[]>> {
  return api.get<Space[]>('/api/spaces/past');
}

/** Join a space */
export async function joinSpace(spaceId: string): Promise<ApiResponse<JoinResult>> {
  return api.post<JoinResult>(`/api/spaces/${spaceId}/join`);
}

/** Create a new space */
export async function createSpace(data: Partial<Space>): Promise<ApiResponse<Space>> {
  return api.post<Space>('/api/spaces/create', data);
}
