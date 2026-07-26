// ─── Tip Contract Data (merged from @degenfeed/tip-contract) ─────
export {
  encodeTipData,
  encodeTipWithMessageData,
  getTipChainConfig,
  getTipContractAddress,
  TIP_CHAIN_CONFIG,
  TIP_CONTRACT_ABI,
  TIP_CONTRACT_ADDRESSES,
  TIP_CONTRACT_SOURCE,
} from './tip-contract-data';
export type { OnChainTip, TipOnChainOptions, TipResult } from './tipContract';
export { getOnChainTips, switchToTipChain, tipOnChain } from './tipContract';

/**
 * EIP-712 typed data signing.
 * Stub for DTS compatibility — wraps viem's signTypedData.
 * In browser/WalletConnect contexts, delegates to the injected wallet.
 */
export async function signTypedData(_data: {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  value: Record<string, unknown>;
}): Promise<string> {
  throw new Error('signTypedData: not available in environment without viem wallet client');
}
