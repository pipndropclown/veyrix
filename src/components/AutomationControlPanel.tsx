"use client";
import { SectionHeader } from "./SectionHeader";
import { LIVE_TIMEFRAME_IDS } from "@/lib/market/liveCandles";
import { strategyList } from "@/lib/strategy/strategyRegistry";
import { paperTradingConfig } from "@/lib/trading/tradingConfig";
import type { AutomationSettings, AutomationStatus } from "@/types/liveTrading";
interface Props {
  settings: AutomationSettings;
  status: AutomationStatus;
  position: "FLAT" | "LONG";
  onChange(settings: AutomationSettings): void;
}
export function AutomationControlPanel({
  settings,
  status,
  position,
  onChange,
}: Props) {
  const strategy = strategyList.find(
    (item) => item.id === settings.strategyId,
  )!;
  return (
    <section className="panel automation-panel" aria-live="polite">
      <SectionHeader
        eyebrow="Closed-candle execution"
        title="Automated paper trading"
        action={
          <span
            className={`status-pill ${settings.enabled ? "active" : "unavailable"}`}
          >
            <i />
            {settings.enabled ? "RUNNING" : "STOPPED"}
          </span>
        }
      />
      <div className="automation-controls">
        <div
          className="automation-toggle"
          role="group"
          aria-label="Automation status"
        >
          <button
            type="button"
            aria-pressed={settings.enabled}
            className={settings.enabled ? "selected" : ""}
            onClick={() => onChange({ ...settings, enabled: true })}
          >
            ON
          </button>
          <button
            type="button"
            aria-pressed={!settings.enabled}
            className={!settings.enabled ? "selected" : ""}
            onClick={() => onChange({ ...settings, enabled: false })}
          >
            OFF
          </button>
        </div>
        <label>
          Strategy
          <select
            value={settings.strategyId}
            onChange={(event) =>
              onChange({
                ...settings,
                strategyId: event.target
                  .value as AutomationSettings["strategyId"],
                lastProcessedCandleId: null,
              })
            }
          >
            {strategyList.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Automation timeframe
          <select
            value={settings.timeframe}
            onChange={(event) =>
              onChange({
                ...settings,
                timeframe: event.target
                  .value as AutomationSettings["timeframe"],
                lastProcessedCandleId: null,
              })
            }
          >
            {LIVE_TIMEFRAME_IDS.map((id) => (
              <option value={id} key={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="automation-status-grid">
        {[
          ["Status", settings.enabled ? "RUNNING" : "STOPPED"],
          ["Strategy", strategy.name],
          ["Timeframe", settings.timeframe],
          ["Signal", status.signal?.signal ?? "WAITING"],
          [
            "Confidence",
            status.signal ? `${status.signal.confidence}%` : "N/A",
          ],
          ["Position", position],
          [
            "Last candle",
            status.lastEvaluatedCandle
              ? new Date(status.lastEvaluatedCandle).toLocaleString()
              : "Waiting for closed candle",
          ],
          [
            "Last evaluation",
            status.lastEvaluationTime
              ? new Date(status.lastEvaluationTime).toLocaleTimeString()
              : "N/A",
          ],
          ["Last execution", status.lastExecution ?? "None"],
          [
            "Next close",
            status.nextExpectedClose
              ? new Date(status.nextExpectedClose).toLocaleTimeString()
              : "N/A",
          ],
          ["Processed", String(settings.processedCandleIds.length)],
          ["Allocation", `${paperTradingConfig.positionSizePercent}%`],
          [
            "Stop / target",
            `${paperTradingConfig.stopLossPercent}% / ${paperTradingConfig.takeProfitPercent}%`,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="automation-reason">
        <span>Current reason</span>
        <p>
          {status.signal?.reason ??
            (settings.enabled
              ? "Waiting for the next safe closed candle."
              : "Automation is off. Risk protection remains active; strategy entries and exits are disabled.")}
        </p>
      </div>
    </section>
  );
}
