import { bytesToHex } from "@noble/hashes/utils";
/**
 * Lightning zap support via LNURL-pay (NIP-57).
 *
 * Flow:
 *   1. Given a Nostr pubkey, resolve their LNURL from kind 0 metadata
 *   2. Call LNURL-pay endpoint to get payment request
 *   3. Return invoice + QR data
 */

export interface ZapInvoice {
	pr: string; // Bolt11 invoice
	description: string;
	description_hash: string;
	amount: number; // msat
	expires_at: number;
	// LNURL-pay response extras
	allowsNsec?: boolean;
	commentAllowed?: number;
	status: "OK" | "ERROR";
	reason?: string;
}

interface NostrProfileResponse {
	profile?: { content?: string };
	content?: string;
}

interface LnurlPayParams {
	status?: string;
	callback: string;
	minSendable?: number;
	maxSendable?: number;
	commentAllowed?: number;
	allowsNsec?: boolean;
	reason?: string;
}

interface LnurlInvoiceResponse {
	status?: string;
	pr?: string;
	description?: string;
	description_hash?: string;
	reason?: string;
}

/**
 * Resolve LNURL from a Nostr pubkey by fetching their kind 0 metadata.
 */
export async function resolveLnurlFromPubkey(
	pubkey: string,
	relays: string[],
): Promise<string | null> {
	// Try popular relay aggregators first (faster)
	const aggregators = [
		`https://api.nostr.best/nprofile/${pubkey}`,
		`https://naddr.com/api/nprofile/${pubkey}`,
	];

	for (const url of aggregators) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
			if (!res.ok) continue;
			const data = (await res.json()) as NostrProfileResponse;
			const metadata = data?.profile?.content || data?.content;
			if (metadata) {
				const lnurl = extractLnurl(metadata);
				if (lnurl) return lnurl;
			}
		} catch {
			/* try next */
		}
	}

	// Fallback: subscribe to relays via WebSocket for kind 0 metadata
	const lnurl = await fetchLnurlFromRelays(pubkey, relays);
	return lnurl;
}

/**
 * Extract LNURL from Nostr profile metadata JSON.
 */
function extractLnurl(metadataStr: string): string | null {
	try {
		const meta = JSON.parse(metadataStr);
		const raw = typeof meta === "string" ? JSON.parse(meta) : meta;

		// Check standard field names
		const lnurl = raw.lud06 || raw.lud16 || raw.lnurl || raw.lightning;
		if (lnurl) return lnurl.toString();

		// Check in nip05 field (sometimes contains LNURL)
		if (raw.nip05?.includes("@")) {
			// Convert user@domain.com to lnurl
			return lnaddressToLnurl(raw.nip05);
		}
	} catch {}
	return null;
}

/**
 * Convert a Lightning Address (user@domain.com) to an LNURL-pay URL.
 */
function lnaddressToLnurl(address: string): string {
	const [user, domain] = address.split("@");
	return `https://${domain}/.well-known/lnurlp/${user}`;
}

/**
 * Fetch an invoice from an LNURL-pay endpoint.
 */

/**
 * Fetch LNURL from a Nostr relay by subscribing to kind 0 metadata.
 * Uses WebSocket; works in Cloudflare Workers.
 */
async function fetchLnurlFromRelays(
	pubkey: string,
	relays: string[],
): Promise<string | null> {
	for (const relay of relays) {
		const lnurl = await fetchLnurlFromRelay(pubkey, relay);
		if (lnurl) return lnurl;
	}
	return null;
}

function fetchLnurlFromRelay(
	pubkey: string,
	relay: string,
): Promise<string | null> {
	return new Promise((resolve) => {
		try {
			const ws = new WebSocket(relay);
			const subId = bytesToHex(crypto.getRandomValues(new Uint8Array(8)));
			let settled = false;

			const cleanup = () => {
				if (!settled) {
					settled = true;
					try {
						ws.close();
					} catch {
						/* ignore */
					}
				}
			};

			const timer = setTimeout(() => {
				cleanup();
				resolve(null);
			}, 5000);

			ws.addEventListener("open", () => {
				ws.send(
					JSON.stringify([
						"REQ",
						subId,
						{ kinds: [0], authors: [pubkey], limit: 1 },
					]),
				);
			});

			ws.addEventListener("message", (event) => {
				try {
					const msg = JSON.parse(event.data as string) as unknown[];
					if (msg[0] === "EVENT" && msg[1] === subId) {
						const content = (msg[2] as { content?: string } | undefined)
							?.content;
						if (content) {
							const lnurl = extractLnurl(content);
							if (lnurl) {
								clearTimeout(timer);
								cleanup();
								resolve(lnurl);
								return;
							}
						}
					}
					if (msg[0] === "EOSE" && msg[1] === subId) {
						clearTimeout(timer);
						cleanup();
						resolve(null);
					}
				} catch {
					/* ignore malformed */
				}
			});

			ws.addEventListener("error", () => {
				clearTimeout(timer);
				cleanup();
				resolve(null);
			});

			ws.addEventListener("close", () => {
				clearTimeout(timer);
				if (!settled) resolve(null);
			});
		} catch {
			resolve(null);
		}
	});
}

/**
 * Bech32 polymod checksum generator (BIP-0173).
 */
function bech32Polymod(values: number[]): number {
	const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
	let chk = 1;
	for (const v of values) {
		const b = chk >> 25;
		chk = ((chk & 0x1ffffff) << 5) ^ v;
		for (let i = 0; i < 5; i++) {
			chk ^= (b >> i) & 1 ? (GEN[i] ?? 0) : 0;
		}
	}
	return chk;
}

/**
 * Minimal bech32 decoder for LNURLs (BIP-0173) with checksum verification.
 */
function bech32Decode(bech: string): Uint8Array {
	const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
	const bechLower = bech.toLowerCase();
	const sep = bechLower.lastIndexOf("1");
	if (sep < 1) throw new Error("Invalid bech32: no separator");

	const hrp = bechLower.slice(0, sep);
	const dataPart = bechLower.slice(sep + 1);
	if (dataPart.length < 6)
		throw new Error("Invalid bech32: data part too short");

	let hasLower = false;
	let hasUpper = false;
	for (let i = 0; i < bech.length; i++) {
		const c = bech[i];
		if (c === undefined) continue;
		if (c >= "a" && c <= "z") hasLower = true;
		if (c >= "A" && c <= "Z") hasUpper = true;
	}
	if (hasLower && hasUpper) throw new Error("Invalid bech32: mixed case");

	const values: number[] = [];
	for (let i = 0; i < hrp.length; i++) {
		values.push(hrp.charCodeAt(i) >> 5);
	}
	values.push(0);
	for (let i = 0; i < hrp.length; i++) {
		values.push(hrp.charCodeAt(i) & 31);
	}

	const data = new Uint8Array(dataPart.length);
	for (let i = 0; i < dataPart.length; i++) {
		const c = dataPart[i];
		if (c === undefined) throw new Error("Invalid bech32 character");
		const idx = CHARSET.indexOf(c);
		if (idx < 0) throw new Error("Invalid bech32 character");
		data[i] = idx;
		values.push(idx);
	}

	if (bech32Polymod(values) !== 1) {
		throw new Error("Invalid bech32: checksum mismatch");
	}

	// Convert 5-bit data words to 8-bit bytes (excluding 6-word checksum)
	const payload = data.slice(0, -6);
	const result: number[] = [];
	let buffer = 0;
	let bitsLeft = 0;
	for (const val of payload) {
		buffer = (buffer << 5) | val;
		bitsLeft += 5;
		if (bitsLeft >= 8) {
			result.push((buffer >> (bitsLeft - 8)) & 0xff);
			bitsLeft -= 8;
		}
	}

	return new Uint8Array(result);
}

export async function fetchZapInvoice(
	lnurl: string,
	amountMsat: number,
	comment?: string,
): Promise<ZapInvoice | { status: "ERROR"; reason: string }> {
	try {
		// If it's a lightning address, convert to URL first
		const url =
			lnurl.includes("@") && !lnurl.startsWith("http")
				? lnaddressToLnurl(lnurl)
				: lnurl;

		// Check if it's already a bech32 LNURL
		let endpoint: string;
		if (url.startsWith("lnurl")) {
			// Decode bech32 LNURL to URL
			const bytes = bech32Decode(url);
			endpoint = new TextDecoder().decode(bytes);
		} else {
			endpoint = url;
		}

		// Step 1: Get LNURL-pay params
		const paramsRes = await fetch(endpoint, {
			signal: AbortSignal.timeout(5000),
		});
		if (!paramsRes.ok) {
			return { status: "ERROR", reason: "LNURL endpoint unreachable" };
		}
		const params = (await paramsRes.json()) as LnurlPayParams;

		if (params.status === "ERROR") {
			return { status: "ERROR", reason: params.reason || "LNURL error" };
		}

		// Validate params
		if (!params.callback) {
			return { status: "ERROR", reason: "No callback in LNURL params" };
		}

		const minSendable = params.minSendable || 1;
		const maxSendable = params.maxSendable || 1_000_000_000;

		if (amountMsat < minSendable || amountMsat > maxSendable) {
			return {
				status: "ERROR",
				reason: `Amount out of range (${minSendable}-${maxSendable} msat)`,
			};
		}

		// Step 2: Get invoice from callback
		const callbackUrl = new URL(params.callback);
		callbackUrl.searchParams.set("amount", String(amountMsat));
		if (
			comment &&
			params.commentAllowed &&
			comment.length <= params.commentAllowed
		) {
			callbackUrl.searchParams.set("comment", comment);
		}

		const invoiceRes = await fetch(callbackUrl.toString(), {
			signal: AbortSignal.timeout(5000),
		});
		if (!invoiceRes.ok) {
			return { status: "ERROR", reason: "Invoice endpoint unreachable" };
		}
		const invoice = (await invoiceRes.json()) as LnurlInvoiceResponse;

		if (invoice.status === "ERROR") {
			return { status: "ERROR", reason: invoice.reason || "Invoice error" };
		}

		if (!invoice.pr) {
			return {
				status: "ERROR",
				reason: "No payment request in invoice response",
			};
		}

		return {
			pr: invoice.pr,
			description: invoice.description || "",
			description_hash: invoice.description_hash || "",
			amount: amountMsat,
			expires_at: Date.now() + 60000, // default 1min expiry
			allowsNsec: !!params.allowsNsec,
			commentAllowed: params.commentAllowed || 0,
			status: "OK",
		};
	} catch (err) {
		return { status: "ERROR", reason: String(err) };
	}
}
