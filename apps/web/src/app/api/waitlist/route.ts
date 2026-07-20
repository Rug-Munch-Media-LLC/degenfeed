import { NextResponse } from 'next/server';

interface WaitlistBody {
  email: string;
  creatorType?: string;
  platforms?: string[];
  features?: string[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WaitlistBody;

    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // In production, insert into your waitlist database or CRM here
    // For now, log and return success
    console.info(
      '[Waitlist]',
      JSON.stringify({
        email: body.email,
        creatorType: body.creatorType,
        platforms: body.platforms,
        features: body.features,
        timestamp: new Date().toISOString(),
      }),
    );

    return NextResponse.json({ success: true, message: 'Added to waitlist' });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
