import {
	Keypair,
	LAMPORTS_PER_SOL,
	PublicKey,
	SystemProgram,
	Transaction,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import type { Env } from "../index";
import { handleX402Paywall, handleX402Verify } from "../routes/x402";

const env: Env = {};

function buildSignedTipTx(
	sender: Keypair,
	recipient: string,
	amount = 0.001,
): string {
	const tx = new Transaction();
	tx.feePayer = sender.publicKey;
	tx.recentBlockhash = "4M5xYZx7nTByfFV9KxGj69acpmFDJyEQLM26Gc3x1j6Y";
	tx.add(
		SystemProgram.transfer({
			fromPubkey: sender.publicKey,
			toPubkey: new PublicKey(recipient),
			lamports: amount * LAMPORTS_PER_SOL,
		}),
	);
	tx.sign(sender);
	return btoa(String.fromCharCode(...tx.serialize()));
}

describe("handleX402Paywall", () => {
	it("returns 402 with X-Payment-Required header", async () => {
		const creator = Keypair.generate().publicKey.toBase58();
		const request = new Request(
			`https://app.degenfeed.xyz/api/x402/paywall?creator=${encodeURIComponent(creator)}&amount=0.001`,
		);
		const res = await handleX402Paywall(request, env);
		expect(res.status).toBe(402);
		const header = res.headers.get("X-Payment-Required");
		expect(header).toContain("solana:https://app.degenfeed.xyz/api/blink/tip");
		expect(header).toContain(creator);
	});

	it("rejects invalid creator address", async () => {
		const request = new Request(
			"https://app.degenfeed.xyz/api/x402/paywall?creator=bad",
		);
		const res = await handleX402Paywall(request, env);
		expect(res.status).toBe(400);
	});
});

describe("handleX402Verify", () => {
	it("returns ok true for a valid signed transaction proof", async () => {
		const sender = Keypair.generate();
		const recipient = Keypair.generate().publicKey.toBase58();
		const proof = buildSignedTipTx(sender, recipient);
		const request = new Request("https://app.degenfeed.xyz/api/x402/verify", {
			method: "POST",
			body: JSON.stringify({ proof }),
		});
		const res = await handleX402Verify(request, env);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(true);
	});

	it("returns ok false for an unsigned transaction proof", async () => {
		const sender = Keypair.generate().publicKey;
		const recipient = Keypair.generate().publicKey;
		const tx = new Transaction();
		tx.feePayer = sender;
		tx.recentBlockhash = "4M5xYZx7nTByfFV9KxGj69acpmFDJyEQLM26Gc3x1j6Y";
		tx.add(
			SystemProgram.transfer({
				fromPubkey: sender,
				toPubkey: recipient,
				lamports: 1000,
			}),
		);
		const proof = btoa(
			String.fromCharCode(
				...tx.serialize({
					requireAllSignatures: false,
					verifySignatures: false,
				}),
			),
		);
		const request = new Request("https://app.degenfeed.xyz/api/x402/verify", {
			method: "POST",
			body: JSON.stringify({ proof }),
		});
		const res = await handleX402Verify(request, env);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(false);
	});

	it("rejects missing proof", async () => {
		const request = new Request("https://app.degenfeed.xyz/api/x402/verify", {
			method: "POST",
			body: "{}",
		});
		const res = await handleX402Verify(request, env);
		expect(res.status).toBe(400);
	});
});
