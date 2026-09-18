# Veyrix — Orynth Submission

## Core details

- Product name: Veyrix
- Website: https://veyrix-phi.vercel.app
- GitHub: https://github.com/pipndropclown/veyrix
- Creator X: https://x.com/pipNdropclown
- Creator: @pipNdropclown
- Suggested categories: Analytics, Web3, Infrastructure (or closest current Orynth equivalents)
- Logo upload: Official Veyrix logo (asset pending in this checkout)

## Product Name

Veyrix

## Tagline

Autonomous Strategy Research Lab

## One-Line Description

Test, compare, and validate blockchain trading strategies without risking real capital.

## 60-character summary

Autonomous crypto strategy research and paper trading.

## What makes it special? (under 500 characters)

Veyrix combines live crypto market data, autonomous and manual paper trading, multi-timeframe candlestick charts, and a research lab for robustness, regimes, walk-forward validation, and overfitting analysis. Users can challenge strategies without real capital, wallets, or transaction signing.

## First comment

Trading strategies can look convincing until they meet live conditions, risk rules, and changing regimes. Veyrix lets people observe autonomous paper execution and research behavior over time before risking capital. Everything is simulation-only: no real trades or wallet transactions.

## Why we built it

Charts show signals and backtests show historical results, but neither alone explains how a strategy behaves across time, market regimes, costs, and risk controls. Veyrix brings those layers together in one traceable research workflow.

## Problem

Backtests often emphasize returns while hiding overfitting, weak out-of-sample behavior, regime dependence, transaction costs, and benchmark underperformance. Researchers need a consistent way to challenge a strategy, not just showcase its best run.

## Solution

Veyrix runs multiple strategies through the same deterministic simulation and validation framework, then separates historical performance from the quality of evidence supporting it. It turns complex research artifacts into readable scorecards, failure profiles, and reproducible reports.

## Key Features

- Live public BTC, ETH, and SOL market context with a shared virtual-USDC paper portfolio
- Live candlestick terminal with volume, trade markers, and risk levels
- Visible closed-candle autonomous paper trading and confirmed manual paper trades
- Read-only Phantom, Solflare, and Backpack wallet identity, fully separated from virtual funds
- Three long-only strategy agents under identical assumptions
- OHLC backtesting with modeled fees, slippage, stops, and targets
- Full and exposure-matched SOL benchmarks
- Parameter sensitivity, walk-forward, regime, and overfitting analysis
- Multi-regime, extended, and multi-anchor validation
- Reproducible manifests, deterministic fingerprints, normalized artifacts, and exports
- Research Workspace with performance/evidence scorecards and deterministic reports

## What Makes Veyrix Different

Veyrix does not crown a strategy from one attractive return. It compares performance, robustness, evidence quality, benchmark behavior, parameter stability, market regimes, and historical anchors under shared assumptions. Its conclusions are deterministic and traceable to stored metrics rather than generated claims.

## Technical Stack

Next.js App Router, React, strict TypeScript, Node.js server routes, Coinbase Exchange public data, local browser persistence for the paper account, and normalized server-side research artifacts.

## How It Uses Blockchain Data

Veyrix uses public SOL-USD market prices and OHLC candles from Coinbase Exchange to evaluate simulated strategy behavior. It does not access wallets or submit blockchain transactions.

## Current Safety Model

Paper trading and historical simulation only. No private keys, seed phrases, wallet signing, real funds, or real exchange execution. Simulated leverage, margin, and short positions exist only inside the virtual paper account.

## Current MVP

Markets: BTC, ETH, and SOL/USDC paper pairs. Strategies: Momentum, Moving Average, Mean Reversion. Trading: manual Spot and simulated Futures paper execution, plus multi-agent autonomous paper simulation. Research: backtesting, robustness, walk-forward, regime, extended validation, and reports. Wallet: read-only Phantom/Solflare/Backpack. Themes: Dark, Light, System. Accounts/cloud sync: architecture ready for activation; Supabase public values are not configured in the current deployment.

## Ownership verification

- Live product: https://veyrix-phi.vercel.app
- Creator: @pipNdropclown
- Creator X: https://x.com/pipNdropclown
- GitHub: https://github.com/pipndropclown/veyrix
- Orynth meta token: Pending

When Orynth provides Veyrix's unique verification token, add it to the production site exactly as instructed, redeploy, and verify ownership. Do not reuse another product's token.

## Submission checklist

- [x] Product name
- [x] Production website
- [x] Live terminal
- [x] Candlestick chart
- [x] Autonomous paper trading
- [x] Manual paper trading
- [x] Trade history
- [x] Research Workspace
- [x] Read-only wallet architecture
- [x] Dark/light/system themes
- [x] Security validation
- [x] Production deployment
- [ ] Public GitHub repository verified
- [ ] Official logo asset integrated
- [ ] Supabase activated and authenticated runtime-tested
- [ ] Create Veyrix listing on Orynth
- [ ] Receive unique Orynth verification token
- [ ] Add verification token
- [ ] Capture final screenshots
- [ ] Verify ownership
- [ ] Submit Veyrix on Orynth

## Future Roadmap

Potential next steps include broader historical sources, portable research replay, richer evidence diagnostics, and optional durable artifact infrastructure. The roadmap does not promise real-money automation.
## V1.1.1 update

Accounts are optional: Guest Mode remains fully usable. When configured, Supabase provides user-scoped cloud persistence for virtual paper-account data and preferences. Dark, Light, and System themes are available. Wallet identity remains read-only and separate from the paper account; no real trades or wallet transactions are possible.

## V1.3 Multi-Market Trading Lab

Veyrix supports BTC, ETH, and SOL Spot Paper and Futures Paper markets through Coinbase Exchange public USD reference feeds. Paper positions settle only in virtual USDC. A centralized registry controls provider IDs and display precision, one shared virtual account funds all markets, and one market-specific autonomous configuration can run at a time. Historical backtesting and reproducible research can select BTC, ETH, or SOL.

## V1.4 Multi-Agent Automation & Performance Analytics

Veyrix runs up to six independent simulated paper agents at once across BTC, ETH, and SOL Spot or Futures markets. Agents share one browser-local virtual-USDC account, with per-market/mode position ownership, capital checks, pause-safe risk monitoring, and visible conflict handling. A centralized scheduler shares candle requests by market/timeframe while keeping execution IDs per agent. The dashboard compares actual recorded paper-trade metrics and shows individual realized equity curves; a documented bounded score remains unavailable before five completed trades. Legacy V1.3 automation is migrated into an agent. See [V1.4 technical details](V1.4.md).

Veyrix has no live trading integration: simulated leverage is bookkeeping within the virtual account, not borrowing. Agent execution and persistence are browser-side; closing the browser pauses new evaluations. Research links preselect a market/strategy but never launch jobs automatically. Metrics are descriptive, not investment advice or predictions.
