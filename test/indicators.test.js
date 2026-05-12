import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ema, sma, stochastic } from '../src/indicators.js';

describe('indicators', () => {
  it('calculates SMA values after enough samples', () => {
    assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  });

  it('seeds EMA with SMA and then applies recursive multiplier', () => {
    const values = ema([1, 2, 3, 4, 5], 3);
    assert.equal(values[0], null);
    assert.equal(values[1], null);
    assert.equal(values[2], 2);
    assert.equal(values[3], 3);
    assert.equal(values[4], 4);
  });

  it('calculates slow stochastic K and D', () => {
    const candles = [
      { high: 10, low: 5, close: 7 },
      { high: 11, low: 6, close: 10 },
      { high: 12, low: 7, close: 11 },
      { high: 13, low: 8, close: 12 },
      { high: 14, low: 9, close: 13 }
    ];
    const result = stochastic(candles, 3, 2, 2);
    assert.equal(result.rawK[0], null);
    assert.ok(Math.abs(result.rawK[2] - 85.71428571428571) < 1e-9);
    assert.ok(Math.abs(result.k[3] - 85.71428571428571) < 1e-9);
    assert.ok(Math.abs(result.d[4] - 85.71428571428571) < 1e-9);
  });
});
