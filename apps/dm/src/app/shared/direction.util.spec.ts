import { calculateDirection } from './direction.util';

describe('calculateDirection', () => {
  const origin = { x: 0, y: 0 };

  it.each`
    toX    | toY    | expected
    ${10}  | ${0}   | ${'east'}
    ${10}  | ${10}  | ${'northeast'}
    ${0}   | ${10}  | ${'north'}
    ${-10} | ${10}  | ${'northwest'}
    ${-10} | ${0}   | ${'west'}
    ${-10} | ${-10} | ${'southwest'}
    ${0}   | ${-10} | ${'south'}
    ${10}  | ${-10} | ${'southeast'}
  `('returns $expected for vector ($toX,$toY)', ({ toX, toY, expected }) => {
    expect(calculateDirection(origin.x, origin.y, toX, toY)).toBe(expected);
  });

  it('treats zero delta as east by convention', () => {
    expect(calculateDirection(5, 5, 5, 5)).toBe('east');
  });
});
