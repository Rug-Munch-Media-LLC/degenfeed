import type { Env } from "../index";

export async function handleNewsletterSend(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleNewsletterSubscribersList(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, subscribers: [] }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleNewsletterSubscriberRemove(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleNewsletterCreateDraft(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, draft: { id: "" } }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleNewsletterSendTest(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}
