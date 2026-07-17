/**
 * /api/deploy — Self-hosted community deployment requests
 *
 * POST /api/deploy/request — Submit a deploy request (stored in KV)
 * GET  /api/deploy/status   — Check deploy request status by id
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DeployRequest {
  id: string;
  domain: string;
  communityType: 'lemmy' | 'peertube' | 'mastodon';
  communityName: string;
  description: string;
  adminEmail: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  /** Generated docker-compose.yml content (populated when status=completed) */
  composeContent?: string;
  /** Deployment guide URL */
  guideUrl?: string;
  /** Error message if status=failed */
  error?: string;
}

interface DeployRequestBody {
  domain: string;
  communityType: 'lemmy' | 'peertube' | 'mastodon';
  communityName: string;
  description: string;
  adminEmail: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEPLOY_PREFIX = 'deploy:';

const SETUP_TIMES: Record<string, string> = {
  lemmy: '~15 minutes',
  peertube: '~30 minutes',
  mastodon: '~20 minutes',
};

const DB_PASSWORDS: Record<string, string> = {
  lemmy: 'lemmy_db_pass',
  peertube: 'peertube_db_pass',
  mastodon: 'mastodon_db_pass',
};

// ── Validation ─────────────────────────────────────────────────────────────

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateDomain(domain: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
    domain,
  );
}

function validateBody(
  body: unknown,
): { ok: true; data: DeployRequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  if (!b.domain || typeof b.domain !== 'string') {
    return { ok: false, error: 'domain is required (string)' };
  }
  if (!validateDomain(b.domain)) {
    return { ok: false, error: 'domain must be a valid domain name (e.g., community.example.com)' };
  }

  if (!b.communityType || !['lemmy', 'peertube', 'mastodon'].includes(b.communityType as string)) {
    return { ok: false, error: 'communityType must be one of: lemmy, peertube, mastodon' };
  }

  if (
    !b.communityName ||
    typeof b.communityName !== 'string' ||
    b.communityName.trim().length === 0
  ) {
    return { ok: false, error: 'communityName is required (string)' };
  }
  if (b.communityName.length > 100) {
    return { ok: false, error: 'communityName must be 100 characters or fewer' };
  }

  if (!b.description || typeof b.description !== 'string') {
    return { ok: false, error: 'description is required (string)' };
  }
  if (b.description.length > 2000) {
    return { ok: false, error: 'description must be 2000 characters or fewer' };
  }

  if (!b.adminEmail || typeof b.adminEmail !== 'string') {
    return { ok: false, error: 'adminEmail is required (string)' };
  }
  if (!validateEmail(b.adminEmail)) {
    return { ok: false, error: 'adminEmail must be a valid email address' };
  }

  return {
    ok: true,
    data: {
      domain: b.domain.toLowerCase(),
      communityType: b.communityType as DeployRequestBody['communityType'],
      communityName: b.communityName.trim(),
      description: b.description.trim(),
      adminEmail: b.adminEmail.trim().toLowerCase(),
    },
  };
}

// ── Template generator ────────────────────────────────────────────────────

// biome-ignore lint/correctness/noUnusedVariables: scaffolding for full deployment pipeline
function generateEnvs(data: DeployRequestBody): Record<string, string> {
  return {
    DOMAIN: data.domain,
    ADMIN_EMAIL: data.adminEmail,
    POSTGRES_PASSWORD: DB_PASSWORDS[data.communityType] ?? '',
    MASTODON_SECRET_KEY: `sk_${crypto.randomUUID().replace(/-/g, '')}`,
    MASTODON_OTP_SECRET: `otp_${crypto.randomUUID().replace(/-/g, '')}`,
    MASTODON_VAPID_PRIVATE: `vp_${crypto.randomUUID().replace(/-/g, '')}`,
    MASTODON_VAPID_PUBLIC: `VP_${crypto.randomUUID().replace(/-/g, '')}`,
    SMTP_SERVER: '',
    SMTP_PORT: '587',
    SMTP_LOGIN: '',
    SMTP_PASSWORD: '',
  };
}

function generateGuideUrl(data: DeployRequestBody): string {
  return `https://app.degenfeed.xyz/docs/self-host#${data.communityType}`;
}

// ── ID generation ──────────────────────────────────────────────────────────

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().slice(0, 8);
  return `${ts}-${rand}`;
}

function generateComposeUrl(id: string): string {
  return `https://app.degenfeed.xyz/api/deploy/compose/${id}`;
}

// ── Handlers ───────────────────────────────────────────────────────────────

export async function handleDeployRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const validation = validateBody(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const data = validation.data;
  const id = generateId();
  const now = new Date().toISOString();

  const deployRequest: DeployRequest = {
    id,
    domain: data.domain,
    communityType: data.communityType,
    communityName: data.communityName,
    description: data.description,
    adminEmail: data.adminEmail,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  // Store in KV
  try {
    await env.DEPLOYMENTS?.put(DEPLOY_PREFIX + id, JSON.stringify(deployRequest), {
      expirationTtl: 60 * 60 * 24 * 30, // 30 days
    });
  } catch {
    return jsonResponse({ error: 'Failed to store deploy request' }, 500);
  }

  // Return the confirmation with generated config
  return noCacheJsonResponse({
    ok: true,
    id,
    domain: data.domain,
    communityType: data.communityType,
    communityName: data.communityName,
    status: 'pending',
    estimatedSetup: SETUP_TIMES[data.communityType] || '~20 minutes',
    adminEmail: data.adminEmail,
    guideUrl: generateGuideUrl(data),
    composeUrl: generateComposeUrl(id),
    message: `We'll set up your instance and email you at ${data.adminEmail}`,
  });
}

export async function handleDeployStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return jsonResponse({ error: 'id query parameter is required' }, 400);
  }

  try {
    const raw = await env.DEPLOYMENTS?.get(DEPLOY_PREFIX + id);
    if (!raw) {
      return jsonResponse({ error: 'Deploy request not found' }, 404);
    }
    const deployRequest = JSON.parse(raw) as DeployRequest;
    return noCacheJsonResponse({ ok: true, request: deployRequest });
  } catch {
    return jsonResponse({ error: 'Failed to fetch deploy request' }, 500);
  }
}
