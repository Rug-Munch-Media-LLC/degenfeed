import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';

// LensHub v1 proxy on Polygon mainnet
export const LENS_HUB_ADDRESS = '0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d';

/**
 * Encode a uint256 value as 32-byte hex string.
 */
function encodeUint256(value: bigint | number | string): string {
