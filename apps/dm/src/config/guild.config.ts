import { env } from '../env';

export interface GuildConfig {
  slug: string;
  displayName: string;
  arrivalMessage: string;
  teleportCooldownSeconds: number;
  populationLimit: number;
  services: {
    shop: boolean;
    crier: boolean;
    exits: string[];
  };
}

export const defaultGuildConfig: GuildConfig = {
  slug: 'guild-hall',
  displayName: 'Adventurers Guild Hall',
  arrivalMessage:
    '✨ You step into the Guild Hall. Merchants beckon you over while the town crier clears their throat for the next announcement.',
  teleportCooldownSeconds: 300,
  populationLimit: 50,
  services: {
    shop: true,
    crier: true,
    exits: ['return', 'random'],
  },
};

export const getGuildConfig = (): GuildConfig => ({
  ...defaultGuildConfig,
  teleportCooldownSeconds:
    env.GUILD_TELEPORT_COOLDOWN ?? defaultGuildConfig.teleportCooldownSeconds,
  populationLimit:
    env.GUILD_POPULATION_LIMIT ?? defaultGuildConfig.populationLimit,
});
