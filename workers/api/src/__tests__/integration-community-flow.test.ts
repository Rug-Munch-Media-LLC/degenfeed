/**
 * @degenfeed/api — Integration test: Community flow
 *
 * Tests browse → join → content flow for cross-protocol communities.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@degenfeed/feed-providers", () => ({
	NostrProvider: vi.fn(() => ({
		fetchFeed: vi.fn().mockResolvedValue({ posts: [] }),
		healthCheck: vi.fn(),
	})),
}));

describe("Community flow: browse → community feed", () => {
	it("should list available communities", async () => {
		const { handleCommunitiesList } = await import("../routes/community");
		const req = new Request("http://localhost/api/communities");
		const env = {
			COMMUNITIES: {
				list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
				get: vi.fn(),
				put: vi.fn(),
			},
			// biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
		} as any;
		const res = await handleCommunitiesList(req, env);
		expect(res.status).toBe(200);
	});

	it("should return community feed", async () => {
		const { handleCommunityFeed } = await import("../routes/community");
		const req = new Request("http://localhost/api/community/crypto/feed");
		const env = {
			COMMUNITIES: {
				get: vi.fn().mockImplementation(async (key: string) => {
					// Return a mock community for the communityKey lookup
					if (key.startsWith("community:")) {
						return JSON.stringify({
							id: "crypto",
							name: "Crypto",
							memberCount: 1,
						});
					}
					return null;
				}),
				put: vi.fn(),
			},
			// biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
		} as any;
		const res = await handleCommunityFeed(req, env, "crypto");
		expect(res.status).toBe(200);
	});
});
