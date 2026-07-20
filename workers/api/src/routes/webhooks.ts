import type { Env } from "../index";

export async function handleWebhookCreate(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, webhook: { id: "" } }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleWebhookTest(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleWebhookList(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, webhooks: [] }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleWebhookDelete(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleWebhookTrigger(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}
