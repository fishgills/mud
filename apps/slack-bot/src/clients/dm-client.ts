import { initClient } from '@ts-rest/core';
import { dmContract } from '@mud/api-contracts';
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

export const dmClient = initClient(dmContract, {
  baseUrl: normalizeBaseUrl(env.DM_SERVICE_URL),
  baseHeaders: {},
  fetch: authorizedFetch,
});
