import 'server-only';

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { decodeMaybeBase64 } from './slack-env';

const SESSION_COOKIE = 'bf_session';
const STATE_COOKIE = 'bf_oauth_state';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const STATE_TTL_SECONDS = 60 * 10;

type SessionPayload = {
  teamId: string;
  userId: string;
  exp: number;
};

const getSecret = () => {
  const secret = decodeMaybeBase64(process.env.SLACK_STATE_SECRET);
  if (!secret && process.env.NODE_ENV !== 'production') {
    return 'dev-slack-session-secret';
  }
  if (!secret) {
    throw new Error('Missing SLACK_STATE_SECRET for Slack web auth.');
  }
  return secret;
};

const signValue = (value: string) => {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
};

const encodeSignedValue = (value: string) => {
  const signature = signValue(value);
  return `${value}.${signature}`;
};

const decodeSignedValue = (signed: string | undefined | null) => {
  if (!signed) return null;
  const [value, signature] = signed.split('.');
  if (!value || !signature) return null;
  const expected = signValue(value);
  const valid =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  return valid ? value : null;
};

const encodeSession = (payload: SessionPayload) => {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return encodeSignedValue(data);
};

const decodeSession = (signed: string | undefined | null) => {
  const data = decodeSignedValue(signed);
  if (!data) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf8'),
    ) as SessionPayload;
    if (!payload?.teamId || !payload?.userId) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

const isSecureCookie = () => process.env.NODE_ENV === 'production';

export const createOauthState = () => randomBytes(16).toString('hex');

export const setOauthStateCookie = (response: NextResponse, state: string) => {
  const signed = encodeSignedValue(state);
  response.cookies.set(STATE_COOKIE, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(),
    maxAge: STATE_TTL_SECONDS,
    path: '/',
  });
};

export const clearOauthStateCookie = (response: NextResponse) => {
  response.cookies.delete(STATE_COOKIE);
};

export const verifyOauthState = async (state: string | null) => {
  const cookieStore = await cookies();
  const stored = decodeSignedValue(cookieStore.get(STATE_COOKIE)?.value);
  if (!stored || !state) return false;
  return stored === state;
};

export const setSessionCookie = (
  response: NextResponse,
  teamId: string,
  userId: string,
) => {
  const payload: SessionPayload = {
    teamId,
    userId,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  response.cookies.set(SESSION_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(),
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });
};

export const getSession = async () => {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
};
