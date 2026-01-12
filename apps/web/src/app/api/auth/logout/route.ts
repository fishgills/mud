import { NextResponse } from 'next/server';

/**
 * Logout endpoint - clears the session cookie
 */
export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear the session cookie by setting it to expire immediately
  response.cookies.set('bf_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  return response;
}
