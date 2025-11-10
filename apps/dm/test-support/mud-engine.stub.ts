type PlayerFactoryInput = {
  clientId: string;
  clientType?: string;
  name?: string;
  id?: number | string;
} & Record<string, unknown>;

type PlayerFactoryEntity = PlayerFactoryInput & {
  clientId: string;
  id: number | string;
};

const players = new Map<string, PlayerFactoryEntity>();
let autoIncrement = 1;

const normalizeClientId = (clientId: string, clientType?: string): string => {
  if (!clientId) return '';
  const prefix = clientType ? `${clientType}:` : '';
  if (prefix && clientId.startsWith(prefix)) {
    return clientId.slice(prefix.length);
  }
  if (clientId.startsWith('slack:')) {
    return clientId.slice('slack:'.length);
  }
  return clientId;
};

export const PlayerFactory = {
  async create(input: PlayerFactoryInput): Promise<PlayerFactoryEntity> {
    const canonicalClientId = normalizeClientId(
      input.clientId,
      input.clientType,
    );
    const entity: PlayerFactoryEntity = {
      ...input,
      clientId: canonicalClientId,
      id: input.id ?? autoIncrement++,
    };
    players.set(canonicalClientId, entity);
    players.set(input.clientId, entity);
    return entity;
  },
  async load(
    clientId: string,
    clientType?: string,
  ): Promise<PlayerFactoryEntity | null> {
    const canonical = normalizeClientId(clientId, clientType);
    return players.get(canonical) ?? players.get(clientId) ?? null;
  },
  async clear(): Promise<void> {
    players.clear();
    autoIncrement = 1;
  },
};

const noop = async () => undefined;

export const MonsterFactory = {
  load: noop,
  save: noop,
  delete: noop,
};

export const EventBus = {
  on: () => () => undefined,
  emit: noop,
  clear: () => undefined,
};

