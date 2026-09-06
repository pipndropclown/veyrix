import Link from "next/link";
export function ProductHero() {
  return (
    <section className="product-hero" aria-labelledby="product-title">
      <div>
        <span>VEYRIX 1.1 PROTOTYPE</span>
        <h1 id="product-title">Autonomous Strategy Research Lab</h1>
        <p>
          Live paper trading terminal, historical backtesting, and rigorous
          strategy research in one simulation-only workspace.
        </p>
        <small>
          Test, compare, and validate blockchain trading strategies without
          risking real capital.
        </small>
      </div>
      <div className="hero-actions">
        <strong>PAPER TRADING ONLY</strong>
        <Link href="/research">OPEN RESEARCH WORKSPACE</Link>
      </div>
    </section>
  );
}
