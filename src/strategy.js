import { crossAbove, crossBelow, ema, stochastic } from './indicators.js';

export const defaultParams = Object.freeze({
  timeframeMinutes: 15,
  emaFastPeriod: 50,
  emaSlowPeriod: 200,
  stochasticKPeriod: 14,
  stochasticKSmoothing: 3,
  stochasticDPeriod: 3,
  oversold: 20,
  overbought: 80,
  rejectionLookback: 8,
  rejectionTolerancePct: 0.003,
  minWickBodyRatio: 1.2,
  riskRewardRatio: 1.8,
  stopBufferPct: 0.0015,
  riskPerTradePct: 0.01,
  initialEquity: 10_000,
  feeRate: 0.0004,
  slippagePct: 0.0002,
  allowShorts: true
});

export function buildSignals(candles, overrides = {}) {
  const params = { ...defaultParams, ...overrides };
  validateCandles(candles);

  const closes = candles.map((candle) => candle.close);
  const emaFast = ema(closes, params.emaFastPeriod);
  const emaSlow = ema(closes, params.emaSlowPeriod);
  const stoch = stochastic(candles, params.stochasticKPeriod, params.stochasticKSmoothing, params.stochasticDPeriod);
  const signals = [];

  for (let i = 1; i < candles.length; i += 1) {
    if (!indicatorsReady(i, emaFast, emaSlow, stoch)) continue;

    const candle = candles[i];
    const previous = candles[i - 1];
    const trend = emaFast[i] > emaSlow[i] ? 'bullish' : emaFast[i] < emaSlow[i] ? 'bearish' : 'flat';
    const rejection = detectRejection(candles, i, params);
    const reversal = detectReversal(previous, candle);
    const momentum = detectMomentum(stoch, i, params);

    if (trend === 'bullish' && rejection.support && reversal.bullish && momentum.bullish) {
      signals.push(createSignal('long', candles, i, params, rejection.supportLevel, { trend, rejection, reversal, momentum, emaFast: emaFast[i], emaSlow: emaSlow[i], stochasticK: stoch.k[i], stochasticD: stoch.d[i] }));
    }

    if (params.allowShorts && trend === 'bearish' && rejection.resistance && reversal.bearish && momentum.bearish) {
      signals.push(createSignal('short', candles, i, params, rejection.resistanceLevel, { trend, rejection, reversal, momentum, emaFast: emaFast[i], emaSlow: emaSlow[i], stochasticK: stoch.k[i], stochasticD: stoch.d[i] }));
    }
  }

  return { signals, indicators: { emaFast, emaSlow, stochastic: stoch }, params };
}

export function detectRejection(candles, index, params = defaultParams) {
  const candle = candles[index];
  const start = Math.max(0, index - params.rejectionLookback);
  const prior = candles.slice(start, index);
  if (prior.length === 0) return { support: false, resistance: false };

  const supportLevel = Math.min(...prior.map((entry) => entry.low));
  const resistanceLevel = Math.max(...prior.map((entry) => entry.high));
  const tolerance = candle.close * params.rejectionTolerancePct;
  const body = Math.max(Math.abs(candle.close - candle.open), Number.EPSILON);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);

  return {
    support: candle.low <= supportLevel + tolerance && candle.close > supportLevel && lowerWick / body >= params.minWickBodyRatio,
    resistance: candle.high >= resistanceLevel - tolerance && candle.close < resistanceLevel && upperWick / body >= params.minWickBodyRatio,
    supportLevel,
    resistanceLevel,
    lowerWickBodyRatio: lowerWick / body,
    upperWickBodyRatio: upperWick / body
  };
}

export function detectReversal(previous, current) {
  const bullishEngulfing = current.close > current.open && previous.close < previous.open && current.close >= previous.open && current.open <= previous.close;
  const bearishEngulfing = current.close < current.open && previous.close > previous.open && current.open >= previous.close && current.close <= previous.open;
  const bullishPin = current.close > current.open && lowerWickRatio(current) >= 0.55;
  const bearishPin = current.close < current.open && upperWickRatio(current) >= 0.55;

  return {
    bullish: bullishEngulfing || bullishPin,
    bearish: bearishEngulfing || bearishPin,
    bullishEngulfing,
    bearishEngulfing,
    bullishPin,
    bearishPin
  };
}

export function detectMomentum(stoch, index, params = defaultParams) {
  const previousK = stoch.k[index - 1];
  const currentK = stoch.k[index];
  const previousD = stoch.d[index - 1];
  const currentD = stoch.d[index];

  return {
    bullish: crossAbove(previousK, currentK, previousD, currentD) && previousK <= params.oversold,
    bearish: crossBelow(previousK, currentK, previousD, currentD) && previousK >= params.overbought,
    k: currentK,
    d: currentD
  };
}

function createSignal(side, candles, index, params, rejectedLevel, context) {
  const candle = candles[index];
  const direction = side === 'long' ? 1 : -1;
  const entry = applySlippage(candle.close, side, params.slippagePct);
  const rawStop = side === 'long'
    ? Math.min(candle.low, rejectedLevel) * (1 - params.stopBufferPct)
    : Math.max(candle.high, rejectedLevel) * (1 + params.stopBufferPct);
  const riskPerUnit = Math.abs(entry - rawStop);
  const takeProfit = entry + direction * riskPerUnit * params.riskRewardRatio;

  return {
    index,
    time: candle.time,
    side,
    entry,
    stopLoss: rawStop,
    takeProfit,
    riskPerUnit,
    context
  };
}

function lowerWickRatio(candle) {
  const range = Math.max(candle.high - candle.low, Number.EPSILON);
  return (Math.min(candle.open, candle.close) - candle.low) / range;
}

function upperWickRatio(candle) {
  const range = Math.max(candle.high - candle.low, Number.EPSILON);
  return (candle.high - Math.max(candle.open, candle.close)) / range;
}

function indicatorsReady(index, emaFast, emaSlow, stoch) {
  return emaFast[index] != null && emaSlow[index] != null && stoch.k[index] != null && stoch.d[index] != null;
}

function applySlippage(price, side, slippagePct) {
  return side === 'long' ? price * (1 + slippagePct) : price * (1 - slippagePct);
}

function validateCandles(candles) {
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new TypeError('Candles must be a non-empty array.');
  }

  for (const [index, candle] of candles.entries()) {
    for (const key of ['open', 'high', 'low', 'close']) {
      if (!Number.isFinite(candle[key])) throw new TypeError(`Candle ${index} has invalid ${key}.`);
    }
    if (candle.high < candle.low) throw new RangeError(`Candle ${index} high is below low.`);
  }
}
