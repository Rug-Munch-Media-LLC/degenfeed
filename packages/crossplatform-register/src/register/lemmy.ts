/**
 * @degenfeed/crossplatform-register — Lemmy registration
 *
 * Creates a user account on a Lemmy instance via its API v3.
 * Lemmy instances are federated — registration is instance-specific.
 *
 * API docs: https://join-lemmy.org/api/classes/LemmyHttp.html#register
 * Endpoint: POST /api/v3/user/register
 *
 * Self-hosted instance: https://community.degenfeed.xyz
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerLemmy(
  desiredUsername: string,
  walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = opts.lemmyInstanceUrl || 'https://community.degenfeed.xyz';
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v3`;

    // Step 1: Check if username is available (search for existing user)
    const searchRes = await fetch(
      `${apiBase}/user?username=${encodeURIComponent(desiredUsername)}`,
      {
        headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
      },
    );
    if (searchRes.ok) {
      // User exists — check if it's actually found
      const searchData = (await searchRes.json()) as { person_view?: { person?: { id: number } } };
      if (searchData?.person_view?.person?.id) {
        return {
          platform: 'lemmy',
          status: 'failed',
          error: `@${desiredUsername} is already taken on ${instanceUrl}`,
        };
      }
    }

    // Step 2: Get captcha info if required
    let captchaUuid: string | undefined;
    let captchaAnswer: string | undefined;
    try {
      const captchaRes = await fetch(`${apiBase}/user/get_captcha`, {
        headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
      });
      if (captchaRes.ok) {
        const captchaData = (await captchaRes.json()) as {
          ok?: { uuid: string; png: string };
        };
        // If captcha is required, we need a human-in-the-loop
        if (captchaData?.ok?.uuid) {
          return {
            platform: 'lemmy',
            status: 'failed',
            error: `CAPTCHA required by ${instanceUrl}. Manual registration needed at ${instanceUrl}/signup`,
          };
        }
      }
    } catch {
      // Captcha endpoint may not exist — proceed without
    }

    // Step 3: Register user
    const password = generateLemmyPassword();
    const email = `${walletAddress.slice(2, 10)}-lemmy@register.degenfeed.xyz`;

    const registerRes = await fetch(`${apiBase}/user/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
      },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        password_verify: password,
        email,
        show_nsfw: true,
        captcha_uuid: captchaUuid,
        captcha_answer: captchaAnswer,
        honeypet: '', // anti-spam: must be empty
        answer: '', // anti-spam: must be empty
      }),
    });

    const registerData = (await registerRes.json()) as {
      jwt?: string;
      registration_created?: boolean;
      verify_email_sent?: boolean;
      error?: string;
    };

    if (!registerRes.ok || !registerData.jwt) {
      // May have been created but email verification is needed
      if (registerData.registration_created) {
        const accountInfo: Record<string, string> = {
          username: desiredUsername,
          instance: instanceUrl,
          email,
          status: 'pending_verification',
        };
        const { persistPlatformAccount } = await import('./kv');
        await persistPlatformAccount('lemmy', walletAddress, accountInfo, opts.storage);
        return {
          platform: 'lemmy',
          status: 'pending',
          username: `${desiredUsername}@${new URL(instanceUrl).hostname}`,
          accountInfo,
        };
      }
      return {
        platform: 'lemmy',
        status: 'failed',
        error: registerData.error || `Lemmy registration failed on ${instanceUrl}`,
      };
    }

    // Encrypt the jwt using the caller-supplied seal function before KV storage.
    // The raw jwt is never stored in plaintext — only the AES-256-GCM sealed blob.
    const jwtToStore = opts.sealSecret ? await opts.sealSecret(registerData.jwt) : registerData.jwt;
    const accountInfo: Record<string, string> = {
      username: desiredUsername,
      instance: instanceUrl,
      _sealedJwt: jwtToStore,
      email,
      verifyEmailSent: String(registerData.verify_email_sent ?? false),
    };

    const { persistPlatformAccount } = await import('./kv');
    await persistPlatformAccount('lemmy', walletAddress, accountInfo, opts.storage);

    return {
      platform: 'lemmy',
      status: registerData.verify_email_sent ? 'pending' : 'created',
      username: `${desiredUsername}@${new URL(instanceUrl).hostname}`,
      accountInfo: {
        username: desiredUsername,
        instance: instanceUrl,
        email,
        verifyEmailSent: String(registerData.verify_email_sent ?? false),
      },
    };
  } catch (err) {
    return {
      platform: 'lemmy',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Lemmy registration error',
    };
  }
}

function generateLemmyPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
