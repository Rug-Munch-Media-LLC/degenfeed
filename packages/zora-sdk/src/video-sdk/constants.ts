import type { Address } from 'viem';

// ─── ABIs ─────────────────────────────────────────────────────────────────

/** Zora ERC-721z (ZoraNFT) contract ABI — minimal subset for mint + read. */
export const ZORA_NFT_ABI = [
  {
    type: 'function' as const,
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable' as const,
  },
  {
    type: 'function' as const,
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'event' as const,
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
] as const;

/** Zora Creator Coin ABI — minimal subset for purchase/transfer. */
export const ZORA_COIN_ABI = [
  {
    type: 'function' as const,
    name: 'purchase',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable' as const,
  },
  {
    type: 'function' as const,
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view' as const,
  },
] as const;

// ─── Addresses ──────────────────────────────────────────────────────────────

export const ZORA_NFT_CONTRACTS: Record<string, Address> = {
  base: '0x8B8C5B1b17EcE0B0B1e9C0e5f0c3e1a2f3d4e5f6',
  ethereum: '0x8B8C5B1b17EcE0B0B1e9C0e5f0c3e1a2f3d4e5f6',
  optimism: '0x8B8C5B1b17EcE0B0B1e9C0e5f0c3e1a2f3d4e5f6',
  arbitrum: '0x8B8C5B1b17EcE0B0B1e9C0e5f0c3e1a2f3d4e5f6',
  zora: '0x8B8C5B1b17EcE0B0B1e9C0e5f0c3e1a2f3d4e5f6',
};

export const CHAIN_EXPLORERS: Record<string, string> = {
  base: 'https://base.blockscout.com',
  ethereum: 'https://etherscan.io',
  optimism: 'https://optimistic.etherscan.io',
  arbitrum: 'https://arbiscan.io',
  zora: 'https://explorer.zora.energy',
};

export const CHAIN_RPC_URLS: Record<string, string> = {
  base: 'https://mainnet.base.org',
  ethereum: 'https://eth.llamarpc.com',
  optimism: 'https://mainnet.optimism.io',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  zora: 'https://rpc.zora.energy',
};

export const PINATA_API = 'https://api.pinata.cloud';
export const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs';
