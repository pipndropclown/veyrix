"use client";
import { useEffect, useMemo, useState } from "react";
import { BacktestPanel } from "./BacktestPanel";
import { ExtendedValidationLab } from "./ExtendedValidationLab";
import { MultiRegimeLab } from "./MultiRegimeLab";
import { ReproducibleResearchPanel } from "./ReproducibleResearchPanel";
import { RobustnessLab } from "./RobustnessLab";
import { SectionHeader } from "./SectionHeader";
import {
  calculateConclusionDrift,
  createResearchSnapshot,
  generateResearchReport,
  researchReportToMarkdown,
} from "@/lib/research/researchReport";
import type {
  NormalizedResearchDetail,
  ResearchManifest,
  ResearchSummary,
} from "@/types/research";
import type { ResearchReport } from "@/types/researchReport";
import type { StrategyId } from "@/types/strategy";
const pct = (value: number | null) =>
    value === null ? "N/A" : `${value.toFixed(2)}%`,
  score = (value: number | null) => (value === null ? "N/A" : value.toFixed(1)),
  name = (id: string | null) => (id ? id.replaceAll("_", " ") : "N/A"),
  areas = [
    "overview",
    "strategies",
    "robustness",
    "regimes",
    "validation",
    "failure-analysis",
    "research-evidence",
    "artifacts",
  ];
type StandardRecord = {
  researchRunId: string;
  manifest: ResearchManifest;
  summary: ResearchSummary;
  detail: NormalizedResearchDetail;
  strategyNotes: Partial<Record<StrategyId, string>>;
};
export function ResearchWorkspace() {
  const [history, setHistory] = useState<ResearchSummary[]>([]),
    [stored, setStored] = useState<StandardRecord | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [demo, setDemo] = useState(false),
    [marketPrice, setMarketPrice] = useState<number | null>(null),
    [notes, setNotes] = useState<Partial<Record<StrategyId, string>>>({});
  const report = useMemo(
      () =>
        stored
          ? generateResearchReport({
              summary: stored.summary,
              manifest: stored.manifest,
              detail: stored.detail,
            })
          : null,
      [stored],
    ),
    drift = useMemo(() => calculateConclusionDrift(history), [history]);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/research").then((r) => r.json()),
      fetch("/api/market")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([library, market]) => {
        if (!active) return;
        if (library.success) {
          setHistory(library.summaries);
          if (library.summaries[0])
            void load(library.summaries[0].researchRunId);
        }
        if (market?.success) setMarketPrice(market.data.price);
      })
      .catch(() => setError("Research library is unavailable."));
    return () => {
      active = false;
    };
  }, []);
  async function load(runId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/research/${runId}`),
        payload = await response.json();
      if (!response.ok || !payload.success) throw new Error();
      const value = payload.record as StandardRecord;
      setStored(value);
      setNotes(value.strategyNotes ?? {});
    } catch {
      setError("Stored STANDARD research detail could not be loaded.");
    } finally {
      setBusy(false);
    }
  }
  function download(filename: string, value: string, type: string) {
    const blob = new Blob([value], { type }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  function exportReport() {
    if (!report) return;
    download(
      `Veyrix-report-${report.runId.slice(0, 12)}-${report.historicalRange.end.slice(0, 10)}.md`,
      researchReportToMarkdown(report),
      "text/markdown",
    );
  }
  function exportSnapshot() {
    if (!report || !stored) return;
    const snapshot = createResearchSnapshot(report, {
      summary: stored.summary,
      manifest: stored.manifest,
      detail: stored.detail,
    });
    download(
      `Veyrix-snapshot-${report.runId.slice(0, 12)}.json`,
      JSON.stringify(snapshot, null, 2),
      "application/json",
    );
  }
  async function saveStrategyNote(strategyId: StrategyId, value: string) {
    if (!stored) return;
    const next = { ...notes, [strategyId]: value };
    setNotes(next);
    const response = await fetch(`/api/research/${stored.researchRunId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategyNotes: next }),
    });
    if (!response.ok)
      setError("Strategy note requires configured durable storage.");
  }
  return (
    <section className="research-workspace">
      <div className="workspace-hero">
        <div>
          <span>VEYRIX RESEARCH WORKSPACE</span>
          <h1>Strategy research, organized as evidence.</h1>
          <p>
            Compare historical paper simulations, robustness, regimes,
            validation methods, and failure modes without connecting real funds.
          </p>
        </div>
        <button aria-pressed={demo} onClick={() => setDemo((value) => !value)}>
          {demo ? "EXIT PRESENTATION" : "PRESENTATION MODE"}
        </button>
      </div>
      {demo ? (
        <Demo report={report} marketPrice={marketPrice} />
      ) : (
        <>
          <nav className="workspace-tabs" aria-label="Research report sections">
            {areas.map((area) => (
              <a key={area} href={`#${area}`}>
                {area.replace("-", " ")}
              </a>
            ))}
          </nav>
          <section className="workspace-library panel">
            <SectionHeader
              eyebrow={`${history.length} stored summaries · conclusion drift ${drift}`}
              title="Select research evidence"
            />
            <div className="timeline" role="list">
              {history.map((item) => (
                <button
                  aria-pressed={stored?.researchRunId === item.researchRunId}
                  key={item.researchRunId}
                  onClick={() => load(item.researchRunId)}
                >
                  <time>{item.anchor.slice(0, 10)}</time>
                  <strong>{name(item.topStrategy)}</strong>
                  <span>
                    {pct(item.averageOosReturnPercent)} OOS · evidence{" "}
                    {score(item.researchScore)}
                  </span>
                </button>
              ))}
            </div>
            {!history.length && (
              <p className="backtest-empty">
                No normalized research runs are currently stored. Run research
                in Artifacts &amp; Experiments below.
              </p>
            )}
            {busy && <p role="status">Loading stored research…</p>}
            {error && (
              <p className="backtest-error" role="alert">
                {error}
              </p>
            )}
          </section>
          {report && stored && (
            <ReportView
              report={report}
              stored={stored}
              notes={notes}
              saveStrategyNote={saveStrategyNote}
              exportReport={exportReport}
              exportSnapshot={exportSnapshot}
              drift={drift}
            />
          )}
          <section id="artifacts" className="workspace-area">
            <SectionHeader
              eyebrow="Saved research · exports · lazy artifacts"
              title="Artifacts & experiments"
            />
            <ReproducibleResearchPanel />
            <details>
              <summary>BACKTESTING AND STRATEGY ARENA</summary>
              <BacktestPanel />
            </details>
            <details>
              <summary>ROBUSTNESS LAB</summary>
              <RobustnessLab />
            </details>
            <details>
              <summary>MULTI-REGIME LAB</summary>
              <MultiRegimeLab />
            </details>
            <details>
              <summary>EXTENDED VALIDATION LAB</summary>
              <ExtendedValidationLab />
            </details>
          </section>
        </>
      )}
      <aside className="assumptions">
        <strong>Research disclosure</strong>
        <span>
          Results are historical paper simulations, not investment advice.
          Parameter optimization can overfit; heuristic regimes and overlapping
          windows are not statistically independent. No real trades are
          executed.
        </span>
      </aside>
    </section>
  );
}
function ReportView({
  report,
  stored,
  notes,
  saveStrategyNote,
  exportReport,
  exportSnapshot,
  drift,
}: {
  report: ResearchReport;
  stored: StandardRecord;
  notes: Partial<Record<StrategyId, string>>;
  saveStrategyNote: (id: StrategyId, value: string) => void;
  exportReport: () => void;
  exportSnapshot: () => void;
  drift: string;
}) {
  return (
    <article className="research-report">
      <section id="overview" className="panel report-overview">
        <SectionHeader
          eyebrow={`${report.runId} · ${report.historicalRange.start.slice(0, 10)}—${report.historicalRange.end.slice(0, 10)}`}
          title={report.title}
        />
        <p className="executive-summary">{report.executiveSummary}</p>
        <div className="manifest-actions">
          <button onClick={exportReport}>EXPORT RESEARCH REPORT</button>
          <button onClick={exportSnapshot}>EXPORT SHAREABLE SNAPSHOT</button>
        </div>
        <div className="winner-grid">
          {Object.entries(report.categoryWinners).map(([category, winner]) => (
            <div key={category}>
              <span>{category.replaceAll(/([A-Z])/g, " $1")}</span>
              <strong>{name(winner)}</strong>
            </div>
          ))}
        </div>
      </section>
      <section id="strategies" className="workspace-area">
        <SectionHeader
          eyebrow="Performance quality is separate from evidence quality"
          title="Strategy scorecards"
        />
        <div className="scorecard-grid">
          {report.strategies.map((item) => (
            <section className="panel" key={item.scorecard.strategyId}>
              <h3>{item.scorecard.strategyName}</h3>
              <span
                className={`verdict verdict-${item.scorecard.verdict.toLowerCase()}`}
              >
                {item.scorecard.verdict}
              </span>
              <dl>
                <Metric
                  label="Historical OOS"
                  value={pct(item.scorecard.historicalOosReturnPercent)}
                />
                <Metric
                  label="Matched beat"
                  value={pct(item.scorecard.matchedBenchmarkBeatRatePercent)}
                />
                <Metric
                  label="Profitable OOS"
                  value={pct(item.scorecard.profitableOosPercent)}
                />
                <Metric
                  label="Max drawdown"
                  value={pct(item.scorecard.maximumDrawdownPercent)}
                />
                <Metric
                  label="Robustness"
                  value={score(item.scorecard.robustnessScore)}
                />
                <Metric
                  label="Research Score"
                  value={score(item.scorecard.researchScore)}
                />
                <Metric
                  label="Performance"
                  value={item.scorecard.performanceQuality}
                />
                <Metric
                  label="Evidence"
                  value={item.scorecard.evidenceQuality}
                />
              </dl>
              <label className="strategy-note">
                <span>Strategy research note</span>
                <textarea
                  key={`${stored.researchRunId}-${item.scorecard.strategyId}`}
                  maxLength={200}
                  defaultValue={notes[item.scorecard.strategyId] ?? ""}
                  onBlur={(event) =>
                    saveStrategyNote(
                      item.scorecard.strategyId,
                      event.target.value,
                    )
                  }
                  placeholder="Metadata only; does not affect scores."
                />
              </label>
            </section>
          ))}
        </div>
      </section>
      <section id="robustness" className="workspace-area panel">
        <SectionHeader
          eyebrow="Cross-window and parameter behavior"
          title="Robustness"
        />
        <p>{report.sections.robustnessLeader}</p>
        <p>{report.conclusion}</p>
      </section>
      <section id="regimes" className="workspace-area panel">
        <SectionHeader
          eyebrow="Historical OOS averages · N/A means insufficient data"
          title="Market regime story"
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Strategy</th>
                {["Bullish", "Bearish", "Sideways", "High volatility"].map(
                  (value) => (
                    <th key={value}>{value}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {report.strategies.map((item) => (
                <tr key={item.scorecard.strategyId}>
                  <th>{item.scorecard.strategyName}</th>
                  {item.regimes.map((regime) => (
                    <td key={regime.regime}>
                      {regime.confidence === "INSUFFICIENT_DATA" ? (
                        "N/A"
                      ) : (
                        <>
                          <strong>{pct(regime.averageOosReturnPercent)}</strong>
                          <small>
                            {regime.periods} periods ·{" "}
                            {regime.matchedBenchmarkComparison.toLowerCase()}
                          </small>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>{report.sections.bestRegime}</p>
        <p>{report.sections.weakestRegime}</p>
      </section>
      <section id="validation" className="workspace-area panel">
        <SectionHeader
          eyebrow="Stored methodology outputs"
          title="Validation"
        />
        <div className="research-performance">
          <div>
            <span>Coverage</span>
            <strong>{report.evidence.historyDays}D</strong>
          </div>
          <div>
            <span>Independent folds</span>
            <strong>{report.evidence.independentOosFolds}</strong>
          </div>
          <div>
            <span>Methods</span>
            <strong>{report.evidence.validationMethods}</strong>
          </div>
          <div>
            <span>Agreement</span>
            <strong>{score(report.evidence.crossMethodAgreement)}</strong>
          </div>
          <div>
            <span>Conclusion drift</span>
            <strong>{drift}</strong>
          </div>
        </div>
      </section>
      <section id="failure-analysis" className="workspace-area">
        <SectionHeader
          eyebrow="Retained worst folds · factual attribution"
          title="Failure analysis"
        />
        <div className="failure-grid">
          {report.strategies.map((item) => (
            <details key={item.scorecard.strategyId}>
              <summary>
                {item.scorecard.strategyName} · weakest{" "}
                {name(item.failure.weakestRegime)}
              </summary>
              {item.failure.statements.map((statement) => (
                <p key={statement}>{statement}</p>
              ))}
              <dl>
                <Metric
                  label="Stop-loss loss"
                  value={`$${item.failure.stopLossUsd.toFixed(2)}`}
                />
                <Metric
                  label="Signal-exit loss"
                  value={`$${item.failure.strategySignalLossUsd.toFixed(2)}`}
                />
                <Metric
                  label="Fees"
                  value={`$${item.failure.feesUsd.toFixed(2)}`}
                />
                <Metric
                  label="Slippage"
                  value={`$${item.failure.slippageUsd.toFixed(2)}`}
                />
              </dl>
            </details>
          ))}
        </div>
      </section>
      <section id="research-evidence" className="workspace-area panel">
        <SectionHeader
          eyebrow="Evidence quality does not mean profitability"
          title="Research evidence"
        />
        <div className="evidence-layout">
          <div>
            <strong>{report.evidence.validationConfidence}</strong>
            <span>Validation confidence</span>
          </div>
          <div>
            <strong>{score(report.evidence.researchScore)}</strong>
            <span>Research Score</span>
          </div>
          <div>
            <strong>{report.evidence.datasetQualityPercent.toFixed(1)}%</strong>
            <span>Dataset quality</span>
          </div>
          <div>
            <strong>{report.evidence.observedRegimes}</strong>
            <span>Observed regimes</span>
          </div>
        </div>
        <p>{report.sections.evidenceQuality}</p>
        <h3>Next experiments</h3>
        <ul>
          {report.nextExperiments.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <details className="panel">
        <summary>RESEARCH ASSUMPTIONS</summary>
        {report.assumptions.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </details>
      <p className="simulation-disclaimer">{report.disclaimer}</p>
    </article>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function Demo({
  report,
  marketPrice,
}: {
  report: ResearchReport | null;
  marketPrice: number | null;
}) {
  return (
    <section className="demo-mode">
      <span>VEYRIX</span>
      <h2>Autonomous Strategy Research Lab</h2>
      <div className="demo-grid">
        <div>
          <small>Live Market</small>
          <strong>
            {marketPrice === null
              ? "Unavailable"
              : `SOL $${marketPrice.toFixed(2)}`}
          </strong>
        </div>
        <div>
          <small>Strategies Tested</small>
          <strong>{report?.strategies.length ?? 3}</strong>
        </div>
        <div>
          <small>Historical Coverage</small>
          <strong>
            {report ? `${report.historicalRange.days}D` : "No stored run"}
          </strong>
        </div>
        <div>
          <small>Simulated Experiments</small>
          <strong>Paper only</strong>
        </div>
        <div>
          <small>Top Current Research Finding</small>
          <strong>
            {report?.sections.overallResult ?? "Load a stored research run"}
          </strong>
        </div>
        <div>
          <small>Research Confidence</small>
          <strong>
            {report?.evidence.validationConfidence ?? "Unavailable"}
          </strong>
        </div>
      </div>
      <strong className="paper-only">
        PAPER TRADING ONLY · NO REAL ORDERS
      </strong>
    </section>
  );
}
