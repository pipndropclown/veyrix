# Veyrix

Website: https://veyrix-phi.vercel.app  
GitHub: https://github.com/pipndropclown/veyrix

## Autonomous Strategy Research Lab

Veyrix is a live paper-trading terminal and strategy-research laboratory for SOL markets. It helps researchers test, compare, and validate blockchain trading strategies without risking real capital.

## What Veyrix Is

Veyrix combines live public SOL market data, a local paper account, deterministic historical simulation, and reproducible validation reports. It is a research prototype—not an exchange, wallet, financial adviser, or real-money trading bot.

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
