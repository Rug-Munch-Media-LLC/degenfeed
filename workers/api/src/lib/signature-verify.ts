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

import { ed25519 } from "@noble/curves/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

const BASE58_ALPHABET =
	"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58ToBytes(input: string): Uint8Array {
	if (input.length === 0) return new Uint8Array(0);
	const alphabetMap = new Map<string, number>();
	for (let i = 0; i < BASE58_ALPHABET.length; i++) {
		alphabetMap.set(BASE58_ALPHABET[i]!, i);
	}
	let leadingZeros = 0;
	for (const ch of input) {
		if (ch === "1") leadingZeros++;
		else break;
	}
	const digits: number[] = [];
	for (let i = leadingZeros; i < input.length; i++) {
		const ch = input[i]!;
		const val = alphabetMap.get(ch);
		if (val === undefined) throw new Error("Invalid base58 character");
		let carry = val;
		for (let j = 0; j < digits.length; j++) {
			const cur = digits[j]! * 256 + carry;
			digits[j] = cur % 58;
			carry = Math.floor(cur / 58);
		}
		while (carry > 0) {
			digits.push(carry % 58);
			carry = Math.floor(carry / 58);
		}
	}
	const bytes = new Uint8Array(digits.length);
	for (let i = 0; i < digits.length; i++) {
		bytes[i] = digits[digits.length - 1 - i]!;
	}
	if (leadingZeros === 0) return bytes;
	const out = new Uint8Array(leadingZeros + bytes.length);
	out.set(bytes, leadingZeros);
	return out;
}

/**
 * Verify an Ethereum EIP-191 personal_sign signature.
 *
 * Replicates the exact logic of:
 *   signature = personal_sign(utf8ToHex(message), address)
 *
 * The signed payload is:
 *   "\x19Ethereum Signed Message:\n${message.length}${message}"
 *
 * @param message - The raw text message that was signed
 * @param signature - Hex-encoded signature (0x-prefixed or bare)
 * @param expectedAddress - Lowercased Ethereum address to compare against
 */
export function verifyEthereumSignature(
	message: string,
	signature: string,
	expectedAddress: string,
): boolean {
	try {
		const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
		const msgHash = keccak_256(new TextEncoder().encode(prefix + message));

		const sig = signature.startsWith("0x") ? signature.slice(2) : signature;
		const rHex = sig.slice(0, 64);
		const sHex = sig.slice(64, 128);
		const v = Number.parseInt(sig.slice(128, 130), 16);
		const recovery = v - 27;
		if (recovery < 0 || recovery > 3) return false;

		const sigObj = secp256k1.Signature.fromCompact(
			hexToBytes(rHex! + sHex),
		).addRecoveryBit(recovery);
		const pubKey = sigObj.recoverPublicKey(msgHash);
		const pubBytes = pubKey.toRawBytes(false).slice(1);
		const address = `0x${bytesToHex(keccak_256(pubBytes).slice(-20))}`;

		return address.toLowerCase() === expectedAddress.toLowerCase();
	} catch {
		return false;
	}
}

/**
 * Verify a Solana ed25519 signature.
 *
 * Solana wallets sign arbitrary messages via:
 *   wallet.signMessage(new TextEncoder().encode(message))
 *
 * The message is NOT hashed before ed25519; the raw bytes are signed.
 *
 * @param message - The raw text message that was signed
 * @param signatureHex - Hex-encoded signature (without 0x prefix)
 * @param expectedPublicKey - Base58-encoded Solana public key
 */
export function verifySolanaSignature(
	message: string,
	signatureHex: string,
	expectedPublicKey: string,
): boolean {
	try {
		const msgBytes = new TextEncoder().encode(message);
		const sigBytes = hexToBytes(signatureHex);
		const pubBytes = base58ToBytes(expectedPublicKey);
		if (pubBytes.length !== 32) return false;
		return ed25519.verify(sigBytes, msgBytes, pubBytes);
	} catch {
		return false;
	}
}
