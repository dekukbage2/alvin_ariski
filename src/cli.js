#!/usr/bin/env node
import { runBacktest, loadCsvCandles } from './backtest.js';

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const json = args.includes('--json');

if (!file) {
  console.error('Usage: tf15-ema-stoch <candles.csv> [--json] [--key=value ...]');
  process.exit(1);
}

const overrides = Object.fromEntries(args
  .filter((arg) => arg.startsWith('--') && arg.includes('='))
  .map((arg) => {
    const [key, rawValue] = arg.slice(2).split('=');
    const numeric = Number(rawValue);
    return [key, Number.isFinite(numeric) ? numeric : rawValue];
  }));

const candles = await loadCsvCandles(file);
const result = runBacktest(candles, overrides);

if (json) {
  console.log(JSON.stringify(result, jsonMetricReplacer, 2));
} else {
  console.table(result.metrics);
  console.table(result.trades.map(({ time, side, entry, stopLoss, takeProfit, exitTime, exitPrice, exitReason, netPnl, equity }) => ({
    time,
    side,
    entry: entry.toFixed(4),
    stopLoss: stopLoss.toFixed(4),
    takeProfit: takeProfit.toFixed(4),
    exitTime,
    exitPrice: exitPrice.toFixed(4),
    exitReason,
    netPnl: netPnl.toFixed(2),
    equity: equity.toFixed(2)
  })));
}

function jsonMetricReplacer(_key, value) {
  return value === Infinity ? 'Infinity' : value;
}
