import type { App } from '@slack/bolt';
import { registerUninstallHandler } from './uninstall';
import { deleteWorkspaceData } from '@mud/database';

jest.mock('@mud/database', () => ({
  deleteWorkspaceData: jest.fn(),
}));

type UninstallHandler = (args: {
  context: { teamId?: string };
  logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
}) => Promise<void> | void;

const mockedDeleteWorkspaceData = deleteWorkspaceData as jest.MockedFunction<
  typeof deleteWorkspaceData
>;

describe('registerUninstallHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes workspace data when app is uninstalled', async () => {
    const handlers: Record<string, UninstallHandler> = {};
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const app = {
      event: jest.fn((eventName: string, handler: UninstallHandler) => {
        handlers[eventName] = handler;
      }),
    } as unknown as App;

    mockedDeleteWorkspaceData.mockResolvedValueOnce({
      deletedPlayers: 3,
      deletedInstallations: 1,
    });

    registerUninstallHandler(app);

    const handler = handlers.app_uninstalled;
    if (!handler) {
      throw new Error('app_uninstalled handler was not registered');
    }

    await handler({ context: { teamId: 'T123' }, logger });

    expect(deleteWorkspaceData).toHaveBeenCalledWith('T123');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('skips cleanup when teamId is missing', async () => {
    const handlers: Record<string, UninstallHandler> = {};
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const app = {
      event: jest.fn((eventName: string, handler: UninstallHandler) => {
        handlers[eventName] = handler;
      }),
    } as unknown as App;

    registerUninstallHandler(app);

    const handler = handlers.app_uninstalled;
    if (!handler) {
      throw new Error('app_uninstalled handler was not registered');
    }

    await handler({ context: {}, logger });

    expect(deleteWorkspaceData).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'app_uninstalled received without teamId; skipping cleanup',
    );
  });
});
