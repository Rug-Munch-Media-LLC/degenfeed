import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';

// LensHub v1 proxy on Polygon mainnet
export const LENS_HUB_ADDRESS = '0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d';

/**
 * Encode a uint256 value as 32-byte hex string.
 */
function encodeUint256(value: bigint | number | string): string {
  const big = typeof value === 'bigint' ? value : BigInt(value);
  return big.toString(16).padStart(64, '0');
}

/**
 * Parse a Lens v1 publication id like \"0x01-0x01\" into profileId and pubId.
 */
export function parsePublicationId(
  publicationId: string,
): { profileId: string; pubId: string } | null {
  const parts = publicationId.split('-');
  if (parts.length !== 2) return null;
  const profileId = parts[0]?.trim();
  const pubId = parts[1]?.trim();
  if (!profileId || !pubId) return null;
  if (!/^0x[0-9a-fA-F]+$/.test(profileId) || !/^0x[0-9a-fA-F]+$/.test(pubId)) return null;
  return { profileId, pubId };
}

/**
 * Build the calldata for LensHub.collect(profileId, pubId, \"0x\")
 * Suitable for eth_sendTransaction.
 */
export function buildLensCollectCalldata(profileId: string, pubId: string): string {
  const signature = 'collect(uint256,uint256,bytes)';
  const selector = bytesToHex(keccak_256(new TextEncoder().encode(signature))).slice(0, 8);

  // ABI encoding for collect(uint256,uint256,bytes)
  // profileId (32), pubId (32), bytes offset (32 = 0x60), bytes length (32 = 0)
  const calldata = `${
    selector + encodeUint256(profileId) + encodeUint256(pubId)
  }00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000`;

  return `0x${calldata}`;
}

/**
 * Build a complete Lens collect transaction intent.
 */
export function buildLensCollectIntent(publicationId: string, from?: string) {
  const parsed = parsePublicationId(publicationId);
  if (!parsed) return null;

  return {
    chainId: 137, // Polygon mainnet
    to: LENS_HUB_ADDRESS,
    data: buildLensCollectCalldata(parsed.profileId, parsed.pubId),
    from: from || undefined,
    value: '0x0',
  };
}

/**
 * Build the calldata for LensHub.createProfile — suitable for eth_sendTransaction.
 *
 * LensHub.createProfile creates a new profile and optionally registers a handle
 * in one transaction. The follow module can be set to 0x0 for free follow.
 *
 * Reference: LensHub.sol — function createProfile(CreateProfileParams calldata)
 */
export function buildLensProfileCreateCalldata(opts: {
  handle: string;
  to: string;
  followModule?: string;
  followModuleData?: string;
}): {
  to: string;
  data: string;
  value: string;
  chainId: number;
} {
  const signature = 'createProfile((string,address,address,bytes))';
  const selector = bytesToHex(keccak_256(new TextEncoder().encode(signature))).slice(0, 8);

  const followModule = opts.followModule || '0x0000000000000000000000000000000000000000';
  const followModuleData = opts.followModuleData || '0x';

  // ABI-encode the CreateProfileParams struct:
  //   (string to, address followModule, address followModuleReturnData, bytes followModuleData)
  //
  // The struct is laid out as:
  //   - offset to struct (0x20 = 32)
  //   - string handle: offset (32), length (32), data (variable)
  //   - address followModule (32)
  //   - address followModuleReturnData (32)  — always 0x0 for free follow
  //   - bytes followModuleData: offset (32), length (32), data (variable)
  //
  // For simplicity, we construct a minimal ABI encoding:
  //   Tuple encoding: offset (32), then each element

  const handleHex = bytesToHex(new TextEncoder().encode(opts.handle));
  const handleLen = opts.handle.length;

  // Pad handle data to 32-byte words
  const handleDataPadded = handleHex.padEnd(Math.ceil(handleLen / 32) * 64, '0');

  // Struct layout (offset 32 points to the start of the struct)
  // offset to struct = 0x20
  //   - string: offset (32) -> 0x20 (points to start of string data relative to struct start)
  //            = 32 + 32 + 32 + 32 + 32 = 160 = 0xa0 from the very start of calldata
  //            Actually let's compute relative offset:
  //            Struct starts at byte 36 (after selector + offset)
  //            Within struct at offset 0: string handle — offset to string data = 0x60 (96 bytes)
  //              because: string offset(32) + address(32) + address(32) + bytes offset(32) = 128 = 0x80
  //              Wait, let me just build it correctly:

  // Simplified ABI encoding for createProfile(CreateProfileParams)
  // The param is a tuple, so we encode:
  //   offset to tuple (0x20)
  //   then inside the tuple: handle (string), followModule (address), followModuleReturnData (address), followModuleData (bytes)
  //
  // Tuple encoding from offset 36 (after selector 4 + offset 32):
  //   [0..32)   offset to handle string data = 0x80 (128 = 32*4)
  //   [32..64)  followModule (address, left-padded to 32)
  //   [64..96)  followModuleReturnData (address = 0x0, left-padded to 32)
  //   [96..128) offset to followModuleData bytes = 0x100 (256 = 128 + 128)
  //   [128..160) handle string length
  //   [160..)   handle string data (padded to 32)
  //   [256..288) followModuleData length (0)
  //   [288..)   followModuleData (empty)

  const handleLenHex = encodeUint256(handleLen);
  const paddedHandle = handleHex.padEnd(Math.ceil(handleLen / 32) * 64, '0');

  const calldata = `${
    selector
  }0000000000000000000000000000000000000000000000000000000000000020` + // offset to tuple
    `0000000000000000000000000000000000000000000000000000000000000080` + // offset to handle string (128 = 32*4)
    `000000000000000000000000${followModule.slice(2).padStart(40, '0')}` +  // followModule address
    `0000000000000000000000000000000000000000000000000000000000000000` +  // followModuleReturnData (0x0)
    `0000000000000000000000000000000000000000000000000000000000000100` +  // offset to followModuleData bytes (256)
    `${handleLenHex}` +                                                      // handle string length
    `${paddedHandle}` +                                                      // handle string data (padded)
    `0000000000000000000000000000000000000000000000000000000000000000`;    // followModuleData length (0)

  return {
    to: LENS_HUB_ADDRESS,
    data: `0x${calldata}`,
    value: '0x0',
    chainId: 137, // Polygon mainnet
  };
}

/**
 * Encode an address as a 32-byte hex word (left-padded with zeros).
 */
export function encodeAddress(addr: string): string {
  return '000000000000000000000000' + addr.replace('0x', '').toLowerCase().padStart(40, '0');
}

/**
 * Build a Momoka proof verification URL.
 */
export function buildMomokaProofUrl(daHash: string): string {
  return `https://momoka.lens.xyz/da/${daHash}`;
}

/**
 * Momoka proof data for a gasless publication.
 */
export interface MomokaProofData {
  daHash: string;
  profileId: string;
  publicationId?: string;
  content: string;
  submittedAt: string;
  verified: boolean;
  arweaveTxId?: string;
  proofUrl: string;
}
