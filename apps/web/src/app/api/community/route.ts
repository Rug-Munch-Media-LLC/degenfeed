import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const _displayName = typeof body.displayName === 'string' ? body.displayName.trim() : name;
    const _description = typeof body.description === 'string' ? body.description.trim() : '';

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
    }
    if (name.length > 48) {
      return NextResponse.json({ error: 'Name must be 48 characters or fewer' }, { status: 400 });
    }

    // Not yet implemented — see ROADMAP.md
    return NextResponse.json(
      { error: 'Community creation not yet available', status: 501 },
      { status: 501 },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
