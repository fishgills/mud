import { initClient } from '@ts-rest/core';
import { worldContract } from '@mud/api-contracts';
import { authorizedFetch } from '@mud/gcp-auth';
import { env } from '../env';

const normalizeBaseUrl = (url: string): string => {
  if (!url) {
    return 'http://localhost:3000/world';
  }

  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/world';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '');
  }
};

export const worldClient = initClient(worldContract, {
  baseUrl: normalizeBaseUrl(env.WORLD_SERVICE_URL),
  baseHeaders: {},
  fetch: authorizedFetch,
});
