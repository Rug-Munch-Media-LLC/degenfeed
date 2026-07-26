/**
 * @degenfeed/api-worker — Universal Inbox Protocol Reply Handlers
 *
 * Send replies to any protocol. Each function handles the
 * protocol-specific API call to post a reply.
 */

export async function replyMastodon(
  content: string, parentId: string, auth: Record<string, string>, _env: unknown,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const instance = auth.mastodon_instance ?? 'https://social.degenfeed.xyz';
  const token = auth.mastodon ?? auth.accessToken;
  if (!token) return { ok: false, error: 'Not authenticated to Mastodon' };

  try {
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: content, in_reply_to_id: parentId, visibility: 'public' }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return { ok: false, error: `Mastodon reply failed: ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, nativeId: data.id };
  } catch (e) {
    return { ok: false, error: `Mastodon reply error: ${(e as Error).message}` };
  }
}

export async function replyNostr(
  content: string, parentEventId: string, auth: Record<string, string>, signedMessage?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  try {
    if (signedMessage) {
      const signedEvent = JSON.parse(signedMessage) as { id: string; pubkey: string; content: string; sig: string; tags: string[][] };
      const { RelayPool } = await import('@degenfeed/nostr-sdk');
      const pool = new RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], { eoseTimeout: 4000 });
      await pool.publish(signedEvent);
      pool.disconnectAll();
      return { ok: true, nativeId: signedEvent.id };
    }

    const nsec = auth.nostr ?? auth.nsec;
    if (!nsec) return { ok: false, error: 'Nostr requires nsec or pre-signed event' };

    const nostr = await import('@degenfeed/nostr-sdk');
    const tags: string[][] = [];
    if (/^[0-9a-f]{64}$/i.test(parentEventId)) tags.push(['e', parentEventId, '', 'reply']);
    const ev = nostr.createTextNote(content, nsec, tags);
    const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], { eoseTimeout: 4000 });
    await pool.publish(ev);
    pool.disconnectAll();
    return { ok: true, nativeId: ev.id };
  } catch (e) {
    return { ok: false, error: `Nostr reply error: ${(e as Error).message}` };
  }
}

export async function replyFarcaster(
  _content: string, auth: Record<string, string>, signedMessage?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  if (!signedMessage) return { ok: false, error: 'Farcaster requires a pre-signed cast message' };
  const hubUrl = auth.farcaster_hub ?? 'https://hub.farcaster.standardcrypto.vc:2281';

  try {
    let messageBody: BodyInit = signedMessage;
    const hex = signedMessage.startsWith('0x') ? signedMessage.slice(2) : signedMessage;
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      messageBody = bytes;
    }

    const submitRes = await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: messageBody,
    });
    if (submitRes.ok) {
      const submitData = (await submitRes.json()) as Record<string, unknown>;
      return { ok: true, nativeId: String(submitData.hash || '') };
    }
    const errText = await submitRes.text();
    return { ok: false, error: `Farcaster Hub rejected: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: `Farcaster reply error: ${(e as Error).message}` };
  }
}

export async function replyBluesky(
  content: string, auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const pdsUrl = auth.bluesky_pds ?? 'https://bsky.social';
  const accessJwt = auth.bluesky_jwt ?? auth.bluesky_accessJwt ?? auth.accessJwt;
  const repoDid = auth.bluesky_did ?? '';
  if (!accessJwt || !repoDid) return { ok: false, error: 'Not authenticated to Bluesky' };

  try {
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessJwt}` },
      body: JSON.stringify({ repo: repoDid, collection: 'app.bsky.feed.post', record: { $type: 'app.bsky.feed.post', text: content, createdAt: new Date().toISOString() } }),
    });
    if (res.ok) {
      const data = (await res.json()) as { uri?: string };
      return { ok: true, nativeId: data.uri ?? '' };
    }
    const errText = await res.text();
    return { ok: false, error: `Bluesky reply failed: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: `Bluesky reply error: ${(e as Error).message}` };
  }
}

export async function replyPeerTube(
  content: string, _nativeId: string, auth: Record<string, string>, parentVideoUuid?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  if (!parentVideoUuid) return { ok: false, error: 'PeerTube reply requires a video UUID' };
  const instance = auth.peertube_instance ?? 'https://video.degenfeed.xyz';
  const token = auth.peertube ?? '';

  try {
    const res = await fetch(`${instance}/api/v1/videos/${encodeURIComponent(parentVideoUuid)}/comment-threads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text: content }),
    });
    if (res.ok) {
      const data = (await res.json()) as { comment?: { id: number } };
      return { ok: true, nativeId: String(data.comment?.id ?? '') };
    }
    const errText = await res.text();
    return { ok: false, error: `PeerTube reply failed: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: `PeerTube reply error: ${(e as Error).message}` };
  }
}

export async function replyLemmy(
  content: string, parentPostId: string, auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const instance = auth.lemmy_instance ?? 'https://community.degenfeed.xyz';
  const token = auth.lemmy ?? auth.authToken;
  if (!token) return { ok: false, error: 'Not authenticated to Lemmy' };

  try {
    const res = await fetch(`${instance}/api/v3/comment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ post_id: Number(parentPostId) || 0, content }),
    });
    if (res.ok) {
      const data = (await res.json()) as { comment_view?: { comment?: { id: number } } };
      return { ok: true, nativeId: String(data.comment_view?.comment?.id ?? '') };
    }
    const errText = await res.text();
    return { ok: false, error: `Lemmy reply failed: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: `Lemmy reply error: ${(e as Error).message}` };
  }
}

export async function replyPixelfed(
  content: string, parentStatusId: string, auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const instance = auth.pixelfed_instance ?? 'https://gram.degenfeed.xyz';
  const token = auth.pixelfed ?? auth.accessToken;
  if (!token) return { ok: false, error: 'Not authenticated to Pixelfed' };

  try {
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: content, in_reply_to_id: parentStatusId, visibility: 'public' }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return { ok: false, error: `Pixelfed reply failed: ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, nativeId: data.id };
  } catch (e) {
    return { ok: false, error: `Pixelfed reply error: ${(e as Error).message}` };
  }
}

export async function replyMatrix(
  content: string, auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const matrixToken = auth.matrix_token ?? auth.matrixAccessToken;
  const matrixUrl = auth.matrix_instance ?? 'https://matrix.degenfeed.xyz';
  const roomId = auth.matrix_room_id ?? '';
  if (!matrixToken || !roomId) return { ok: false, error: 'Not authenticated to Matrix or missing room ID' };

  try {
    const res = await fetch(`${matrixUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message`, {
      method: 'POST',
      headers: { authorization: `Bearer ${matrixToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ msgtype: 'm.text', body: content }),
    });
    if (res.ok) {
      const data = (await res.json()) as { event_id?: string };
      return { ok: true, nativeId: data.event_id ?? '' };
    }
    const errText = await res.text();
    return { ok: false, error: `Matrix reply failed: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: `Matrix reply error: ${(e as Error).message}` };
  }
}
