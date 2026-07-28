/**
 * @degenfeed/api-worker — Unified Profile Sync
 *
 * Profile sync triggers, updates, and primary field overrides.
 */

import type { PrimaryFieldOverride, ProtocolProfile } from '../../lib/profile-sync';
import {
  getSyncStatus,
  pushProfile,
  SUPPORTED_SYNC_PROTOCOLS,
  setPrimaryOverride,
  syncProfile,
} from '../../lib/profile-sync';
import { jsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../types';

export async function handleSyncProfile(
  request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (session.address.toLowerCase() !== wallet.toLowerCase())
    return jsonResponse({ error: 'Can only sync your own profile' }, 403);
  try {
    const result = await syncProfile(wallet, {}, env);
    return jsonResponse({
      data: {
        syncedProtocols: result.map(r => r.protocol),
        results: result,
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Sync failed: ${String(err)}` }, 500);
  }
}

export async function handleUpdateProfile(
  request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (session.address.toLowerCase() !== wallet.toLowerCase())
    return jsonResponse({ error: 'Can only update your own profile' }, 403);
  let body: Partial<ProtocolProfile>;
  try {
    body = (await request.json()) as Partial<ProtocolProfile>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const validFields: Array<keyof ProtocolProfile> = [
    'displayName',
    'avatar',
    'bio',
    'website',
    'banner',
  ];
  const hasUpdates = validFields.some((f) => body[f] !== undefined);
  if (!hasUpdates)
    return jsonResponse(
      { error: 'No valid fields to update. Supported: displayName, avatar, bio, website, banner' },
      400,
    );
  try {
    const result = await pushProfile(wallet, body as Record<string, unknown>, env);
    const succeeded = result.filter(p => p.ok).length;
    const failed = result.filter(p => !p.ok).length;
    return jsonResponse({
      data: {
        results: result,
        summary: { totalProtocols: SUPPORTED_SYNC_PROTOCOLS.length, succeeded, failed },
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Failed to update profile: ${String(err)}` }, 500);
  }
}

export async function handleSetPrimary(
  request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (session.address.toLowerCase() !== wallet.toLowerCase())
    return jsonResponse({ error: 'Can only modify your own profile' }, 403);
  let body: Record<string, string | null>;
  try {
    body = (await request.json()) as Record<string, string | null>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const allowedFields: Array<keyof PrimaryFieldOverride> = [
    'displayName',
    'avatar',
    'bio',
    'website',
    'banner',
  ];
  const overrides: PrimaryFieldOverride = {};
  for (const field of allowedFields) {
    const value = body[field];
    if (value === null || value === undefined) continue;
    if (typeof value !== 'string')
      return jsonResponse(
        { error: `Invalid value for ${field}: must be a protocol name or null` },
        400,
      );
    const protocol = value.toLowerCase();
    if (!SUPPORTED_SYNC_PROTOCOLS.includes(protocol))
      return jsonResponse(
        {
          error: `Unsupported protocol for ${field}: "${protocol}". Supported: ${SUPPORTED_SYNC_PROTOCOLS.join(', ')}`,
        },
        400,
      );
    overrides[field] = protocol;
  }
  try {
    // Apply each field override to the specified protocol
    const results: Record<string, void> = {};
    for (const [field, protocol] of Object.entries(overrides)) {
      if (!protocol) continue;
      results[field] = await setPrimaryOverride(wallet, protocol, env);
    }
    return jsonResponse({ data: { overrides: results } });
  } catch (err) {
    return jsonResponse({ error: `Failed to set primary: ${String(err)}` }, 500);
  }
}

export async function handleSyncStatus(
  _request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  if (!wallet || wallet.length < 10) return jsonResponse({ error: 'Invalid wallet address' }, 400);
  try {
    const statuses = await getSyncStatus(wallet, env);
    return jsonResponse({ data: statuses });
  } catch (err) {
    return jsonResponse({ error: `Failed to get sync status: ${String(err)}` }, 500);
  }
}
