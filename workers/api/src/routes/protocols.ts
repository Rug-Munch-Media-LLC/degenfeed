import { MastodonProvider, ThreadsProvider } from "@degenfeed/feed-providers";
import { type Env, jsonResponse } from "../index";

export async function handleActivityPubFeed(
	request: Request,
	_env: Env,
): Promise<Response> {
	const params = new URL(request.url).searchParams;
	const instance = params.get("instance") ?? "https://social.degenfeed.xyz";
	const type = params.get("type") ?? "public";
	const hashtag = params.get("hashtag") ?? "";
	const limit = Number(params.get("limit")) || 20;

	try {
		const provider = new MastodonProvider({ instanceUrl: instance });
		const result = await provider.fetchFeed({
			timeoutMs: 6000,
			concurrency: 4,
		});
		let posts = result.posts;
		if (type === "hashtag" && hashtag) {
			posts = posts.filter((p) =>
				p.text.toLowerCase().includes(`#${hashtag.toLowerCase()}`),
			);
		}
		const sliced = posts.slice(0, limit);
		return jsonResponse({
			data: sliced,
			meta: { total: sliced.length, limit, instance },
		});
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "ActivityPub fetch failed";
		return jsonResponse({ error: message }, 502);
	}
}

export async function handleThreadsFeed(
	request: Request,
	_env: Env,
): Promise<Response> {
	const params = new URL(request.url).searchParams;
	const actor = params.get("actor") ?? "";
	const limit = Number(params.get("limit")) || 25;

	try {
		const provider = new ThreadsProvider();
		const result = await provider.fetchFeed({
			timeoutMs: 6000,
			concurrency: 4,
		});
		let posts = result.posts;
		if (actor) {
			posts = posts.filter((p) =>
				p.author.handles.threads?.toLowerCase().includes(actor.toLowerCase()),
			);
		}
		const sliced = posts.slice(0, limit);
		return jsonResponse({
			data: sliced,
			meta: { total: sliced.length, limit, notice: result.notice },
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Threads fetch failed";
		return jsonResponse({ error: message }, 502);
	}
}
