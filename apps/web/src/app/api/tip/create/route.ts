import { NextResponse } from 'next/server';
import { z } from 'zod';
export const dynamic = 'force-dynamic';

const TipSchema = z.object({
  recipient: z.string().min(1).max(100),
  method: z.enum(['lightning', 'on-chain', 'x402']),
  amount: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, 'Amount must be positive'),
  message: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = TipSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Not yet implemented — see ROADMAP.md
    return NextResponse.json({ error: 'Tip creation coming soon', status: 501 }, { status: 501 });
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
