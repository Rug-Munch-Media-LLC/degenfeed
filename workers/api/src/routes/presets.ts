/**
 * /api/presets — Protocol quality preset storage (KV-backed)
 *
 * Stores per-protocol preset selections in KV at
 * `user:preset:{wallet}:{protocol}` so they persist across sessions.
 *
 * Auth: requires a valid session cookie (`__Host-dfid`).
 *
 * GET  /api/presets              → all presets for this user
 * GET  /api/presets?protocol=X   → preset for one protocol
 * POST /api/presets              → save preset for a protocol
 */

import {
	PRESET_NAMES,
	type PresetName,
	presetKvKey,
} from "@degenfeed/feed-core";
import { type Env, jsonResponse, noCacheJsonResponse } from "../index";
import { validateBodySize } from "../sanitize";
import { requireSession } from "../session";

export interface StoredPresetEntry {
	presetName: PresetName;
	updatedAt: number;
}

function isValidPresetName(name: unknown): name is PresetName {
	return PRESET_NAMES.includes(name as PresetName);
}

export async function handleFeedPresets(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	const wallet = session.address.toLowerCase();

	if (request.method === "GET") {
		const url = new URL(request.url);
		const protocol = url.searchParams.get("protocol");

		try {
			if (protocol) {
				// Return preset for a specific protocol
				const raw = await env.CACHE?.get(presetKvKey(wallet, protocol));
				if (raw) {
					return noCacheJsonResponse(JSON.parse(raw) as StoredPresetEntry);
				}
				// Default: quality preset for known protocols
				return noCacheJsonResponse({
					presetName: "quality" as PresetName,
					updatedAt: 0,
				} satisfies StoredPresetEntry);
			}

			// Return ALL presets for this user
			// Scan for `user:preset:{wallet}:` prefix keys
			const allPresets: Record<string, StoredPresetEntry> = {};
			if (env.CACHE?.list) {
				const prefix = `user:preset:${wallet}:`;
				const listing = await env.CACHE.list({ prefix });
				for (const key of listing.keys) {
					const raw = await env.CACHE.get(key.name);
					if (raw) {
						const protocolName = key.name.replace(prefix, "");
						allPresets[protocolName] = JSON.parse(raw) as StoredPresetEntry;
					}
				}
			}
			return noCacheJsonResponse(allPresets);
		} catch (err) {
			console.warn(
				"[presets] GET failed:",
				err instanceof Error ? err.message : err,
			);
			return jsonResponse({ error: "Failed to read presets" }, 500);
		}
	}

	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const bodySizeCheck = validateBodySize(request, 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	let body: { presetName?: unknown; protocol?: string };
	try {
		body = (await request.json()) as {
			presetName?: unknown;
			protocol?: string;
		};
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}

	if (!isValidPresetName(body.presetName)) {
		return jsonResponse(
			{
				error: `Invalid preset name. Must be one of: ${PRESET_NAMES.join(", ")}`,
			},
			400,
		);
	}

	const protocol = body.protocol ?? "unified";

	try {
		const entry: StoredPresetEntry = {
			presetName: body.presetName,
			updatedAt: Date.now(),
		};
		await env.CACHE?.put(presetKvKey(wallet, protocol), JSON.stringify(entry), {
			expirationTtl: 60 * 60 * 24 * 400, // 400 days
		});
		return noCacheJsonResponse({ ok: true, preset: entry });
	} catch (err) {
		console.warn(
			"[presets] POST failed:",
			err instanceof Error ? err.message : err,
		);
		return jsonResponse({ error: "Failed to save preset" }, 500);
	}
}
