import { DescriptionService } from './description.service';

describe('DescriptionService', () => {
  test('generateFallbackDescription with no peaks or settlements', () => {
    const svc = new DescriptionService({} as any);
    const center = { x: 0, y: 0, biomeName: 'plains', height: 1 } as any;
    const text = svc.generateFallbackDescription(5, center, [], [], []);
    expect(text).toContain('5 tiles');
    expect(text).toContain('plains');
  });

  test('generateFallbackDescription includes peaks and settlements (here + others)', () => {
    const svc = new DescriptionService({} as any);
    const center = { x: 1, y: 2, biomeName: 'forest', height: 0 } as any;
    const peaks = [{ direction: 'north' }, { direction: 'east' }] as any;
    const settlements = [
      { distance: 0, type: 'hamlet', name: 'Home', direction: 'south' },
      { distance: 2, type: 'village', name: 'Faraway', direction: 'west' },
    ] as any;

    const text = svc.generateFallbackDescription(
      3,
      center,
      [],
      peaks,
      settlements,
    );
    expect(text).toContain('Distant peaks');
    expect(text).toContain("You're in the hamlet Home");
    expect(text).toContain('village Faraway to the west');
  });

  test('generateAiDescription returns AI text when available and falls back on error', async () => {
    const aiService = {
      getText: jest.fn().mockResolvedValue({ output_text: 'Lovely scene' }),
    } as any;
    const svc = new DescriptionService(aiService);
    const center = { x: 2, y: 3, biomeName: 'swamp', height: 0 } as any;
    const timing: any = {};
    const text = await svc.generateAiDescription(
      center,
      4,
      [],
      [],
      [],
      null,
      timing,
    );
    expect(text).toBe('Lovely scene');
    expect(typeof timing.tAiMs).toBe('number');

    // when AI throws, should return fallback
    aiService.getText.mockRejectedValueOnce(new Error('boom'));
    const fallback = await svc.generateAiDescription(
      center,
      2,
      [{ biomeName: 'swamp' } as any],
      [],
      [],
      null,
      {} as any,
    );
    expect(fallback).toContain('swamp');
  });
});
