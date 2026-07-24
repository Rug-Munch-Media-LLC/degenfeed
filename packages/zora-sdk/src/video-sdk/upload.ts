import { IPFS_GATEWAY, PINATA_API } from './constants';
import { metadataToDataUri } from './metadata';
import type { PinataConfig, VideoMetadata, VideoUploadResult } from './types';

export async function uploadToIpfs(
  file: File | Blob,
  fileName: string,
  config: PinataConfig,
  options?: { pinToArweave?: boolean },
): Promise<VideoUploadResult> {
  const formData = new FormData();
  formData.append('file', file, fileName);

  if (options?.pinToArweave) {
    // biome-ignore lint/style/noNonNullAssertion: optional Arweave
    formData.append('pinToArweave', 'true'!);
  }

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.jwt}` },
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Pinata upload failed: ${res.status} ${errBody}`);
  }

  const data = (await res.json()) as { IpfsHash: string; PinSize: number; Timestamp: string };
  return {
    ipfsUri: `ipfs://${data.IpfsHash}`,
    pinataUrl: `${config.gateway ?? IPFS_GATEWAY}/${data.IpfsHash}`,
  };
}

export async function uploadMetadataToIpfs(
  metadata: VideoMetadata,
  config: PinataConfig,
): Promise<string> {
  // Use data URI for small metadata (gas optimization)
  const json = JSON.stringify(metadata);
  if (json.length < 500) {
    return metadataToDataUri(metadata);
  }

  // Upload large metadata to IPFS
  const blob = new Blob([json], { type: 'application/json' });
  const result = await uploadToIpfs(blob as File, 'metadata.json', config);
  return result.ipfsUri;
}
