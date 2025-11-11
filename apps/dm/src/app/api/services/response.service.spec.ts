import { ResponseService } from './response.service';

describe('ResponseService', () => {
  const service = new ResponseService();

  it('builds look response with settlement metadata', () => {
    const response = service.buildResponseData(
      {
        x: 5,
        y: -2,
        biomeName: 'forest',
        description: 'lush',
        height: 0.4,
        temperature: 0.6,
        moisture: 0.7,
      } as any,
      9,
      [{ biome: 'forest', count: 10 } as any],
      [],
      [],
      {
        name: 'Town',
        type: 'city',
        size: 'large',
        intensity: 2,
        isCenter: true,
      } as any,
      'A scenic view',
      [{ name: 'Hero', distance: 2, direction: 'north' }],
      [{ name: 'Goblin', hp: 5 } as any],
      [{ id: 1, itemId: 10, quality: 'Rare', itemName: 'Gem' }],
    );

    expect(response.location).toMatchObject({
      x: 5,
      y: -2,
      description: 'lush',
    });
    expect(response.visibilityRadius).toBe(9);
    expect(response.currentSettlement?.name).toBe('Town');
    expect(response.inSettlement).toBe(true);
    expect(response.description).toBe('A scenic view');
  });

  it('omits settlement info when none provided', () => {
    const response = service.buildResponseData(
      { x: 0, y: 0, biomeName: 'plains', description: null, height: 0 } as any,
      5,
      [],
      [],
      [],
      null,
      '',
      [],
      [],
    );

    expect(response.currentSettlement).toBeUndefined();
    expect(response.inSettlement).toBe(false);
  });
});
