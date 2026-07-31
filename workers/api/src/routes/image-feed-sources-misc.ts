/** 6. Lens — image publications via Lens API */
export async function fetchLensImages(env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev';
  const meta = metaFor('lens');

  const query = `query {
    posts(
      request: {filter: {postTypes: [ROOT]}, pageSize: ${Math.min(limit, 50) === 50 ? 'FIFTY' : 'TEN'}}
    ) { items { __typename ... on Post {
        id
        timestamp
        metadata { ... on ImageMetadata {
          content title image { item }
        } ... on TextOnlyMetadata { content } }
        author { address username { localName } metadata { name picture } }
        stats { reactions comments reposts quotes }
      }}
    }
  }`;

  try {
    const res = await fetchWithTimeout(lensApi, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/1.0' },
      body: JSON.stringify({ query }),
      timeout: 5000,
    });
    if (!res?.ok) return results;

    const json = (await res.json()) as {
      data?: { posts?: { items: Array<Record<string, unknown>> } };
    };

    const items = json?.data?.posts?.items ?? [];
    for (const item of items) {
      const meta_data = item.metadata as Record<string, unknown> | undefined;
      const image = meta_data?.image as Record<string, unknown> | undefined;
      const imageUrl = (image?.item as string) ?? '';
      if (!imageUrl) continue;

      const profile = item.author as Record<string, unknown> | undefined;
      const stats = item.stats as Record<string, unknown> | undefined;
      const authorMeta = profile?.metadata as Record<string, unknown> | undefined;
      const username = profile?.username as Record<string, unknown> | undefined;

      results.push({
        id: `lens:${item.id as string}`,
        source: 'lens' as ImageSource,
        protocol: 'lens',
        imageUrl,
        fullImageUrl: imageUrl,
        title: (meta_data?.title as string) ?? (meta_data?.content as string) ?? '',
        author: {
          id: `lens:${profile?.address as string}`,
          displayName: (authorMeta?.name as string) ?? (username?.localName as string) ?? 'Lens Creator',
          handle: username?.localName as string,
          avatarUrl: (authorMeta?.picture as string) ?? '',
        },
        sourceBadge: meta.badge,
        sourceColor: meta.color,
        sourceLabel: meta.label,
        category: guessCategory(
          (meta_data?.title as string) ?? '',
          (meta_data?.tags as string[]) ?? [],
          'lens',
        ),
        createdAt: new Date(item.timestamp as string).getTime(),
        aspectRatio: 4 / 3,
        likes: 0,
        shares: (stats?.reposts as number) ?? 0,
        comments: (stats?.comments as number) ?? 0,
        isNFT: false,
        tags: (meta_data?.tags as string[]) ?? [],
      });
    }
  } catch (err) {
    log('warn', '[image-feed] Lens fetch failed:', err);
  }
  return results;
}

/** 7. IPFS/Arweave — decentralized images via gateway */
export async function fetchDecentralizedImages(_env: Env, _limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];

  // Fetch trending content from IPFS via NFT storage or pinning services
  // This is a best-effort — real deployment would use a curated index
  try {
    const sources = [
      {
        url: 'https://ipfs.io/api/v0/refs?arg=/ipns/nftstorage.link&limit=20',
        source: 'ipfs' as ImageSource,
      },
      { url: 'https://arweave.net/graphql', source: 'arweave' as ImageSource },
    ];

    for (const src of sources) {
      if (results.length >= _limit) break;
      try {
        const res = await fetchWithTimeout(src.url, { timeout: 3000 });
        if (!res?.ok) continue;
        const text = await res.text();
        log('info', `[image-feed] ${src.source} returned ${text.length} bytes`);
      } catch {
        // Source unavailable
      }
    }
  } catch {
    // Decentralized fetch unavailable
  }

  return results;
}

/** 8. Reddit — image posts */
export async function fetchRedditImages(_env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const meta = metaFor('reddit');
  const subreddits = [
    'Art',
    'photography',
    'itookapicture',
    'EarthPorn',
    'NFT',
    'streetphotography',
  ];

  const fetches = subreddits.slice(0, 5).map(async (sub) => {
    try {
      const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${Math.ceil(limit / 5)}`;
      const res = await fetchWithTimeout(url, {
        headers: { 'user-agent': 'DegenFeed/1.0 (by /u/degenfeed)' },
        timeout: 4000,
      });
      if (!res?.ok) return [];
      const json = (await res.json()) as {
        data?: { children?: Array<{ data: Record<string, unknown> }> };
      };
      return (json.data?.children ?? [])
        .map((child) => {
          const d = child.data;
          const imageUrl = (d.url_overridden_by_dest as string) || (d.url as string) || '';
          const isImage = /\.(jpg|jpeg|png|gif|webp)/i.test(imageUrl);
          if (!isImage) return null;
          return {
            id: `reddit:${d.id as string}`,
            source: 'reddit' as ImageSource,
            protocol: 'reddit',
            imageUrl,
            fullImageUrl: imageUrl,
            title: (d.title as string)?.slice(0, 200) ?? '',
            author: {
              id: `reddit:${d.author as string}`,
              displayName: `u/${d.author as string}`,
            },
            sourceBadge: meta.badge,
            sourceColor: meta.color,
            sourceLabel: meta.label,
            category: guessCategory(d.title as string, [sub], 'reddit'),
            createdAt: (d.created_utc as number) * 1000,
            aspectRatio: (() => {
              const preview = d.preview as Record<string, unknown> | undefined;
              const images = preview?.images as Array<Record<string, unknown>> | undefined;
              const source = images?.[0]?.source as Record<string, number> | undefined;
              return source?.width ? source.width / source.height : 4 / 3;
            })(),
            likes: (d.ups as number) ?? 0,
            shares: 0,
            comments: (d.num_comments as number) ?? 0,
            isNFT: sub === 'NFT',
            tags: [sub],
            url: `https://reddit.com${d.permalink as string}`,
          } as UnifiedImage;
        })
        .filter(Boolean) as UnifiedImage[];
    } catch {
      return [];
    }
  });

  const settled = await Promise.allSettled(fetches);
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value);
  }
  return results;
}

/** 9. Immich/Lychee — self-hosted image galleries */
export async function fetchSelfHostedImages(env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];

  // Immich
  const immichUrl = env.IMMICH_URL;
  const immichKey = env.IMMICH_API_KEY;
  if (immichUrl && immichKey) {
    const meta = metaFor('immich');
    try {
      const res = await fetchWithTimeout(`${immichUrl}/api/albums?shared=true`, {
        headers: { 'x-api-key': immichKey, accept: 'application/json' },
        timeout: 3000,
      });
      if (res?.ok) {
        const albums = (await res.json()) as Array<{ id: string; albumName: string }>;
        // Fetch assets from first few albums
        for (const album of albums.slice(0, 3)) {
          try {
            const assetRes = await fetchWithTimeout(
              `${immichUrl}/api/albums/${album.id}?limit=${Math.ceil(limit / 3)}`,
              { headers: { 'x-api-key': immichKey }, timeout: 3000 },
            );
            if (!assetRes?.ok) continue;
            const albumData = (await assetRes.json()) as {
              assets?: Array<{
                id: string;
                originalPath: string;
                thumbhash?: string;
                exifInfo?: {
                  imageName?: string;
                  exifImageWidth?: number;
                  exifImageHeight?: number;
                };
                ownerId?: string;
                type: 'IMAGE' | 'VIDEO';
              }>;
            };
            for (const asset of albumData.assets ?? []) {
              if (asset.type !== 'IMAGE') continue;
              results.push({
                id: `immich:${asset.id}`,
                source: 'immich' as ImageSource,
                protocol: 'immich',
                imageUrl: `${immichUrl}/api/asset/${asset.id}/thumbnail?size=preview`,
                fullImageUrl: `${immichUrl}/api/asset/${asset.id}/original`,
                thumbnailUrl: `${immichUrl}/api/asset/${asset.id}/thumbnail?size=thumbnail`,
                title:
                  asset.exifInfo?.imageName ?? asset.originalPath.split('/').pop() ?? 'Untitled',
                author: { id: `immich:${asset.ownerId ?? 'unknown'}`, displayName: 'Immich User' },
                sourceBadge: meta.badge,
                sourceColor: meta.color,
                sourceLabel: meta.label,
                category: 'photography',
                createdAt: Date.now(),
                width: asset.exifInfo?.exifImageWidth,
                height: asset.exifInfo?.exifImageHeight,
                aspectRatio:
                  asset.exifInfo?.exifImageWidth && asset.exifInfo?.exifImageHeight
                    ? asset.exifInfo.exifImageWidth / asset.exifInfo.exifImageHeight
                    : 4 / 3,
                likes: 0,
                shares: 0,
                comments: 0,
                isNFT: false,
                tags: [album.albumName],
              });
            }
          } catch {
            /* album fetch failed */
          }
        }
      }
    } catch {
      /* immich unavailable */
    }
  }

  return results;
}
