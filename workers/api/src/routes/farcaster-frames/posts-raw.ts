// ═══════════════════════════════════════════════════════════════════════════
// POST /api/farcaster/frames/post — Post a frame as a Farcaster cast
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Post a frame URL as a cast to Farcaster via Hubble.
 *
 * Expects JSON body:
 *   { text: string, embedUrl: string, channelId?: string }
 *
 * Uses our self-hosted Hubble to sign and submit the cast.
 * The frame URL must serve valid Frame meta tags.
 */
frames.post('/post', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      text?: string;
      embedUrl?: string;
      channelId?: string;
    };

    if (!body.text) {
      return jsonResponse({ error: 'text is required' }, 400);
    }
    if (!body.embedUrl) {
      return jsonResponse({ error: 'embedUrl is required' }, 400);
    }

    const result = await postCastToFarcaster(
      c.env,
      '',
      body.text,
      [body.embedUrl],
      body.channelId,
    );

    if (result.error) {
      return jsonResponse({ error: result.error }, 500);
    }

    return jsonResponse({
      ok: true,
      hash: result.hash,
      url: `https://warpcast.com/~/conversations/${result.hash}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to post frame: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/farcaster/frames/post-to-channel — Post frame to a Farcaster channel
// ═══════════════════════════════════════════════════════════════════════════

frames.post('/post-to-channel', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      text?: string;
      embedUrl?: string;
      channelId?: string;
    };

    if (!body.text) {
      return jsonResponse({ error: 'text is required' }, 400);
    }
    if (!body.embedUrl) {
      return jsonResponse({ error: 'embedUrl is required' }, 400);
    }
    if (!body.channelId) {
      return jsonResponse({ error: 'channelId is required' }, 400);
    }

    const result = await postCastToFarcaster(
      c.env,
      '',
      body.text,
      [body.embedUrl],
      body.channelId,
    );

    if (result.error) {
      return jsonResponse({ error: result.error }, 502);
    }

    return jsonResponse({
      ok: true,
      hash: result.hash,
      channelId: body.channelId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to post to channel: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/farcaster/frames/announce-stream — Announce stream to Farcaster channels
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Announce a stream to relevant Farcaster channels.
 *
 * Discovers matching channels from the stream's category/tags,
 * then posts the frame to each channel.
 */
frames.post('/announce-stream', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      streamId?: string;
      title?: string;
      creatorHandle?: string;
      category?: string;
      tags?: string[];
    };

    if (!body.streamId) {
      return jsonResponse({ error: 'streamId is required' }, 400);
    }

    const title = body.title || 'Untitled Stream';
    const creatorHandle = body.creatorHandle || session.displayName || session.address.slice(0, 10);
    const embedUrl = `https://app.degenfeed.xyz/api/farcaster/frames/stream/${body.streamId}`;

    // Find relevant channels
    const channels = getRelevantChannels(body.category, body.tags);

    if (channels.length === 0) {
      return jsonResponse({ error: 'No relevant channels found' }, 404);
    }

    // Post to each channel via Hubble
    const results = await Promise.allSettled(
      channels.map(async (ch: FarcasterChannel) => {
        const castText = `🔴 LIVE: ${title}\n\n${creatorHandle} is streaming on DegenFeed`;
        return postCastToFarcaster(c.env, '', castText, [embedUrl], ch.id);
      }),
    );

    const announcements = results.map((r, i) => ({
      channelId: channels[i]?.id ?? 'unknown',
      status: r.status === 'fulfilled' ? (r.value.hash ? 'posted' : 'failed') : 'error',
      hash: r.status === 'fulfilled' ? r.value.hash : undefined,
      error:
        r.status === 'rejected'
          ? r.reason instanceof Error
            ? r.reason.message
            : String(r.reason)
          : r.status === 'fulfilled'
            ? r.value.error
            : undefined,
    }));

    return jsonResponse({
      ok: true,
      announcements,
      channelsAnnounced: announcements.filter((a) => a.status === 'posted').length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to announce stream: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/channels — List available Farcaster channels
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return the list of available Farcaster channels for announcement routing.
 */
frames.get('/channels', async (_c) => {
  const channels = getRelevantChannels();
  return noCacheJsonResponse({ channels });
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
