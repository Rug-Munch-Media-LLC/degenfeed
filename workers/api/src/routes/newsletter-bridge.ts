import type { Env } from "../index";

export async function handleNewsletterBridgeConnect(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleNewsletterBridgeDisconnect(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleNewsletterBridgeList(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, bridges: [] }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleNewsletterBridgePoll(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, messages: [] }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleNewsletterBridgeAutoPoll(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleNewsletterBridgeStats(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, stats: {} }), {
		headers: { "content-type": "application/json" },
	});
}
