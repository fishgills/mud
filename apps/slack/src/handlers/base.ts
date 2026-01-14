import type { PlayerRecord } from '../dm-client';
import { dmClient } from '../dm-client';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { registerHandler } from './handlerRegistry';
import { HandlerContext } from './types';
import { getSlackApp } from '../appContext';
import {
  CREATION_INCOMPLETE_MESSAGE,
  MISSING_CHARACTER_MESSAGE,
} from './characterUtils';

type CommandRegistration = string | string[];

const toArray = (value: CommandRegistration): string[] =>
  Array.isArray(value) ? value : [value];

export abstract class BaseCommandHandler {
  protected readonly commands: string[];

  protected constructor(commands: CommandRegistration) {
    this.commands = toArray(commands);
    this.register();
  }

  protected get dm() {
    return dmClient;
  }

  protected get app() {
    return getSlackApp();
  }

  protected register(): void {
    this.commands.forEach((command) => {
      registerHandler(command, this.handle.bind(this));
    });
  }

  async handle(ctx: HandlerContext): Promise<void> {
    await this.execute(ctx);
  }

  protected abstract execute(ctx: HandlerContext): Promise<void>;
}

export abstract class SafeCommandHandler extends BaseCommandHandler {
  protected readonly defaultErrorMessage: string;
  protected teamId?: string;

  protected constructor(
    commands: CommandRegistration,
    defaultErrorMessage: string,
  ) {
    super(commands);
    this.defaultErrorMessage = defaultErrorMessage;
  }

  protected abstract perform(ctx: HandlerContext): Promise<void>;

  protected async execute(ctx: HandlerContext): Promise<void> {
    this.teamId = ctx.teamId;
    try {
      const shouldContinue = await this.beforePerform(ctx);
      if (!shouldContinue) {
        return;
      }
      await this.perform(ctx);
    } catch (error) {
      await ctx.say({ text: this.getFriendlyError(error) });
    }
  }

  protected async beforePerform(_ctx?: HandlerContext): Promise<boolean> {
    void _ctx;
    return true;
  }

  protected getFriendlyError(error: unknown): string {
    return getUserFriendlyErrorMessage(error, this.defaultErrorMessage);
  }
}

export abstract class PlayerCommandHandler extends SafeCommandHandler {
  protected readonly options: PlayerCommandHandlerResolvedOptions;
  protected player: PlayerRecord | null = null;

  protected constructor(
    commands: CommandRegistration,
    defaultErrorMessage: string,
    options: PlayerCommandHandlerOptions = {},
  ) {
    super(commands, defaultErrorMessage);
    this.options = {
      loadPlayer: options.loadPlayer ?? true,
      requirePlayer: options.requirePlayer ?? true,
      missingCharacterMessage:
        options.missingCharacterMessage ?? MISSING_CHARACTER_MESSAGE,
      allowDuringCreation: options.allowDuringCreation ?? false,
    };
  }

  protected override async beforePerform(
    ctx: HandlerContext,
  ): Promise<boolean> {
    const shouldContinue = await super.beforePerform(ctx);
    if (!shouldContinue) {
      return false;
    }

    this.player = null;

    if (!this.options.loadPlayer) {
      return true;
    }

    const playerResult = await this.dm.getPlayer({
      teamId: ctx.teamId,
      userId: ctx.userId,
    });

    if (!playerResult || !playerResult.success || !playerResult.data) {
      if (this.options.requirePlayer) {
        const message =
          playerResult?.message ?? this.options.missingCharacterMessage;
        await ctx.say({ text: message });
        return false;
      }

      return true;
    }

    this.player = playerResult.data;

    if (
      this.player &&
      this.player.isCreationComplete === false &&
      !this.options.allowDuringCreation
    ) {
      await ctx.say({ text: CREATION_INCOMPLETE_MESSAGE });
      return false;
    }

    return true;
  }
}

interface PlayerCommandHandlerOptions {
  loadPlayer?: boolean;
  requirePlayer?: boolean;
  missingCharacterMessage?: string;
  allowDuringCreation?: boolean;
}

interface PlayerCommandHandlerResolvedOptions {
  loadPlayer: boolean;
  requirePlayer: boolean;
  missingCharacterMessage: string;
  allowDuringCreation: boolean;
}
