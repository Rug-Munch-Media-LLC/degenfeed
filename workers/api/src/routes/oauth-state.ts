import type { Env } from "../index";

export const GOOGLE_STATE_PREFIX = "google:state:";
export const GITHUB_STATE_PREFIX = "github:state:";
export const DISCORD_STATE_PREFIX = "discord:state:";
export const TWITTER_STATE_PREFIX = "twitter:state:";
export const TELEGRAM_STATE_PREFIX = "telegram:state:";
export const REDDIT_STATE_PREFIX = "reddit:state:";
export const MEDIUM_STATE_PREFIX = "medium:state:";
export const YOUTUBE_STATE_PREFIX = "youtube:state:";
export const LINKEDIN_STATE_PREFIX = "linkedin:state:";
export const INSTAGRAM_STATE_PREFIX = "instagram:state:";
export const PINTEREST_STATE_PREFIX = "pinterest:state:";
export const TIKTOK_STATE_PREFIX = "tiktok:state:";
const STATE_TTL_SECONDS = 600;

export function generateOAuthState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function storeState(
	env: Env,
	state: string,
	prefix: string,
): Promise<void> {
	if (!env.CACHE) return;
	try {
		await env.CACHE.put(prefix + state, "1", {
			expirationTtl: STATE_TTL_SECONDS,
		});
	} catch (err) {
		console.warn(
			"[oauth-state] storeState failed:",
			err instanceof Error ? err.message : err,
		);
	}
}

export async function consumeState(
	env: Env,
	state: string,
	prefix: string,
): Promise<boolean> {
	if (!env.CACHE) {
		console.warn("[oauth-state] KV/CACHE unavailable — CSRF validation denied");
		return false;
	}
	try {
		const existing = await env.CACHE.get(prefix + state);
		if (!existing) return false;
		await env.CACHE.delete(prefix + state);
		return true;
	} catch (err) {
		console.warn(
			"[oauth-state] consumeState failed:",
			err instanceof Error ? err.message : err,
		);
		return false;
	}
}
