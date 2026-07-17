export const runtime = 'edge';

import type { Metadata } from 'next';

interface PostLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PostLayoutProps): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);

  // Default metadata
  const defaultMetadata: Metadata = {
    title: 'Post — DegenFeed',
    description: 'View post details on DegenFeed.',
    openGraph: {
      title: 'Post — DegenFeed',
      description: 'View post details on DegenFeed.',
      type: 'article',
      siteName: 'DegenFeed',
      url: `https://app.degenfeed.xyz/post/${encodeURIComponent(id)}`,
      images: [{ url: 'https://app.degenfeed.xyz/og-image.png', width: 1200, height: 630, alt: 'DegenFeed' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Post — DegenFeed',
      description: 'View post details on DegenFeed.',
      images: ['https://app.degenfeed.xyz/og-image.png'],
    },
  };

  // Try to fetch post data for richer preview
  try {
    const apiUrl = new URL('https://app.degenfeed.xyz/api/feed/post/' + encodeURIComponent(id));
    apiUrl.searchParams.set('format', 'og');
    const res = await fetch(apiUrl.toString(), {
      signal: AbortSignal.timeout(3000),
      headers: { 'user-agent': 'DegenFeed/1.0 (OGPreview)' },
    });
    if (res.ok) {
      // The OG endpoint returns HTML with meta tags — we prefer the JSON API
      const jsonRes = await fetch(
        'https://app.degenfeed.xyz/api/feed/post/' + encodeURIComponent(id),
        { signal: AbortSignal.timeout(3000), headers: { 'user-agent': 'DegenFeed/1.0 (OGPreview)' } },
      );
      if (jsonRes.ok) {
        const body = (await jsonRes.json()) as {
          data?: { text?: string; author?: { displayName?: string; avatarUrl?: string }; protocol?: string; embeds?: Array<{ kind: string; url: string }>; metrics?: { likes: number; reposts: number; replies: number }; createdAt?: number };
        };
        const post = body.data;
        if (post) {
          const author = post.author?.displayName || 'Unknown';
          const protocol = post.protocol || '';
          const text = (post.text || '').slice(0, 200);
          const image =
            post.embeds?.find((e) => e.kind === 'image')?.url ||
            post.author?.avatarUrl ||
            'https://app.degenfeed.xyz/og-image.png';

          return {
            title: `${author} on ${protocol} — DegenFeed`,
            description: text,
            openGraph: {
              title: `${author} on ${protocol}`,
              description: text,
              type: 'article',
              siteName: 'DegenFeed',
              url: `https://app.degenfeed.xyz/post/${encodeURIComponent(id)}`,
              images: [{ url: image, width: 1200, height: 630, alt: `${author} on ${protocol}` }],
            },
            twitter: {
              card: 'summary_large_image',
              title: `${author} on ${protocol}`,
              description: text,
              images: [image],
            },
          };
        }
      }
    }
  } catch {
    // Fall back to defaults
  }

  return defaultMetadata;
}

export default function PostLayout({ children }: PostLayoutProps) {
  return children;
}
