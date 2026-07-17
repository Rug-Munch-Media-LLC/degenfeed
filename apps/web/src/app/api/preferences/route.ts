import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { theme } = await request.json();
  const response = NextResponse.json({ ok: true });
  response.cookies.set('df_theme', theme, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
    secure: true,
    httpOnly: false,
  });
  return response;
}
