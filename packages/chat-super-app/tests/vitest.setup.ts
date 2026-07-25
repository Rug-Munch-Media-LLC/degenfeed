/**
 * @degenfeed/chat-super-app — Vitest setup
 *
 * Sets up test mocks for KV storage, Web Crypto, and WebRTC APIs
 * that are expected by the chat-super-app modules.
 */

// Mock global Web Crypto API for environments that don't have it
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      subtle: {
        generateKey: async () => ({ exportKey: async () => new ArrayBuffer(32) }),
        exportKey: async () => new ArrayBuffer(32),
        importKey: async () => ({}),
        encrypt: async () => new ArrayBuffer(32),
        decrypt: async () => new ArrayBuffer(32),
        deriveKey: async () => ({}),
        deriveBits: async () => new ArrayBuffer(32),
      },
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
      randomUUID: () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        }),
    },
    writable: true,
  });
}

// Mock TextEncoder/TextDecoder if not available
if (typeof globalThis.TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = class {
    encode(s: string): Uint8Array {
      return Buffer.from(s, 'utf-8');
    }
  };
}

if (typeof globalThis.TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = class {
    decode(b: Uint8Array): string {
      return Buffer.from(b).toString('utf-8');
    }
  };
}

// Suppress noisy console output during tests
globalThis.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any;
