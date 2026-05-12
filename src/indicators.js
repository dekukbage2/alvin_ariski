export function sma(values, period) {
  validatePeriod(period);
  const result = Array(values.length).fill(null);
  let sum = 0;

  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }

  return result;
}

export function ema(values, period) {
  validatePeriod(period);
  const result = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let seedSum = 0;
  let previous = null;

  for (let i = 0; i < values.length; i += 1) {
    if (i < period) seedSum += values[i];

    if (i === period - 1) {
      previous = seedSum / period;
      result[i] = previous;
    } else if (i >= period) {
      previous = (values[i] - previous) * multiplier + previous;
      result[i] = previous;
    }
  }

  return result;
}

export function stochastic(candles, kPeriod = 14, kSmoothing = 3, dPeriod = 3) {
  validatePeriod(kPeriod);
  validatePeriod(kSmoothing);
  validatePeriod(dPeriod);

  const rawK = Array(candles.length).fill(null);

  for (let i = kPeriod - 1; i < candles.length; i += 1) {
    const window = candles.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...window.map((candle) => candle.high));
    const lowestLow = Math.min(...window.map((candle) => candle.low));
    const range = highestHigh - lowestLow;
    rawK[i] = range === 0 ? 50 : ((candles[i].close - lowestLow) / range) * 100;
  }

  const smoothedK = rollingAverageNullable(rawK, kSmoothing);
  const d = rollingAverageNullable(smoothedK, dPeriod);

  return { rawK, k: smoothedK, d };
}

export function crossAbove(previousA, currentA, previousB, currentB) {
  return previousA != null && currentA != null && previousB != null && currentB != null && previousA <= previousB && currentA > currentB;
}

export function crossBelow(previousA, currentA, previousB, currentB) {
  return previousA != null && currentA != null && previousB != null && currentB != null && previousA >= previousB && currentA < currentB;
}

function rollingAverageNullable(values, period) {
  const result = Array(values.length).fill(null);
  const queue = [];
  let sum = 0;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null || Number.isNaN(value)) {
      queue.length = 0;
      sum = 0;
      continue;
    }

    queue.push(value);
    sum += value;

    if (queue.length > period) sum -= queue.shift();
    if (queue.length === period) result[i] = sum / period;
  }

  return result;
}

function validatePeriod(period) {
  if (!Number.isInteger(period) || period <= 0) {
    throw new RangeError(`Period must be a positive integer, received ${period}`);
  }
}
