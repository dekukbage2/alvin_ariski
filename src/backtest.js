import { readFile } from 'node:fs/promises';
import { buildSignals, defaultParams } from './strategy.js';

export async function loadCsvCandles(path) {
  const text = await readFile(path, 'utf8');
  return parseCsvCandles(text);
}

export function parseCsvCandles(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must contain a header and at least one data row.');

  const headers = lines[0].split(',').map((header) => header.trim().toLowerCase());
  const required = ['time', 'open', 'high', 'low', 'close'];
  for (const header of required) {
    if (!headers.includes(header)) throw new Error(`CSV is missing required column: ${header}`);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = line.split(',').map((value) => value.trim());
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const candle = {
      time: row.time,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: row.volume == null || row.volume === '' ? undefined : Number(row.volume)
    };

    if (!Number.isFinite(candle.open) || !Number.isFinite(candle.high) || !Number.isFinite(candle.low) || !Number.isFinite(candle.close)) {
      throw new Error(`CSV row ${rowIndex + 2} contains invalid OHLC data.`);
    }

    return candle;
  });
}

export function runBacktest(candles, overrides = {}) {
  const params = { ...defaultParams, ...overrides };
  const { signals } = buildSignals(candles, params);
  const trades = [];
  let equity = params.initialEquity;
  let maxEquity = equity;
  let maxDrawdownPct = 0;
  let openUntil = -1;

  for (const signal of signals) {
    if (signal.index <= openUntil || signal.riskPerUnit <= 0) continue;

    const riskBudget = equity * params.riskPerTradePct;
    const quantity = riskBudget / signal.riskPerUnit;
    const outcome = resolveTrade(candles, signal, quantity, params);
    if (!outcome) continue;

    const grossPnl = calculatePnl(signal.side, signal.entry, outcome.exitPrice, quantity);
    const fees = (Math.abs(signal.entry * quantity) + Math.abs(outcome.exitPrice * quantity)) * params.feeRate;
    const netPnl = grossPnl - fees;
    equity += netPnl;
    maxEquity = Math.max(maxEquity, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, ((maxEquity - equity) / maxEquity) * 100);
    openUntil = outcome.exitIndex;

    trades.push({
      ...signal,
      exitIndex: outcome.exitIndex,
      exitTime: candles[outcome.exitIndex].time,
      exitPrice: outcome.exitPrice,
      exitReason: outcome.exitReason,
      quantity,
      grossPnl,
      fees,
      netPnl,
      equity
    });
  }

  return { trades, metrics: calculateMetrics(trades, params.initialEquity, equity, maxDrawdownPct), params };
}

export function calculateMetrics(trades, initialEquity, finalEquity, maxDrawdownPct) {
  const wins = trades.filter((trade) => trade.netPnl > 0);
  const losses = trades.filter((trade) => trade.netPnl <= 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0));
  const returns = trades.map((trade, index) => {
    const previousEquity = index === 0 ? initialEquity : trades[index - 1].equity;
    return trade.netPnl / previousEquity;
  });

  return {
    initialEquity,
    finalEquity,
    netProfit: finalEquity - initialEquity,
    returnPct: ((finalEquity - initialEquity) / initialEquity) * 100,
    tradeCount: trades.length,
    winRatePct: trades.length === 0 ? 0 : (wins.length / trades.length) * 100,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss,
    averageTrade: trades.length === 0 ? 0 : (finalEquity - initialEquity) / trades.length,
    maxDrawdownPct,
    sharpeApprox: approximateSharpe(returns)
  };
}

function resolveTrade(candles, signal, quantity, params) {
  for (let i = signal.index + 1; i < candles.length; i += 1) {
    const candle = candles[i];
    const stopHit = signal.side === 'long' ? candle.low <= signal.stopLoss : candle.high >= signal.stopLoss;
    const targetHit = signal.side === 'long' ? candle.high >= signal.takeProfit : candle.low <= signal.takeProfit;

    if (stopHit && targetHit) {
      return { exitIndex: i, exitPrice: signal.stopLoss, exitReason: 'stop_loss_intrabar_priority' };
    }
    if (stopHit) return { exitIndex: i, exitPrice: signal.stopLoss, exitReason: 'stop_loss' };
    if (targetHit) return { exitIndex: i, exitPrice: signal.takeProfit, exitReason: 'take_profit' };
  }

  const lastIndex = candles.length - 1;
  const lastClose = candles[lastIndex].close;
  const exitPrice = signal.side === 'long' ? lastClose * (1 - params.slippagePct) : lastClose * (1 + params.slippagePct);
  return quantity > 0 ? { exitIndex: lastIndex, exitPrice, exitReason: 'end_of_data' } : null;
}

function calculatePnl(side, entry, exit, quantity) {
  return side === 'long' ? (exit - entry) * quantity : (entry - exit) * quantity;
}

function approximateSharpe(returns) {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const standardDeviation = Math.sqrt(variance);
  return standardDeviation === 0 ? 0 : (mean / standardDeviation) * Math.sqrt(252 * 24 * 4);
}
