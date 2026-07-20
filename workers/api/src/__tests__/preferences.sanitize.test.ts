import { describe, expect, it } from "vitest";

import { sanitizePrefs } from "../routes/preferences";

describe("sanitizePrefs", () => {
	it("applies sensible defaults when given empty body", () => {
		const out = sanitizePrefs({});
		expect(out.hideLowQuality).toBe(false);
		expect(out.diversityBoost).toBe(true);
		expect(out.preferredNiches).toEqual([]);
		expect(out.preferredPlatforms).toEqual([]);
		expect(out.mutedNiches).toEqual([]);
		expect(out.recencyWeight).toBe(1);
		expect(out.engagementWeight).toBe(1);
		expect(out.updatedAt).toBeGreaterThan(0);
	});

	it("lowercases niches and drops empty strings", () => {
		const out = sanitizePrefs({
			preferredNiches: ["Bitcoin", "ETHEREUM", "", "  ", "defi"],
			mutedNiches: ["ScamCoin"],
		});
		expect(out.preferredNiches).toEqual(["bitcoin", "ethereum", "defi"]);
		expect(out.mutedNiches).toEqual(["scamcoin"]);
	});

	it("clamps out-of-range weights to [0.1, 5]", () => {
		const out = sanitizePrefs({ recencyWeight: 99, engagementWeight: -2 });
		expect(out.recencyWeight).toBe(5);
		expect(out.engagementWeight).toBe(0.1);
	});

	it("falls back to defaults for non-numeric weights", () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing invalid input shape
		const out = sanitizePrefs({
			recencyWeight: "foo",
			engagementWeight: NaN,
		} as any);
		expect(out.recencyWeight).toBe(1);
		expect(out.engagementWeight).toBe(1);
	});

	it("preserves hideLowQuality boolean", () => {
		expect(sanitizePrefs({ hideLowQuality: true }).hideLowQuality).toBe(true);
		expect(sanitizePrefs({ hideLowQuality: false }).hideLowQuality).toBe(false);
	});

	it("filters non-string platforms", () => {
		const out = sanitizePrefs({
			// biome-ignore lint/suspicious/noExplicitAny: test fixture
			preferredPlatforms: ["nostr", 42, null, "bluesky"] as any,
		});
		expect(out.preferredPlatforms).toEqual(["nostr", "bluesky"]);
	});

	// ── New quality filter tests ─────────────────────────────────────

	it("preserves showOriginalContent boolean", () => {
		expect(
			sanitizePrefs({ showOriginalContent: true }).showOriginalContent,
		).toBe(true);
		expect(
			sanitizePrefs({ showOriginalContent: false }).showOriginalContent,
		).toBe(false);
		expect(sanitizePrefs({}).showOriginalContent).toBe(false);
	});

	it("clamps minEngagement to valid range", () => {
		expect(sanitizePrefs({ minEngagement: 5 }).minEngagement).toBe(5);
		expect(sanitizePrefs({ minEngagement: -1 }).minEngagement).toBe(0);
		expect(sanitizePrefs({ minEngagement: 9999 }).minEngagement).toBe(1000);
		expect(sanitizePrefs({}).minEngagement).toBe(0);
	});

	it("clamps maxPerNiche to valid range", () => {
		expect(sanitizePrefs({ maxPerNiche: 3 }).maxPerNiche).toBe(3);
		expect(sanitizePrefs({ maxPerNiche: 0 }).maxPerNiche).toBe(1);
		expect(sanitizePrefs({ maxPerNiche: 99 }).maxPerNiche).toBe(20);
		expect(sanitizePrefs({}).maxPerNiche).toBe(5);
	});

	it("preserves interleaveProtocols boolean", () => {
		expect(
			sanitizePrefs({ interleaveProtocols: false }).interleaveProtocols,
		).toBe(false);
		expect(
			sanitizePrefs({ interleaveProtocols: true }).interleaveProtocols,
		).toBe(true);
		expect(sanitizePrefs({}).interleaveProtocols).toBe(true);
	});
});
