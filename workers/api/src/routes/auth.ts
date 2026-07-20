import { type Env, getGtsConfig, jsonResponse, rateLimit } from "../index";
import { validateBodySize } from "../sanitize";
import {
	consumeState as consumeOAuthState,
	generateOAuthState,
	REDDIT_STATE_PREFIX,
	storeState as storeOAuthState,
} from "./oauth-state";

const STATE_KEY_PREFIX = "gts:state:";
const STATE_TTL_SECONDS = 600;
const THREADS_STATE_PREFIX = "threads:state:";

function generateState(): string {
	return generateOAuthState();
}

async function storeState(
	env: Env,
	state: string,
	prefix = STATE_KEY_PREFIX,
): Promise<void> {
	await storeOAuthState(env, state, prefix);
}

async function consumeState(
	env: Env,
	state: string,
	prefix = STATE_KEY_PREFIX,
): Promise<boolean> {
	return consumeOAuthState(env, state, prefix);
}

/**
 * GET /api/auth/gotosocial/authorize?redirect=...
 *
 * Generates a CSRF `state` nonce, stores it in KV, and returns the
 * authorize URL the client should redirect the user to. The `state`
 * parameter must be echoed back to /api/auth/gotosocial/callback.
 */
export async function handleGtSAuthorize(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const rawRedirect = url.searchParams.get("redirect");
	const allowedRedirects = [
		getGtsConfig(env).redirectUri,
		"https://degenfeed.xyz/auth/callback",
		"https://app.degenfeed.xyz/auth/callback",
	];
	const redirect =
		rawRedirect && allowedRedirects.some((r) => rawRedirect.startsWith(r))
			? rawRedirect
			: getGtsConfig(env).redirectUri;
	const devMode =
		env.ALLOW_DEV_OAUTH === "true" && url.searchParams.get("dev") === "true";

	const ip =
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for") ||
		"unknown";
	const rl = await rateLimit(env, ip, "oauth:gts-authorize", 10, 60000);
	if (!rl.allowed) {
		return new Response(
			JSON.stringify({ error: "Rate limit", retryAfterMs: rl.retryAfter }),
			{
				status: 429,
				headers: {
					"content-type": "application/json",
					"retry-after": String(Math.ceil(rl.retryAfter / 1000)),
				},
			},
		);
	}

	const state = generateState();
	await storeState(env, state);

	const params = new URLSearchParams({
		client_id: getGtsConfig(env).clientId,
		redirect_uri: devMode ? "urn:ietf:wg:oauth:2.0:oob" : redirect,
		response_type: "code",
		scope: getGtsConfig(env).scopes,
		state,
	});
	const authorizeUrl = devMode
		? `http://127.0.0.1:8082/oauth/authorize?${params.toString()}`
		: `https://social.degenfeed.xyz/oauth/authorize?${params.toString()}`;

	return jsonResponse({
		authorizeUrl,
		state,
		instanceUrl: getGtsConfig(env).instanceUrl,
		dev: devMode,
	});
}

/**
 * POST /api/auth/gotosocial/callback
 * Body: { code: string, state: string, redirect_uri?: string }
 *
 * Verifies the `state` nonce against KV (CSRF protection) before exchanging
 * the OAuth authorization code for an access token.
 */
export async function handleGtSCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const bodySizeCheck = validateBodySize(request, 32 * 1024);
		if (!bodySizeCheck.ok)
			return jsonResponse({ error: bodySizeCheck.error }, 413);

		const body = (await request.json()) as {
			code?: string;
			state?: string;
			redirect_uri?: string;
		};
		if (!body.code) {
			return jsonResponse({ error: "Missing authorization code" }, 400);
		}
		if (!body.state) {
			return jsonResponse({ error: "Missing state nonce" }, 400);
		}

		const stateValid = await consumeState(env, body.state);
		if (!stateValid) {
			return jsonResponse({ error: "Invalid or expired state" }, 400);
		}

		const redirectUri = body.redirect_uri || getGtsConfig(env).redirectUri;
		const tokenRes = await fetch(`${getGtsConfig(env).apiBase}/oauth/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: getGtsConfig(env).clientId,
				client_secret: getGtsConfig(env).clientSecret,
				redirect_uri: redirectUri,
				code: body.code,
				scope: getGtsConfig(env).scopes,
			}).toString(),
		});

		if (!tokenRes.ok) {
			const errText = await tokenRes.text();
			return jsonResponse(
				{ error: "Token exchange failed", detail: errText },
				400,
			);
		}

		const tokenData = (await tokenRes.json()) as Record<string, unknown>;

		// Fetch user profile
		const accessToken = tokenData.access_token as string;
		const userRes = await fetch(
			`${getGtsConfig(env).apiBase}/api/v1/accounts/verify_credentials`,
			{
				headers: { authorization: `Bearer ${accessToken}` },
			},
		);
		const profile = userRes.ok
			? ((await userRes.json()) as Record<string, unknown>)
			: null;

		return jsonResponse({
			accessToken,
			refreshToken: tokenData.refresh_token,
			scope: tokenData.scope,
			createdAt: tokenData.created_at,
			expiresIn: tokenData.expires_in,
			tokenType: tokenData.token_type,
			profile: profile
				? {
						id: profile.id,
						username: profile.username,
						acct: profile.acct,
						displayName: profile.display_name,
						avatar: profile.avatar,
						url: profile.url,
					}
				: null,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Callback error";
		console.error(
			"[auth] handleGtSCallback failed:",
			err instanceof Error ? err.message : err,
		);
		return jsonResponse({ error: message }, 500);
	}
}

/**
 * POST /api/auth/gotosocial/register
 * Generates a state nonce and the authorize URL the user should visit.
 * The state must be echoed back to /api/auth/gotosocial/callback.
 */
export async function handleGtSRegister(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const redirect =
		url.searchParams.get("redirect") || getGtsConfig(env).redirectUri;
	const devMode = url.searchParams.get("dev") === "true";

	const ip =
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for") ||
		"unknown";
	const rl = await rateLimit(env, ip, "oauth:gts-register", 10, 60000);
	if (!rl.allowed) {
		return new Response(
			JSON.stringify({ error: "Rate limit", retryAfterMs: rl.retryAfter }),
			{
				status: 429,
				headers: {
					"content-type": "application/json",
					"retry-after": String(Math.ceil(rl.retryAfter / 1000)),
				},
			},
		);
	}

	const state = generateState();
	await storeState(env, state);

	const params = new URLSearchParams({
		client_id: getGtsConfig(env).clientId,
		redirect_uri: devMode ? "urn:ietf:wg:oauth:2.0:oob" : redirect,
		response_type: "code",
		scope: getGtsConfig(env).scopes,
		state,
		sign_up: "true",
	});
	const authorizeUrl = devMode
		? `http://127.0.0.1:8082/oauth/authorize?${params.toString()}`
		: `https://social.degenfeed.xyz/oauth/authorize?${params.toString()}`;

	return jsonResponse({
		success: true,
		message:
			"Redirect user to the authorize URL. They will be prompted to sign up if they do not have an account.",
		authorizeUrl,
		state,
		instanceUrl: getGtsConfig(env).instanceUrl,
	});
}

/**
 * GET /api/auth/threads/authorize
 *
 * Returns the Meta OAuth authorize URL for Threads.
 * Generates a CSRF state nonce stored in KV.
 */
export async function handleThreadsAuthorize(
	request: Request,
	env: Env,
): Promise<Response> {
	const appId = env.THREADS_APP_ID;
	if (!appId) {
		return jsonResponse(
			{ error: "Threads auth not configured (THREADS_APP_ID)" },
			501,
		);
	}

	const url = new URL(request.url);
	const redirectUri = `https://${url.hostname}/auth/callback/threads`;

	const ip =
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for") ||
		"unknown";
	const rl = await rateLimit(env, ip, "oauth:threads-authorize", 10, 60000);
	if (!rl.allowed) {
		return new Response(
			JSON.stringify({ error: "Rate limit", retryAfterMs: rl.retryAfter }),
			{
				status: 429,
				headers: {
					"content-type": "application/json",
					"retry-after": String(Math.ceil(rl.retryAfter / 1000)),
				},
			},
		);
	}

	const state = generateState();
	await storeState(env, state, THREADS_STATE_PREFIX);

	const authorizeUrl =
		`https://www.facebook.com/v22.0/dialog/oauth?` +
		new URLSearchParams({
			client_id: appId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "threads_basic,threads_content_publish",
			state,
		}).toString();

	return jsonResponse({ authorizeUrl, state });
}

/**
 * POST /api/auth/threads/callback
 * Body: { code, state }
 *
 * Exchanges the OAuth code for a Threads access token.
 * Uses a server-to-server call so the app secret never hits the client.
 */
export async function handleThreadsCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	const bodySizeCheck = validateBodySize(request, 32 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	const appId = env.THREADS_APP_ID;
	const appSecret = env.THREADS_APP_SECRET;
	if (!appId || !appSecret) {
		return jsonResponse({ error: "Threads auth not configured" }, 501);
	}

	try {
		const body = (await request.json()) as { code?: string; state?: string };
		if (!body.code)
			return jsonResponse({ error: "Missing authorization code" }, 400);
		if (!body.state) return jsonResponse({ error: "Missing state nonce" }, 400);

		const stateValid = await consumeState(
			env,
			body.state,
			THREADS_STATE_PREFIX,
		);
		if (!stateValid)
			return jsonResponse({ error: "Invalid or expired state" }, 400);

		const url = new URL(request.url);
		const redirectUri = `https://${url.hostname}/auth/callback/threads`;

		const res = await fetch(
			`https://graph.facebook.com/v22.0/oauth/access_token?` +
				new URLSearchParams({
					client_id: appId,
					client_secret: appSecret,
					redirect_uri: redirectUri,
					code: body.code,
					grant_type: "authorization_code",
				}).toString(),
		);
		if (!res.ok) {
			const errText = await res.text();
			return jsonResponse(
				{ error: `Token exchange failed: ${errText.slice(0, 200)}` },
				400,
			);
		}

		const data = (await res.json()) as {
			access_token?: string;
			user_id?: string;
			error?: { message?: string };
		};
		if (data.error?.message || !data.access_token) {
			return jsonResponse(
				{ error: data.error?.message ?? "No access token" },
				400,
			);
		}

		const shortLivedToken = data.access_token;
		const userId = data.user_id ?? "";

		let username = "";
		let name: string | undefined;
		let avatar: string | undefined;

		try {
			const profileRes = await fetch(
				`https://graph.threads.net/v1.0/${userId}?fields=id,username,name,profile_picture_url`,
				{ headers: { authorization: `Bearer ${shortLivedToken}` } },
			);
			if (profileRes.ok) {
				const profile = (await profileRes.json()) as {
					username?: string;
					name?: string;
					profile_picture_url?: string;
				};
				username = profile.username ?? "";
				name = profile.name;
				avatar = profile.profile_picture_url;
			}
		} catch (err) {
			console.warn(
				"[auth] Threads profile fetch failed:",
				err instanceof Error ? err.message : err,
			);
		}

		return jsonResponse({
			userId,
			username,
			name,
			avatar,
			accessToken: shortLivedToken,
		});
	} catch (err) {
		console.error(
			"[auth] handleThreadsCallback failed:",
			err instanceof Error ? err.message : err,
		);
		return jsonResponse({ error: (err as Error).message }, 500);
	}
}

/**
 * GET /api/auth/warpcast/authorize
 *
 * Returns the Warpcast (Farcaster) OAuth authorize URL.
 * Uses Farcaster's OAuth flow at auth.farcaster.xyz.
 */
export async function handleWarpcastAuthorize(
	request: Request,
	env: Env,
): Promise<Response> {
	const appId = env.FARCASTER_CLIENT_ID;
	if (!appId) {
		return jsonResponse(
			{ error: "Warpcast auth not configured (FARCASTER_CLIENT_ID)" },
			501,
		);
	}

	const ip =
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for") ||
		"unknown";
	const rl = await rateLimit(env, ip, "oauth:warpcast-authorize", 10, 60000);
	if (!rl.allowed) {
		return new Response(
			JSON.stringify({ error: "Rate limit", retryAfterMs: rl.retryAfter }),
			{
				status: 429,
				headers: {
					"content-type": "application/json",
					"retry-after": String(Math.ceil(rl.retryAfter / 1000)),
				},
			},
		);
	}

	const state = generateState();
	await storeState(env, state, "warpcast:state:");

	const url = new URL(request.url);
	const redirectUri = `https://${url.hostname}/auth/callback/warpcast`;

	const authorizeUrl =
		`https://auth.farcaster.xyz/v1/auth/authorize?` +
		new URLSearchParams({
			client_id: appId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "read write",
			state,
		}).toString();

	return jsonResponse({ authorizeUrl, state });
}

/**
 * POST /api/auth/warpcast/callback
 * Body: { code, state }
 *
 * Exchanges the Farcaster OAuth code for an access token.
 */
export async function handleWarpcastCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const bodySizeCheck = validateBodySize(request, 32 * 1024);
		if (!bodySizeCheck.ok)
			return jsonResponse({ error: bodySizeCheck.error }, 413);

		const body = (await request.json()) as { code?: string; state?: string };
		if (!body.code)
			return jsonResponse({ error: "Missing authorization code" }, 400);
		if (!body.state) return jsonResponse({ error: "Missing state nonce" }, 400);

		const stateValid = await consumeState(env, body.state, "warpcast:state:");
		if (!stateValid)
			return jsonResponse({ error: "Invalid or expired state" }, 400);

		const res = await fetch("https://auth.farcaster.xyz/v1/auth/token", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ code: body.code }),
		});
		if (!res.ok) {
			const errText = await res.text();
			return jsonResponse(
				{ error: `Warpcast token exchange failed: ${errText.slice(0, 200)}` },
				400,
			);
		}

		const data = (await res.json()) as {
			access_token?: string;
			user?: {
				fid?: number;
				username?: string;
				display_name?: string;
				pfp_url?: string;
			};
		};
		if (!data.access_token) {
			return jsonResponse({ error: "No access token returned" }, 400);
		}

		return jsonResponse({
			accessToken: data.access_token,
			fid: data.user?.fid,
			username: data.user?.username,
			displayName: data.user?.display_name,
			avatar: data.user?.pfp_url,
		});
	} catch (err) {
		console.error(
			"[auth] handleWarpcastCallback failed:",
			err instanceof Error ? err.message : err,
		);
		return jsonResponse({ error: (err as Error).message }, 500);
	}
}

/**
 * POST /api/auth/reddit/callback
 * Body: { code, redirect_uri }
 *
 * Exchanges the Reddit OAuth code for an access token.
 * Reddit uses basic auth (appId:appSecret) in the Authorization header.
 */
export async function handleRedditCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	const bodySizeCheck = validateBodySize(request, 32 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	const appId = env.REDDIT_CLIENT_ID;
	const appSecret = env.REDDIT_CLIENT_SECRET;
	if (!appId || !appSecret) {
		return jsonResponse(
			{
				error:
					"Reddit auth not configured (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET)",
			},
			501,
		);
	}

	try {
		const body = (await request.json()) as {
			code?: string;
			redirect_uri?: string;
			state?: string;
		};
		if (!body.code)
			return jsonResponse({ error: "Missing authorization code" }, 400);

		if (!body.state) return jsonResponse({ error: "Missing state nonce" }, 400);
		const stateValid = await consumeState(env, body.state, REDDIT_STATE_PREFIX);
		if (!stateValid)
			return jsonResponse({ error: "Invalid or expired state" }, 400);

		const redirectUri =
			body.redirect_uri ||
			`https://${new URL(request.url).hostname}/auth/callback/reddit`;
		const auth = btoa(`${appId}:${appSecret}`);

		const res = await fetch("https://www.reddit.com/api/v1/access_token", {
			method: "POST",
			headers: {
				authorization: `Basic ${auth}`,
				"content-type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code: body.code,
				redirect_uri: redirectUri,
			}).toString(),
		});
		if (!res.ok) {
			const errText = await res.text();
			return jsonResponse(
				{ error: `Reddit token exchange failed: ${errText.slice(0, 200)}` },
				400,
			);
		}

		const data = (await res.json()) as {
			access_token?: string;
			refresh_token?: string;
			expires_in?: number;
			scope?: string;
		};
		if (!data.access_token) {
			return jsonResponse({ error: "No access token returned" }, 400);
		}

		let username = "";
		let avatar: string | undefined;
		try {
			const profileRes = await fetch("https://oauth.reddit.com/api/v1/me", {
				headers: {
					authorization: `Bearer ${data.access_token}`,
					"user-agent": "degenfeed/1.0",
				},
			});
			if (profileRes.ok) {
				const profile = (await profileRes.json()) as {
					name?: string;
					icon_img?: string;
				};
				username = profile.name ?? "";
				avatar = profile.icon_img;
			}
		} catch (err) {
			console.warn(
				"[auth] Reddit profile fetch failed:",
				err instanceof Error ? err.message : err,
			);
		}

		return jsonResponse({
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresIn: data.expires_in,
			scope: data.scope,
			username,
			avatar,
		});
	} catch (err) {
		console.error(
			"[auth] handleRedditCallback failed:",
			err instanceof Error ? err.message : err,
		);
		return jsonResponse({ error: (err as Error).message }, 500);
	}
}
