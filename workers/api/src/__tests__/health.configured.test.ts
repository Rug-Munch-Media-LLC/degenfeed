import { describe, expect, it, vi } from "vitest";

const sockets: Array<{
	onopen: (() => void) | null;
	onclose: (() => void) | null;
	onerror: ((event?: unknown) => void) | null;
	close: () => void;
	readyState: number;
}> = [];
vi.stubGlobal(
	"WebSocket",
	vi.fn().mockImplementation(() => {
		const ws = {
			onopen: null,
			onclose: null,
			onerror: null,
			close: vi.fn(),
			readyState: 0,
		};
		sockets.push(ws);
		return ws;
	}),
);

import type { Env } from "../index";
import { handleRelaysHealth } from "../routes/health";

describe("handleRelaysHealth (configured)", () => {
	it("should return relay status", { timeout: 5000 }, async () => {
		const env: Env = { RELAY_URLS: "wss://relay.damus.io" };
		const resPromise = handleRelaysHealth(env);
		await new Promise((r) => setTimeout(r, 10));
		for (const ws of sockets) {
			if (typeof ws.onopen === "function") ws.onopen();
		}
		sockets.length = 0;
		const res = await resPromise;
		expect(res.status).toBe(200);
	});
});
