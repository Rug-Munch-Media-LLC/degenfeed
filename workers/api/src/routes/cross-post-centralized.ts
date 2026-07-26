/**
 * @degenfeed/api-worker — Cross-Post to Centralized Platforms (Dispatch)
 *
 * Publishes content to platforms we CAN'T fork: Medium, Substack, YouTube,
 * TikTok, Instagram, LinkedIn, Reddit, Pinterest.
 *
 * Dispatches to platform-specific handlers in cross-post-platforms.ts.
 * Types and limits are in cross-post-types.ts.
 *
 * All handlers require the user to have connected their account first via
 * the /api/accounts/connect/:platform flow.
 */

import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import { getConnectedAccount } from './connected-accounts';
import {
  publishToInstagram,
  publishToLinkedIn,
  publishToMedium,
  publishToPinterest,
  publishToReddit,
  publishToSubstack,
  publishToTikTok,
  publishToYouTube,
} from './cross-post-platforms';
import type { CrossPostInput, CrossPostResult } from './cross-post-types';

// ─── Re-exports for backward compatibility ─────────────────────────────────

export type { CrossPostInput, CrossPostResult } from './cross-post-types';
export { adaptContentForPlatform, PLATFORM_LIMITS } from './cross-post-types';

// ─── Main dispatch ────────────────────────────────────────────────────────

export async function handleCrossPostCentralized(
  request: Request,
  env: Env,
  platform: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();

  // Get the user's connected account for this platform
  const account = await getConnectedAccount(env, wallet, platform);
  if (!account) {
    return jsonResponse(
      {
        error: `No connected account for ${platform}. Connect first at /api/accounts/connect/${platform}`,
        platform,
      },
      401,
    );
  }

  // Parse input
  let input: CrossPostInput;
  try {
    input = (await request.json()) as CrossPostInput;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!input.text && !input.videoUrl && !input.videoBase64) {
    return jsonResponse({ error: 'text, videoUrl, or videoBase64 required' }, 400);
  }

  // Dispatch to platform-specific handler
  let result: CrossPostResult;
  switch (platform) {
    case 'medium':
      result = await publishToMedium(input, account);
      break;
    case 'substack':
      result = await publishToSubstack(input, account);
      break;
    case 'youtube':
      result = await publishToYouTube(input, account, env);
      break;
    case 'tiktok':
      result = await publishToTikTok(input, account, env);
      break;
    case 'instagram':
      result = await publishToInstagram(input, account, env);
      break;
    case 'linkedin':
      result = await publishToLinkedIn(input, account);
      break;
    case 'reddit':
      result = await publishToReddit(input, account);
      break;
    case 'pinterest':
      result = await publishToPinterest(input, account);
      break;
    default:
      return jsonResponse({ error: `Unsupported platform: ${platform}` }, 400);
  }

  if (!result.ok) {
    return jsonResponse({ error: result.error || 'Publishing failed', platform, result }, 502);
  }

  return jsonResponse({ ok: true, platform, result });
}
