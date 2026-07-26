import { MastodonProvider, ThreadsProvider } from '@degenfeed/feed-providers';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

export async function handleActivityPubFeed(request: Request, _env: Env): Promise<Response> {
