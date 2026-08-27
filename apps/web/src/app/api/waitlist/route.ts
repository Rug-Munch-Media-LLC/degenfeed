import { NextResponse } from 'next/server';
import { WaitlistSchema } from '../../../lib/validation/schemas';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = WaitlistSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // In production, insert into your waitlist database or CRM here
    // For now, log and return success
    console.info(
      '[Waitlist]',
      JSON.stringify({
        email: parsed.data.email,
        name: parsed.data.name,
        referrer: parsed.data.referrer,
        interests: parsed.data.interests,
        timestamp: new Date().toISOString(),
      }),
    );

    return NextResponse.json({ success: true, message: 'Added to waitlist' });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
