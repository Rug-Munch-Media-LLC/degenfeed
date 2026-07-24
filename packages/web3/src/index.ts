// ─── Tip Contract (folded from @degenfeed/tip-contract) ───────────
export {
  encodeTipData,
  encodeTipWithMessageData,
  getTipChainConfig,
  getTipContractAddress,
  TIP_CHAIN_CONFIG,
  TIP_CONTRACT_ABI,
  TIP_CONTRACT_ADDRESSES,
  TIP_CONTRACT_SOURCE,
} from '@degenfeed/tip-contract';
export type { OnChainTip, TipOnChainOptions, TipResult } from './tipContract';
export { getOnChainTips, switchToTipChain, tipOnChain } from './tipContract';
