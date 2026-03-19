import { describe, expect, it } from 'vitest';
import { toPositiveInt } from '../src/utils';

describe('toPositiveInt', () => {
  it('returns floored positive integer', () => {
    expect(toPositiveInt(12.8, 50)).toBe(12);
  });

  it('returns fallback for negative numbers', () => {
    expect(toPositiveInt(-1, 50)).toBe(50);
  });

  it('returns fallback for non-number values', () => {
    expect(toPositiveInt('abc', 50)).toBe(50);
  });
});
