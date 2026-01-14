import 'server-only';

type ItemActionResponse = {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
};

const dmBaseUrl = process.env.DM_API_BASE_URL ?? 'http://localhost:3000/dm';

type JsonMap = Record<string, unknown>;

type RequestOptions = {
  query?: Record<string, string | number | undefined | null>;
  body?: JsonMap;
};

const dmRequest = async <T>(
  path: string,
  method: 'GET' | 'POST',
  options: RequestOptions = {},
): Promise<T> => {
  const url = new URL(`${dmBaseUrl}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = (await response.json()) as Record<string, unknown>;
      if (typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      const text = await response.text().catch(() => '');
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const equipItem = async (params: {
  teamId: string;
  userId: string;
  playerItemId: number;
  slot: string;
}): Promise<ItemActionResponse> => {
  return dmRequest<ItemActionResponse>('/players/equip', 'POST', {
    body: {
      teamId: params.teamId,
      userId: params.userId,
      playerItemId: params.playerItemId,
      slot: params.slot,
    },
  });
};

export const unequipItem = async (params: {
  teamId: string;
  userId: string;
  playerItemId: number;
}): Promise<ItemActionResponse> => {
  return dmRequest<ItemActionResponse>('/players/unequip', 'POST', {
    body: {
      teamId: params.teamId,
      userId: params.userId,
      playerItemId: params.playerItemId,
    },
  });
};
