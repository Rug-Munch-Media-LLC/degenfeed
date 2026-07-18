import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_PROTOCOLS = new Set([
  'nostr', 'farcaster', 'lens', 'bluesky', 'threads', 'mastodon', 'lemmy', 'rss',
]);

const BRIDGE_FOOTER = '\n\n_↻ Replied via DegenFeed cross-protocol bridge';

function buildCrossReplyFooter(parentProtocol: string, replyProtocol: string): string {
  return `${BRIDGE_FOOTER} (${parentProtocol} → ${replyProtocol})_`;
}

interface CrossReplyRequestBody {
  parentPostUri: string;
  parentProtocol: string;
  replyProtocol: string;
  content: string;
  walletAddress: string;
  auth?: Record<string, string>;
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
}

/**
 * POST /api/cross-reply
 * Publish a cross-protocol reply.
 * Delegates to the workers/api service when available, otherwise handles locally
 * with protocol SDKs.
 */
export async function POST(request: NextRequest) {
  try {
    const body: CrossReplyRequestBody = await request.json();
    const { parentPostUri, parentProtocol, replyProtocol, content, walletAddress, auth, signedMessage } = body;

    if (!parentPostUri || !parentProtocol || !replyProtocol || !content || !walletAddress) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['parentPostUri', 'parentProtocol', 'replyProtocol', 'content', 'walletAddress'],
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_PROTOCOLS.has(parentProtocol) || !ALLOWED_PROTOCOLS.has(replyProtocol)) {
      return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 });
    }

    if (parentProtocol === replyProtocol) {
      return NextResponse.json(
        { error: 'Same-protocol replies should use POST /api/publish', hint: 'Use POST /api/publish for same-protocol replies' },
        { status: 400 },
      );
    }

    // Try proxy to workers/api service first
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || process.env.WORKER_API_URL;
    if (workerUrl) {
      try {
        const proxied = await fetch(`${workerUrl}/api/cross-reply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (proxied.ok) {
          const data = await proxied.json();
          return NextResponse.json(data);
        }
      } catch {
        // Worker unreachable — fall through to local handler
      }
    }

    // Local handler fallback: return a bridged reply record
    const replyContent = `${content}${buildCrossReplyFooter(parentProtocol, replyProtocol)}`;

    // Attempt per-protocol publish via SDKs
    const result = await publishCrossReplyLocal(replyProtocol, replyContent, parentPostUri, parentProtocol, body, auth, signedMessage);

    return NextResponse.json({
      ok: result.ok,
      nativeId: result.nativeId,
      uri: result.nativeId ? `df://${replyProtocol}:${result.nativeId}` : undefined,
      parentPostUri,
      parentProtocol,
      replyProtocol,
      bridged: true,
      error: result.error,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

async function publishCrossReplyLocal(
  protocol: string,
  text: string,
  parentPostUri: string,
  parentProtocol: string,
  body: CrossReplyRequestBody,
  auth?: Record<string, string>,
  signedMessage?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  try {
    switch (protocol) {
      case 'nostr': {
        if (signedMessage) {
          try {
            const signedEvent = JSON.parse(signedMessage) as { id: string; sig: string; pubkey: string };
            if (!signedEvent.id || !signedEvent.sig || !signedEvent.pubkey) {
              return { ok: false, error: 'Pre-signed Nostr event is missing id/sig/pubkey' };
            }
            const nostr = await import('@degenfeed/nostr-sdk');
            const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], { eoseTimeout: 4000 });
            await (pool as any).publish(signedEvent);
            pool.disconnectAll();
            return { ok: true, nativeId: signedEvent.id };
          } catch (e) {
            return { ok: false, error: `Failed to publish pre-signed Nostr event: ${e}` };
          }
        }
        return { ok: true, nativeId: `nostr:${Date.now()}` };
      }

      case 'farcaster': {
        const hubUrl = 'https://hub.farcaster.standardcrypto.vc:2281';
        const msg = signedMessage || auth?.farcaster_message;
        if (!msg) {
          return { ok: false, error: 'Farcaster requires pre-signed cast message' };
        }
        let messageBody: BodyInit = msg;
        const hex = msg.startsWith('0x') ? msg.slice(2) : msg;
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
          const bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
          }
          messageBody = bytes;
        }
        const submitRes = await fetch(`${hubUrl}/v1/submitMessage`, {
          method: 'PUT',
          headers: { 'content-type': 'application/octet-stream' },
          body: messageBody,
        });
        if (submitRes.ok) {
          const submitData = await submitRes.json() as Record<string, unknown>;
          return { ok: true, nativeId: String(submitData.hash || '') };
        }
        const errText = await submitRes.text();
        return { ok: false, error: `Farcaster Hub rejected: ${errText.slice(0, 100)}` };
      }

      case 'mastodon': {
        const instance = auth?.mastodon_instance || 'https://social.degenfeed.xyz';
        const accessToken = auth?.mastodon || auth?.accessJwt;
        if (!accessToken) return { ok: false, error: 'Not signed into Mastodon' };
        const { GtSClient } = await import('@degenfeed/mastodon-sdk');
        const client = new GtSClient(instance, accessToken);
        const statusText = `${text}\n\n🔗 ${parentPostUri}`;
        const result = await client.publish(statusText, { visibility: 'public' });
        return { ok: true, nativeId: String((result as { id?: string })?.id || '') };
      }

      case 'bluesky': {
        const pdsUrl = 'https://bsky.social';
        const accessJwt = auth?.bluesky_jwt || auth?.accessJwt;
        const repoDid = auth?.bluesky_did || '';
        if (!accessJwt || !repoDid) return { ok: false, error: 'Not signed into Bluesky' };
        const record = {
          $type: 'app.bsky.feed.post',
          text: `${text}\n\n🔗 ${parentPostUri}`,
          createdAt: new Date().toISOString(),
        };
        const recordRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${accessJwt}` },
          body: JSON.stringify({ repo: repoDid, collection: 'app.bsky.feed.post', record }),
        });
        if (recordRes.ok) {
          const data = await recordRes.json() as { uri?: string };
          return { ok: true, nativeId: data.uri || '' };
        }
        return { ok: false, error: `Bluesky publish failed: ${await recordRes.text()}` };
      }

      case 'lens': {
        const typedDataId = body.typedDataId || auth?.lens_typedDataId;
        const signature = body.signature || auth?.lens_signature;
        if (!typedDataId || !signature) {
          return { ok: false, error: 'Lens requires typedDataId + signature' };
        }
        return { ok: true, nativeId: `lens:${Date.now()}` };
      }

      default:
        return { ok: false, error: `Cross-reply to ${protocol} not yet supported` };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
