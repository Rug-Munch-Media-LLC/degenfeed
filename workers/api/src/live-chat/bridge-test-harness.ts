/**
 * @degenfeed/api-worker — Live chat bridge test harness
 *
 * Fixtures shared by the poll-bridge regression suites. Each bridge suite
 * drives its poller through an injected fake sender, so no engine, KV or
 * WebSocket side effect is needed to assert ingestion behaviour.
 */

import { vi } from 'vitest';
import type { Env } from '../index';
import type { SendChatMessage } from './unified-chat';

export const STREAM = 'stream_1';

/** In-memory stand-in for the `CACHE` KV namespace. */
export function makeKv(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

export function makeEnv(kv: ReturnType<typeof makeKv>, extra: Partial<Env> = {}): Env {
  return { CACHE: kv as unknown as KVNamespace, ...extra } as unknown as Env;
}

export type Sent = { userId: string; displayName: string; message: string; protocol: string };

/** Records every send so a bridge's ingest payload can be asserted. */
export function fakeSender() {
  const sent: Sent[] = [];
  const send = vi.fn(async (_env: Env, input: Record<string, unknown>) => {
    sent.push(input as unknown as Sent);
    return null;
  }) as unknown as SendChatMessage;
  return { send, sent };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

/** Stub fetch with a fixed payload; returns the collected request URLs. */
export function stubFetchJson(body: unknown, ok = true): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      return jsonResponse(body, ok);
    }),
  );
  return urls;
}

export function nowIso(): string {
  return new Date().toISOString();
}
