import { NextResponse } from 'next/server';
import {
  clearOauthStateCookie,
  setSessionCookie,
  verifyOauthState,
} from '../../../../lib/slack-auth';
import { decodeMaybeBase64 } from '../../../../lib/slack-env';

type SlackOauthResponse = {
  ok: boolean;
  error?: string;
  team?: { id?: string };
  authed_user?: { id?: string };
};

export const dynamic = 'force-dynamic';
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');
const getOrigin = (request: Request) => {
  const forwardedHost =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const forwardedProto =
    request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol;
  if (!forwardedHost) {
    return new URL(request.url).origin;
  }
  return `${forwardedProto}://${forwardedHost}`;
};

const exchangeCodeForToken = async (params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}) => {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
  });

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  return (await response.json()) as SlackOauthResponse;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  console.log('[slack-oauth] callback', {
    host: request.headers.get('host'),
    basePath,
    codePresent: Boolean(code),
    statePresent: Boolean(state),
    error,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code || !(await verifyOauthState(state))) {
    const response = NextResponse.json(
      { error: 'Invalid OAuth state.' },
      { status: 400 },
    );
    clearOauthStateCookie(response);
    console.warn('[slack-oauth] invalid state', {
      codePresent: Boolean(code),
      statePresent: Boolean(state),
    });
    return response;
  }

  const clientId = decodeMaybeBase64(process.env.SLACK_CLIENT_ID);
  const clientSecret = decodeMaybeBase64(process.env.SLACK_CLIENT_SECRET);
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Missing Slack OAuth credentials.' },
      { status: 500 },
    );
  }

  const redirectUri =
    process.env.SLACK_OAUTH_REDIRECT_URL ??
    new URL(
      `${basePath}/api/auth/slack/callback`,
      getOrigin(request),
    ).toString();

  const oauthResponse = await exchangeCodeForToken({
    code,
    redirectUri,
    clientId,
    clientSecret,
  });

  if (!oauthResponse.ok) {
    console.error('[slack-oauth] token exchange failed', {
      error: oauthResponse.error ?? 'unknown',
    });
    return NextResponse.json(
      { error: oauthResponse.error ?? 'OAuth failed.' },
      { status: 400 },
    );
  }

  const teamId = oauthResponse.team?.id;
  const userId = oauthResponse.authed_user?.id;
  if (!teamId || !userId) {
    console.error('[slack-oauth] missing user/team', {
      teamIdPresent: Boolean(teamId),
      userIdPresent: Boolean(userId),
    });
    return NextResponse.json(
      { error: 'Slack OAuth response missing user or team.' },
      { status: 400 },
    );
  }

  const response = NextResponse.redirect(
    new URL(`${basePath}/me`, getOrigin(request)),
  );
  clearOauthStateCookie(response);
  setSessionCookie(response, teamId, userId);
  console.log('[slack-oauth] success', {
    teamId,
    userId,
    redirect: `${basePath}/me`,
  });

  return response;
}
