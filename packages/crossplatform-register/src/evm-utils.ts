/**
 * @degenfeed/crossplatform-register — EVM transaction utilities
 *
 * Minimal EVM key derivation and transaction signing for cross-platform
 * registration (Farcaster on Base, Lens on Polygon).
 *
 * Uses @noble/curves secp256k1 for key operations and @noble/hashes for
 * keccak-256, keeping dependencies consistent with the rest of the monorepo.
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export interface TransactionRequest {
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  nonce: string;
  chainId: number;
}

/**
 * Derive an EVM address from a hex private key.
 */
export function privateKeyToAddress(privateKeyHex: string): string {
  const pk = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const privKeyBytes = hexToBytes(pk);
  const pubKey = secp256k1.getPublicKey(privKeyBytes, false);
  // Uncompressed public key -> keccak256 -> last 20 bytes
  const hash = keccak_256(pubKey.slice(1));
  const addressBytes = hash.slice(-20);
  return `0x${bytesToHex(addressBytes)}`;
}

/**
 * RLP-encode and sign an EIP-155 transaction.
 * Returns the raw signed transaction hex for eth_sendRawTransaction.
 */
export function signTransaction(tx: TransactionRequest, privateKeyHex: string): string {
  const pk = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const privKeyBytes = hexToBytes(pk);

  // Build the RLP array for an EIP-155 transaction
  const fields = [
    toRlp(tx.nonce),
    toRlp(tx.gasPrice),
    toRlp(tx.gas),
    toRlp(tx.to),
    toRlp(tx.value),
    toRlp(tx.data),
    toRlp(BigInt(tx.chainId)),
    toRlp(0n), // r (empty)
    toRlp(0n), // s (empty)
  ];

  // Sign the RLP-encoded transaction hash
  const encoded = rlpEncode(fields);
  const hash = keccak_256(hexToBytes(encoded));
  const sig = secp256k1.sign(hash, privKeyBytes);

  // Compute recovery ID with EIP-155 chain ID
  const chainId = BigInt(tx.chainId);
  // Re-encode with signature
  const signedFields = [
    toRlp(tx.nonce),
    toRlp(tx.gasPrice),
    toRlp(tx.gas),
    toRlp(tx.to),
    toRlp(tx.value),
    toRlp(tx.data),
    toRlp(chainId),
    toRlp(0n),
    toRlp(0n),
  ];

  const unsignedEncoded = rlpEncode(signedFields);
  const unsignedHash = keccak_256(hexToBytes(unsignedEncoded));

  const finalSig = secp256k1.sign(unsignedHash, privKeyBytes);

  const _finalV = chainId * 2n + BigInt(35) + BigInt(finalSig.recovery);
  const finalFields = [
    toRlp(tx.nonce),
    toRlp(tx.gasPrice),
    toRlp(tx.gas),
    toRlp(tx.to),
    toRlp(tx.value),
    toRlp(tx.data),
    toRlp(_finalV),
    toRlp(toBigIntSig(finalSig.r)),
    toRlp(toBigIntSig(finalSig.s)),
  ];

  const rlpHex = rlpEncode(finalFields);
  return `0x${rlpHex}`;
}

// ─── Minimal RLP encoder ──────────────────────────────────────────────

type RlpItem = string | bigint | RlpItem[];

function toRlp(value: string | bigint | number): string {
  if (typeof value === 'bigint') {
    if (value === 0n) return '80';
    let hex = value.toString(16);
    if (hex.length % 2 === 1) hex = `0${hex}`;
    return hex;
  }
  if (typeof value === 'number') {
    if (value === 0) return '80';
    let hex = value.toString(16);
    if (hex.length % 2 === 1) hex = `0${hex}`;
    return hex;
  }
  // String
  const clean = value.startsWith('0x') ? value.slice(2) : value;
  if (clean === '' || clean === '00') return '80';
  return clean;
}

function rlpEncode(items: RlpItem[]): string {
  let encoded = '';
  for (const item of items) {
    if (typeof item === 'string') {
      const hex = item.startsWith('0x') ? item.slice(2) : item;
      if (hex === '' || hex === '00') {
        encoded += '80';
      } else if (hex.length / 2 === 1 && hex < '80') {
        encoded += hex;
      } else {
        const len = hex.length / 2;
        if (len <= 55) {
          encoded += `${(0x80 + len).toString(16)}${hex}`;
        } else {
          const lenHex = len.toString(16);
          const lenLen = lenHex.length / 2;
          encoded += `${(0xb7 + lenLen).toString(16)}${lenHex}${hex}`;
        }
      }
    } else {
      // Nested array
      const inner = rlpEncode(item as RlpItem[]);
      const len = inner.length / 2;
      if (len <= 55) {
        encoded += `${(0xc0 + len).toString(16)}${inner}`;
      } else {
        const lenHex = len.toString(16);
        const lenLen = lenHex.length / 2;
        encoded += `${(0xf7 + lenLen).toString(16)}${lenHex}${inner}`;
      }
    }
  }
  return encoded;
}

function toBigIntSig(hex: Uint8Array | bigint | number): bigint {
  if (typeof hex === 'bigint') return hex;
  if (typeof hex === 'number') return BigInt(hex);
  return BigInt(`0x${bytesToHex(hex)}`);
}
