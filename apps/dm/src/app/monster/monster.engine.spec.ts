import { MONSTER_ENGINE } from './monster.engine';

describe('Monster engine tokens', () => {
  it('exposes injection token', () => {
    expect(typeof MONSTER_ENGINE).toBe('symbol');
  });
});
