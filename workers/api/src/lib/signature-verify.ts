/**
 * @degenfeed/api-worker — Cross-chain signature verification
 *
 * Verifies EIP-191 (Ethereum personal_sign) and Solana ed25519 signatures.
 * Used by both the wallet sign-in flow and the hardware wallet 2FA system.
 *
 * ETHERS / VIEM NOTE:
 * We use @noble/curves directly instead of viem/ethers to keep the
 * Worker bundle small (~8KB vs ~200KB+). The crypto is identical:
 *  - Ethereum: keccak256 + secp256k1 recovery (ecrecover)
 *  - Solana:  ed25519.verify
 */

import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58ToBytes(input: string): Uint8Array {
