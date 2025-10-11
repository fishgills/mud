import { initClient } from '@ts-rest/core';
import { worldContract } from '@mud/api-contracts';
import { authorizedFetch } from '@mud/gcp-auth';
import { env } from '../env';

const normalizeBaseUrl = (urlStr: string): string => {
  try {
    const url = new URL(urlStr);
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.toString();
  } catch {
    return urlStr.replace(/\/$/, '');
  }
};

export const worldClient = initClient(worldContract, {
  baseUrl: normalizeBaseUrl(env.WORLD_SERVICE_URL),
  baseHeaders: {},
  fetch: authorizedFetch,
});
