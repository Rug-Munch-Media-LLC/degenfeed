import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  // Simulate join — always succeeds for demo
  return NextResponse.json({ success: true, memberCount: Math.floor(Math.random() * 100) + 1 });
}
