import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStateStore = new Map<string, string>();

const mockCache = {
	put: vi.fn(async (key: string, value: string) => {
		mockStateStore.set(key, value);
	}),
	get: vi.fn(async (key: string) => mockStateStore.get(key) ?? null),
	delete: vi.fn(async (key: string) => {
		mockStateStore.delete(key);
	}),
} as unknown as KVNamespace;

const env: {
	CACHE: KVNamespace;
	GTS_CLIENT_ID?: string;
	GTS_INSTANCE_URL?: string;
} = {
	CACHE: mockCache,
	GTS_CLIENT_ID: "test-client-id",
	GTS_INSTANCE_URL: "https://social.degenfeed.xyz",
};

vi.mock("@degenfeed/types", () => ({}));

import { handleGtSAuthorize, handleGtSCallback } from "../routes/auth";

describe("GTS OAuth state nonce", () => {
	beforeEach(() => {
		mockStateStore.clear();
		(mockCache.put as ReturnType<typeof vi.fn>).mockClear();
		(mockCache.get as ReturnType<typeof vi.fn>).mockClear();
		(mockCache.delete as ReturnType<typeof vi.fn>).mockClear();
	});

	it("authorize returns a state nonce and stores it in KV", async () => {
		const req = new Request("http://localhost/api/auth/gotosocial/authorize");
		const res = await handleGtSAuthorize(req, env);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { state: string; authorizeUrl: string };
		expect(body.state).toMatch(/^[0-9a-f]{32}$/);
		expect(body.authorizeUrl).toContain(`state=${body.state}`);
		expect(mockStateStore.has(`gts:state:${body.state}`)).toBe(true);
	});

	it("callback rejects a missing state", async () => {
		const req = new Request("http://localhost/api/auth/gotosocial/callback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ code: "abc" }),
		});
		const res = await handleGtSCallback(req, env);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/state/i);
	});

	it("callback rejects an unknown state", async () => {
		const req = new Request("http://localhost/api/auth/gotosocial/callback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ code: "abc", state: "never-issued" }),
		});
		const res = await handleGtSCallback(req, env);
		expect(res.status).toBe(400);
	});

	it("callback consumes a valid state (no replay)", async () => {
		const authRes = await handleGtSAuthorize(
			new Request("http://localhost/api/auth/gotosocial/authorize"),
			env,
		);
		const { state } = (await authRes.json()) as { state: string };

		// First callback with valid state: GTS is mocked via global fetch so
		// we don't have a real OAuth server, but the route reaches the token
		// exchange. Mock fetch to fail loudly so the request returns 500 with
		// a useful error (not 400). What we care about is that the state was
		// consumed BEFORE the token exchange.
		const before = mockStateStore.has(`gts:state:${state}`);
		expect(before).toBe(true);

		// The token exchange will fail in this unit test (no real GTS) — we
		// only assert that the state was consumed, not the response status.
		const fakeRes = new Response("{}", { status: 200 });
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(fakeRes)
			.mockResolvedValueOnce(new Response("{}", { status: 200 }));

		try {
			await handleGtSCallback(
				new Request("http://localhost/api/auth/gotosocial/callback", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ code: "abc", state }),
				}),
				env,
			);
		} catch {
			/* ignore — we only care about state consumption */
		}

		expect(mockStateStore.has(`gts:state:${state}`)).toBe(false);
		fetchSpy.mockRestore();
	});
});
