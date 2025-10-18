export interface Player {
  id: number;
  clientId: string;
  clientType: string | null;
  slackId: string | null;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  level: number;
  skillPoints: number;
  gold: number;
  xp: number;
  isAlive: boolean;
  headItemId: number | null;
  chestItemId: number | null;
  legsItemId: number | null;
  armsItemId: number | null;
  leftHandItemId: number | null;
  rightHandItemId: number | null;
  lastAction?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Monster {
  id: number;
  name: string;
  type: string;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  x: number;
  y: number;
  biomeId: number;
  isAlive: boolean;
  spawnedAt: Date;
  lastMove?: Date;
  updatedAt?: Date;
}

type PlayerWhere = Record<string, any> | undefined;
type MonsterWhere = Record<string, any> | undefined;

const clone = <T>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

interface DeleteManyResult {
  count: number;
}

const defaultDate = () => new Date();

interface PlayerRecord extends Player {
  createdAt: Date;
  updatedAt: Date;
  lastAction?: Date;
}

interface MonsterRecord extends Monster {
  updatedAt: Date;
}

const state = {
  players: new Map<number, PlayerRecord>(),
  monsters: new Map<number, MonsterRecord>(),
  nextPlayerId: 1,
  nextMonsterId: 1,
};

const matchesFilter = (value: any, filter: Record<string, any>): boolean => {
  if (filter.equals !== undefined) {
    if (typeof value === 'string' && filter.mode === 'insensitive') {
      if (value.toLowerCase() !== String(filter.equals).toLowerCase()) {
        return false;
      }
    } else if (value !== filter.equals) {
      return false;
    }
  }

  if (filter.not !== undefined) {
    if (value === filter.not) {
      return false;
    }
  }

  if (filter.gte !== undefined && value < filter.gte) {
    return false;
  }

  if (filter.lte !== undefined && value > filter.lte) {
    return false;
  }

  if (filter.lt !== undefined && value >= filter.lt) {
    return false;
  }

  if (filter.gt !== undefined && value <= filter.gt) {
    return false;
  }

  return true;
};

const matchesWhere = (
  record: Record<string, any>,
  where: Record<string, any> | undefined,
): boolean => {
  if (!where) {
    return true;
  }

  if (Array.isArray(where.OR)) {
    if (!where.OR.some((clause) => matchesWhere(record, clause))) {
      return false;
    }
  }

  if (Array.isArray(where.AND)) {
    if (!where.AND.every((clause) => matchesWhere(record, clause))) {
      return false;
    }
  }

  for (const [key, value] of Object.entries(where)) {
    if (key === 'OR' || key === 'AND') {
      continue;
    }

    const recordValue = record[key as keyof typeof record];

    if (value === undefined) {
      continue;
    }

    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if (!matchesFilter(recordValue, value)) {
        return false;
      }
    } else if (recordValue !== value) {
      return false;
    }
  }

  return true;
};

const sortRecords = <T extends Record<string, any>>(
  items: T[],
  orderBy: Record<string, 'asc' | 'desc'> | undefined,
) => {
  if (!orderBy) {
    return items;
  }

  const [[field, direction]] = Object.entries(orderBy);
  const factor = direction === 'desc' ? -1 : 1;

  return [...items].sort((a, b) => {
    if (a[field] < b[field]) {
      return -1 * factor;
    }
    if (a[field] > b[field]) {
      return 1 * factor;
    }
    return 0;
  });
};

const playerModel = {
  async create({
    data,
  }: {
    data: Partial<PlayerRecord>;
  }): Promise<PlayerRecord> {
    const id = data.id ?? state.nextPlayerId++;
    const now = defaultDate();

    const record: PlayerRecord = {
      id,
      clientId: data.clientId ?? '',
      clientType: data.clientType ?? null,
      slackId: data.slackId ?? null,
      name: data.name ?? '',
      x: data.x ?? 0,
      y: data.y ?? 0,
      hp: data.hp ?? data.maxHp ?? 0,
      maxHp: data.maxHp ?? data.hp ?? 0,
      strength: data.strength ?? 1,
      agility: data.agility ?? 1,
      health: data.health ?? 1,
      level: data.level ?? 1,
      skillPoints: data.skillPoints ?? 0,
      gold: data.gold ?? 0,
      xp: data.xp ?? 0,
      isAlive: data.isAlive ?? true,
      headItemId: data.headItemId !== undefined ? data.headItemId : null,
      chestItemId: data.chestItemId !== undefined ? data.chestItemId : null,
      legsItemId: data.legsItemId !== undefined ? data.legsItemId : null,
      armsItemId: data.armsItemId !== undefined ? data.armsItemId : null,
      leftHandItemId:
        data.leftHandItemId !== undefined ? data.leftHandItemId : null,
      rightHandItemId:
        data.rightHandItemId !== undefined ? data.rightHandItemId : null,
      lastAction: data.lastAction ?? now,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };

    state.players.set(id, record);
    return clone(record);
  },

  async findFirst({
    where,
  }: {
    where: PlayerWhere;
  }): Promise<PlayerRecord | null> {
    const players = Array.from(state.players.values());
    const match = players.find((player) => matchesWhere(player, where));
    return match ? clone(match) : null;
  },

  async findMany({
    where,
    orderBy,
  }: {
    where?: PlayerWhere;
    orderBy?: Record<string, 'asc' | 'desc'>;
  } = {}): Promise<PlayerRecord[]> {
    const players = Array.from(state.players.values()).filter((player) =>
      matchesWhere(player, where),
    );

    return sortRecords(players, orderBy).map((player) => clone(player));
  },

  async updateMany({
    where,
    data,
  }: {
    where?: PlayerWhere;
    data: Partial<PlayerRecord>;
  }): Promise<DeleteManyResult> {
    let count = 0;
    const now = defaultDate();

    for (const player of Array.from(state.players.values())) {
      if (matchesWhere(player, where)) {
        Object.assign(player, data, { updatedAt: now });
        count += 1;
      }
    }

    return { count };
  },

  async update({
    where,
    data,
  }: {
    where: { id: number };
    data: Partial<PlayerRecord>;
  }): Promise<PlayerRecord> {
    const player = state.players.get(where.id);
    if (!player) {
      throw new Error(`Player ${where.id} not found`);
    }

    Object.assign(player, data, { updatedAt: defaultDate() });
    return clone(player);
  },

  async delete({ where }: { where: { id: number } }): Promise<void> {
    state.players.delete(where.id);
  },

  async deleteMany({
    where,
  }: { where?: PlayerWhere } = {}): Promise<DeleteManyResult> {
    let count = 0;
    for (const [id, player] of Array.from(state.players.entries())) {
      if (matchesWhere(player, where)) {
        state.players.delete(id);
        count += 1;
      }
    }

    return { count };
  },

  async count({ where }: { where?: PlayerWhere } = {}): Promise<number> {
    return Array.from(state.players.values()).filter((player) =>
      matchesWhere(player, where),
    ).length;
  },
};

const monsterModel = {
  async create({
    data,
  }: {
    data: Partial<MonsterRecord>;
  }): Promise<MonsterRecord> {
    const id = data.id ?? state.nextMonsterId++;
    const now = defaultDate();

    const record: MonsterRecord = {
      id,
      name: data.name ?? '',
      type: data.type ?? '',
      hp: data.hp ?? data.maxHp ?? 0,
      maxHp: data.maxHp ?? data.hp ?? 0,
      strength: data.strength ?? 1,
      agility: data.agility ?? 1,
      health: data.health ?? 1,
      x: data.x ?? 0,
      y: data.y ?? 0,
      biomeId: data.biomeId ?? 0,
      isAlive: data.isAlive ?? true,
      spawnedAt: data.spawnedAt ?? now,
      lastMove: data.lastMove,
      updatedAt: now,
    };

    state.monsters.set(id, record);
    return clone(record);
  },

  async findUnique({
    where,
  }: {
    where: { id: number };
  }): Promise<MonsterRecord | null> {
    const monster = state.monsters.get(where.id);
    return monster ? clone(monster) : null;
  },

  async findMany({
    where,
  }: {
    where?: MonsterWhere;
  } = {}): Promise<MonsterRecord[]> {
    const monsters = Array.from(state.monsters.values()).filter((monster) =>
      matchesWhere(monster, where),
    );

    return monsters.map((monster) => clone(monster));
  },

  async update({
    where,
    data,
  }: {
    where: { id: number };
    data: Partial<MonsterRecord>;
  }): Promise<MonsterRecord> {
    const monster = state.monsters.get(where.id);
    if (!monster) {
      throw new Error(`Monster ${where.id} not found`);
    }

    Object.assign(monster, data, { updatedAt: defaultDate() });
    return clone(monster);
  },

  async delete({ where }: { where: { id: number } }): Promise<void> {
    state.monsters.delete(where.id);
  },

  async deleteMany({
    where,
  }: { where?: MonsterWhere } = {}): Promise<DeleteManyResult> {
    let count = 0;
    for (const [id, monster] of Array.from(state.monsters.entries())) {
      if (matchesWhere(monster, where)) {
        state.monsters.delete(id);
        count += 1;
      }
    }

    return { count };
  },
};

export const getPrismaClient = () => ({
  player: playerModel,
  monster: monsterModel,
});

export const __resetMockDatabase = (): void => {
  state.players.clear();
  state.monsters.clear();
  state.nextPlayerId = 1;
  state.nextMonsterId = 1;
};
