/**
 * @degenfeed/bridge — SSO Bridge Provisioning Routes
 *
 * After a user registers on GTS, this module provisions accounts on
 * ALL other mesh services (Nostr, Bluesky, Lemmy, PeerTube, Pixelfed,
 * WriteFreely, Owncast, Castopod) via the crossplatform-register package.
 *
 * Endpoints:
 *   POST /api/sso/provision    — Provision all mesh services for a user
 *   GET  /api/sso/provision/status — Check provisioning status
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import type http from 'node:http';
import { registerOnPlatform } from '@degenfeed/crossplatform-register';

// ─── Protocol definitions for provisioning ──────────────────────────────

interface ProvisionProtocol {
  id: string;
  label: string;
  instanceUrl: string;
  skip?: boolean;
}

const PROVISION_PROTOCOLS: ProvisionProtocol[] = [
  { id: 'nostr', label: 'Nostr', instanceUrl: 'ws://127.0.0.1:8085' },
  { id: 'lemmy', label: 'Lemmy', instanceUrl: 'https://community.degenfeed.xyz' },
  { id: 'bluesky', label: 'Bluesky', instanceUrl: 'https://pds.degenfeed.xyz' },
  { id: 'pixelfed', label: 'Pixelfed', instanceUrl: 'https://photos.degenfeed.xyz' },
  { id: 'peertube', label: 'PeerTube', instanceUrl: 'https://video.degenfeed.xyz' },
  { id: 'writefreely', label: 'WriteFreely', instanceUrl: 'https://blog.degenfeed.xyz' },
  { id: 'owncast', label: 'Owncast', instanceUrl: 'https://live.degenfeed.xyz' },
  { id: 'castopod', label: 'Castopod', instanceUrl: 'https://podcast.degenfeed.xyz' },
];

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Generate a deterministic wallet address from a username.
 * Used when the user doesn't have a crypto wallet yet.
 */
function generateWalletAddress(username: string): string {
  const hash = crypto.createHash('sha256').update(`degenfeed:sso:${username}`).digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

/**
 * Generate a random password for provisioning.
 */
function generateRandomPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 24; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

/**
 * Read JSON body from incoming request.
 */
function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy(new Error('Body too large'));
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
    setTimeout(() => reject(new Error('Request timeout')), 15_000);
  });
}

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res: http.ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { code, message, status } }));
}

// ─── Provisioning Logic ─────────────────────────────────────────────────

export interface ProvisionResult {
  protocol: string;
  ok: boolean;
  status?: string;
  username?: string;
  error?: string;
}

export interface ProvisionSummary {
  total: number;
  ok: number;
  failed: number;
  skipped: number;
}

/**
 * Provision accounts on ALL mesh services for a given user.
 * Skips 'mastodon' since GTS is already created by the caller.
 *
 * @param walletAddress - User's wallet address (or generated)
 * @param username - Desired username (same across all services)
 * @param email - User's email address
 * @param protocolsToSkip - List of protocol IDs to skip (e.g., ['mastodon'])
 * @returns Array of provisioning results per protocol
 */
export async function provisionMeshAccounts(
  walletAddress: string,
  username: string,
  _email?: string,
  protocolsToSkip: string[] = ['mastodon'],
): Promise<{ results: ProvisionResult[]; summary: ProvisionSummary }> {
  const results: ProvisionResult[] = [];
  let okCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const proto of PROVISION_PROTOCOLS) {
    // Skip protocols that were already created by the caller
    if (protocolsToSkip.includes(proto.id)) {
      results.push({ protocol: proto.id, ok: true, status: 'skipped' });
      skipCount++;
      console.log(`[sso] Skipped ${proto.id} — already provisioned by caller`);
      continue;
    }

    try {
      // Special case: Pixelfed has no REST registration API.
      // For our self-hosted instance, create the user via Docker artisan CLI.
      if (proto.id === 'pixelfed' && proto.instanceUrl.includes('photos.degenfeed.xyz')) {
        const email = `${walletAddress.slice(2, 10)}-pf@register.degenfeed.xyz`;
        const password = generateRandomPassword();
        const displayName = `DegenFeed User ${walletAddress.slice(2, 8)}`;
        try {
          execSync(
            `docker exec degenfeed-pixelfed php artisan user:create --no-interaction` +
              ` --username="${username}"` +
              ` --email="${email}"` +
              ` --password="${password}"` +
              ` --name="${displayName}"` +
              ` --confirm_email="1"`,
            { timeout: 15_000, stdio: 'pipe' },
          );
          okCount++;
          console.log(`[sso] ✓ Provisioned Pixelfed for ${username} via artisan`);
          results.push({
            protocol: 'pixelfed',
            ok: true,
            status: 'created',
            username: `${username}@photos.degenfeed.xyz`,
          });
        } catch (execErr) {
          const msg = execErr instanceof Error ? execErr.message : String(execErr);
          if (msg.includes('already exists') || msg.includes('Duplicate') || msg.includes('already taken')) {
            results.push({ protocol: 'pixelfed', ok: false, status: 'failed', error: `@${username} already taken` });
          } else {
            results.push({ protocol: 'pixelfed', ok: false, status: 'failed', error: `Artisan failed: ${msg.slice(0, 200)}` });
          }
          failCount++;
        }
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts: Record<string, any> = {
        walletAddress,
      };

      // Set instance URL based on protocol
      switch (proto.id) {
        case 'bluesky':
          opts.bskyPdsUrl = proto.instanceUrl;
          break;
        case 'lemmy':
          opts.lemmyInstanceUrl = proto.instanceUrl;
          break;
        case 'peertube':
          opts.peertubeInstanceUrl = proto.instanceUrl;
          break;
        case 'pixelfed':
          opts.pixelfedInstanceUrl = proto.instanceUrl;
          break;
        case 'writefreely':
          opts.writefreelyInstanceUrl = proto.instanceUrl;
          break;
        case 'owncast':
          opts.owncastInstanceUrl = proto.instanceUrl;
          break;
        case 'castopod':
          opts.castopodInstanceUrl = proto.instanceUrl;
          break;
      }

      const registration = await registerOnPlatform(
        proto.id,
        username,
        walletAddress,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opts as any,
      );

      if (registration.status === 'created') {
        okCount++;
        console.log(`[sso] ✓ Provisioned ${proto.label} (${proto.id}) for ${username}`);
        results.push({
          protocol: proto.id,
          ok: true,
          status: 'created',
          username: registration.username,
        });
      } else if (registration.status === 'pending') {
        // Pending means created but requires email verification
        okCount++;
        console.log(`[sso] ~ ${proto.label} (${proto.id}) pending verification for ${username}`);
        results.push({
          protocol: proto.id,
          ok: true,
          status: 'pending',
          username: registration.username,
          error: registration.error,
        });
      } else {
        failCount++;
        console.warn(
          `[sso] ✗ ${proto.label} (${proto.id}) failed: ${registration.error || 'unknown'}`,
        );
        results.push({
          protocol: proto.id,
          ok: false,
          status: 'failed',
          error: registration.error || 'Registration returned failed status',
        });
      }
    } catch (err) {
      failCount++;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[sso] ✗ ${proto.label} (${proto.id}) threw: ${msg}`);
      results.push({
        protocol: proto.id,
        ok: false,
        status: 'error',
        error: msg,
      });
    }
  }

  return {
    results,
    summary: {
      total: results.length,
      ok: okCount,
      failed: failCount,
      skipped: skipCount,
    },
  };
}

// ─── Route Handlers ─────────────────────────────────────────────────────

/**
 * POST /api/sso/provision
 *
 * Provision all mesh services for a given user.
 * Called automatically after GTS registration, or standalone.
 *
 * Body: {
 *   username: string,        // Desired username (required)
 *   walletAddress?: string,  // Wallet address (optional, generated if missing)
 *   email?: string,          // Email address (optional)
 *   skipProtocols?: string[] // Protocols to skip (default: ['mastodon'])
 * }
 */
async function handleSsoProvision(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await readBody(req);
    const { username, walletAddress, email, skipProtocols } = body as {
      username?: string;
      walletAddress?: string;
      email?: string;
      skipProtocols?: string[];
    };

    if (!username || typeof username !== 'string') {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'username (string) is required');
    }

    // Generate a wallet address if not provided
    const addr = walletAddress || generateWalletAddress(username);

    const { results, summary } = await provisionMeshAccounts(
      addr,
      username,
      email || '',
      skipProtocols || ['mastodon'],
    );

    return jsonOk(res, {
      ok: summary.failed === 0,
      username,
      walletAddress: addr,
      results,
      stats: summary,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sso] Provision handler error:', msg);
    return jsonError(res, 500, 'PROVISION_FAILED', msg);
  }
}

/**
 * GET /api/sso/provision/status
 *
 * Returns the list of protocols that can be provisioned
 * and their current configuration status.
 */
async function handleSsoProvisionStatus(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const protocols = PROVISION_PROTOCOLS.map((p) => ({
    id: p.id,
    label: p.label,
    instanceUrl: p.instanceUrl,
    configStatus: 'configured',
  }));

  return jsonOk(res, {
    ok: true,
    provisionProtocols: protocols,
    total: protocols.length,
    message: 'POST /api/sso/provision with {username, walletAddress?, email?, skipProtocols?}',
  });
}

// ─── Router ─────────────────────────────────────────────────────────────

/**
 * Handle SSO-related HTTP requests.
 * Returns true if the path was handled, false otherwise.
 */
export async function handleSsoRoute(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  if (path === '/api/sso/provision' && method === 'POST') {
    await handleSsoProvision(req, res);
    return true;
  }

  if (path === '/api/sso/provision/status' && method === 'GET') {
    await handleSsoProvisionStatus(req, res);
    return true;
  }

  return false;
}
