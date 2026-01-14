import type { RunStatus, RunType } from '@mud/database';
import type { SuccessResponse } from '../../app/api/dto/responses.dto';

export interface RunState {
  id: number;
  runType: RunType;
  status: RunStatus;
  round: number;
  bankedXp: number;
  bankedGold: number;
  difficultyTier: number;
  leaderPlayerId: number;
  guildId?: number | null;
}

export interface RunActionResponse extends SuccessResponse {
  data?: RunState;
}
