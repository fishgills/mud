import { getPlayer } from '../../dm-client';
import type { PlayerStatsSource } from './types';

export interface PlayerLookupResult {
  player?: PlayerStatsSource;
  message?: string;
}

export async function fetchPlayerRecord(
  variables: { teamId: string; userId: string },
  defaultMessage: string,
): Promise<PlayerLookupResult> {
  const result = await getPlayer(variables);
  if (result.success && result.data) {
    return { player: result.data as PlayerStatsSource };
  }

  return {
    message: (result.message as string | undefined) ?? defaultMessage,
  };
}
