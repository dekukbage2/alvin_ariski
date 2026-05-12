# TF15 EMA Stochastic Trading Bot

A JavaScript research bot for 15-minute candles that combines:

- EMA50/EMA200 trend filtering.
- Support/resistance rejection candles.
- Engulfing or pin-bar reversal evidence.
- Stochastic oscillator momentum confirmation.
- Fixed-fractional risk sizing and backtesting metrics.

> This repository is for strategy research and education only. It does not provide financial advice and does not place live orders.

## Quick start

```bash
npm test
npm run backtest:sample
```

Run against your own 15-minute OHLCV CSV file:

```bash
node src/cli.js path/to/candles.csv --json
```

Required CSV columns are `time,open,high,low,close`; `volume` is optional.

## Strategy defaults

| Parameter | Default | Purpose |
| --- | ---: | --- |
| `timeframeMinutes` | 15 | Expected candle timeframe. |
| `emaFastPeriod` | 50 | Fast EMA for regime filtering. |
| `emaSlowPeriod` | 200 | Slow EMA for regime filtering. |
| `stochasticKPeriod` | 14 | Stochastic lookback. |
| `stochasticKSmoothing` | 3 | Slow %K smoothing. |
| `stochasticDPeriod` | 3 | %D smoothing. |
| `oversold` | 20 | Long momentum threshold. |
| `overbought` | 80 | Short momentum threshold. |
| `rejectionLookback` | 8 | Recent level detection window. |
| `minWickBodyRatio` | 1.2 | Minimum rejection wick/body quality. |
| `riskRewardRatio` | 1.8 | Take-profit distance in units of risk. |
| `riskPerTradePct` | 0.01 | Equity risked per trade. |

CLI overrides use `--key=value`:

```bash
node src/cli.js data/sample-15m.csv --riskRewardRatio=2 --minWickBodyRatio=1.5
```

## Outputs

The backtester reports:

- Initial/final equity.
- Net profit and return percentage.
- Trade count and win rate.
- Profit factor.
- Average trade.
- Maximum drawdown.
- Approximate annualized Sharpe ratio.

See [`docs/strategy.md`](docs/strategy.md) for the literature survey, formulas, detailed entry/exit rules, and validation workflow.
