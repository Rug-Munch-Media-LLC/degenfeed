import { type Env, jsonResponse, rateLimit } from "../index";
import { validateBodySize } from "../sanitize";
import {
	consumeState,
	DISCORD_STATE_PREFIX,
	GITHUB_STATE_PREFIX,
	GOOGLE_STATE_PREFIX,
	generateOAuthState,
	REDDIT_STATE_PREFIX,
	storeState,
	TELEGRAM_STATE_PREFIX,
	TWITTER_STATE_PREFIX,
} from "./oauth-state";

// ─── Rate limit helper ─────────────────────────────────────────────

async function checkRateLimit(
	request: Request,
	env: Env,
	key: string,
	maxReqs = 10,
	windowMs = 60_000,
): Promise<Response | null> {
	const ip =
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for") ||
		"unknown";
	const rl = await rateLimit(env, ip, key, maxReqs, windowMs);
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
	return null;
}

// ─── Google OAuth ───────────────────────────────────────────────────

export async function handleGoogleAuthorize(
	request: Request,
	env: Env,
): Promise<Response> {
	const clientId = env.GOOGLE_CLIENT_ID;
	if (!clientId)
		return jsonResponse({ error: "Google auth not configured" }, 501);

	const rlResponse = await checkRateLimit(
		request,
		env,
		"oauth:google-authorize",
	);
	if (rlResponse) return rlResponse;

	const state = generateOAuthState();
	await storeState(env, state, GOOGLE_STATE_PREFIX);

	const url = new URL(request.url);
	const redirectUri = `${url.protocol}//${url.hostname}/auth/callback/google`;
	const authorizeUrl =
		"https://accounts.google.com/o/oauth2/v2/auth?" +
		new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "openid email profile",
			state,
			access_type: "offline",
			prompt: "consent",
		}).toString();

	return jsonResponse({ authorizeUrl, state });
}

export async function handleGoogleCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	const bodySizeCheck = validateBodySize(request, 32 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	const clientId = env.GOOGLE_CLIENT_ID;
	const clientSecret = env.GOOGLE_CLIENT_SECRET;
	if (!clientId || !clientSecret)
		return jsonResponse({ error: "Google auth not configured" }, 501);

	try {
		const body = (await request.json()) as { code?: string; state?: string };
		if (!body.code)
			return jsonResponse({ error: "Missing authorization code" }, 400);
		if (!body.state) return jsonResponse({ error: "Missing state nonce" }, 400);

		const stateValid = await consumeState(env, body.state, GOOGLE_STATE_PREFIX);
		if (!stateValid)
			return jsonResponse({ error: "Invalid or expired state" }, 400);

		const url = new URL(request.url);
		const redirectUri = `${url.protocol}//${url.hostname}/auth/callback/google`;

		const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				code: body.code,
				grant_type: "authorization_code",
				redirect_uri: redirectUri,
			}).toString(),
		});
		if (!tokenRes.ok) {
			const errText = await tokenRes.text();
			return jsonResponse(
				{ error: `Google token exchange failed: ${errText.slice(0, 200)}` },
				400,
			);
		}

		const tokenData = (await tokenRes.json()) as {
			access_token?: string;
			id_token?: string;
			refresh_token?: string;
			expires_in?: number;
		};

		// Fetch user info with access token
		let email = "";
		let name = "";
		let picture = "";
		let googleId = "";
		try {
			const userRes = await fetch(
				"https://www.googleapis.com/oauth2/v2/userinfo",
				{
					headers: { authorization: `Bearer ${tokenData.access_token}` },
				},
			);
			if (userRes.ok) {
				const user = (await userRes.json()) as {
					id?: string;
					email?: string;
					name?: string;
					picture?: string;
				};
				googleId = user.id ?? "";
				email = user.email ?? "";
				name = user.name ?? "";
				picture = user.picture ?? "";
			}
		} catch {
			/* continue without profile */
		}

		// Try to decode id_token for fallback info
		if (!email && tokenData.id_token) {
			try {
				const payload = JSON.parse(
					atob(tokenData.id_token.split(".")[1] ?? "{}"),
				) as {
					email?: string;
					name?: string;
					picture?: string;
					sub?: string;
				};
				email = payload.email ?? "";
				name = payload.name ?? "";
				picture = payload.picture ?? "";
				googleId = payload.sub ?? "";
			} catch {
				/* KV operation failed -- non-critical, continue */
			}
		}

		return jsonResponse({
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token,
			expiresIn: tokenData.expires_in,
			idToken: tokenData.id_token,
			profile: {
				id: googleId,
				email,
				displayName: name,
				avatar: picture,
				provider: "google",
			},
		});
	} catch (err) {
		return jsonResponse({ error: (err as Error).message }, 500);
	}
}

// ─── GitHub OAuth ───────────────────────────────────────────────────

export async function handleGitHubAuthorize(
	request: Request,
	env: Env,
): Promise<Response> {
	const clientId = env.GITHUB_CLIENT_ID;
	if (!clientId)
		return jsonResponse({ error: "GitHub auth not configured" }, 501);

	const rlResponse = await checkRateLimit(
		request,
		env,
		"oauth:github-authorize",
	);
	if (rlResponse) return rlResponse;

	const state = generateOAuthState();
	await storeState(env, state, GITHUB_STATE_PREFIX);

	const url = new URL(request.url);
	const redirectUri = `${url.protocol}//${url.hostname}/auth/callback/github`;
	const authorizeUrl =
		"https://github.com/login/oauth/authorize?" +
		new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			scope: "read:user user:email",
			state,
		}).toString();

	return jsonResponse({ authorizeUrl, state });
}

export async function handleGitHubCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	const bodySizeCheck = validateBodySize(request, 32 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	const clientId = env.GITHUB_CLIENT_ID;
	const clientSecret = env.GITHUB_CLIENT_SECRET;
	if (!clientId || !clientSecret)
		return jsonResponse({ error: "GitHub auth not configured" }, 501);

	try {
		const body = (await request.json()) as { code?: string; state?: string };
		if (!body.code)
			return jsonResponse({ error: "Missing authorization code" }, 400);
		if (!body.state) return jsonResponse({ error: "Missing state nonce" }, 400);

		const stateValid = await consumeState(env, body.state, GITHUB_STATE_PREFIX);
		if (!stateValid)
			return jsonResponse({ error: "Invalid or expired state" }, 400);

		const tokenRes = await fetch(
			"https://github.com/login/oauth/access_token",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json",
				},
				body: JSON.stringify({
					client_id: clientId,
					client_secret: clientSecret,
					code: body.code,
				}),
			},
		);
		if (!tokenRes.ok) {
			const errText = await tokenRes.text();
			return jsonResponse(
				{ error: `GitHub token exchange failed: ${errText.slice(0, 200)}` },
				400,
			);
		}

		const tokenData = (await tokenRes.json()) as {
			access_token?: string;
			error?: string;
			error_description?: string;
		};
		if (tokenData.error || !tokenData.access_token) {
			return jsonResponse(
				{
					error:
						tokenData.error_description ?? tokenData.error ?? "No access token",
				},
				400,
			);
		}

		// Fetch user profile
		let username = "";
		let name = "";
		let avatar = "";
		let githubId = "";
		let email = "";
		try {
			const [userRes, emailRes] = await Promise.all([
				fetch("https://api.github.com/user", {
					headers: {
						authorization: `Bearer ${tokenData.access_token}`,
						"user-agent": "degenfeed/1.0",
					},
				}),
				fetch("https://api.github.com/user/emails", {
					headers: {
						authorization: `Bearer ${tokenData.access_token}`,
						"user-agent": "degenfeed/1.0",
					},
				}),
			]);
			if (userRes.ok) {
				const user = (await userRes.json()) as {
					id?: number;
					login?: string;
					name?: string;
					avatar_url?: string;
				};
				githubId = String(user.id ?? "");
				username = user.login ?? "";
				name = user.name ?? "";
				avatar = user.avatar_url ?? "";
			}
			if (emailRes.ok) {
				const emails = (await emailRes.json()) as Array<{
					email: string;
					primary: boolean;
				}>;
				email = emails.find((e) => e.primary)?.email ?? emails[0]?.email ?? "";
			}
		} catch {
			/* continue without profile */
		}

		return jsonResponse({
			accessToken: tokenData.access_token,
			profile: {
				id: githubId,
				username,
				displayName: name,
				avatar,
				email,
				provider: "github",
			},
		});
	} catch (err) {
		return jsonResponse({ error: (err as Error).message }, 500);
	}
}

// ─── Discord OAuth ──────────────────────────────────────────────────

export async function handleDiscordAuthorize(
	request: Request,
	env: Env,
): Promise<Response> {
	const clientId = env.DISCORD_CLIENT_ID;
	if (!clientId)
		return jsonResponse({ error: "Discord auth not configured" }, 501);

	const rlResponse = await checkRateLimit(
		request,
		env,
		"oauth:discord-authorize",
	);
	if (rlResponse) return rlResponse;

	const state = generateOAuthState();
	await storeState(env, state, DISCORD_STATE_PREFIX);

	const url = new URL(request.url);
	const redirectUri = `${url.protocol}//${url.hostname}/auth/callback/discord`;
	const authorizeUrl =
		"https://discord.com/api/oauth2/authorize?" +
		new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "identify email",
			state,
		}).toString();

	return jsonResponse({ authorizeUrl, state });
}

export async function handleDiscordCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	const bodySizeCheck = validateBodySize(request, 32 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	const clientId = env.DISCORD_CLIENT_ID;
	const clientSecret = env.DISCORD_CLIENT_SECRET;
	if (!clientId || !clientSecret)
		return jsonResponse({ error: "Discord auth not configured" }, 501);

	try {
		const body = (await request.json()) as { code?: string; state?: string };
		if (!body.code)
			return jsonResponse({ error: "Missing authorization code" }, 400);
		if (!body.state) return jsonResponse({ error: "Missing state nonce" }, 400);

		const stateValid = await consumeState(
			env,
			body.state,
			DISCORD_STATE_PREFIX,
		);
		if (!stateValid)
			return jsonResponse({ error: "Invalid or expired state" }, 400);

		const url = new URL(request.url);
		const redirectUri = `${url.protocol}//${url.hostname}/auth/callback/discord`;

		const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				grant_type: "authorization_code",
				code: body.code,
				redirect_uri: redirectUri,
			}).toString(),
		});
		if (!tokenRes.ok) {
			const errText = await tokenRes.text();
			return jsonResponse(
				{ error: `Discord token exchange failed: ${errText.slice(0, 200)}` },
				400,
			);
		}

		const tokenData = (await tokenRes.json()) as {
			access_token?: string;
			refresh_token?: string;
			expires_in?: number;
		};
		if (!tokenData.access_token)
			return jsonResponse({ error: "No access token" }, 400);

		// Fetch user profile
		let username = "";
		let discriminator = "";
		let avatar = "";
		let discordId = "";
		let email = "";
		try {
			const userRes = await fetch("https://discord.com/api/users/@me", {
				headers: { authorization: `Bearer ${tokenData.access_token}` },
			});
			if (userRes.ok) {
				const user = (await userRes.json()) as {
					id?: string;
					username?: string;
					discriminator?: string;
					avatar?: string;
					email?: string;
				};
				discordId = user.id ?? "";
				username = user.username ?? "";
				discriminator = user.discriminator ?? "";
				email = user.email ?? "";
				if (user.avatar && user.id) {
					avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
				}
			}
		} catch {
			/* continue without profile */
		}

		const displayName =
			discriminator && discriminator !== "0"
				? `${username}#${discriminator}`
				: username;

		return jsonResponse({
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token,
			expiresIn: tokenData.expires_in,
			profile: {
				id: discordId,
				username,
				displayName,
				avatar,
				email,
				provider: "discord",
			},
		});
	} catch (err) {
		return jsonResponse({ error: (err as Error).message }, 500);
	}
}

// ─── Twitter/X OAuth 2.0 ────────────────────────────────────────────

export async function handleTwitterAuthorize(
	request: Request,
	env: Env,
): Promise<Response> {
	const clientId = env.TWITTER_CLIENT_ID;
	if (!clientId)
		return jsonResponse({ error: "Twitter auth not configured" }, 501);

	const rlResponse = await checkRateLimit(
		request,
		env,
		"oauth:twitter-authorize",
	);
	if (rlResponse) return rlResponse;

	const state = generateOAuthState();
	await storeState(env, state, TWITTER_STATE_PREFIX);

	// Use PKCE for Twitter OAuth 2.0
	const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
	const codeChallenge = btoa(
		String.fromCharCode(...new TextEncoder().encode(codeVerifier).slice(0, 32)),
	)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

	await storeState(env, `${state}:pkce`, TWITTER_STATE_PREFIX);
	try {
		await env.CACHE?.put(`pkce:${state}`, codeVerifier, { expirationTtl: 600 });
	} catch {
		/* KV operation failed -- non-critical, continue */
	}

	const url = new URL(request.url);
	const redirectUri = `${url.protocol}//${url.hostname}/auth/callback/twitter`;
	const authorizeUrl =
		"https://twitter.com/i/oauth2/authorize?" +
		new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "tweet.read users.read",
			state,
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
		}).toString();

	return jsonResponse({ authorizeUrl, state });
}

export async function handleTwitterCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	const bodySizeCheck = validateBodySize(request, 32 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	const clientId = env.TWITTER_CLIENT_ID;
	const clientSecret = env.TWITTER_CLIENT_SECRET;
	if (!clientId || !clientSecret)
		return jsonResponse({ error: "Twitter auth not configured" }, 501);

	try {
		const body = (await request.json()) as { code?: string; state?: string };
		if (!body.code)
			return jsonResponse({ error: "Missing authorization code" }, 400);
		if (!body.state) return jsonResponse({ error: "Missing state nonce" }, 400);

		const stateValid = await consumeState(
			env,
			body.state,
			TWITTER_STATE_PREFIX,
		);
		if (!stateValid)
			return jsonResponse({ error: "Invalid or expired state" }, 400);

		// Retrieve PKCE code verifier
		let codeVerifier = "";
		try {
			codeVerifier = (await env.CACHE?.get(`pkce:${body.state}`)) ?? "";
		} catch {
			/* KV operation failed -- non-critical, continue */
		}
		try {
			await env.CACHE?.delete(`pkce:${body.state}`);
		} catch {
			/* KV operation failed -- non-critical, continue */
		}

		const url = new URL(request.url);
		const redirectUri = `${url.protocol}//${url.hostname}/auth/callback/twitter`;

		const tokenParams = new URLSearchParams({
			client_id: clientId,
			code: body.code,
			grant_type: "authorization_code",
			redirect_uri: redirectUri,
		});
		if (codeVerifier) tokenParams.set("code_verifier", codeVerifier);

		const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
			},
			body: tokenParams.toString(),
		});
		if (!tokenRes.ok) {
			const errText = await tokenRes.text();
			return jsonResponse(
				{ error: `Twitter token exchange failed: ${errText.slice(0, 200)}` },
				400,
			);
		}

		const tokenData = (await tokenRes.json()) as {
			access_token?: string;
			refresh_token?: string;
			expires_in?: number;
		};
		if (!tokenData.access_token)
			return jsonResponse({ error: "No access token" }, 400);

		// Fetch user profile
		let username = "";
		let name = "";
		let avatar = "";
		let twitterId = "";
		try {
			const userRes = await fetch("https://api.twitter.com/2/users/me", {
				headers: { authorization: `Bearer ${tokenData.access_token}` },
			});
			if (userRes.ok) {
				const user = (await userRes.json()) as {
					data?: {
						id?: string;
						username?: string;
						name?: string;
						profile_image_url?: string;
					};
				};
				twitterId = user.data?.id ?? "";
				username = user.data?.username ?? "";
				name = user.data?.name ?? "";
				avatar = user.data?.profile_image_url ?? "";
			}
		} catch {
			/* continue without profile */
		}

		return jsonResponse({
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token,
			expiresIn: tokenData.expires_in,
			profile: {
				id: twitterId,
				username,
				displayName: name,
				avatar,
				provider: "twitter",
			},
		});
	} catch (err) {
		return jsonResponse({ error: (err as Error).message }, 500);
	}
}

// ─── Telegram OAuth (Login Widget) ──────────────────────────────────

export async function handleTelegramAuthorize(
	request: Request,
	env: Env,
): Promise<Response> {
	const botName = env.TELEGRAM_BOT_NAME;
	if (!botName)
		return jsonResponse({ error: "Telegram auth not configured" }, 501);

	const rlResponse = await checkRateLimit(
		request,
		env,
		"oauth:telegram-authorize",
	);
	if (rlResponse) return rlResponse;

	const state = generateOAuthState();
	await storeState(env, state, TELEGRAM_STATE_PREFIX);

	const url = new URL(request.url);
	const redirectUri = `${url.protocol}//${url.hostname}/auth/callback/telegram`;
	// Telegram uses its own hash-based verification, done client-side via script
	// We generate state to prevent CSRF and also return the redirect URL
	const widgetOrigin = `https://oauth.telegram.org/embed/${botName}?origin=${encodeURIComponent(redirectUri)}&return_to=${encodeURIComponent(redirectUri)}`;

	return jsonResponse({ authorizeUrl: widgetOrigin, state, botName });
}

export async function handleTelegramCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	const bodySizeCheck = validateBodySize(request, 32 * 1024);
	if (!bodySizeCheck.ok)
		return jsonResponse({ error: bodySizeCheck.error }, 413);

	const botToken = env.TELEGRAM_BOT_TOKEN;
	if (!botToken)
		return jsonResponse({ error: "Telegram auth not configured" }, 501);

	try {
		const body = (await request.json()) as {
			hash?: string;
			id?: number;
			first_name?: string;
			username?: string;
			photo_url?: string;
			auth_date?: number;
			state?: string;
		};

		if (!body.hash || !body.id)
			return jsonResponse({ error: "Missing Telegram auth data" }, 400);

		if (body.state) {
			const stateValid = await consumeState(
				env,
				body.state,
				TELEGRAM_STATE_PREFIX,
			);
			if (!stateValid)
				return jsonResponse({ error: "Invalid or expired state" }, 400);
		}

		// Verify Telegram HMAC-SHA256 signature
		const dataCheckArr = Object.entries({
			auth_date: body.auth_date,
			first_name: body.first_name,
			id: body.id,
			username: body.username,
			photo_url: body.photo_url,
		})
			.filter(([, v]) => v != null)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${k}=${v}`)
			.join("\n");

		const secretKey = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(botToken),
		);
		const key = await crypto.subtle.importKey(
			"raw",
			secretKey,
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign", "verify"],
		);
		const computedSig = await crypto.subtle.sign(
			"HMAC",
			key,
			new TextEncoder().encode(dataCheckArr),
		);
		const computedHex = Array.from(new Uint8Array(computedSig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		if (computedHex !== body.hash) {
			return jsonResponse({ error: "Invalid Telegram signature" }, 401);
		}

		const displayName = [
			body.first_name,
			body.username ? `@${body.username}` : "",
		]
			.filter(Boolean)
			.join(" ");

		return jsonResponse({
			success: true,
			profile: {
				id: String(body.id),
				username: body.username,
				displayName,
				avatar: body.photo_url,
				provider: "telegram",
			},
		});
	} catch (err) {
		return jsonResponse({ error: (err as Error).message }, 500);
	}
}

// ─── Reddit Authorize (was missing) ─────────────────────────────────

export async function handleRedditAuthorize(
	request: Request,
	env: Env,
): Promise<Response> {
	const clientId = env.REDDIT_CLIENT_ID;
	if (!clientId)
		return jsonResponse({ error: "Reddit auth not configured" }, 501);

	const rlResponse = await checkRateLimit(
		request,
		env,
		"oauth:reddit-authorize",
	);
	if (rlResponse) return rlResponse;

	const state = generateOAuthState();
	await storeState(env, state, REDDIT_STATE_PREFIX);

	const url = new URL(request.url);
	const redirectUri = `${url.protocol}//${url.hostname}/auth/callback/reddit`;
	const authorizeUrl =
		"https://www.reddit.com/api/v1/authorize?" +
		new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "identity read",
			state,
			duration: "permanent",
		}).toString();

	return jsonResponse({ authorizeUrl, state });
}
