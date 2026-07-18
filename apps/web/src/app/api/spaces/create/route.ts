import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const id = Array.from({ length: 16 }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)],
    ).join('');

    const space = {
      id,
      title,
      description: body.description || '',
      hostId: body.hostId || 'anon',
      hostName: body.hostName || 'Anonymous',
      hostAvatarUrl: body.hostAvatarUrl,
      coHosts: body.coHosts || [],
      protocols: body.protocols || [],
      status: body.scheduledAt && new Date(body.scheduledAt).getTime() > Date.now() ? 'scheduled' as const : 'live' as const,
      createdAt: Date.now(),
      scheduledAt: body.scheduledAt,
      listeners: 1,
      speakers: [{ id: body.hostId || 'anon', displayName: body.hostName || 'Host', isHost: true, isCoHost: false, speaking: false }],
      reactions: [],
      tippingEnabled: body.tippingEnabled ?? true,
    };

    return NextResponse.json({ space, ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
