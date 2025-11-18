import { ResponseService } from './response.service';

describe('ResponseService', () => {
  const service = new ResponseService();

  it('builds look response without settlement metadata', () => {
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
      [
        {
          biomeName: 'forest',
          proportion: 0.8,
          predominantDirections: ['north'],
        },
      ],
      [
        {
          x: 8,
          y: -5,
          height: 0.9,
          distance: 4,
          direction: 'north',
        },
      ],
      'A scenic view',
      [
        {
          distance: 2,
          direction: 'north',
          x: 6,
          y: -1,
        },
      ],
      [{ name: 'Goblin', hp: 5 } as any],
      [{ id: 1, itemId: 10, quality: 'Rare', itemName: 'Gem' }],
    );

    expect(response.location).toMatchObject({
      x: 5,
      y: -2,
      description: 'lush',
      biomeName: 'forest',
    });
    expect(response.visiblePeaks).toHaveLength(1);
    expect(response.description).toBe('A scenic view');
    expect(response).not.toHaveProperty('currentSettlement');
    expect(response).not.toHaveProperty('inSettlement');
  });

  it('omits optional collections when empty', () => {
    const response = service.buildResponseData(
      { x: 0, y: 0, biomeName: 'plains', description: '', height: 0 } as any,
      5,
      [],
      [],
      'Clear day',
      [],
      [],
    );

    expect(response.monsters).toHaveLength(0);
    expect(response.nearbyPlayers).toHaveLength(0);
    expect(response.items).toBeUndefined();
  });
});
