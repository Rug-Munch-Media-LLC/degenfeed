// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/space/:id — Frame for an audio space
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return a Farcaster Frame HTML page for an audio space.
 *
 * Uses fc:live meta tags (FIP #269) for live activity discovery.
 * Shows speakers, listener count, and join button.
 */
frames.get('/space/:id', async (c) => {
  const spaceId = c.req.param('id');
  const space = await getSpace(c.env, spaceId);

  if (!space) {
    return c.html(
      generateFrameHtml({
        image: 'https://app.degenfeed.xyz/og/space-not-found.png',
        title: 'Space Not Found — DegenFeed',
        buttons: [
          {
            index: 1,
            label: 'Browse Spaces',
            action: 'link',
            target: 'https://app.degenfeed.xyz/spaces',
          },
        ],
      }),
    );
  }

  const title = (space.title as string) || 'Untitled Space';
  const hostName = (space.hostName as string) || 'Anonymous';
  const _hostId = (space.hostId as string) || '';
  const speakers = (space.speakers as Array<Record<string, unknown>>) || [];
  const listenerCount = (space.listeners as number) || 0;
  const speakerCount = speakers.length || 0;
  const _status = (space.status as string) || 'live';
  const _tags = (space.tags as string[]) || [];
  const thumbnail = 'https://app.degenfeed.xyz/og/space-default.png';

  // Build live activity meta for FIP #269
  const hostFid = (space.hostFid as number) || 0;
  const startedAt = (space.startedAt as number) || (space.createdAt as number) || Date.now();
  const speakerFids = speakers
    .map((s) => s.fid as number | undefined)
    .filter((f): f is number => f !== undefined);

  const liveActivity: LiveActivityMeta = {
    type: 'live-audio-space',
    title,
    description: `Audio space hosted by ${hostName} on DegenFeed`,
    image: thumbnail,
    hostFid,
    startedAt,
    speakerFids: speakerFids.length > 0 ? speakerFids : undefined,
    participantCount: speakerCount + listenerCount,
    protocol: 'webrtc',
  };

  const frameUrl = `https://app.degenfeed.xyz/api/farcaster/frames/space/${spaceId}`;
  const spaceAppUrl = `https://app.degenfeed.xyz/spaces/${spaceId}`;
  const speakerInfo = `👥 ${speakerCount} speakers · ${listenerCount} listening`;

  const html = generateFrameHtml({
    image: `https://app.degenfeed.xyz/api/farcaster/frames/space/${spaceId}/image`,
    imageAspectRatio: '1:1',
    title: `🎙️ ${title}`,
    description: speakerInfo,
    postUrl: frameUrl,
    liveActivity,
    refreshInterval: 15,
    buttons: [
      {
        index: 1,
        label: '🎙️ Join Space',
        action: 'link',
        target: spaceAppUrl,
      },
      {
        index: 2,
        label: speakerCount > 0 ? `👥 Speakers (${speakerCount})` : '👥 Join as Speaker',
        action: 'post',
      },
      {
        index: 3,
        label: `🎧 ${listenerCount} listening`,
        action: 'post',
      },
    ],
  });

  return c.html(html);
});

// POST handler for /space/:id — handle button:2 (speakers) and button:3 (listeners)
frames.post('/space/:id', async (c) => {
  const spaceId = c.req.param('id');
  const space = await getSpace(c.env, spaceId);

  if (!space) {
    return c.html(
      generateFrameHtml({
        image: 'https://app.degenfeed.xyz/og/space-not-found.png',
        title: 'Space Not Found',
        buttons: [
          {
            index: 1,
            label: '← Back',
            action: 'link',
            target: 'https://app.degenfeed.xyz/spaces',
          },
        ],
      }),
    );
  }

  const title = (space.title as string) || 'Untitled Space';
  const speakers = (space.speakers as Array<Record<string, unknown>>) || [];
  const listenerCount = (space.listeners as number) || 0;
  const spaceAppUrl = `https://app.degenfeed.xyz/spaces/${spaceId}`;

  // Return speakers/listeners info frame
  const _speakerList = speakers
    .slice(0, 5)
    .map((s) => `• ${(s.displayName as string) || 'Anonymous'}`)
    .join('\n');

  const html = generateFrameHtml({
    image: 'https://app.degenfeed.xyz/og/space-speakers.png',
    imageAspectRatio: '1:1',
    title: `🎙️ ${title}`,
    description: `${speakers.length} speakers · ${listenerCount} listeners`,
    postUrl: `https://app.degenfeed.xyz/api/farcaster/frames/space/${spaceId}`,
    buttons: [
      {
        index: 1,
        label: '🎙️ Join',
        action: 'link',
        target: spaceAppUrl,
      },
      {
        index: 2,
        label: '↩️ Back',
        action: 'post',
      },
    ],
  });

  return c.html(html);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/space/:id/image — Dynamic SVG badge for space
// ═══════════════════════════════════════════════════════════════════════════

frames.get('/space/:id/image', async (c) => {
  const spaceId = c.req.param('id');
  const space = await getSpace(c.env, spaceId);

  const title = (space?.title as string) || 'Untitled Space';
  const hostName = (space?.hostName as string) || 'Anonymous';
  const speakerCount = ((space?.speakers as Array<unknown>) || []).length;
  const listenerCount = (space?.listeners as number) || 0;
  const status = (space?.status as string) || 'live';

  const hue = (spaceId.charCodeAt(0) * 53) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="630" height="630" viewBox="0 0 630 630">
  <defs>
    <radialGradient id="bg">
      <stop offset="0%" style="stop-color:hsl(${hue}, 50%, 25%)" />
      <stop offset="100%" style="stop-color:hsl(${hue}, 60%, 10%)" />
    </radialGradient>
    ${
      status === 'live'
        ? `<linearGradient id="liveBadge" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00ff41" />
      <stop offset="100%" style="stop-color:#00cc33" />
    </linearGradient>`
        : ''
    }
  </defs>

  <rect width="630" height="630" fill="url(#bg)" rx="16" />

  <!-- Microphone icon -->
  <g transform="translate(315, 180)" text-anchor="middle">
    <circle cx="0" cy="0" r="80" fill="rgba(255,255,255,0.1)" />
    <text x="0" y="20" fill="white" font-family="Arial, sans-serif" font-size="72">🎙️</text>
  </g>

  <!-- Status badge -->
  ${
    status === 'live'
      ? `<rect x="215" y="280" width="200" height="44" rx="22" fill="url(#liveBadge)" />
       <text x="315" y="308" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">LIVE</text>`
      : `<rect x="215" y="280" width="200" height="44" rx="22" fill="rgba(255,255,255,0.15)" />
       <text x="315" y="308" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20">${status === 'scheduled' ? 'SCHEDULED' : 'ENDED'}</text>`
  }

  <!-- Title -->
  <text x="315" y="380" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="32" font-weight="bold">
    ${escapeXml(title.slice(0, 30))}
  </text>

  <!-- Host -->
  <text x="315" y="430" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Arial, sans-serif" font-size="22">
    by ${escapeXml(hostName.slice(0, 25))}
  </text>

  <!-- Stats -->
  <g transform="translate(315, 500)" text-anchor="middle">
    <text x="-80" y="0" fill="rgba(255,255,255,0.6)" font-family="Arial, sans-serif" font-size="18">
      👥 ${speakerCount} speakers
    </text>
    <text x="80" y="0" fill="rgba(255,255,255,0.6)" font-family="Arial, sans-serif" font-size="18">
      🎧 ${listenerCount} listening
    </text>
  </g>

  <text x="580" y="590" text-anchor="end" fill="rgba(255,255,255,0.2)" font-family="Arial, sans-serif" font-size="14">
    DegenFeed
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'no-cache, no-store, must-revalidate',
      'access-control-allow-origin': '*',
    },
  });
});

