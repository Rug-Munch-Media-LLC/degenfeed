/**
 * Tests for registration payment verification (CVSS 8.1 fix).
 *
 * Covers:
 *  - lib/register-payment.ts on-chain verification logic (EVM + Solana)
 *  - register-all /all gate: paid plans require a verified paymentTxHash
 *  - register-all /farcaster and /lens gates
 *  - confirmedOverage is no longer a bypass
 */

import { describe, expect, it, vi } from 'vitest';
import { verifyRegistrationPayment } from '../lib/register-payment';
import registerAll from '../routes/register-all';
import { createSession, parseSessionCookie } from '../session';
import type { Env } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-must-be-at-least-32-bytes';

function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      store.set(key, value);
      void opts;
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return { keys: [], list_complete: true, cacheStatus: null };
    },
    async getWithMetadata() {
      return { value: null, metadata: null };
    },
  } as unknown as KVNamespace;
}

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    AUTH_SECRET: TEST_SECRET,
    CACHE: makeKv(),
    SUBSCRIPTIONS: makeKv(),
    ...overrides,
  } as Env;
}

// Explicit FIFO queue consumed by the fetch stub below. (mockResolvedValueOnce
// proved unreliable across the worker's dynamic imports in this suite.)
const fetchQueue: unknown[] = [];

let queueInstalled = false;
function ensureQueueConsumer(): void {
  if (queueInstalled) return;
  queueInstalled = true;
  // vi.stubGlobal handles realm binding correctly under happy-dom
  // (plain globalThis assignment can miss the realm the worker resolves).
  vi.stubGlobal(
    'fetch',
    vi.fn(async (...args: unknown[]) => {
      const next = fetchQueue.shift();
      if (process.env.DEBUG_PAYMENT) {
        const fs = await import('node:fs');
        const err = new Error();
        fs.appendFileSync(
          '/tmp/opencode/payment-debug.txt',
          `FETCH ${String(args[0])} queued=${JSON.stringify(next)}\n  stack=${(err.stack ?? '').split('\n').slice(2, 4).join(' | ')}\n`,
        );
      }
      return new Response(JSON.stringify(next ?? {}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

function mockFetchOnce(result: unknown): void {
  ensureQueueConsumer();
  fetchQueue.push(result);
}

function evmReceipt(status: string) {
  return { jsonrpc: '2.0', result: { status }, id: 1 };
}

async function authedRequest(
  path: string,
  env: Env,
  body: Record<string, unknown>,
): Promise<Response> {
  const { setCookie } = await createSession('0xAbCdEf0123456789', 'ethereum', TEST_SECRET);
  const cookieValue = parseSessionCookie(setCookie);
  const req = new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `__Host-dfid=${cookieValue ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  return registerAll.request('/all', req, env);
}

// ─── verifyRegistrationPayment — EVM ────────────────────────────────────

describe('verifyRegistrationPayment (EVM)', () => {
  it('rejects when no txHash is provided', async () => {
    const res = await verifyRegistrationPayment(
      baseEnv(),
      {},
      {
        walletAddress: '0xabc',
        expectedCents: 800,
        plan: 'standard',
      },
    );
    expect(res.verified).toBe(false);
    expect(res.error).toContain('paymentTxHash is required');
  });

  it('rejects paymentIntentId alone (Stripe is not wired)', async () => {
    const res = await verifyRegistrationPayment(
      baseEnv(),
      { paymentIntentId: 'pi_123' },
      {
        walletAddress: '0xabc',
        expectedCents: 800,
        plan: 'standard',
      },
    );
    expect(res.verified).toBe(false);
    expect(res.error).toContain('paymentIntentId cannot be verified');
  });

  it('rejects malformed txHash', async () => {
    const res = await verifyRegistrationPayment(
      baseEnv(),
      { txHash: 'not-a-hash' },
      {
        walletAddress: '0xabc',
        expectedCents: 800,
        plan: 'standard',
      },
    );
    expect(res.verified).toBe(false);
    expect(res.error).toContain('must be an EVM tx hash');
  });

  it('verifies a successful EVM receipt on Base', async () => {
    const env = baseEnv({ BASE_RPC_URL: 'https://base.example' });
    mockFetchOnce(evmReceipt('0x1'));
    const res = await verifyRegistrationPayment(
      env,
      { txHash: `0x${'a'.repeat(64)}` },
      { walletAddress: '0xabc', expectedCents: 800, plan: 'standard' },
    );
    expect(res.verified).toBe(true);
    expect(res.method).toBe('evm');
  });

  it('rejects a reverted EVM receipt', async () => {
    const env = baseEnv({ BASE_RPC_URL: 'https://base.example' });
    mockFetchOnce(evmReceipt('0x0'));
    const res = await verifyRegistrationPayment(
      env,
      { txHash: `0x${'b'.repeat(64)}` },
      { walletAddress: '0xabc', expectedCents: 800, plan: 'standard' },
    );
    expect(res.verified).toBe(false);
    expect(res.error).toContain('reverted or failed');
  });

  it('rejects when tx not found on any chain', async () => {
    const env = baseEnv({ BASE_RPC_URL: 'https://base.example' });
    mockFetchOnce({ jsonrpc: '2.0', result: null, id: 1 });
    mockFetchOnce({ jsonrpc: '2.0', result: null, id: 1 });
    const res = await verifyRegistrationPayment(
      env,
      { txHash: `0x${'c'.repeat(64)}` },
      { walletAddress: '0xabc', expectedCents: 800, plan: 'standard' },
    );
    expect(res.verified).toBe(false);
    expect(res.error).toContain('not found on supported chains');
  });

  it('rejects when receiver address does not match REGISTRATION_PAYMENT_ADDRESS', async () => {
    const env = baseEnv({
      BASE_RPC_URL: 'https://base.example',
      REGISTRATION_PAYMENT_ADDRESS: '0xRecEiver11111111111111111111111111111111',
    });
    mockFetchOnce(evmReceipt('0x1'));
    mockFetchOnce({
      jsonrpc: '2.0',
      result: { to: '0xSomethingElse222222222222222222222222222222' },
      id: 1,
    });
    const res = await verifyRegistrationPayment(
      env,
      { txHash: `0x${'d'.repeat(64)}` },
      { walletAddress: '0xabc', expectedCents: 800, plan: 'standard' },
    );
    expect(res.verified).toBe(false);
    expect(res.error).toContain('recipient does not match');
  });

  it('verifies when receiver matches REGISTRATION_PAYMENT_ADDRESS', async () => {
    const env = baseEnv({
      BASE_RPC_URL: 'https://base.example',
      REGISTRATION_PAYMENT_ADDRESS: '0xRecEiver11111111111111111111111111111111',
    });
    mockFetchOnce(evmReceipt('0x1'));
    mockFetchOnce({
      jsonrpc: '2.0',
      result: { to: '0xreceiver11111111111111111111111111111111' },
      id: 1,
    });
    const res = await verifyRegistrationPayment(
      env,
      { txHash: `0x${'e'.repeat(64)}` },
      { walletAddress: '0xabc', expectedCents: 800, plan: 'standard' },
    );
    expect(res.verified).toBe(true);
  });
});

// ─── verifyRegistrationPayment — Solana ─────────────────────────────────

describe('verifyRegistrationPayment (Solana)', () => {
  const SOLANA_SIG = '5'.repeat(88);

  it('verifies a finalized Solana signature', async () => {
    const env = baseEnv({ SOLANA_RPC_URL: 'https://solana.example' });
    mockFetchOnce({
      jsonrpc: '2.0',
      result: { value: [{ confirmationStatus: 'finalized', err: null }] },
      id: 1,
    });
    const res = await verifyRegistrationPayment(
      env,
      { txHash: SOLANA_SIG },
      {
        walletAddress: '0xabc',
        expectedCents: 800,
        plan: 'standard',
      },
    );
    expect(res.verified).toBe(true);
    expect(res.method).toBe('solana');
  });

  it('rejects an unconfirmed Solana signature', async () => {
    const env = baseEnv({ SOLANA_RPC_URL: 'https://solana.example' });
    mockFetchOnce({
      jsonrpc: '2.0',
      result: { value: [{ confirmationStatus: 'processed', err: null }] },
      id: 1,
    });
    const res = await verifyRegistrationPayment(
      env,
      { txHash: SOLANA_SIG },
      {
        walletAddress: '0xabc',
        expectedCents: 800,
        plan: 'standard',
      },
    );
    expect(res.verified).toBe(false);
    expect(res.error).toContain('not yet confirmed');
  });

  it('rejects a failed Solana transaction', async () => {
    const env = baseEnv({ SOLANA_RPC_URL: 'https://solana.example' });
    mockFetchOnce({
      jsonrpc: '2.0',
      result: { value: [{ confirmationStatus: 'finalized', err: { InstructionError: [0, 1] } }] },
      id: 1,
    });
    const res = await verifyRegistrationPayment(
      env,
      { txHash: SOLANA_SIG },
      {
        walletAddress: '0xabc',
        expectedCents: 800,
        plan: 'standard',
      },
    );
    expect(res.verified).toBe(false);
    expect(res.error).toContain('failed on-chain');
  });
});

// ─── verifyRegistrationPayment — dedup ──────────────────────────────────

describe('verifyRegistrationPayment (dedup)', () => {
  it('rejects reuse of a txHash that already paid for a registration', async () => {
    const env = baseEnv({ BASE_RPC_URL: 'https://base.example' });
    const txHash = `0x${'f'.repeat(64)}`;

    mockFetchOnce(evmReceipt('0x1'));
    const first = await verifyRegistrationPayment(
      env,
      { txHash },
      {
        walletAddress: '0xabc',
        expectedCents: 800,
        plan: 'standard',
      },
    );
    expect(first.verified).toBe(true);

    // Second use — must be rejected without any RPC call
    const second = await verifyRegistrationPayment(
      env,
      { txHash },
      {
        walletAddress: '0xabc',
        expectedCents: 800,
        plan: 'standard',
      },
    );
    expect(second.verified).toBe(false);
    expect(second.error).toContain('already been used');
  });
});

// ─── register-all /all gate ─────────────────────────────────────────────

describe('POST /api/register/all payment gate', () => {
  it('returns 402 for a standard plan without payment', async () => {
    const env = baseEnv();
    const res = await authedRequest('/api/register/all', env, { plan: 'standard' });
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('paymentTxHash is required');
  });

  it('returns 402 for a standard plan with confirmedOverage=true (legacy bypass removed)', async () => {
    const env = baseEnv();
    const res = await authedRequest('/api/register/all', env, {
      plan: 'standard',
      confirmedOverage: true,
    });
    expect(res.status).toBe(402);
  });

  it('returns 402 for a complete plan with only paymentIntentId', async () => {
    const env = baseEnv();
    const res = await authedRequest('/api/register/all', env, {
      plan: 'complete',
      paymentIntentId: 'pi_123',
    });
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('paymentIntentId cannot be verified');
  });

  it('returns 402 for a paid plan with an unverifiable txHash', async () => {
    const env = baseEnv({ BASE_RPC_URL: 'https://base.example' });
    mockFetchOnce({ jsonrpc: '2.0', result: null, id: 1 }); // base not found
    mockFetchOnce({ jsonrpc: '2.0', result: null, id: 1 }); // polygon not found
    const res = await authedRequest('/api/register/all', env, {
      plan: 'standard',
      paymentTxHash: `0x${'9'.repeat(64)}`,
    });
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('not found on supported chains');
  });

  it('allows the free plan without payment', async () => {
    const env = baseEnv();
    const res = await authedRequest('/api/register/all', env, { plan: 'free' });
    expect(res.status).toBe(200);
  });

  it('proceeds with a verified payment txHash', async () => {
    const env = baseEnv({ BASE_RPC_URL: 'https://base.example' });
    mockFetchOnce(evmReceipt('0x1')); // payment verification
    // Subsequent registration fetches are mocked by test-setup to return {}
    const res = await authedRequest('/api/register/all', env, {
      plan: 'standard',
      paymentTxHash: `0x${'7'.repeat(64)}`,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; charges?: { total?: string } };
    expect(body.success).toBe(true);
  });
});

// ─── register-all /farcaster and /lens gates ───────────────────────────

describe('POST /api/register/farcaster and /lens payment gates', () => {
  async function requestPath(
    path: string,
    env: Env,
    body: Record<string, unknown>,
  ): Promise<Response> {
    const { setCookie } = await createSession('0xAbCdEf0123456789', 'ethereum', TEST_SECRET);
    const cookieValue = parseSessionCookie(setCookie);
    const req = new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `__Host-dfid=${cookieValue ?? ''}`,
      },
      body: JSON.stringify(body),
    });
    return registerAll.request(path, req, env);
  }

  it('returns 402 for standalone Farcaster without payment', async () => {
    const env = baseEnv();
    const res = await requestPath('/farcaster', env, { username: 'testuser' });
    expect(res.status).toBe(402);
  });

  it('returns 402 for standalone Lens without payment', async () => {
    const env = baseEnv();
    const res = await requestPath('/lens', env, { handle: 'testuser' });
    expect(res.status).toBe(402);
  });

  it('proceeds past the payment gate for standalone Farcaster', async () => {
    const env = baseEnv({ BASE_RPC_URL: 'https://base.example' });
    mockFetchOnce(evmReceipt('0x1')); // payment verification
    const res = await requestPath('/farcaster', env, {
      username: 'testuser',
      paymentTxHash: `0x${'3'.repeat(64)}`,
    });
    // Payment gate passed; registration itself fails against mocked RPC.
    // Any response other than 402 proves the gate did not block.
    expect(res.status).not.toBe(402);
  });

  it('proceeds past the payment gate for standalone Lens', async () => {
    const env = baseEnv({ BASE_RPC_URL: 'https://base.example' });
    mockFetchOnce(evmReceipt('0x1')); // payment verification
    const res = await requestPath('/lens', env, {
      handle: 'testuser',
      paymentTxHash: `0x${'4'.repeat(64)}`,
    });
    expect(res.status).not.toBe(402);
  });
});
