import { SettlementGenerator } from './settlement-generator';

describe('SettlementGenerator', () => {
  it('should be defined', () => {
    expect(new SettlementGenerator(5)).toBeDefined();
  });
});
