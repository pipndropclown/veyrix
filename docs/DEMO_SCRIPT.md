# Veyrix V1.0 Demo Script

## 2–3 minute walkthrough

**0:00 — Introduce Veyrix**  
“Veyrix is an Autonomous Strategy Research Lab. It helps us test, compare, and validate blockchain trading strategies without risking real capital. Everything shown is paper trading or historical simulation.”

**0:20 — Live SOL terminal**  
Open the Dashboard. Point out the live Coinbase SOL-USD price, green/red candlesticks, volume, independent chart timeframe, and PAPER TRADING ONLY status. Toggle line/candlestick mode without changing automation.

**0:35 — Paper account**  
Show the virtual $10,000 starting balance, simulated position, realized/unrealized P&L, risk limits, and recent paper trades. Explain that state stays local and no wallet is connected.

**0:50 — Automation and paper execution**  
Show automation status, strategy/timeframe, last closed candle, current BUY/SELL/HOLD decision, next evaluation, and activity feed. Explain that a closed-candle BUY can open a virtual position and produce a chart marker; stops, targets, and history then update from real strategy rules. Demonstrate the confirmed manual paper controls and the clearly separate read-only wallet panel.

**1:05 — Research Workspace**  
Use the Dashboard/Research navigation. Show the Strategy Arena comparing Momentum, Moving Average, and Mean Reversion against identical candles, costs, sizing, and risk assumptions.

**1:25 — Benchmarks and robustness**  
Point out full SOL buy-and-hold and the fairer 10%-exposure benchmark. Open robustness and overfitting sections: sensitivity, future-only walk-forward results, regimes, and parameter stability.

**1:50 — Performance versus evidence**  
Show side-by-side scorecards. Explain that a strategy can have strong research evidence but weak historical performance, and Veyrix reports both honestly.

**2:10 — Deterministic report**  
Open a saved research run and its report/demo view. Highlight the executive summary, failure profile, evidence card, fingerprints, and export. The report is generated from stored metrics without rerunning research or inventing AI claims.

**2:35 — Close**  
“Veyrix is designed to challenge trading ideas before anyone risks capital. Historical results do not predict future performance, and Veyrix executes no real trades.”
### Optional account and themes

Mention that reviewers can use Guest Mode immediately, then optionally create an account for cloud sync and cross-device restoration. Show the theme selector and emphasize that the connected wallet never funds the $10,000 virtual account.

## V1.3 demo

1. Select BTC / USDC and explain that BTC/USD is the public reference feed.
2. Open BTC Spot Paper, then ETH Futures Paper, and show both in Open Positions.
3. Switch charts without modifying either position; show market-filtered markers and history.
4. Configure one autonomous market, strategy, timeframe, mode, leverage, allocation, stop, and target.
5. Open Research, select BTC, ETH, or SOL, and run a market-specific backtest.

## V1.4 demo

1. Create a BTC Spot Momentum agent, an ETH Futures Mean Reversion agent, and a SOL Spot Moving Average agent; show each starts paused and has independent settings.
2. Start the three agents and show active count, per-agent status, position, signal, and shared virtual USDC availability.
3. Show the same-market position conflict message, and point out that a different market/mode can execute if capital remains.
4. Pause one agent, then show risk protections still apply to its open simulated position. Rename an agent and show the agent identity in history/activity.
5. Open an individual agent detail view, compare agent metrics, and select one realized equity curve. Explain the five-trade score threshold and visible score formula.
6. Open Research from an agent and show its market/strategy context. Start a research run only after the user selects the research period and clicks Run.
7. Reiterate that all activity is browser-side paper simulation; nothing is signed, borrowed, deposited, or sent to an exchange.
