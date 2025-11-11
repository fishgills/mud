import { SettlementService } from './settlement.service';

describe('SettlementService', () => {
  const timing = {} as any;
  const service = new SettlementService();
  const player = { x: 0, y: 0 } as any;

  beforeEach(() => {
    timing.tSettlementsFilterMs = 0;
  });

  it('filters nearby settlements by distance and includes large ones', () => {
    const settlements = service.processVisibleSettlements(
      player,
      4,
      {
        nearbySettlements: [
          { name: 'Close', type: 'town', size: 'small', distance: 3, x: 1, y: 1 },
          { name: 'Far', type: 'city', size: 'large', distance: 20, x: 20, y: 0 },
          { name: 'TooFar', type: 'camp', size: 'small', distance: 30, x: 25, y: 0 },
        ],
      } as any,
      timing,
    );

    expect(settlements).toHaveLength(2);
    expect(settlements.map((s) => s.name)).toEqual(['Close', 'Far']);
    expect(settlements[0].direction).toBe('northeast');
    expect(timing.tSettlementsFilterMs).toBeGreaterThanOrEqual(0);
  });

  it('prepends current settlement when not already included', () => {
    const result = service.processVisibleSettlements(
      player,
      4,
      {
        nearbySettlements: [
          {
            name: 'Existing',
            type: 'village',
            size: 'small',
            distance: 1,
            x: 1,
            y: 0,
          },
        ],
        currentSettlement: { name: 'Home', type: 'hub', size: 'large' },
      },
      timing,
    );

    expect(result[0]).toMatchObject({
      name: 'Home',
      distance: 0,
      direction: 'here',
    });
  });

  it('avoids duplicating the current settlement when already listed', () => {
    const result = service.processVisibleSettlements(
      player,
      4,
      {
        nearbySettlements: [
          {
            name: 'Home',
            type: 'hub',
            size: 'large',
            distance: 0,
            x: 0,
            y: 0,
          },
        ],
        currentSettlement: { name: 'Home', type: 'hub', size: 'large' },
      },
      timing,
    );

    expect(result).toHaveLength(1);
  });
});
