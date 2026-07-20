import { Connection, Keypair } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../index";
import { handleBlinkTip } from "../routes/blink";

const env: Env = {};
const VALID_SENDER = Keypair.generate().publicKey.toBase58();
const VALID_RECIPIENT = Keypair.generate().publicKey.toBase58();

describe("handleBlinkTip", () => {
	it("returns Solana Action spec on GET", async () => {
		const request = new Request("https://app.degenfeed.xyz/api/blink/tip");
		const res = await handleBlinkTip(request, env);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			title: string;
			links: { actions: Array<{ href: string }> };
		};
		expect(body.title).toBe("Tip on DegenFeed");
		expect(body.links.actions[0]?.href).toContain(
			"/api/blink/tip?recipient={recipient}&amount={amount}",
		);
	});

	it("returns a base64 transaction on POST", async () => {
		vi.spyOn(Connection.prototype, "getLatestBlockhash").mockResolvedValue({
			blockhash: "4M5xYZx7nTByfFV9KxGj69acpmFDJyEQLM26Gc3x1j6Y",
			lastValidBlockHeight: 123456789,
		});
		const request = new Request(
			`https://app.degenfeed.xyz/api/blink/tip?recipient=${encodeURIComponent(VALID_RECIPIENT)}&amount=0.001`,
			{
				method: "POST",
				body: JSON.stringify({ account: VALID_SENDER }),
			},
		);
		const res = await handleBlinkTip(request, env);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { transaction?: string };
		expect(body.transaction).toBeDefined();
		expect(body.transaction?.length).toBeGreaterThan(0);
	});

	it("rejects invalid recipient", async () => {
		const request = new Request(
			"https://app.degenfeed.xyz/api/blink/tip?recipient=bad&amount=0.001",
			{
				method: "POST",
				body: JSON.stringify({ account: VALID_SENDER }),
			},
		);
		const res = await handleBlinkTip(request, env);
		expect(res.status).toBe(400);
	});

	it("rejects amount above max", async () => {
		const request = new Request(
			`https://app.degenfeed.xyz/api/blink/tip?recipient=${encodeURIComponent(VALID_RECIPIENT)}&amount=2`,
			{
				method: "POST",
				body: JSON.stringify({ account: VALID_SENDER }),
			},
		);
		const res = await handleBlinkTip(request, env);
		expect(res.status).toBe(400);
	});
});
