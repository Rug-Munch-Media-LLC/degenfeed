import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : name;
    const description = typeof body.description === 'string' ? body.description.trim() : '';

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
    }
    if (name.length > 48) {
      return NextResponse.json({ error: 'Name must be 48 characters or fewer' }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    const community = {
      id: slug,
      name: slug,
      displayName: displayName || name,
      description,
      createdAt: Date.now(),
      creator: { walletAddress: '0xuser...0000', identities: {} },
      protocols: {},
      memberCount: 1,
      postCount: 0,
      tags: [],
    };

    return NextResponse.json({ success: true, community }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
