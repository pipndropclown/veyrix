"use client";
import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { HistoricalCandle } from "@/types/backtesting";
import type { ChartMode } from "@/types/liveTrading";
import type { PaperTrade } from "@/types/trading";
import type { PositionRiskLevels } from "@/lib/trading/riskEngine";

interface Props {
  candles: HistoricalCandle[];
  mode: ChartMode;
  trades: PaperTrade[];
  risk: PositionRiskLevels | null;
  currentPrice: number | null;
}
const time = (timestamp: string) =>
  Math.floor(Date.parse(timestamp) / 1000) as UTCTimestamp;
export function LiveCandlestickChart({
  candles,
  mode,
  trades,
  risk,
  currentPrice,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const chart: IChartApi = createChart(host.current, {
      autoSize: true,
      height: 440,
      layout: {
        background: { type: ColorType.Solid, color: "#090d10" },
        textColor: "#78878d",
      },
      grid: {
        vertLines: { color: "#182126" },
        horzLines: { color: "#182126" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#263139",
      },
      rightPriceScale: { borderColor: "#263139" },
      crosshair: {
        vertLine: { color: "#5b736b" },
        horzLine: { color: "#5b736b" },
      },
    });
    const priceSeries =
      mode === "CANDLESTICK"
        ? chart.addSeries(CandlestickSeries, {
            upColor: "#61f2c2",
            downColor: "#ff6474",
            wickUpColor: "#61f2c2",
            wickDownColor: "#ff6474",
            borderUpColor: "#61f2c2",
            borderDownColor: "#ff6474",
          })
        : chart.addSeries(LineSeries, { color: "#61f2c2", lineWidth: 2 });
    if (mode === "CANDLESTICK")
      priceSeries.setData(
        candles.map((c) => ({
          time: time(c.timestamp),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          ...(c.close === c.open ? { color: "#65737a", wickColor: "#65737a", borderColor: "#65737a" } : {}),
        })) as never,
      );
    else
      priceSeries.setData(
        candles.map((c) => ({
          time: time(c.timestamp),
          value: c.close,
        })) as never,
      );
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "#334f48",
    });
    volume
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      candles.map((c) => ({
        time: time(c.timestamp),
        value: c.volume,
        color:
          c.close > c.open
            ? "rgba(97,242,194,.35)"
            : c.close < c.open
              ? "rgba(255,100,116,.35)"
              : "rgba(127,141,149,.3)",
      })),
    );
    const markers = trades
      .flatMap((trade) => [
        {
          time: time(trade.entryTimestamp),
          position: "belowBar" as const,
          color: "#61f2c2",
          shape: "arrowUp" as const,
          text: `BUY ${trade.source ?? "AUTONOMOUS"} $${trade.entryPrice.toFixed(2)}`,
        },
        ...(trade.exitTimestamp
          ? [
              {
                time: time(trade.exitTimestamp),
                position: "aboveBar" as const,
                color: "#ff6474",
                shape: "arrowDown" as const,
                text: `SELL $${(trade.exitPrice ?? 0).toFixed(2)} ${trade.realizedPnl === null ? "" : `${trade.realizedPnl >= 0 ? "+" : ""}$${trade.realizedPnl.toFixed(2)}`}`,
              },
            ]
          : []),
      ])
      .sort((a, b) => Number(a.time) - Number(b.time));
    createSeriesMarkers(priceSeries, markers);
    if (risk) {
      priceSeries.createPriceLine({
        price: risk.entryPrice,
        color: "#72a8ff",
        lineWidth: 1,
        axisLabelVisible: true,
        title: "ENTRY",
      });
      priceSeries.createPriceLine({
        price: risk.stopLossPrice,
        color: "#ff6474",
        lineWidth: 1,
        axisLabelVisible: true,
        title: "STOP",
      });
      priceSeries.createPriceLine({
        price: risk.takeProfitPrice,
        color: "#61f2c2",
        lineWidth: 1,
        axisLabelVisible: true,
        title: "TARGET",
      });
    }
    if (currentPrice && Number.isFinite(currentPrice))
      priceSeries.createPriceLine({
        price: currentPrice,
        color: "#e9bf70",
        lineWidth: 1,
        axisLabelVisible: true,
        title: "LIVE",
      });
    chart.timeScale().fitContent();
    const observer = new ResizeObserver(() => chart.timeScale().fitContent());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [candles, mode, trades, risk, currentPrice]);
  return (
    <div
      ref={host}
      className="live-chart"
      role="img"
      aria-label={`${mode === "CANDLESTICK" ? "Candlestick" : "Line"} chart with SOL price, volume, trade markers, and paper-position levels`}
    />
  );
}
