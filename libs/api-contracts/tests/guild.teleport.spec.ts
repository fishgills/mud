import type {
  GuildTeleportRequest,
  GuildTeleportResponse,
  GuildTradeRequest,
} from '../src/guild';

describe('guild-teleport contracts', () => {
  it('requires team and user identifiers', () => {
    const request: GuildTeleportRequest = {
      teamId: 'T123',
      userId: 'U456',
      requestedAt: new Date().toISOString(),
    };

    expect(request.teamId).toBe('T123');
    expect(request.userId).toBe('U456');
  });

  it('describes response payload for Slack + DM services', () => {
    const response: GuildTeleportResponse = {
      playerId: '42',
      guildTileId: 'guild-hall',
      arrivalMessage: 'Welcome! Grab a drink.',
      services: { shop: true, crier: true, exits: ['return'] },
      occupantsNotified: ['7', '9'],
      correlationId: 'abc',
    };

    expect(response.services.shop).toBe(true);
    expect(response.occupantsNotified).toContain('9');
  });

  it('supports trade requests for buy/sell operations', () => {
    const request: GuildTradeRequest = {
      playerId: '42',
      itemId: 'sword',
      quantity: 2,
      correlationId: 'trade-1',
    };

    expect(request.quantity).toBeGreaterThan(0);
  });
});
