import { beforeEach, describe, expect, it, vi } from "vitest";

// Plain class (not vi.fn) so the shared afterEach(vi.restoreAllMocks) in
// test-setup.ts cannot strip the implementation between tests.
vi.mock("@degenfeed/nostr-sdk", () => ({
	RelayPool: class {
		async list() {
			return [
				{
					id: "a".repeat(64),
					pubkey: "b".repeat(64),
					created_at: 1_700_000_100,
					kind: 1,
					tags: [],
					content: "native nostr reply",
				},
			];
		}
		disconnectAll() {}
	},
}));

import type { Env } from "../index";
import {
	handleUnifiedThread,
	parseDfUri,
	recordThreadRelationship,
	storeCrosspostSiblings,
} from "../routes/thread";

interface KVEntry {
	value: string;
}

function makeKv(seed: Record<string, string> = {}) {
	const store = new Map<string, KVEntry>(
		Object.entries(seed).map(([k, v]) => [k, { value: v }]),
	);
	return {
		store,
		get: vi.fn(async (key: string, type?: string) => {
			const entry = store.get(key);
			if (!entry) return null;
			return type === "json" ? JSON.parse(entry.value) : entry.value;
		}),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, { value });
		}),
		list: vi.fn(async ({ prefix }: { prefix: string }) => ({
			keys: [...store.keys()]
				.filter((k) => k.startsWith(prefix))
				.map((name) => ({ name })),
			list_complete: true,
		})),
	};
}

describe("parseDfUri", () => {
	it("parses df:// URIs", () => {
		expect(parseDfUri("df://nostr:abc123")).toEqual({
			dfUri: "df://nostr:abc123",
			protocol: "nostr",
			nativeId: "abc123",
		});
	});

	it("parses bare protocol:id and URL-encoded forms", () => {
		expect(parseDfUri("farcaster:0xdeadbeef")?.dfUri).toBe(
			"df://farcaster:0xdeadbeef",
		);
		expect(parseDfUri(encodeURIComponent("df://mastodon:42"))?.protocol).toBe(
			"mastodon",
		);
	});

	it("rejects unknown protocols and malformed input", () => {
		expect(parseDfUri("df://notreal:1")).toBeNull();
		expect(parseDfUri("nocolon")).toBeNull();
	});
});

describe("handleUnifiedThread", () => {
	let kv: ReturnType<typeof makeKv>;

	beforeEach(() => {
		kv = makeKv();
	});

	it("rejects non-GET and invalid URIs", async () => {
		const post = new Request("http://localhost/api/thread/x", {
			method: "POST",
		});
		expect(
			(await handleUnifiedThread(post, {} as Env, "df://nostr:1")).status,
		).toBe(405);

		const get = new Request("http://localhost/api/thread/x");
		expect((await handleUnifiedThread(get, {} as Env, "garbage")).status).toBe(
			400,
		);
	});

	it("merges native and bridge replies with protocol metadata", async () => {
		const dfUri = `df://nostr:${"c".repeat(64)}`;
		kv.store.set(`bridge:reply:${dfUri}:farcaster:0xcast`, {
			value: JSON.stringify({
				parentPostUri: dfUri,
				parentProtocol: "nostr",
				replyProtocol: "farcaster",
				replyId: "0xcast",
				content: "bridged from farcaster",
				timestamp: 1_700_000_200_000,
				walletAddress: "0x1234567890abcdef1234",
			}),
		});
		const env = { CACHE: kv } as unknown as Env;
		const req = new Request(
			`http://localhost/api/thread/${encodeURIComponent(dfUri)}`,
		);
		const res = await handleUnifiedThread(req, env, encodeURIComponent(dfUri));
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			replies: Array<{ protocol: string; bridged?: boolean; text: string }>;
			protocols: string[];
			bridgeCount: number;
			byProtocol: Record<string, number>;
		};
		expect(body.replies.length).toBe(2);
		expect(body.protocols).toContain("nostr");
		expect(body.protocols).toContain("farcaster");
		expect(body.bridgeCount).toBe(1);
		expect(body.byProtocol.farcaster).toBe(1);
		const bridged = body.replies.find((r) => r.bridged);
		expect(bridged?.protocol).toBe("farcaster");
		expect(bridged?.text).toBe("bridged from farcaster");
	});

	it("sorts by protocol when requested", async () => {
		const dfUri = `df://nostr:${"d".repeat(64)}`;
		kv.store.set(`bridge:reply:${dfUri}:mastodon:99`, {
			value: JSON.stringify({
				parentPostUri: dfUri,
				parentProtocol: "nostr",
				replyProtocol: "mastodon",
				replyId: "99",
				content: "toot reply",
				timestamp: 1,
				walletAddress: "w",
			}),
		});
		const env = { CACHE: kv } as unknown as Env;
		const req = new Request(
			`http://localhost/api/thread/${encodeURIComponent(dfUri)}?sort=protocol`,
		);
		const res = await handleUnifiedThread(req, env, encodeURIComponent(dfUri));
		const body = (await res.json()) as {
			replies: Array<{ protocol: string }>;
			sort: string;
		};
		expect(body.sort).toBe("protocol");
		expect(body.replies.map((r) => r.protocol)).toEqual(["mastodon", "nostr"]);
	});
});

describe("recordThreadRelationship", () => {
	it("creates root edges and nests grandchildren under the root thread", async () => {
		const kv = makeKv();
		const env = { CACHE: kv } as unknown as Env;
		const root = "df://nostr:rootid";

		await recordThreadRelationship(
			env,
			root,
			"df://farcaster:child1",
			"farcaster",
		);
		let edges = JSON.parse(
			kv.store.get(`bridge:reply:thread:${root}`)?.value ?? "[]",
		);
		expect(edges).toEqual([
			{
				replyUri: "df://farcaster:child1",
				parentUri: root,
				protocol: "farcaster",
				depth: 1,
			},
		]);

		// Reply to the bridge reply — must attach to the ROOT thread at depth 2
		await recordThreadRelationship(
			env,
			"df://farcaster:child1",
			"df://mastodon:gc1",
			"mastodon",
		);
		edges = JSON.parse(
			kv.store.get(`bridge:reply:thread:${root}`)?.value ?? "[]",
		);
		expect(edges).toHaveLength(2);
		expect(edges[1]).toEqual({
			replyUri: "df://mastodon:gc1",
			parentUri: "df://farcaster:child1",
			protocol: "mastodon",
			depth: 2,
		});
	});

	it("does not duplicate edges for the same reply URI", async () => {
		const kv = makeKv();
		const env = { CACHE: kv } as unknown as Env;
		await recordThreadRelationship(
			env,
			"df://nostr:r",
			"df://mastodon:x",
			"mastodon",
		);
		await recordThreadRelationship(
			env,
			"df://nostr:r",
			"df://mastodon:x",
			"mastodon",
		);
		const edges = JSON.parse(
			kv.store.get("bridge:reply:thread:df://nostr:r")?.value ?? "[]",
		);
		expect(edges).toHaveLength(1);
	});
});

describe("storeCrosspostSiblings", () => {
	it("stores a sibling map for each successful target", async () => {
		const kv = makeKv();
		const env = { CACHE: kv } as unknown as Env;
		await storeCrosspostSiblings(env, {
			nostr: { ok: true, hash: "n1" },
			farcaster: { ok: true, hash: "0xf1" },
			lens: { ok: false, error: "nope" },
		});
		const nostrMap = JSON.parse(
			kv.store.get("crosspost:df://nostr:n1")?.value ?? "null",
		);
		const fcMap = JSON.parse(
			kv.store.get("crosspost:df://farcaster:0xf1")?.value ?? "null",
		);
		expect(nostrMap).toEqual(fcMap);
		expect(nostrMap).toEqual([
			{ protocol: "nostr", nativeId: "n1" },
			{ protocol: "farcaster", nativeId: "0xf1" },
		]);
	});

	it("skips single-target publishes", async () => {
		const kv = makeKv();
		const env = { CACHE: kv } as unknown as Env;
		await storeCrosspostSiblings(env, { nostr: { ok: true, hash: "solo" } });
		expect(kv.store.size).toBe(0);
	});
});
