import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

export async function POST(_request: Request) {
  try {
    // Not yet implemented — see ROADMAP.md
    return NextResponse.json(
      { error: 'Community joining not yet available', status: 501 },
      { status: 501 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
