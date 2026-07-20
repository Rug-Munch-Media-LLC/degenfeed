import type { Env } from "../index";

export async function handleMatrixConnect(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleMatrixSendMessage(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleMatrixRoomsList(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, rooms: [] }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleMatrixDisconnect(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleMatrixBridgeMessages(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}
