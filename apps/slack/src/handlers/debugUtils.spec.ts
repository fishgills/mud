import { sendDebugJson } from './debugUtils';

describe('sendDebugJson', () => {
  it('posts inline JSON for small payloads', async () => {
    const say = jest.fn().mockResolvedValue(undefined);
    await sendDebugJson(say, { ok: true });

    expect(say).toHaveBeenCalledWith({ text: '```{\n  "ok": true\n}```' });
  });

  it('uploads a file for large payloads', async () => {
    const say = jest.fn().mockResolvedValue(undefined);
    const largeObject = { text: 'x'.repeat(3000) };

    await sendDebugJson(say, largeObject, {
      filename: 'dbg.json',
      title: 'Debug',
    });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Debug attached as JSON for debugging.',
        fileUpload: expect.objectContaining({ filename: 'dbg.json' }),
      }),
    );
  });
});
