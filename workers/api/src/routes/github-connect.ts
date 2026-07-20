import type { Env } from "../index";

export async function handleGitHubConnect(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleGitHubRepoActivity(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, events: [] }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleGitHubDisconnect(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleGitHubConnectedAccounts(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, accounts: [] }), {
		headers: { "content-type": "application/json" },
	});
}

export async function handleGitHubBridgeActivity(req: Request, env: Env): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, activity: [] }), {
		headers: { "content-type": "application/json" },
	});
}
