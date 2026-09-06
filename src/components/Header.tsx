import Link from "next/link";
import Image from "next/image";
import { ThemeControl } from "./ThemeControl";
import { AccountStatus } from "./AccountStatus";
export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand-logo" aria-label="Veyrix home"><Image src="/brand/veyrix-logo.png" alt="Veyrix" width={180} height={60} priority /></Link>
        <div className="brand-copy">
          <div className="brand-row">
            <h1>Veyrix</h1>
            <span className="paper-badge">
              <i />
              Paper Trading
            </span>
          </div>
          <p>Autonomous Strategy Research Lab</p>
        </div>
        <nav className="main-nav" aria-label="Primary navigation">
          <Link href="/">Dashboard</Link>
          <Link href="/research">Research</Link>
          <a href="https://github.com/pipndropclown/veyrix" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
        <ThemeControl />
        <AccountStatus />
        <div className="header-meta">
          <span className="network">
            <i />
            Coinbase Public Data
          </span>
          <span className="divider" />
          <span className="session">Simulation Only</span>
        </div>
      </div>
    </header>
  );
}
