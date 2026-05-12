import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCsvCandles, runBacktest } from '../src/backtest.js';
import { detectRejection, detectReversal } from '../src/strategy.js';

describe('csv parser', () => {
  it('loads required OHLC fields', () => {
    const candles = parseCsvCandles('time,open,high,low,close\n2024-01-01T00:00:00Z,1,2,0.5,1.5');
    assert.deepEqual(candles[0], { time: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5, volume: undefined });
  });
});

describe('price action helpers', () => {
  it('detects support rejection with a dominant lower wick', () => {
    const candles = [
      { open: 10, high: 11, low: 9.5, close: 10.5 },
      { open: 10.5, high: 10.8, low: 9, close: 10.7 },
      { open: 10.6, high: 10.9, low: 8.95, close: 10.8 }
    ];
    const rejection = detectRejection(candles, 2, { rejectionLookback: 2, rejectionTolerancePct: 0.01, minWickBodyRatio: 4 });
    assert.equal(rejection.support, true);
  });

  it('detects engulfing reversal candles', () => {
    const reversal = detectReversal(
      { open: 10, high: 10.2, low: 9.2, close: 9.5 },
      { open: 9.4, high: 10.5, low: 9.1, close: 10.3 }
    );
    assert.equal(reversal.bullish, true);
    assert.equal(reversal.bullishEngulfing, true);
  });
});

describe('backtester', () => {
  it('returns stable metrics even when strict defaults produce no trades', () => {
    const candles = Array.from({ length: 60 }, (_, index) => ({
      time: `t${index}`,
      open: 100 + index,
      high: 101 + index,
      low: 99 + index,
      close: 100.5 + index
    }));
    const result = runBacktest(candles, { emaFastPeriod: 5, emaSlowPeriod: 10 });
    assert.equal(result.metrics.initialEquity, 10000);
    assert.equal(result.metrics.finalEquity, 10000);
    assert.equal(result.metrics.tradeCount, 0);
  });
});

describe('parameter refinement', () => {
  it('scores empty strategies below strategies with trades', async () => {
    const { score } = await import('../src/optimize.js');
    assert.equal(score({ tradeCount: 0 }), -Infinity);
    assert.ok(score({ tradeCount: 3, returnPct: 4, maxDrawdownPct: 1, profitFactor: 1.5 }) > 0);
  });
});
