# TF15 EMA/Stochastic Rejection-Reversal-Momentum Strategy

This project implements a rules-based 15-minute strategy that combines trend filtering, price-action rejection/reversal, and stochastic momentum confirmation. It is intended for research and backtesting, not financial advice.

## Literature and practice survey

- **Rejection / support-resistance context:** Rejection candles are treated as failed attempts to trade through a recent support or resistance level. The implementation models support as the lowest low and resistance as the highest high across a configurable lookback, then requires a long wick and a close back inside the level. This aligns with the common support/resistance idea that price reactions near previously important highs/lows can be used as decision zones.
- **Reversal signal:** Reversal is represented by bullish/bearish engulfing candles or pin bars. These candle patterns are used as local evidence that order flow changed around the rejected level, but the bot deliberately requires additional trend and momentum filters to reduce stand-alone candlestick noise.
- **Momentum signal:** Stochastic oscillator confirmation is used because stochastic compares the current close with the recent high-low range and is commonly interpreted as a bounded momentum oscillator. The long setup requires a %K/%D bullish cross from oversold conditions; the short setup requires a bearish cross from overbought conditions.
- **Trend filter:** EMA50 and EMA200 are used as a directional regime filter. Longs are allowed only when EMA50 is above EMA200, and shorts are allowed only when EMA50 is below EMA200. This attempts to avoid fading the dominant 15-minute trend.
- **Risk management:** The backtester sizes each trade from a fixed percentage of equity, places the stop beyond the rejected wick/level, and sets the target by a configurable risk-reward ratio. Intrabar ambiguity is handled conservatively by assuming the stop is hit before the target if both occur in the same candle.

Useful references for the indicator formulas and strategy components include MetaTrader's stochastic oscillator documentation (https://www.metatrader4.com/en/trading-platform/help/analytics/tech_indicators/stochastic_oscillator), Britannica's moving average overview (https://www.britannica.com/money/simple-vs-exponential-moving-averages), and academic work on support/resistance modelling and momentum strategy design such as arXiv:2103.02331 and arXiv:2101.01006.

## Indicator formulas

### EMA50 and EMA200

For a period `n`, the exponential moving average multiplier is:

```text
alpha = 2 / (n + 1)
```

The first EMA value is seeded with an `n`-period simple moving average:

```text
EMA[first] = SMA(close[0..n-1])
```

Subsequent EMA values are recursive:

```text
EMA[t] = (close[t] - EMA[t-1]) * alpha + EMA[t-1]
```

The bot uses the same formula for EMA50 (`n = 50`) and EMA200 (`n = 200`).

### Stochastic oscillator

For a %K lookback `n`:

```text
raw %K[t] = ((close[t] - lowestLow(n)) / (highestHigh(n) - lowestLow(n))) * 100
```

The bot computes a slow stochastic by smoothing raw %K with a moving average and then computing %D as another moving average:

```text
%K[t] = SMA(raw %K, kSmoothing)
%D[t] = SMA(%K, dPeriod)
```

Defaults are `kPeriod = 14`, `kSmoothing = 3`, and `dPeriod = 3`.

## Algorithm rules

### Long setup

1. Use only 15-minute candles.
2. EMA50 must be above EMA200.
3. Current candle must reject recent support:
   - Low trades at or slightly below the recent lookback support level.
   - Close returns above that support level.
   - Lower wick/body ratio is at least `minWickBodyRatio`.
4. Current candle must show bullish reversal evidence:
   - Bullish engulfing candle, or
   - Bullish pin bar with a dominant lower wick.
5. Stochastic momentum must confirm:
   - %K crosses above %D.
   - Prior %K is at or below the oversold threshold.
6. Enter at close plus slippage, stop below the rejected wick/support, and target `riskRewardRatio` times the initial risk.

### Short setup

1. Use only 15-minute candles.
2. EMA50 must be below EMA200.
3. Current candle must reject recent resistance:
   - High trades at or slightly above the recent lookback resistance level.
   - Close returns below that resistance level.
   - Upper wick/body ratio is at least `minWickBodyRatio`.
4. Current candle must show bearish reversal evidence:
   - Bearish engulfing candle, or
   - Bearish pin bar with a dominant upper wick.
5. Stochastic momentum must confirm:
   - %K crosses below %D.
   - Prior %K is at or above the overbought threshold.
6. Enter at close minus slippage, stop above the rejected wick/resistance, and target `riskRewardRatio` times the initial risk.

## Validation and parameter refinement workflow

1. Run the baseline on in-sample 15-minute data.
2. Record net profit, return percentage, win rate, profit factor, maximum drawdown, average trade, trade count, and approximate Sharpe ratio.
3. Sweep parameters one group at a time:
   - `rejectionLookback`: level sensitivity.
   - `minWickBodyRatio`: rejection quality.
   - `oversold` / `overbought`: momentum strictness.
   - `riskRewardRatio`: payoff profile.
4. Re-run on out-of-sample data. Keep only parameter changes that improve risk-adjusted performance without collapsing trade count or increasing drawdown beyond tolerance.
