import { BskyClient } from "@degenfeed/bluesky-sdk";
import { HubClient } from "@degenfeed/farcaster-sdk";
import {
	emptyBehaviorProfile,
	learnFromInteraction,
	type UserBehaviorProfile,
} from "@degenfeed/feed-core";
import { LensClient } from "@degenfeed/lens-sdk";
import { GtSClient } from "@degenfeed/mastodon-sdk";
import type { EngagementAction, Protocol } from "@degenfeed/types";
import {
	BSKY_SOCIAL,
	type Env,
	FARCASTER_HUBS,
	jsonResponse,
	LENS_APIS,
} from "../index";
import {
	hasSuspiciousPayload,
	isAllowedProtocol,
	sanitizeString,
} from "../sanitize";

const ALLOWED_ACTIONS = new Set<EngagementAction>([
	"like",
	"unlike",
	"repost",
	"unrepost",
	"bookmark",
	"unbookmark",
	"reply",
	"react",
]);

interface EngageRequest {
	action?: string;
	postId?: string;
	protocol?: string;
	target?: { authorId?: string; publicationId?: string };
	content?: string;
	reaction?: string;
	auth?: Record<string, string>;
	authToken?: string;
}

function noAccountError(protocol: string): { error: string } {
	return { error: `No social account linked for ${protocol}` };
}

function nativeIdFromPostId(postId: string, protocol: string): string {
	const prefix = `${protocol}:`;
	if (postId.startsWith(prefix)) return postId.slice(prefix.length);
	return postId;
}

// ─── Behavior tracking ──────────────────────────────────────────────

const ACTION_MAP: Record<
	string,
	"view" | "like" | "repost" | "reply" | "tip" | "bookmark" | "dismiss"
> = {
	like: "like",
	unlike: "dismiss",
	repost: "repost",
	unrepost: "dismiss",
	bookmark: "bookmark",
	unbookmark: "dismiss",
	reply: "reply",
	react: "like",
};

async function trackBehavior(
	env: Env,
	address: string,
	action: EngagementAction,
	protocol: string,
	postId: string,
	target: { authorId?: string; publicationId?: string },
	content?: string,
): Promise<void> {
	const mapped = ACTION_MAP[action];
	if (!mapped) return;

	try {
		const raw = await env.CACHE?.get(`user:behavior:${address.toLowerCase()}`);
		const profile: UserBehaviorProfile = raw
			? JSON.parse(raw)
			: emptyBehaviorProfile();

		// Fetch the full post from KV if available
		let post = null;
		try {
			const postRaw = await env.CACHE?.get(`post:${postId}`);
			if (postRaw) post = JSON.parse(postRaw);
		} catch { /* KV operation failed -- non-critical, continue */ }

		const minimalPost = post ?? {
			id: postId,
			protocol: protocol as Protocol,
			author: { id: target.authorId || "" },
			text: content || "",
			embeds: [],
			niches: [],
			createdAt: Date.now(),
			contentType: "text" as const,
			metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
			engagement: {
				viewerLiked: false,
				viewerReposted: false,
				viewerBookmarked: false,
				raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
			},
			raw: {},
		};

		const updated = learnFromInteraction(profile, minimalPost, mapped);
		await env.CACHE?.put(
			`user:behavior:${address.toLowerCase()}`,
			JSON.stringify(updated),
			{
				expirationTtl: 60 * 60 * 24 * 30,
			},
		);
	} catch {
		// Fire-and-forget — non-critical
	}
}

// ─── Main handler ──────────────────────────────────────────────────

export async function handleEngage(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	try {
		const body: EngageRequest = (await request.json()) as EngageRequest;
		const action = sanitizeString(body.action, 32) as EngagementAction;
		const postId = sanitizeString(body.postId, 256);
		const protocol = sanitizeString(body.protocol, 32);

		if (
			!action ||
			!postId ||
			!protocol ||
			!isAllowedProtocol(protocol) ||
			!ALLOWED_ACTIONS.has(action) ||
			hasSuspiciousPayload(`${action}${postId}${protocol}`)
		) {
			return jsonResponse({ error: "action, postId, protocol required" }, 400);
		}

		const content = sanitizeString(body.content, 10000);
		const reaction = sanitizeString(body.reaction, 16);
		const target = {
			authorId: sanitizeString(body.target?.authorId, 256),
			publicationId: sanitizeString(body.target?.publicationId, 256),
		};
		const auth = body.auth ?? {};
		const nativeId = nativeIdFromPostId(postId, protocol);

		let response: Response;

		switch (protocol) {
			case "nostr":
				response = await Promise.resolve(
					handleNostr(action, nativeId, target, content, reaction, auth, env),
				);
				break;
			case "farcaster":
				response = await handleFarcaster(
					action,
					nativeId,
					target,
					content,
					reaction,
					auth,
					env,
				);
				break;
			case "lens":
				response = await handleLens(
					action,
					nativeId,
					target,
					content,
					reaction,
					auth,
					env,
				);
				break;
			case "bluesky":
				response = await handleBluesky(
					action,
					nativeId,
					target,
					content,
					reaction,
					auth,
					env,
				);
				break;
			case "threads":
				response = await handleThreads(
					action,
					nativeId,
					target,
					content,
					reaction,
					auth,
					env,
				);
				break;
			case "mastodon":
				response = await handleMastodon(
					action,
					nativeId,
					target,
					content,
					reaction,
					auth,
					env,
				);
				break;
			case "lemmy":
				response = await handleLemmy(
					action,
					nativeId,
					target,
					content,
					reaction,
					auth,
					env,
				);
				break;
			default:
				return jsonResponse({ error: `${protocol} not supported` }, 400);
		}

		// Fire-and-forget behavior tracking on successful engagement
		if (response.status === 200) {
			const { requireSession } = await import("../session");
			const session = await requireSession(request, env);
			if (!(session instanceof Response)) {
				void trackBehavior(
					env,
					session.address,
					action,
					protocol,
					postId,
					target,
					content,
				);
			}
		}

		return response;
	} catch (err) {
		const message = err instanceof Error ? err.message : "Internal error";
		return jsonResponse({ error: message }, 500);
	}
}

function handleNostr(
	_action: EngagementAction,
	_eventId: string,
	_target: { authorId: string; publicationId: string },
	_content: string,
	_reaction: string,
	_auth: Record<string, string>,
	_env: Env,
): Response {
	// SECURITY: Server-side nsec no longer accepted (2026-07-13).
	// Clients must sign engagement events locally using @degenfeed/nostr-sdk
	// and submit pre-signed events. Raw nsec in request body is rejected.
	return jsonResponse(
		{
			error: "Server-side Nostr signing is deprecated.",
			detail: "Sign engagement events client-side using @degenfeed/nostr-sdk.",
			migration:
				"Use the client-side engageNostr() in apps/web/src/lib/nostr.ts",
			docs: "https://degenfeed.xyz/docs/nostr-publish",
		},
		410,
	);
}

async function handleFarcaster(
	_action: EngagementAction,
	_castHash: string,
	_target: { authorId: string; publicationId: string },
	_content: string,
	_reaction: string,
	auth: Record<string, string>,
	env: Env,
): Promise<Response> {
	const signedMessage = auth.farcaster_message ?? "";
	if (!signedMessage) {
		return jsonResponse(noAccountError("farcaster"), 401);
	}

	const hubUrl = env.FARCASTER_HUB_URL || FARCASTER_HUBS[0];
	const client = new HubClient(hubUrl);

	try {
		await client.submitMessage(signedMessage);
		return jsonResponse({ success: true });
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Farcaster engagement failed";
		return jsonResponse({ error: message }, 500);
	}
}

async function handleLens(
	action: EngagementAction,
	publicationId: string,
	_target: { authorId: string; publicationId: string },
	content: string,
	_reaction: string,
	auth: Record<string, string>,
	env: Env,
): Promise<Response> {
	const token = auth.lens ?? auth.accessToken ?? "";
	if (!token) {
		return jsonResponse(noAccountError("lens"), 401);
	}

	const client = new LensClient(env.LENS_API_URL || LENS_APIS[0]);
	client.setAuth(token);

	try {
		if (action === "like") {
			await client.like(publicationId);
		} else if (action === "unlike") {
			await client.unlike(publicationId);
		} else if (action === "repost") {
			await client.mirror(publicationId);
		} else if (action === "unrepost") {
			await client.unmirror(publicationId);
		} else if (action === "reply") {
			await client.comment(publicationId, content);
		} else {
			return jsonResponse({ error: `${action} not supported on lens` }, 400);
		}
		return jsonResponse({ success: true });
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Lens engagement failed";
		return jsonResponse({ error: message }, 500);
	}
}

async function handleBluesky(
	action: EngagementAction,
	uri: string,
	target: { authorId: string; publicationId: string },
	content: string,
	_reaction: string,
	auth: Record<string, string>,
	env: Env,
): Promise<Response> {
	const jwt = auth.bluesky ?? auth.accessJwt ?? "";
	const did = auth.bluesky_did ?? auth.did ?? target.authorId ?? "";
	if (!jwt || !did) {
		return jsonResponse(noAccountError("bluesky"), 401);
	}

	const cid = target.publicationId || "";
	const client = new BskyClient(env.BSKY_SOCIAL_URL || BSKY_SOCIAL);
	client.setAuth(jwt);

	try {
		if (action === "like") {
			await client.like(uri, cid, did);
		} else if (action === "unlike") {
			await client.unlike(uri, did);
		} else if (action === "repost") {
			await client.repost(uri, cid, did);
		} else if (action === "unrepost") {
			await client.unrepost(uri, did);
		} else if (action === "reply") {
			await client.reply(uri, cid, did, content);
		} else {
			return jsonResponse({ error: `${action} not supported on bluesky` }, 400);
		}
		return jsonResponse({ success: true });
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Bluesky engagement failed";
		return jsonResponse({ error: message }, 500);
	}
}

async function handleThreads(
	action: EngagementAction,
	_uri: string,
	_target: { authorId: string; publicationId: string },
	_content: string,
	_reaction: string,
	_auth: Record<string, string>,
	_env: Env,
): Promise<Response> {
	// The official Meta Threads API does not support engagement actions
	// (like, unlike, repost, reply). Users must engage via the Threads app.
	return jsonResponse({ error: `${action} not supported on threads` }, 400);
}

async function handleMastodon(
	action: EngagementAction,
	statusId: string,
	_target: { authorId: string; publicationId: string },
	content: string,
	_reaction: string,
	auth: Record<string, string>,
	_env: Env,
): Promise<Response> {
	const instance = auth.mastodon_instance || "https://social.degenfeed.xyz";
	const token = auth.mastodon ?? auth.authToken ?? "";
	if (!token) {
		return jsonResponse(noAccountError("mastodon"), 401);
	}

	const client = new GtSClient(instance, token);

	try {
		if (action === "like") {
			await client.like(statusId);
		} else if (action === "unlike") {
			await client.unlike(statusId);
		} else if (action === "repost") {
			await client.repost(statusId);
		} else if (action === "unrepost") {
			await client.unrepost(statusId);
		} else if (action === "bookmark") {
			await client.bookmark(statusId);
		} else if (action === "unbookmark") {
			await client.unbookmark(statusId);
		} else if (action === "reply") {
			await client.publish(content, { inReplyToId: statusId });
		} else {
			return jsonResponse(
				{ error: `${action} not supported on mastodon` },
				400,
			);
		}
		return jsonResponse({ success: true });
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Mastodon engagement failed";
		return jsonResponse({ error: message }, 500);
	}
}

async function handleLemmy(
	action: EngagementAction,
	postId: string,
	_target: { authorId: string; publicationId: string },
	content: string,
	_reaction: string,
	auth: Record<string, string>,
	_env: Env,
): Promise<Response> {
	const instance = auth.lemmy_instance || "https://community.degenfeed.xyz";
	const token = auth.lemmy ?? auth.authToken ?? "";
	if (!token) {
		return jsonResponse(noAccountError("lemmy"), 401);
	}

	const headers: Record<string, string> = {
		"content-type": "application/json",
		authorization: `Bearer ${token}`,
	};

	try {
		if (action === "like") {
			await fetch(`${instance}/api/v3/post/like`, {
				method: "POST",
				headers,
				body: JSON.stringify({ post_id: Number(postId), score: 1 }),
			});
		} else if (action === "unlike") {
			await fetch(`${instance}/api/v3/post/like`, {
				method: "POST",
				headers,
				body: JSON.stringify({ post_id: Number(postId), score: 0 }),
			});
		} else if (action === "reply") {
			await fetch(`${instance}/api/v3/comment`, {
				method: "POST",
				headers,
				body: JSON.stringify({ post_id: Number(postId), content }),
			});
		} else {
			return jsonResponse({ error: `${action} not supported on lemmy` }, 400);
		}
		return jsonResponse({ success: true });
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Lemmy engagement failed";
		return jsonResponse({ error: message }, 500);
	}
}
