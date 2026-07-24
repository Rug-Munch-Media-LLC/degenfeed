// ── God code split: moved to video-sdk/ directory ────────────────────────
// This file is now a thin re-export barrel for backward compatibility.
// Each concern lives in its own module under video-sdk/:
//   constants.ts — ABIs, contract addresses, chain RPC URLs
//   types.ts     — PinataConfig, MintVideoOptions, ZoraVideoNFT, etc.
//   metadata.ts  — buildVideoMetadata, metadataToDataUri
//   upload.ts    — uploadToIpfs, uploadMetadataToIpfs
//   index.ts     — ZoraVideoSDK class

export {
  CHAIN_EXPLORERS,
  CHAIN_RPC_URLS,
  ZORA_COIN_ABI,
  ZORA_NFT_ABI,
  ZORA_NFT_CONTRACTS,
} from './video-sdk/constants';
export { ZoraVideoSDK } from './video-sdk/index';
export { buildVideoMetadata, metadataToDataUri } from './video-sdk/metadata';
export type {
  AnnounceResult,
  CollectResult,
  MintResult,
  MintVideoOptions,
  PinataConfig,
  TipResult,
  TrendingQuery,
  VideoMetadata,
  VideoUploadResult,
  ZoraVideoNFT,
  ZoraVideoSDKConfig,
} from './video-sdk/types';
export { uploadMetadataToIpfs, uploadToIpfs } from './video-sdk/upload';
