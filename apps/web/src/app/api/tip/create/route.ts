import { NextResponse } from 'next/server';
// TODO: Wire to worker backend — see ROADMAP.md
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recipient, method, amount } = body;

    if (!recipient || !method || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: recipient, method, amount' },
        { status: 400 },
      );
    }

    // Not yet implemented — see ROADMAP.md
    return NextResponse.json({ error: 'Tip creation coming soon', status: 501 }, { status: 501 });
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
