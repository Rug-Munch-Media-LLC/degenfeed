/**
 * CORS allowlist — env-driven.
 *
 * Origins are read from the `ALLOWED_ORIGINS` env var (comma-separated).
 * Set via wrangler.toml [vars] per environment:
 *   ALLOWED_ORIGINS = "https://degenfeed.xyz,https://app.degenfeed.xyz"
 *
 * Fallback origins are hardcoded for local development so `wrangler dev`
 * works without configuration.
 */

const FALLBACK_ALLOWED_ORIGINS = [
	"https://degenfeed.xyz",
	"https://app.degenfeed.xyz",
	"https://social.degenfeed.xyz",
	"http://localhost:3000",
	"http://127.0.0.1:3000",
] as const;

let cachedAllowlist: Set<string> | null = null;
let cachedAllowlistKey: string | null = null;

function buildAllowlist(envAllowlist?: string): Set<string> {
	const src =
		envAllowlist && envAllowlist.trim().length > 0
			? envAllowlist
			: FALLBACK_ALLOWED_ORIGINS.join(",");
	return new Set(
		src
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean),
	);
}

export function getAllowedOriginSet(envAllowlist?: string): Set<string> {
	const key = envAllowlist ?? "";
	if (cachedAllowlist && cachedAllowlistKey === key) return cachedAllowlist;
	cachedAllowlist = buildAllowlist(envAllowlist);
	cachedAllowlistKey = key;
	return cachedAllowlist;
}

export function isAllowedOrigin(
	origin: string | null | undefined,
	envAllowlist?: string,
): boolean {
	if (!origin) return false;
	return getAllowedOriginSet(envAllowlist).has(origin.toLowerCase());
}

export function parseOriginHeader(header: string | null): string | null {
	if (!header) return null;
	try {
		return new URL(header).origin;
	} catch {
		return null;
	}
}

export function getAllowedOrigin(
	request: Request,
	envAllowlist?: string,
): string | null {
	const origin = request.headers.get("origin");
	if (!origin) return null;
	return isAllowedOrigin(origin, envAllowlist) ? origin : null;
}

export function corsHeaders(origin: string | null): Headers {
	const headers = new Headers();
	if (origin) {
		headers.set("Access-Control-Allow-Origin", origin);
		headers.set("Access-Control-Allow-Credentials", "true");
	}
	headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS",
	);
	headers.set(
		"Access-Control-Allow-Headers",
		"content-type, authorization, x-csrf-token",
	);
	headers.set(
		"Access-Control-Expose-Headers",
		"X-Payment-Required, X-CSRF-Token",
	);
	return headers;
}

export function applyCors(response: Response, origin: string | null): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of corsHeaders(origin)) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
