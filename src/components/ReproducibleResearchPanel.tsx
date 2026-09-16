"use client";
import { useEffect, useState } from "react";
import { SectionHeader } from "./SectionHeader";
import type {
  MultiAnchorResult,
  NormalizedResearchRecord,
  ResearchArtifact,
  ResearchArtifactIndexEntry,
  ResearchComparison,
  ResearchStoreStatus,
  ResearchSummary,
} from "@/types/research";
import { MARKET_IDS,MARKET_REGISTRY,type MarketId } from "@/lib/market/marketRegistry";
const pct = (value: number | null) =>
    value === null ? "N/A" : `${value.toFixed(2)}%`,
  num = (value: number | null) => (value === null ? "N/A" : value.toFixed(1)),
  kb = (value: number) => `${(value / 1024).toFixed(1)} kB`;
export function ReproducibleResearchPanel() {
  const [timeframe, setTimeframe] = useState<"180D" | "365D">("180D"),
    [marketId,setMarketId]=useState<MarketId>("SOL"),
    [anchor, setAnchor] = useState(""),
    [note, setNote] = useState(""),
    [summary, setSummary] = useState<ResearchSummary | null>(null),
    [detail, setDetail] = useState<{
      manifest: NormalizedResearchRecord["manifest"];
      artifactIndex: ResearchArtifactIndexEntry[];
    } | null>(null),
    [artifact, setArtifact] = useState<ResearchArtifact | null>(null),
    [multi, setMulti] = useState<MultiAnchorResult | null>(null),
    [history, setHistory] = useState<ResearchSummary[]>([]),
    [status, setStatus] = useState<ResearchStoreStatus | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [comparison, setComparison] = useState<ResearchComparison | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function refresh() {
    const response = await fetch("/api/research"),
      payload = await response.json();
    if (payload.success) {
      setHistory(payload.summaries);
      setStatus(payload.status);
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/research")
      .then((response) => response.json())
      .then((payload) => {
        if (active && payload.success) {
          setHistory(payload.summaries);
          setStatus(payload.status);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function runResearch() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/research/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeframe, anchor: anchor || undefined,marketId }),
        }),
        payload = await response.json();
      if (!response.ok || !payload.success) throw new Error();
      setSummary(payload.summary);
      setDetail(null);
      setMulti(null);
      await refresh();
    } catch {
      setError("Research could not run. Check the historical anchor.");
    } finally {
      setBusy(false);
    }
  }
  async function runMulti() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/validation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeframe,
            strategyId: "momentum",
            action: "multi_anchor",
            anchor: anchor || undefined,
          }),
        }),
        payload = await response.json();
      if (!response.ok || !payload.success) throw new Error();
      setMulti(payload.data);
    } catch {
      setError("Multi-anchor research could not run.");
    } finally {
      setBusy(false);
    }
  }
  async function view(runId: string, standard = false) {
    const response = await fetch(
        `/api/research/${runId}${standard ? "" : "/summary"}`,
      ),
      payload = await response.json();
    if (!payload.success) return;
    if (standard) {
      setDetail({
        manifest: payload.record.manifest,
        artifactIndex: payload.record.detail.artifactIndex,
      });
      setSummary(payload.record.summary);
    } else setSummary(payload.summary);
  }
  async function loadArtifact(id: string) {
    if (!summary) return;
    setArtifact(null);
    const response = await fetch(
        `/api/research/${summary.researchRunId}/artifacts/${id}`,
      ),
      payload = await response.json();
    if (payload.success) setArtifact(payload.artifact);
  }
  async function exportRun(
    runId: string,
    level: "summary" | "standard" | "full" = "full",
  ) {
    const suffix =
        level === "summary"
          ? "/summary"
          : level === "full"
            ? "?detail=full"
            : "",
      response = await fetch(`/api/research/${runId}${suffix}`),
      payload = await response.json();
    if (!payload.success) return;
    const value = level === "summary" ? payload.summary : payload.record,
      anchorDate = (
        level === "summary"
          ? payload.summary.anchor
          : value.manifest.historicalEnd
      ).slice(0, 10),
      blob = new Blob([JSON.stringify(value, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `Veyrix-${level}-${anchorDate}-${runId.slice(0, 12)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function exportManifest() {
    if (!summary || !detail) return;
    const blob = new Blob([JSON.stringify(detail.manifest, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `Veyrix-manifest-${summary.researchRunId.slice(0, 12)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function pin(runId: string, pinned: boolean) {
    await fetch(`/api/research/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    await refresh();
  }
  async function saveNote() {
    if (!summary || status?.durable !== "CONFIGURED") return;
    const response = await fetch(`/api/research/${summary.researchRunId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      }),
      payload = await response.json();
    if (payload.success) {
      setSummary(payload.summary);
      await refresh();
    }
  }
  async function compare() {
    const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runIds: selected }),
      }),
      payload = await response.json();
    if (payload.success) setComparison(payload.comparison);
  }
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
  }
  return (
    <section className="repro-research-section" aria-busy={busy}>
      <SectionHeader
        eyebrow="Durable-ready · compact · reproducible"
        title="Research library"
      />
      <div className="robust-controls">
        <label>Research market<select value={marketId} onChange={event=>setMarketId(event.target.value as MarketId)}>{MARKET_IDS.map(id=><option key={id} value={id}>{MARKET_REGISTRY[id].displaySymbol}</option>)}</select></label>
        <div className="period-selector">
          {(["180D", "365D"] as const).map((value) => (
            <button
              key={value}
              className={timeframe === value ? "selected" : ""}
              onClick={() => setTimeframe(value)}
              aria-pressed={timeframe === value}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="anchor-control">
          <span>Historical end</span>
          <input
            type="date"
            value={anchor}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setAnchor(event.target.value)}
          />
          <small>{anchor ? "Custom UTC anchor" : "Latest available"}</small>
        </label>
        <button disabled={busy} onClick={runResearch}>
          {busy ? "RUNNING HISTORICAL SIMULATION…" : "RUN RESEARCH"}
        </button>
        <button disabled={busy || marketId!=="SOL"} onClick={runMulti}>
          {busy ? "VALIDATING STRATEGY ROBUSTNESS…" : "RUN SOL MULTI-ANCHOR"}
        </button>
      </div>
      {busy && (
        <p className="research-running" role="status">
          Running historical simulation. Long validation ranges may take several
          minutes.
        </p>
      )}
      {error && <p className="backtest-error">{error}</p>}
      {status && (
        <div className="research-performance">
          <div>
            <span>Research cache</span>
            <strong>{status.memory}</strong>
          </div>
          <div>
            <span>Durable store</span>
            <strong>{status.durable}</strong>
          </div>
          <div>
            <span>Historical source</span>
            <strong>COINBASE</strong>
          </div>
          <div>
            <span>Schema</span>
            <strong>{status.schemaVersion}</strong>
          </div>
        </div>
      )}
      {summary && (
        <section className="panel">
          <SectionHeader
            eyebrow={`${summary.accessSource} · ${summary.persistenceStatus}`}
            title={`Research summary ? ${summary.marketId??"SOL"} / USDC`}
          />
          <div className="research-performance">
            <div>
              <span>Top strategy</span>
              <strong>{summary.topStrategy?.replace("_", " ") ?? "N/A"}</strong>
            </div>
            <div>
              <span>Research Score</span>
              <strong>{num(summary.researchScore)}</strong>
            </div>
            <div>
              <span>Multi-Regime</span>
              <strong>{num(summary.multiRegimeRobustness)}</strong>
            </div>
            <div>
              <span>Avg OOS</span>
              <strong>{pct(summary.averageOosReturnPercent)}</strong>
            </div>
            <div>
              <span>Matched beat</span>
              <strong>{pct(summary.matchedBenchmarkBeatRatePercent)}</strong>
            </div>
            <div>
              <span>Summary / standard / full</span>
              <strong>
                {kb(summary.sizes.summaryBytes)} /{" "}
                {kb(summary.sizes.standardBytes ?? summary.sizes.detailedBytes)}{" "}
                / {kb(summary.sizes.fullBytes ?? summary.sizes.detailedBytes)}
              </strong>
            </div>
          </div>
          <div className="manifest-actions">
            <button onClick={() => view(summary.researchRunId, true)}>
              VIEW STANDARD
            </button>
            <button onClick={() => exportRun(summary.researchRunId, "summary")}>
              SUMMARY EXPORT
            </button>
            <button
              onClick={() => exportRun(summary.researchRunId, "standard")}
            >
              STANDARD EXPORT
            </button>
            <button onClick={() => exportRun(summary.researchRunId)}>
              FULL EXPORT
            </button>
            <input
              aria-label="Research run note"
              maxLength={160}
              placeholder="Optional research note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <button
              disabled={status?.durable !== "CONFIGURED"}
              onClick={saveNote}
            >
              SAVE NOTE
            </button>
          </div>
          {summary.note && <p>{summary.note}</p>}
          {detail && (
            <>
              <details>
                <summary>VIEW RESEARCH MANIFEST</summary>
                <button onClick={exportManifest}>MANIFEST EXPORT</button>
                <pre>{JSON.stringify(detail.manifest, null, 2)}</pre>
              </details>
              <details>
                <summary>
                  LAZY ARTIFACTS ({detail.artifactIndex.length})
                </summary>
                <div className="anchor-list">
                  {detail.artifactIndex.slice(0, 30).map((item) => (
                    <button
                      key={item.artifactId}
                      onClick={() => loadArtifact(item.artifactId)}
                    >
                      {item.type} · {kb(item.sizeBytes)}
                    </button>
                  ))}
                </div>
                {artifact && <pre>{JSON.stringify(artifact, null, 2)}</pre>}
              </details>
            </>
          )}
        </section>
      )}
      <section className="panel leaderboard">
        <SectionHeader
          eyebrow={`${history.length} of 25 indexed runs`}
          title="Recent runs"
        />
        {history.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Date</th>
                  <th>Market</th><th>History</th>
                  <th>Top strategy</th>
                  <th>Score</th>
                  <th>Reliability</th>
                  <th>Run</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.researchRunId}>
                    <td>
                      <input
                        aria-label="Compare run"
                        type="checkbox"
                        checked={selected.includes(item.researchRunId)}
                        onChange={() => toggle(item.researchRunId)}
                      />
                    </td>
                    <td>{item.createdAt.slice(0, 10)}</td>
                    <td>{item.marketId??"SOL"}</td><td>{item.timeframe}</td>
                    <td>{item.topStrategy?.replace("_", " ") ?? "N/A"}</td>
                    <td>
                      {num(item.temporalResearchScore ?? item.researchScore)}
                    </td>
                    <td>{item.temporalReliability}</td>
                    <td>{item.researchRunId.slice(0, 12)}</td>
                    <td>
                      <button onClick={() => view(item.researchRunId)}>
                        VIEW
                      </button>
                      <button onClick={() => exportRun(item.researchRunId)}>
                        EXPORT
                      </button>
                      <button
                        disabled={status?.durable !== "CONFIGURED"}
                        onClick={() => pin(item.researchRunId, !item.pinned)}
                      >
                        {item.pinned ? "UNPIN" : "PIN"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="backtest-empty">
            Completed research runs will appear here.
          </div>
        )}
        <button disabled={selected.length < 2} onClick={compare}>
          COMPARE SELECTED
        </button>
      </section>
      {comparison && (
        <section className="panel">
          <SectionHeader
            eyebrow="Saved summaries only · no recomputation"
            title="Saved-run comparison"
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Market</th><th>History</th>
                  <th>Anchor</th>
                  <th>Top strategy</th>
                  <th>Research</th>
                  <th>Robustness</th>
                  <th>Avg OOS</th>
                  <th>Matched beat</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.researchRunId}>
                    <td>{row.researchRunId.slice(0, 12)}</td>
                    <td>{row.marketId??"SOL"}</td><td>{row.timeframe}</td>
                    <td>{row.anchor.slice(0, 10)}</td>
                    <td>{row.topStrategy?.replace("_", " ") ?? "N/A"}</td>
                    <td>{num(row.temporalResearchScore)}</td>
                    <td>{num(row.multiRegimeRobustness)}</td>
                    <td>{pct(row.averageOosReturnPercent)}</td>
                    <td>{pct(row.matchedBenchmarkBeatRatePercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {multi && (
        <section className="panel leaderboard">
          <SectionHeader
            eyebrow="Three deterministic anchors"
            title="Temporal research leaderboard"
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Avg OOS</th>
                  <th>Consistency</th>
                  <th>Reliability</th>
                  <th>Temporal score</th>
                </tr>
              </thead>
              <tbody>
                {multi.leaderboard.map((entry) => (
                  <tr key={entry.strategyId}>
                    <td>{entry.strategyId.replace("_", " ")}</td>
                    <td>{pct(entry.averageOosReturnPercent)}</td>
                    <td>{num(entry.anchorConsistencyScore)}</td>
                    <td>{entry.temporalReliability}</td>
                    <td>{num(entry.temporalResearchScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <aside className="assumptions">
        <strong>Storage disclosure</strong>
        <span>
          Memory caching always works. Filesystem persistence is optional and is
          not durable on ephemeral serverless instances. Summary endpoints omit
          detailed folds; full details are fetched only when requested. All
          results remain historical paper simulations.
        </span>
      </aside>
    </section>
  );
}
