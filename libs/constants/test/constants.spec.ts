import {
  expectedRankForLevel,
  computeTemplateWeights,
  pickTemplatesForLevel,
  MAX_ITEM_RANK,
} from '../src/constants';

describe('constants loot ranking', () => {
  test('expectedRankForLevel maps to 1..10 for level 1 and 20', () => {
    expect(expectedRankForLevel(1)).toBe(1);
    expect(expectedRankForLevel(20)).toBe(10);
    expect(expectedRankForLevel(10)).toBeGreaterThanOrEqual(4);
  });

  test('computeTemplateWeights biases towards expected rank for a level', () => {
    const low = computeTemplateWeights(1).map((w) => w.template.rank ?? 0);
    const high = computeTemplateWeights(20).map((w) => w.template.rank ?? 0);
    // average rank should be higher for level 20 than level 1
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    expect(avg(high)).toBeGreaterThanOrEqual(avg(low));
  });

  test('pickTemplatesForLevel returns unique templates', () => {
    const picks = pickTemplatesForLevel(10, 6);
    const names = new Set(picks.map((p) => p.name));
    expect(names.size).toBe(picks.length);
    expect(picks.length).toBe(6);
  });
});
