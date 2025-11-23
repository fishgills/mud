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
export declare const PlayerFactory: {
  create(input: PlayerFactoryInput): Promise<PlayerFactoryEntity>;
  load(
    clientId: string,
    clientType?: string,
  ): Promise<PlayerFactoryEntity | null>;
  clear(): Promise<void>;
};
export declare const MonsterFactory: {
  load: () => Promise<undefined>;
  save: () => Promise<undefined>;
  delete: () => Promise<undefined>;
};
export declare const EventBus: {
  on: () => () => undefined;
  emit: () => Promise<undefined>;
  clear: () => undefined;
};
export {};
