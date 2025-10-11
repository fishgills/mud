import { dmSdk } from '../clients/dm-sdk';
import { COMMANDS, MOVEMENT_COMMANDS } from '../commands';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { registerHandler } from './handlerRegistry';
import { HandlerContext } from './types';
import { toClientId } from '../utils/clientId';

type CommandRegistration = string | string[];

const toArray = (value: CommandRegistration): string[] =>
  Array.isArray(value) ? value : [value];

export abstract class BaseCommandHandler {
  protected readonly commands: string[];

  protected constructor(commands: CommandRegistration) {
    this.commands = toArray(commands);
    this.register();
  }

  protected get sdk() {
    return dmSdk;
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

  protected constructor(
    commands: CommandRegistration,
    defaultErrorMessage: string,
  ) {
    super(commands);
    this.defaultErrorMessage = defaultErrorMessage;
  }

  protected abstract perform(ctx: HandlerContext): Promise<void>;

  protected async execute(ctx: HandlerContext): Promise<void> {
    try {
      await this.perform(ctx);
    } catch (error) {
      await ctx.say({ text: this.getFriendlyError(error) });
    }
  }

  protected getFriendlyError(error: unknown): string {
    return getUserFriendlyErrorMessage(error, this.defaultErrorMessage);
  }
}

export abstract class PlayerCommandHandler extends SafeCommandHandler {
  protected constructor(
    commands: CommandRegistration,
    defaultErrorMessage: string,
  ) {
    super(commands, defaultErrorMessage);
  }

  protected toClientId(userId: string): string {
    return toClientId(userId);
  }
}

export const MOVEMENT_COMMAND_SET = [
  ...new Set<string>([COMMANDS.MOVE, ...MOVEMENT_COMMANDS]),
];
