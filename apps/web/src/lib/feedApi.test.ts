/**
 * feedApi.resolveApiBase — tests for the API routing decision logic.
 *
 * This function decides which backend the ENTIRE app talks to. Getting it
 * wrong silently breaks every feed. Priority:
 *   1. API_PROXY_TARGET (docker service name)
 *   2. NEXT_PUBLIC_WORKER_URL / WORKER_URL (only when not a container-local
 *      fallback like host.docker.internal or 127.0.0.1)
 *   3. Docker DNS default http://degenfeed-api:3001
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string | undefined>): void {
  delete process.env.API_PROXY_TARGET;
  delete process.env.NEXT_PUBLIC_WORKER_URL;
  delete process.env.WORKER_URL;
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined) process.env[k] = v;
  }
}

describe('resolveApiBase', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('prefers API_PROXY_TARGET when set', async () => {
    setEnv({
      API_PROXY_TARGET: 'http://degenfeed-api:3001',
      NEXT_PUBLIC_WORKER_URL: 'https://api.degenfeed.xyz',
    });
    const { resolveApiBase } = await import('./feedApi');
    expect(resolveApiBase()).toBe('http://degenfeed-api:3001');
  });

  it('trims whitespace on API_PROXY_TARGET', async () => {
    setEnv({ API_PROXY_TARGET: '  https://api.degenfeed.xyz  ' });
    const { resolveApiBase } = await import('./feedApi');
    expect(resolveApiBase()).toBe('https://api.degenfeed.xyz');
  });

  it('uses NEXT_PUBLIC_WORKER_URL when it is a public URL', async () => {
    setEnv({ NEXT_PUBLIC_WORKER_URL: 'https://api.degenfeed.xyz' });
    const { resolveApiBase } = await import('./feedApi');
    expect(resolveApiBase()).toBe('https://api.degenfeed.xyz');
  });

  it('falls back to WORKER_URL when NEXT_PUBLIC is unset', async () => {
    setEnv({ WORKER_URL: 'https://api.degenfeed.xyz' });
    const { resolveApiBase } = await import('./feedApi');
    expect(resolveApiBase()).toBe('https://api.degenfeed.xyz');
  });

  it('rejects host.docker.internal worker URLs (broken inside web container)', async () => {
    setEnv({ NEXT_PUBLIC_WORKER_URL: 'http://host.docker.internal:8787' });
    const { resolveApiBase } = await import('./feedApi');
    expect(resolveApiBase()).toBe('http://degenfeed-api:3001');
  });

  it('rejects 127.0.0.1 worker URLs', async () => {
    setEnv({ WORKER_URL: 'http://127.0.0.1:8787' });
    const { resolveApiBase } = await import('./feedApi');
    expect(resolveApiBase()).toBe('http://degenfeed-api:3001');
  });

  it('defaults to docker DNS name when nothing is set', async () => {
    setEnv({});
    const { resolveApiBase } = await import('./feedApi');
    expect(resolveApiBase()).toBe('http://degenfeed-api:3001');
  });

  it('treats empty-string env vars as unset', async () => {
    setEnv({ API_PROXY_TARGET: '', NEXT_PUBLIC_WORKER_URL: '', WORKER_URL: '' });
    const { resolveApiBase } = await import('./feedApi');
    expect(resolveApiBase()).toBe('http://degenfeed-api:3001');
  });
});
