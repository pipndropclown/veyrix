"use client";
import { useMemo, useState } from "react";
import { SectionHeader } from "./SectionHeader";
import type { PaperPortfolioState } from "@/types/trading";
interface Props {
  portfolio: PaperPortfolioState;
  price: number | null;
  automationEnabled: boolean;
  onBuy(amount: number): string | null;
  onSell(): string | null;
}
export function ManualPaperTradePanel({
  portfolio,
  price,
  automationEnabled,
  onBuy,
  onSell,
}: Props) {
  const [amount, setAmount] = useState("1000"),
    [error, setError] = useState<string | null>(null);
  const parsed = Number(amount),
    quantity = useMemo(
      () => (price && parsed > 0 ? parsed / price : 0),
      [parsed, price],
    );
  const buy = () => {
    if (
      !window.confirm(
        "THIS IS A PAPER TRADE.\n\nNO REAL FUNDS WILL MOVE.\n\nConfirm virtual SOL purchase?",
      )
    )
      return;
    setError(onBuy(parsed));
  };
  const sell = () => {
    if (
      !window.confirm(
        "THIS IS A PAPER TRADE.\n\nNO REAL FUNDS WILL MOVE.\n\nSell the entire virtual SOL position?",
      )
    )
      return;
    setError(onSell());
  };
  return (
    <section className="panel manual-panel">
      <SectionHeader
        eyebrow="One shared virtual account"
        title="Manual paper trade"
      />
      {automationEnabled && (
        <p className="automation-warning">
          Automation is currently active. Veyrix strategy and risk rules may
          close this paper position.
        </p>
      )}
      <dl>
        <div>
          <dt>Available virtual USDC</dt>
          <dd>${portfolio.availableUsdc.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Current SOL price</dt>
          <dd>{price ? `$${price.toFixed(2)}` : "Unavailable"}</dd>
        </div>
        <div>
          <dt>Estimated SOL</dt>
          <dd>{quantity.toFixed(6)}</dd>
        </div>
        <div>
          <dt>Remaining virtual USDC</dt>
          <dd>
            $
            {Math.max(
              0,
              portfolio.availableUsdc - (Number.isFinite(parsed) ? parsed : 0),
            ).toFixed(2)}
          </dd>
        </div>
      </dl>
      <label>
        Amount to spend (virtual USDC)
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={portfolio.solBalance > 0}
        />
      </label>
      <div className="manual-actions">
        <button
          type="button"
          disabled={!price || portfolio.solBalance > 0}
          onClick={buy}
        >
          CONFIRM PAPER BUY
        </button>
        <button
          type="button"
          disabled={!price || portfolio.solBalance <= 0}
          onClick={sell}
        >
          SELL ALL
        </button>
      </div>
      {error && (
        <p className="backtest-error" role="alert">
          {error}
        </p>
      )}
      <small>No wallet funds are used. Short selling is disabled.</small>
    </section>
  );
}
