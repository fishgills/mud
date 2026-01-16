describe('guild-shop contracts', () => {
  it('describes buy request', () => {
    const request = {
      teamId: 'T1',
      userId: 'U1',
      sku: 'potion',
      quantity: 2,
    };
    expect(request.sku).toBe('potion');
  });

  it('describes trade response shape', () => {
    const response = {
      receiptId: '1',
      playerId: '42',
      itemId: '7',
      direction: 'BUY' as const,
      goldDelta: -20,
      remainingGold: 80,
      inventoryDelta: 1,
      stockRemaining: 5,
    };
    expect(response.direction).toBe('BUY');
  });

  it('supports catalog listing responses', () => {
    const item = {
      sku: 'guild-1',
      name: 'Elixir',
      description: 'Restores health',
      buyPriceGold: 100,
      sellPriceGold: 50,
      stockQuantity: 3,
      tags: ['consumable'],
      tier: 4,
      itemPower: 12,
      strengthBonus: 6,
      agilityBonus: 4,
      healthBonus: 2,
      weaponDiceCount: 1,
      weaponDiceSides: 8,
      ticketRequirement: 'Epic',
      quality: 'Fine',
    };
    expect(item.tags).toContain('consumable');
    expect(item.itemPower).toBeGreaterThan(0);
  });
});
