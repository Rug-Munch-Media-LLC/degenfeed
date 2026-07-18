import { NextResponse } from 'next/server';
import { MOCK_MY_FEEDS as mockCustomFeeds, MOCK_PUBLIC_FEEDS as mockPublicFeeds } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const feed = mockCustomFeeds.find((f) => f.id === id) ?? mockPublicFeeds.find((f) => f.id === id);

    if (!feed) {
      return NextResponse.json({ error: 'Feed not found', status: 404 }, { status: 404 });
    }

    return NextResponse.json({ data: { feed } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json({ data: { ok: true, feed: { id, ...body } } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json({ error: message, status: 400 }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ data: { ok: true, id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
