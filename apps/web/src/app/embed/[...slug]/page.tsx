import type { Metadata } from 'next';
import { EmbedPageClient } from './client';

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const rawUri = slug?.join('/') || '';
  const dfUri = decodeURIComponent(rawUri);

  const metadata: Metadata = {
    title: 'Post on DegenFeed',
    description: 'View this embedded post on DegenFeed.',
    openGraph: {
      title: 'Post on DegenFeed',
      description: 'View this embedded post on DegenFeed.',
      type: 'article',
      siteName: 'DegenFeed',
      url: `https://app.degenfeed.xyz/embed/${encodeURIComponent(dfUri)}`,
    },
    twitter: {
      card: 'summary_large_image',
    },
  };

  // Try to fetch post data for richer preview
  try {
    const apiUrl = new URL('https://app.degenfeed.xyz/api/content/' + encodeURIComponent(dfUri));
    const res = await fetch(apiUrl.toString(), {
      signal: AbortSignal.timeout(3000),
      headers: { 'user-agent': 'DegenFeed/1.0 (EmbedPage)' },
    });
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { text?: string; author?: { displayName?: string }; protocol?: string; embeds?: Array<{ kind: string; url: string }> };
      };
      const post = body.data;
      if (post) {
        const author = post.author?.displayName || 'Unknown';
        const protocol = post.protocol || '';
        const text = (post.text || '').slice(0, 200);
        const image =
          post.embeds?.find((e) => e.kind === 'image')?.url ||
          'https://app.degenfeed.xyz/og-image.png';

        metadata.title = `${author} on ${protocol} — DegenFeed`;
        metadata.description = text;
        metadata.openGraph = {
          ...metadata.openGraph,
          title: `${author} on ${protocol}`,
          description: text,
          images: [{ url: image, width: 1200, height: 630, alt: `${author} on ${protocol}` }],
        };
        metadata.twitter = {
          ...metadata.twitter,
          title: `${author} on ${protocol}`,
          description: text,
          images: [image],
        };
      }
    }
  } catch {
    // Fall back to defaults
  }

  return metadata;
}

export default async function EmbedPage({ params }: Props) {
  const slug = (await params).slug;
  const rawUri = slug?.join('/') || '';
  const dfUri = decodeURIComponent(rawUri);

  return <EmbedPageClient dfUri={dfUri} />;
}
