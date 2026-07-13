export const runtime = 'edge';

import type { Metadata } from 'next';
import { SECTIONS } from '../sections';

interface Props {
  params: Promise<{ section: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const label = SECTIONS.find((s) => s.id === section)?.label ?? section;
  return {
    title: label,
    description: `Browse ${label} posts on DegenFeed. ${SECTIONS.find((s) => s.id === section)?.description ?? ''}`,
  };
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
