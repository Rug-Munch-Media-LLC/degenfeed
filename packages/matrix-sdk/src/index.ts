/**
 * @degenfeed/matrix-sdk
 *
 * Matrix homeserver client for room management, messaging, and bridging.
 * Uses `fetch()` throughout - compatible with Cloudflare Workers, Node 18+.
 *
 * @see https://spec.matrix.org/latest/client-server-api/
 */

import type { Protocol } from '@degenfeed/types';
export type { Protocol };

// ─── Constants ─────────────────────────────────────────────────────

const MATRIX_API_PATH = '/_matrix/client/v3';
const MATRIX_MEDIA_PATH = '/_matrix/media/v3';
const MATRIX_MAX_RETRIES = 3;

// ─── Error Types ───────────────────────────────────────────────────

export class MatrixError extends Error {
	public readonly errcode: string;
	public readonly statusCode: number;
	public readonly retryAfterMs?: number;
	constructor(message: string, errcode: string, statusCode: number, retryAfterMs?: number) {
		super(message);
		this.name = 'MatrixError';
		this.errcode = errcode;
		this.statusCode = statusCode;
		this.retryAfterMs = retryAfterMs;
	}
}

// ─── Types ─────────────────────────────────────────────────────────

export interface MatrixRoom { roomId: string; name?: string; topic?: string; canonicalAlias?: string; aliases?: string[]; avatarUrl?: string; memberCount?: number; joinRule?: string; guestAccess?: string; version?: string; creator?: string; }
export interface MatrixMessage { body: string; msgtype: string; format?: string; formattedBody?: string; sender: string; roomId: string; eventId: string; originServerTs: number; }
export interface MatrixEvent { eventId: string; type: string; roomId?: string; sender: string; originServerTs: number; content: Record<string, unknown>; unsigned?: Record<string, unknown>; stateKey?: string; }
export interface MatrixUser { userId: string; displayName?: string; avatarUrl?: string; currentlyActive?: boolean; lastPresenceTs?: number; presence?: 'online' | 'offline' | 'unavailable'; statusMsg?: string; }

// ─── Helpers ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

// ─── Main Client ───────────────────────────────────────────────────

export class MatrixClient {
	private homeserverUrl: string;
	private accessToken?: string;
	private userAgent: string;

	constructor(homeserverUrl: string, accessToken?: string, opts?: { userAgent?: string }) {
		this.homeserverUrl = homeserverUrl.replace(/\/$/, '');
		this.accessToken = accessToken;
		this.userAgent = opts?.userAgent ?? 'DegenFeed/0.1 (+https://degenfeed.xyz)';
	}

	static async discoverHomeserver(userId: string): Promise<string> {
		const parts = userId.split(':');
		if (parts.length < 2) throw new MatrixError('Invalid Matrix user ID', 'M_INVALID_PARAM', 400);
		const domain = parts.slice(1).join(':');
		try {
			const res = await fetch(`https://${domain}/.well-known/matrix/client`, { headers: { 'user-agent': 'DegenFeed/0.1' } });
			if (res.ok) {
				const wk = await res.json() as { 'm.homeserver'?: { baseUrl: string } };
				if (wk['m.homeserver']?.baseUrl) return wk['m.homeserver'].baseUrl;
			}
		} catch { /* fall through */ }
		return `https://${domain}`;
	}

	private async request<T>(method: string, path: string, body?: Record<string, unknown> | FormData): Promise<T> {
		const headers: Record<string, string> = { 'user-agent': this.userAgent };
		if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;

		let requestBody: BodyInit | undefined;
		if (body instanceof FormData) { requestBody = body; } else if (body !== undefined) { headers['content-type'] = 'application/json'; requestBody = JSON.stringify(body); }

		let lastError: Error | null = null;
		for (let attempt = 0; attempt < MATRIX_MAX_RETRIES; attempt++) {
			if (attempt > 0) await sleep(100 * 2 ** attempt);
			try {
				const url = `${this.homeserverUrl}${path}`;
				const res = await fetch(url, { method, headers, body: requestBody });
				if (!res.ok) {
					const eb = await res.json().catch(() => ({})) as { errcode?: string; error?: string; retry_after_ms?: number };
					if (res.status === 429 && eb.retry_after_ms) {
						if (attempt < MATRIX_MAX_RETRIES - 1) { await sleep(eb.retry_after_ms + 100); continue; }
						throw new MatrixError(eb.error ?? 'Rate limited', eb.errcode ?? 'M_LIMIT_EXCEEDED', res.status, eb.retry_after_ms);
					}
					throw new MatrixError(eb.error ?? res.statusText, eb.errcode ?? 'M_UNKNOWN', res.status);
				}
				if (res.status === 202 || res.status === 204) return undefined as unknown as T;
				const text = await res.text();
				return text.length > 0 ? JSON.parse(text) as T : undefined as unknown as T;
			} catch (err) {
				if (err instanceof MatrixError) throw err;
				lastError = err instanceof Error ? err : new Error(String(err));
				if (attempt < MATRIX_MAX_RETRIES - 1) continue;
			}
		}
		throw lastError ?? new MatrixError('Matrix request failed after retries', 'M_UNKNOWN', 0);
	}

	async login(username: string, password: string, deviceName?: string): Promise<{ userId: string; accessToken: string; deviceId: string }> {
		const result = await this.request<{ user_id: string; access_token: string; device_id: string }>('POST', `${MATRIX_API_PATH}/login`, {
			type: 'm.login.password',
			identifier: { type: 'm.id.user', user: username },
			password,
			initial_device_display_name: deviceName ?? 'DegenFeed',
		});
		this.accessToken = result.access_token;
		return { userId: result.user_id, accessToken: result.access_token, deviceId: result.device_id };
	}

	async register(username: string, password: string): Promise<{ userId: string; accessToken: string; deviceId: string }> {
		const result = await this.request<{ user_id: string; access_token: string; device_id: string }>('POST', `${MATRIX_API_PATH}/register`, { username, password });
		this.accessToken = result.access_token;
		return { userId: result.user_id, accessToken: result.access_token, deviceId: result.device_id };
	}

	async joinRoom(roomIdOrAlias: string): Promise<{ roomId: string }> {
		const result = await this.request<{ room_id: string }>('POST', `${MATRIX_API_PATH}/join/${encodeURIComponent(roomIdOrAlias)}`);
		return { roomId: result.room_id };
	}

	async createRoom(opts?: { name?: string; topic?: string; visibility?: 'public' | 'private'; preset?: string; invite?: string[]; isDirect?: boolean }): Promise<{ roomId: string }> {
		const b: Record<string, unknown> = {};
		if (opts?.name) b.name = opts.name;
		if (opts?.topic) b.topic = opts.topic;
		if (opts?.visibility) b.visibility = opts.visibility;
		if (opts?.preset) b.preset = opts.preset;
		if (opts?.invite) b.invite = opts.invite;
		if (opts?.isDirect) b.is_direct = true;
		const result = await this.request<{ room_id: string }>('POST', `${MATRIX_API_PATH}/createRoom`, b);
		return { roomId: result.room_id };
	}

	async getJoinedRooms(): Promise<string[]> {
		const result = await this.request<{ joined_rooms: string[] }>('GET', `${MATRIX_API_PATH}/joined_rooms`);
		return result.joined_rooms;
	}

	async leaveRoom(roomId: string): Promise<void> {
		await this.request<void>('POST', `${MATRIX_API_PATH}/rooms/${encodeURIComponent(roomId)}/leave`);
	}

	async inviteUser(roomId: string, userId: string): Promise<void> {
		await this.request<void>('POST', `${MATRIX_API_PATH}/rooms/${encodeURIComponent(roomId)}/invite`, { user_id: userId });
	}

	async sendMessage(roomId: string, body: string, msgtype = 'm.text', opts?: { formattedBody?: string; format?: string }): Promise<{ eventId: string }> {
		const content: Record<string, unknown> = { body, msgtype };
		if (opts?.format) content.format = opts.format;
		if (opts?.formattedBody) content.formatted_body = opts.formattedBody;
		return this.sendEvent(roomId, 'm.room.message', content);
	}

	async sendEvent(roomId: string, eventType: string, content: Record<string, unknown>): Promise<{ eventId: string }> {
		const txnId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
		const result = await this.request<{ event_id: string }>('PUT', `${MATRIX_API_PATH}/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${txnId}`, content);
		return { eventId: result.event_id };
	}

	async getRoomMessages(roomId: string, opts?: { from?: string; limit?: number; dir?: 'f' | 'b' }): Promise<{ chunk: MatrixEvent[]; start: string; end: string }> {
		const query = new URLSearchParams();
		if (opts?.from) query.set('from', opts.from);
		if (opts?.limit !== undefined) query.set('limit', String(opts.limit));
		if (opts?.dir) query.set('dir', opts.dir);
		const result = await this.request<{ chunk: MatrixEvent[]; start: string; end: string }>('GET', `${MATRIX_API_PATH}/rooms/${encodeURIComponent(roomId)}/messages?${query.toString()}`);
		return result;
	}

	async setRoomTopic(roomId: string, topic: string): Promise<void> {
		await this.sendEvent(roomId, 'm.room.topic', { topic });
	}

	async uploadContent(data: Blob | Uint8Array, contentType: string, filename?: string): Promise<{ contentUri: string }> {
		const body = data instanceof Blob ? data : new Blob([data as BlobPart], { type: contentType });
		const query = filename ? `?filename=${encodeURIComponent(filename)}` : '';
		const result = await this.request<{ content_uri: string }>('POST', `${MATRIX_MEDIA_PATH}/upload${query}`, body as unknown as FormData);
		return { contentUri: result.content_uri };
	}

	async getDisplayName(userId: string): Promise<string | null> {
		try {
			const result = await this.request<{ displayname?: string }>('GET', `${MATRIX_API_PATH}/profile/${encodeURIComponent(userId)}/displayname`);
			return result.displayname ?? null;
		} catch { return null; }
	}

	async setDisplayName(displayName: string): Promise<void> {
		await this.request<void>('PUT', `${MATRIX_API_PATH}/profile/@me/displayname`, { displayname: displayName });
	}
}
