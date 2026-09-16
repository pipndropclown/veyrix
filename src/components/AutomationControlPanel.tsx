"use client";
import { SectionHeader } from "./SectionHeader";
import { LIVE_TIMEFRAME_IDS } from "@/lib/market/liveCandles";
import { strategyList } from "@/lib/strategy/strategyRegistry";
import type { AutomationSettings, AutomationStatus } from "@/types/liveTrading";
import { MARKET_IDS,MARKET_REGISTRY } from "@/lib/market/marketRegistry";
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
        <label>Market<select value={settings.marketId??"SOL"} onChange={event=>onChange({...settings,marketId:event.target.value as AutomationSettings["marketId"],lastProcessedCandleId:null})}>{MARKET_IDS.map(id=><option key={id} value={id}>{MARKET_REGISTRY[id].displaySymbol}</option>)}</select></label>
        <label>Trading mode<select value={settings.tradingMode??"SPOT"} onChange={event=>onChange({...settings,tradingMode:event.target.value as "SPOT"|"FUTURES",lastProcessedCandleId:null})}><option>SPOT</option><option>FUTURES</option></select></label>
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
        {(settings.tradingMode??"SPOT")==="FUTURES"&&<label>Leverage<select value={settings.leverage??1} onChange={event=>onChange({...settings,leverage:Number(event.target.value) as 1|2|3|5})}>{[1,2,3,5].map(x=><option key={x} value={x}>{x}x</option>)}</select></label>}
        <label>Allocation %<input type="number" min="1" max="100" value={settings.allocationPercent??10} onChange={event=>onChange({...settings,allocationPercent:Number(event.target.value)})}/></label>
        <label>Stop loss %<input type="number" min="0" value={settings.stopLossPercent??3} onChange={event=>onChange({...settings,stopLossPercent:Number(event.target.value)})}/></label>
        <label>Take profit %<input type="number" min="0" value={settings.takeProfitPercent??6} onChange={event=>onChange({...settings,takeProfitPercent:Number(event.target.value)})}/></label>
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
          ["Market / mode", `${settings.marketId??"SOL"} ${settings.tradingMode??"SPOT"}`],
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
          ["Allocation", `${settings.allocationPercent??10}%`],
          [
            "Stop / target",
            `${settings.stopLossPercent??3}% / ${settings.takeProfitPercent??6}%`,
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
