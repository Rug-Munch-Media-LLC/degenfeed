import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;

    // Simulate join — always succeeds for demo
    return NextResponse.json({
      data: { success: true, memberCount: Math.floor(Math.random() * 100) + 1 },
      meta: { community: name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
