import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const LeaveSchema = z.object({
  userId: z.string().optional(),
});

/**
 * POST /api/spaces/[id]/leave — Leave a space
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rawBody = await request.json().catch(() => ({}));
  LeaveSchema.safeParse(rawBody);
  return NextResponse.json({
    space: { id, listeners: Math.max(0, Math.floor(Math.random() * 500)) },
    ok: true,
  });
}
