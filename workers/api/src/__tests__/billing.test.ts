import { describe, expect, it } from 'vitest';
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
    const body = (await res.json()) as { tier: string; amount: number; action: unknown };
    expect(res.status).toBe(200);
    expect(body.tier).toBe('pro');
    expect(body.amount).toBe(5);
    expect(body.action).toBeDefined();
  });

  it('should reject invalid tier', async () => {
    const req = new Request('http://localhost/api/billing/checkout?tier=invalid');
    const res = await handleBillingCheckout(req, mockEnv);
    expect(res.status).toBe(400);
  });

  it('should record subscription on verify', async () => {
    const req = new Request('http://localhost/api/billing/verify?tier=pro', {
      method: 'POST',
      body: JSON.stringify({
        account: 'So11111111111111111111111111111111111111112',
        signature: 'sig',
      }),
    });
    const res = await handleBillingVerify(req, mockEnv);
    const body = (await res.json()) as { ok: boolean; tier: string };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.tier).toBe('pro');
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
