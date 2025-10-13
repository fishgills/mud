import { authorizedFetch } from '@mud/gcp-auth';
import { env } from './env';

type JsonMap = Record<string, unknown>;

type PlayerRecord = {
  id?: number;
  slackId?: string;
  name?: string;
  x?: number;
  y?: number;
  hp?: number;
  maxHp?: number;
  strength?: number;
  agility?: number;
  health?: number;
  gold?: number;
  xp?: number;
  level?: number;
  skillPoints?: number;
  isAlive?: boolean;
};

type MonsterRecord = {
  id?: number;
  name?: string;
  type?: string;
  hp?: number;
  maxHp?: number;
  x?: number;
  y?: number;
  isAlive?: boolean;
};

const dmBaseUrl = env.DM_API_BASE_URL.replace(/\/$/, '');

async function dmGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${dmBaseUrl}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });
  }

  const response = await authorizedFetch(url.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`DM GET ${url.pathname} failed: ${response.status} ${response.statusText} ${text}`);
  }

  return (await response.json()) as T;
}

async function dmPost<T>(path: string, body: JsonMap): Promise<T> {
  const url = `${dmBaseUrl}${path}`;
  const response = await authorizedFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`DM POST ${path} failed: ${response.status} ${response.statusText} ${text}`);
  }

  return (await response.json()) as T;
}

async function dmDelete<T>(path: string): Promise<T> {
  const url = `${dmBaseUrl}${path}`;
  const response = await authorizedFetch(url, {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`DM DELETE ${path} failed: ${response.status} ${response.statusText} ${text}`);
  }

  return (await response.json()) as T;
}

export const dmSdk = {
  async GetPlayer(variables: { slackId?: string; clientId?: string; name?: string }) {
    const response = await dmGet('/players', {
      slackId: variables.slackId ?? undefined,
      clientId: variables.clientId ?? undefined,
      name: variables.name ?? undefined,
    });
    return { getPlayer: response } as { getPlayer: JsonMap };
  },

  async MovePlayer(variables: { slackId?: string; clientId?: string; input: JsonMap }) {
    const response = await dmPost('/movement/move', {
      slackId: variables.slackId,
      clientId: variables.clientId,
      move: variables.input,
    });
    return { movePlayer: response } as { movePlayer: JsonMap };
  },

  async Attack(variables: { slackId: string; input: JsonMap }) {
    const response = await dmPost('/players/attack', {
      slackId: variables.slackId,
      input: variables.input,
    });
    return { attack: response } as { attack: JsonMap };
  },

  async SpendSkillPoint(variables: { slackId: string; attribute: string }) {
    const response = await dmPost('/players/spend-skill-point', variables);
    return { spendSkillPoint: response } as { spendSkillPoint: JsonMap };
  },

  async RerollPlayerStats(variables: { slackId: string }) {
    const response = await dmPost('/players/reroll', variables);
    return { rerollPlayerStats: response } as { rerollPlayerStats: JsonMap };
  },

  async CompletePlayer(variables: { slackId: string }) {
    const response = await dmPost('/players/stats', {
      slackId: variables.slackId,
      input: { hp: 10 },
    });
    return { updatePlayerStats: response } as { updatePlayerStats: JsonMap };
  },

  async DeletePlayer(variables: { slackId: string }) {
    const response = await dmDelete(`/players/${encodeURIComponent(variables.slackId)}`);
    return { deletePlayer: response } as { deletePlayer: JsonMap };
  },

  async SniffNearestMonster(variables: { slackId?: string; clientId?: string }) {
    const response = await dmGet('/movement/sniff', {
      slackId: variables.slackId ?? undefined,
      clientId: variables.clientId ?? undefined,
    });
    return { sniffNearestMonster: response } as { sniffNearestMonster: JsonMap };
  },

  async GetLookView(variables: { slackId?: string; clientId?: string }) {
    const response = await dmGet('/movement/look', {
      slackId: variables.slackId ?? undefined,
      clientId: variables.clientId ?? undefined,
    });
    return { getLookView: response } as { getLookView: JsonMap };
  },

  async GetLocationEntities(variables: { x: number; y: number }) {
    const [players, monsters] = await Promise.all([
      dmGet<PlayerRecord[]>('/players/location', {
        x: String(variables.x),
        y: String(variables.y),
      }),
      dmGet<MonsterRecord[]>('/system/monsters', {
        x: String(variables.x),
        y: String(variables.y),
      }),
    ]);
    return {
      getPlayersAtLocation: players,
      getMonstersAtLocation: monsters,
    } as {
      getPlayersAtLocation: PlayerRecord[];
      getMonstersAtLocation: MonsterRecord[];
    };
  },

  async GetPlayerWithLocation(variables: { slackId: string }) {
    const [{ getPlayer }, nearby] = await Promise.all([
      this.GetPlayer({ slackId: variables.slackId }),
      dmGet('/movement/look', { slackId: variables.slackId }),
    ]);
    return {
      getPlayer,
      getLookView: nearby,
    } as JsonMap;
  },
};
