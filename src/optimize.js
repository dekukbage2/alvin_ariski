#!/usr/bin/env node
import { loadCsvCandles, runBacktest } from './backtest.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith('--'));

  if (!file) {
    console.error('Usage: node src/optimize.js <candles.csv> [--json]');
    process.exit(1);
  }

  const candles = await loadCsvCandles(file);
  const candidates = sweepParameters(candles)
    .sort((a, b) => score(b.metrics) - score(a.metrics))
    .slice(0, 10);

  if (args.includes('--json')) {
    console.log(JSON.stringify(candidates, jsonMetricReplacer, 2));
  } else {
    console.table(candidates.map(({ params, metrics }) => ({
      rejectionLookback: params.rejectionLookback,
      minWickBodyRatio: params.minWickBodyRatio,
      oversold: params.oversold,
      overbought: params.overbought,
      riskRewardRatio: params.riskRewardRatio,
      trades: metrics.tradeCount,
      returnPct: metrics.returnPct.toFixed(2),
      maxDrawdownPct: metrics.maxDrawdownPct.toFixed(2),
      profitFactor: Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : 'Infinity',
      score: score(metrics).toFixed(2)
    })));
  }
}

export function sweepParameters(candles, grid = defaultGrid()) {
  const results = [];

  for (const rejectionLookback of grid.rejectionLookback) {
    for (const minWickBodyRatio of grid.minWickBodyRatio) {
      for (const oversold of grid.oversold) {
        for (const overbought of grid.overbought) {
          for (const riskRewardRatio of grid.riskRewardRatio) {
            const params = { rejectionLookback, minWickBodyRatio, oversold, overbought, riskRewardRatio };
            const { metrics } = runBacktest(candles, params);
            results.push({ params, metrics });
          }
        }
      }
    }
  }

  return results;
}

export function score(metrics) {
  if (metrics.tradeCount === 0) return -Infinity;
  return metrics.returnPct - metrics.maxDrawdownPct + Math.min(metrics.profitFactor, 5) * 2 + Math.log10(metrics.tradeCount + 1);
}

function defaultGrid() {
  return {
    rejectionLookback: [6, 8, 12],
    minWickBodyRatio: [1, 1.2, 1.5],
    oversold: [20, 25, 30],
    overbought: [70, 75, 80],
    riskRewardRatio: [1.5, 1.8, 2]
  };
}

function jsonMetricReplacer(_key, value) {
  return value === Infinity ? 'Infinity' : value;
}
