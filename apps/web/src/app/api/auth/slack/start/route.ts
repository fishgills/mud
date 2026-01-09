import { NextResponse } from 'next/server';
import {
  createOauthState,
  setOauthStateCookie,
} from '../../../../lib/slack-auth';
import { decodeMaybeBase64 } from '../../../../lib/slack-env';

const USER_SCOPE = 'identity.basic';
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

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientId = decodeMaybeBase64(process.env.SLACK_CLIENT_ID);
  if (!clientId) {
    return NextResponse.json(
      { error: 'Missing SLACK_CLIENT_ID.' },
      { status: 500 },
    );
  }

  const redirectUri =
    process.env.SLACK_OAUTH_REDIRECT_URL ??
    new URL(
      `${basePath}/api/auth/slack/callback`,
      getOrigin(request),
    ).toString();
  const state = createOauthState();
  console.log('[slack-oauth] start', {
    host: request.headers.get('host'),
    basePath,
    redirectUri,
    clientId: clientId.slice(0, 6),
  });

  const authorizeUrl = new URL('https://slack.com/oauth/v2/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('user_scope', USER_SCOPE);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  console.log('[slack-oauth] redirect', {
    authorizeUrl: authorizeUrl.toString(),
  });

  const response = NextResponse.redirect(authorizeUrl.toString());
  setOauthStateCookie(response, state);
  return response;
}
