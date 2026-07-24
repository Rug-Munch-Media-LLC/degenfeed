// ── God code split: moved to video-sdk/ directory ────────────────────────
// This file is now a thin re-export barrel for backward compatibility.
// Each concern lives in its own module under video-sdk/:
//   constants.ts — ABIs, contract addresses, chain RPC URLs
//   types.ts     — PinataConfig, MintVideoOptions, ZoraVideoNFT, etc.
//   metadata.ts  — buildVideoMetadata, metadataToDataUri
//   upload.ts    — uploadToIpfs, uploadMetadataToIpfs
//   index.ts     — ZoraVideoSDK class

export type { PinataConfig, VideoUploadResult, MintVideoOptions, MintResult, ZoraVideoNFT, CollectResult, TipResult, AnnounceResult, TrendingQuery, ZoraVideoSDKConfig } from './video-sdk/types';
export { ZORA_NFT_ABI, ZORA_COIN_ABI, ZORA_NFT_CONTRACTS, CHAIN_EXPLORERS, CHAIN_RPC_URLS } from './video-sdk/constants';
export { buildVideoMetadata, metadataToDataUri } from './video-sdk/metadata';
export { uploadToIpfs, uploadMetadataToIpfs } from './video-sdk/upload';
export { ZoraVideoSDK } from './video-sdk/index';
