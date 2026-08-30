import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';
import { handleBillingCheckout, handleBillingStatus, handleBillingVerify } from '../routes/billing';

describe('billing', () => {
  const mockEnv: Env = {
    SUBSCRIPTIONS: {
      async get(_key: string) {
        return null;
      },
      async put(_key: string, _value: string) {
        return;
      },
      async delete(_key: string) {
        return;
      },
      async list() {
        return { keys: [], list_complete: true };
      },
    } as unknown as KVNamespace,
  };

  it('should return checkout action for pro tier', async () => {
    const req = new Request('http://localhost/api/billing/checkout?tier=pro');
    const res = await handleBillingCheckout(req, mockEnv);
    const body = (await res.json()) as {
      tier: string;
      amount: number;
      action: unknown;
    };
    expect(res.status).toBe(200);
    expect(body.tier).toBe('pro');
    expect(body.amount).toBe(10);
    expect(body.action).toBeDefined();
  });

  it('should reject invalid tier', async () => {
    const req = new Request('http://localhost/api/billing/checkout?tier=invalid');
    const res = await handleBillingCheckout(req, mockEnv);
    expect(res.status).toBe(400);
  });

  it('should record subscription on verify', async () => {
    // Mock Solana RPC: 1) signature confirmed, 2) tx pays the treasury the
    // pro tier price (10 SOL) from the claiming account (fee payer).
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: { value: [{ confirmationStatus: 'finalized' }] },
          id: 1,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const account = 'So11111111111111111111111111111111111111112';
    const treasury = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: {
            transaction: { message: { accountKeys: [account, treasury] } },
            meta: {
              preBalances: [20_000_000_000, 5_000_000_000],
              postBalances: [10_000_000_000, 15_000_000_000], // treasury +10 SOL
            },
          },
          id: 1,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const req = new Request('http://localhost/api/billing/verify?tier=pro', {
      method: 'POST',
      body: JSON.stringify({
        account,
        signature: 'sig',
      }),
    });
    const res = await handleBillingVerify(req, {
      ...mockEnv,
      SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      BILLING_TREASURY_ADDRESS: treasury,
    });
    const body = (await res.json()) as { ok: boolean; tier: string };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.tier).toBe('pro');
  });

  it('should reject a transaction that underpays the treasury', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: { value: [{ confirmationStatus: 'finalized' }] },
          id: 1,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const account = 'So11111111111111111111111111111111111111112';
    const treasury = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: {
            transaction: { message: { accountKeys: [account, treasury] } },
            meta: {
              preBalances: [20_000_000_000, 5_000_000_000],
              postBalances: [19_999_999_999, 5_000_000_001], // treasury +1 lamport
            },
          },
          id: 1,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const req = new Request('http://localhost/api/billing/verify?tier=pro', {
      method: 'POST',
      body: JSON.stringify({ account, signature: 'sig2' }),
    });
    const res = await handleBillingVerify(req, {
      ...mockEnv,
      SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      BILLING_TREASURY_ADDRESS: treasury,
    });
    const body = (await res.json()) as { error: string; code?: string };
    expect(res.status).toBe(402);
    expect(body.code).toBe('PAYMENT_MISMATCH');
  });

  it('should refuse verification when billing is not configured', async () => {
    const req = new Request('http://localhost/api/billing/verify?tier=pro', {
      method: 'POST',
      body: JSON.stringify({
        account: 'So11111111111111111111111111111111111111112',
        signature: 'sig3',
      }),
    });
    const res = await handleBillingVerify(req, { ...mockEnv });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('NOT_CONFIGURED');
  });

  it('should return free status for unknown identity', async () => {
    const req = new Request(
      'http://localhost/api/billing/status?identityId=solana:unknownunknownunknownunknownunknownunknownunknown',
    );
    const res = await handleBillingStatus(req, mockEnv);
    const body = (await res.json()) as { tier: string; active: boolean };
    expect(res.status).toBe(200);
    expect(body.tier).toBe('free');
    expect(body.active).toBe(false);
  });
});
