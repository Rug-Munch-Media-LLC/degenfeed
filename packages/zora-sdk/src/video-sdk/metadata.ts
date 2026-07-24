import type { Address } from 'viem';
import type { VideoMetadata } from './types';

export function buildVideoMetadata(opts: {
  name: string;
  description: string;
  thumbnailUri: string;
  videoUri: string;
  duration?: number;
  creator: Address;
  linkedCreatorCoin?: Address;
  editionSize?: number;
  royaltyBps?: number;
}): VideoMetadata {
  return {
    name: opts.name,
    description: opts.description,
    image: opts.thumbnailUri,
    animation_url: opts.videoUri,
    content: {
      url: opts.videoUri,
      mime_type: 'video/mp4',
      duration: opts.duration ? `PT${opts.duration}S` : undefined,
    },
    external_url: `https://degenfeed.xyz/zora/video/creator/${opts.creator}`,
    attributes: [
      { trait_type: 'Creator', value: opts.creator },
      { trait_type: 'Edition Size', value: opts.editionSize ?? 1 },
      { trait_type: 'Royalty BPS', value: opts.royaltyBps ?? 500 },
      ...(opts.linkedCreatorCoin
        ? [{ trait_type: 'Linked Creator Coin', value: opts.linkedCreatorCoin }]
        : []),
      ...(opts.duration ? [{ trait_type: 'Duration', value: opts.duration }] : []),
    ],
    linked_creator_coin: opts.linkedCreatorCoin,
    duration: opts.duration,
  };
}

export function metadataToDataUri(metadata: VideoMetadata): string {
  const json = JSON.stringify(metadata);
  const encoded = typeof btoa !== 'undefined' ? btoa(json) : Buffer.from(json).toString('base64');
  return `data:application/json;base64,${encoded}`;
}
