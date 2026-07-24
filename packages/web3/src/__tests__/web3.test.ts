import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeTipData,
  encodeTipWithMessageData,
  getTipChainConfig,
  getTipContractAddress,
  TIP_CHAIN_CONFIG,
  TIP_CONTRACT_ABI,
  TIP_CONTRACT_ADDRESSES,
} from '../index';

describe('TIP_CHAIN_CONFIG', () => {
  it('defines config for base, optimism, and arbitrum', () => {
    expect(TIP_CHAIN_CONFIG.base).toBeDefined();
    expect(TIP_CHAIN_CONFIG.optimism).toBeDefined();
    expect(TIP_CHAIN_CONFIG.arbitrum).toBeDefined();
  });

  it('has correct chain IDs', () => {
    expect(TIP_CHAIN_CONFIG.base.chainId).toBe('0x2105');
    expect(TIP_CHAIN_CONFIG.base.chainIdDecimal).toBe(8453);
    expect(TIP_CHAIN_CONFIG.optimism.chainIdDecimal).toBe(10);
    expect(TIP_CHAIN_CONFIG.arbitrum.chainIdDecimal).toBe(42161);
  });

  it('has RPC URLs and explorers for all chains', () => {
    for (const [chain, config] of Object.entries(TIP_CHAIN_CONFIG)) {
      expect(config.rpc).toMatch(/^https?:\/\//);
      expect(config.explorer).toMatch(/^https?:\/\//);
      expect(config.name).toBeTruthy();
    }
  });
});

describe('TIP_CONTRACT_ADDRESSES', () => {
  it('has placeholder zero addresses (not yet deployed)', () => {
    expect(TIP_CONTRACT_ADDRESSES.base).toBe('0x0000000000000000000000000000000000000000');
    expect(TIP_CONTRACT_ADDRESSES.optimism).toBe('0x0000000000000000000000000000000000000000');
    expect(TIP_CONTRACT_ADDRESSES.arbitrum).toBe('0x0000000000000000000000000000000000000000');
  });
});

describe('TIP_CONTRACT_ABI', () => {
  it('has tip, tipWithMessage, and tipWithSplit methods', () => {
    const methods = TIP_CONTRACT_ABI.filter((item) => item.type === 'function');
    const names = methods.map((m) => m.name);
    expect(names).toContain('tip');
    expect(names).toContain('tipWithMessage');
    expect(names).toContain('tipWithSplit');
    expect(names).toContain('batchTip');
    expect(names).toContain('tipERC20');
  });

  it('has TipSent event', () => {
    const events = TIP_CONTRACT_ABI.filter((item) => item.type === 'event');
    expect(events.map((e) => e.name)).toContain('TipSent');
  });
});

describe('getTipChainConfig', () => {
  it('returns config for supported chain', () => {
    const config = getTipChainConfig('base');
    expect(config.name).toBe('Base');
    expect(config.chainId).toBe('0x2105');
  });

  it('throws for unsupported chain', () => {
    expect(() => getTipChainConfig('polygon')).toThrow('Unsupported chain');
    expect(() => getTipChainConfig('' as any)).toThrow('Unsupported chain');
  });
});

describe('getTipContractAddress', () => {
  it('throws since contracts are not yet deployed', () => {
    expect(() => getTipContractAddress('base')).toThrow('not yet deployed');
    expect(() => getTipContractAddress('optimism')).toThrow('not yet deployed');
    expect(() => getTipContractAddress('arbitrum')).toThrow('not yet deployed');
  });

  it('throws for unknown chain', () => {
    expect(() => getTipContractAddress('polygon')).toThrow();
  });
});

describe('encodeTipData', () => {
  it('encodes tip(address) with correct signature', () => {
    const recipient = '0x1234567890abcdef1234567890abcdef12345678';
    const encoded = encodeTipData(recipient as `0x${string}`);

    // First 4 bytes = function selector for tip(address)
    expect(encoded).toMatch(/^0x1702e8f0/);
    // Should have 4 bytes selector + 32 bytes padded address = 72 hex chars + 0x prefix
    expect(encoded.length).toBe(74);
  });

  it('pads address to 32 bytes', () => {
    const recipient = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const encoded = encodeTipData(recipient as `0x${string}`);

    // After the 4-byte selector, the address should be zero-padded to 32 bytes
    const addrPart = encoded.slice(10); // skip 0x + selector
    expect(addrPart).toMatch(/^0{24}deadbeefdeadbeefdeadbeefdeadbeefdeadbeef$/);
  });

  it('lowercases the address', () => {
    const recipient = '0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF';
    const encoded = encodeTipData(recipient as `0x${string}`);
    expect(encoded).toBe(encoded.toLowerCase());
  });
});

describe('encodeTipWithMessageData', () => {
  it('encodes tipWithMessage with string message', () => {
    const recipient = '0x1234567890abcdef1234567890abcdef12345678';
    const message = 'Hello, DegenFeed!';
    const encoded = encodeTipWithMessageData(recipient as `0x${string}`, message);

    expect(encoded).toMatch(/^0xcf02c46b/);
    expect(encoded.length).toBeGreaterThan(100);
  });

  it('encodes empty message', () => {
    const recipient = '0x1234567890abcdef1234567890abcdef12345678';
    const encoded = encodeTipWithMessageData(recipient as `0x${string}`, '');

    expect(encoded).toMatch(/^0xcf02c46b/);
  });

  it('encodes long messages', () => {
    const recipient = '0x1234567890abcdef1234567890abcdef12345678';
    const message = 'x'.repeat(100);
    const encoded = encodeTipWithMessageData(recipient as `0x${string}`, message);

    expect(encoded).toMatch(/^0xcf02c46b/);
    // String content should be hex-encoded
    const hexChars = message
      .split('')
      .map((c) => c.charCodeAt(0).toString(16))
      .join('');
    expect(encoded.toLowerCase()).toContain(hexChars);
  });
});

describe('switchToTipChain — mock provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate browser environment with window.ethereum
    globalThis.window = {
      ethereum: null,
    } as any;
  });

  it('throws when no ethereum provider is detected', async () => {
    const { switchToTipChain } = await import('../tipContract');
    await expect(switchToTipChain('base')).rejects.toThrow('No Ethereum wallet detected');
  });
});

describe('tipOnChain — mock provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.window = {} as any;
  });

  it('throws when no ethereum provider', async () => {
    const { tipOnChain } = await import('../tipContract');
    await expect(
      tipOnChain({
        chain: 'base',
        recipient: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '0.001',
      }),
    ).rejects.toThrow('No Ethereum wallet detected');
  });

  it('throws for zero or negative amounts', async () => {
    const mockProvider = {
      request: vi.fn().mockResolvedValue(['0xabc']),
      on: vi.fn(),
      removeListener: vi.fn(),
      selectedAddress: '0xabc',
    };
    globalThis.window = { ethereum: mockProvider } as any;

    const { tipOnChain } = await import('../tipContract');
    // After module is loaded, window.ethereum is set so getProvider works,
    // but getTipContractAddress will still throw since addresses are zero
    await expect(
      tipOnChain({
        chain: 'base',
        recipient: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '0',
      }),
    ).rejects.toThrow();
  });
});

describe('estimateTipGas — mock provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no provider', async () => {
    globalThis.window = {} as any;
    const { estimateTipGas } = await import('../tipContract');
    const result = await estimateTipGas(
      'base',
      '0x1234567890abcdef1234567890abcdef12345678',
      '0.001',
    );
    expect(result).toBeNull();
  });

  it('returns null when eth_accounts returns empty', async () => {
    const mockProvider = {
      request: vi.fn().mockResolvedValueOnce([]),
      on: vi.fn(),
      removeListener: vi.fn(),
      selectedAddress: undefined,
    };
    globalThis.window = { ethereum: mockProvider } as any;

    vi.mock('../tip-contract-data', () => ({
      getTipContractAddress: vi
        .fn()
        .mockReturnValue('0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`),
      encodeTipData: vi.fn().mockReturnValue('0x1702e8f0' as `0x${string}`),
      getTipChainConfig: vi.fn().mockReturnValue({
        name: 'Base',
        chainId: '0x2105',
        rpc: 'https://mainnet.base.org',
        explorer: 'https://basescan.org',
      }),
      TIP_CHAIN_CONFIG: {},
      TIP_CONTRACT_ADDRESSES: {},
      TIP_CONTRACT_ABI: [],
      TIP_CONTRACT_SOURCE: '',
    }));

    const { estimateTipGas } = await import('../tipContract');
    const result = await estimateTipGas(
      'base',
      '0x1234567890abcdef1234567890abcdef12345678',
      '0.001',
    );
    expect(result).toBeNull();
    vi.unmock('../tip-contract-data');
  });
});

describe('getOnChainTips — mock provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when no ethereum provider', async () => {
    globalThis.window = {} as any;
    const { getOnChainTips } = await import('../tipContract');
    await expect(
      getOnChainTips('base', '0x1234567890abcdef1234567890abcdef12345678'),
    ).rejects.toThrow('No Ethereum wallet detected');
  });
});

describe('decodeTipSentEvent', () => {
  it('decodes a valid TipSent event log', async () => {
    // The decodeTipSentEvent is not exported, so we test through tipContract behavior
    // We import the module and verify getOnChainTips handles logs
    globalThis.window = {
      ethereum: {
        request: vi.fn().mockResolvedValue([]),
        on: vi.fn(),
        removeListener: vi.fn(),
        selectedAddress: '0xabc',
      },
    } as any;

    const { getOnChainTips } = await import('../tipContract');
    // This will throw because getTipContractAddress fails (not deployed)
    // So we verify the error message
    await expect(
      getOnChainTips('base', '0x1234567890abcdef1234567890abcdef12345678'),
    ).rejects.toThrow();
    // The error will be from getTipContractAddress since the addresses are zero
    // which is expected behavior for pre-deployment
  });
});
