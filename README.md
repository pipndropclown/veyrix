# Veyrix

Website: https://veyrix-phi.vercel.app  
GitHub: https://github.com/pipndropclown/veyrix

## Autonomous Strategy Research Lab

Veyrix is a live paper-trading terminal and strategy-research laboratory for BTC, ETH, and SOL markets. It helps researchers test, compare, and validate blockchain trading strategies without risking real capital.

## What Veyrix Is

Veyrix combines live public BTC, ETH, and SOL market data, one local shared virtual-USDC account, deterministic historical simulation, and reproducible validation reports. It is a research prototype—not an exchange, wallet, financial adviser, or real-money trading bot.

## Problem

An impressive backtest can conceal overfitting, weak out-of-sample performance, dependence on one market regime, transaction costs, or underperformance against a simple benchmark. A single return number does not show whether a result is repeatable or well supported.

## Solution

Veyrix evaluates three strategies against the same candles, capital, long-only constraints, fees, slippage, risk controls, and benchmarks. It separates performance quality from evidence quality and adds sensitivity, walk-forward, regime, multi-anchor, and failure analysis.

## Core Features

- Live SOL-USD market data and a locally persisted paper account
- Responsive candlestick/line terminal with volume, trade markers, and position risk lines
- Closed-candle autonomous paper trading across 1m, 5m, 15m, 30m, 1H, 4H, 12H, and 1D
- Confirmed manual paper BUY and SELL ALL on the same virtual account
- Read-only Wallet Standard identity support for Phantom, Solflare, and Backpack
- Momentum, Moving Average Crossover, and Mean Reversion agents
- Historical OHLC backtesting with deterministic fees, slippage, stop loss, and take profit
- Full-exposure and 10%-exposure buy-and-hold benchmarks
- Strategy Arena and experimental Veyrix Score
- Parameter sensitivity and stability analysis
- Chronological walk-forward and embargoed validation
- Market-regime, multi-regime, and extended validation
- Overfitting warnings, failure profiles, and exposure analysis
- Reproducible multi-anchor research with deterministic identities and fingerprints
- Normalized, lazy-loaded research artifacts and compact saved-run summaries
- Research Workspace and deterministic research reports

## Architecture

Veyrix uses Next.js App Router, React, and strict TypeScript. Coinbase Exchange public endpoints provide SOL-USD market candles. Paper-account state is local to the browser, while research executes server-side and remains isolated from live paper state. Stored research uses normalized artifacts with memory caching and an optional local filesystem adapter; no database or paid service is required.

## Safety Boundary

Veyrix is paper trading and historical simulation only. It does not execute real trades, connect wallets, submit blockchain transactions, move funds, or request private keys or seed phrases. Results are not investment advice.

## Running Locally

Requirements: a current Node.js LTS release and npm.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Production-style validation:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

No secret is required for Coinbase public market data. Local filesystem research persistence is optional; without it, research uses best-effort process memory.

## Tests

The V1.0 release passes 363 deterministic tests covering strategies, execution, analytics, validation, research caching, normalized artifacts, and report generation.

## Research Limitations

- Simulated historical performance does not predict future results.
- OHLC candles do not reveal exact intrabar paths; collision handling is deterministic.
- Constant modeled fees and slippage cannot reproduce variable spreads, liquidity, order-book depth, or latency.
- Research scores, regimes, verdicts, and warnings are transparent heuristics, not statistical proof.
- Public-data availability and serverless cache lifetime can vary.
- Veyrix has no real-money execution capability.
- Wallet connection is identity/balance display only and never funds the virtual account.

## Roadmap

Future research may broaden datasets, improve evidence diagnostics, and add portable research replay. The safety boundary remains simulation-first; real-money automation is not part of this release.

## V1.3 Multi-Market Trading Lab

Veyrix supports BTC, ETH, and SOL Spot Paper and Futures Paper markets through Coinbase Exchange public USD reference feeds. Paper positions settle only in virtual USDC. A centralized registry controls provider IDs and display precision, one shared virtual account funds all markets, and one market-specific autonomous configuration can run at a time. Historical backtesting and reproducible research can select BTC, ETH, or SOL.

## V1.4 Multi-Agent Automation & Performance Analytics

Up to six independent browser-side paper agents can run at once across BTC, ETH, and SOL, in Spot or simulated Futures mode. Each agent has its own strategy, timeframe, sizing preference, risk levels, lifecycle, processed-candle IDs, trade ownership, and analytics. Agents share one virtual USDC account and cannot overlap positions for the same market and mode. A single browser scheduler groups candles by market/timeframe and caches shared requests; only the latest safe closed candle is evaluated after a browser restart. Pausing blocks strategy actions while stop, target, and simulated liquidation protection continue. Removing an agent with an open position requires confirmation and leaves the position open for manual control.

The Automation Agents dashboard includes per-agent realized and unrealized results, a comparison table, an individual realized equity curve, and an observable 0–100 Veyrix Agent Score. The score is withheld until five trades are completed and summarizes past simulated results; it is not investment advice or a forecast. Agent settings and trade ownership are stored locally in Guest Mode. Read [docs/V1.4.md](docs/V1.4.md) for the score formula, migration, limits, and known constraints.
