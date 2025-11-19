describe('guild-shop contracts', () => {
  it('describes buy request', () => {
    const request = {
      teamId: 'T1',
      userId: 'U1',
      item: 'potion',
      quantity: 2,
    };
    expect(request.item).toBe('potion');
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
});
