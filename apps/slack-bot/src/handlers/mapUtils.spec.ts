jest.mock('../env', () => ({
  env: {
    WORLD_RENDER_BASE_URL: 'https://mud.example/world',
  },
}));

import { sendPngMap } from './mapUtils';
import type { SayMessage } from './types';

describe('sendPngMap', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('constructs the map URL and posts a Slack image', async () => {
    const say = jest
      .fn<Promise<void>, [SayMessage]>()
      .mockResolvedValue(undefined);

    const result = await sendPngMap(say, 3, -4, 12);

    expect(result).toBe(true);
    expect(say).toHaveBeenCalledWith({
      text: 'Map',
      blocks: [
        expect.objectContaining({
          type: 'image',
          image_url: 'https://mud.example/world/render/map.png?x=3&y=-4&p=12',
          alt_text: 'Map at (3, -4)',
        }),
      ],
    });
  });

  it('returns false when Slack post fails', async () => {
    const say = jest
      .fn<Promise<void>, [SayMessage]>()
      .mockRejectedValue(new Error('fail'));
    const consoleSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const result = await sendPngMap(say, 0, 0);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
