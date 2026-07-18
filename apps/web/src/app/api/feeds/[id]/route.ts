import { NextResponse } from 'next/server';
import { mockCustomFeeds, mockPublicFeeds } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feed = mockCustomFeeds.find((f) => f.id === id) ?? mockPublicFeeds.find((f) => f.id === id);

  if (!feed) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
  }

  return NextResponse.json({ feed });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return NextResponse.json({ ok: true, feed: { id, ...body } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ ok: true, id });
}
