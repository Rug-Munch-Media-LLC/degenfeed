import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";

// LensHub v1 proxy on Polygon mainnet
export const LENS_HUB_ADDRESS = "0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d";

/**
 * Encode a uint256 value as 32-byte hex string.
 */
function encodeUint256(value: bigint | number | string): string {
	const big = typeof value === "bigint" ? value : BigInt(value);
	return big.toString(16).padStart(64, "0");
}

/**
 * Parse a Lens v1 publication id like \"0x01-0x01\" into profileId and pubId.
 */
export function parsePublicationId(
	publicationId: string,
): { profileId: string; pubId: string } | null {
	const parts = publicationId.split("-");
	if (parts.length !== 2) return null;
	const profileId = parts[0]?.trim();
	const pubId = parts[1]?.trim();
	if (!profileId || !pubId) return null;
	if (!/^0x[0-9a-fA-F]+$/.test(profileId) || !/^0x[0-9a-fA-F]+$/.test(pubId))
		return null;
	return { profileId, pubId };
}

/**
 * Build the calldata for LensHub.collect(profileId, pubId, \"0x\")
 * Suitable for eth_sendTransaction.
 */
export function buildLensCollectCalldata(
	profileId: string,
	pubId: string,
): string {
	const signature = "collect(uint256,uint256,bytes)";
	const selector = bytesToHex(
		keccak_256(new TextEncoder().encode(signature)),
	).slice(0, 8);

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
		value: "0x0",
	};
}
