import Link from "next/link";

export function ProductNav({ compact = false }: { compact?: boolean }) {
  return (
    <nav className={`nav ${compact ? "nav-compact" : ""}`} aria-label="Primary navigation">
      <Link className="brand" href="/" aria-label="TEC Network home">
        <span className="brand-mark" aria-hidden="true">T</span>
        <span className="brand-stack">
          <strong>TEC Network</strong>
          <small>Institute of Contaminant Standards</small>
        </span>
      </Link>
      <div className="nav-links">
        <a href="/why">Why TEC</a>
        <a href="/developers">API</a>
        <a href="/pricing">Pricing</a>
        <a href="/dashboard">Dashboard</a>
        <a className="nav-cta nav-cta-link" href="/join">Join the network</a>
      </div>
    </nav>
  );
}

export function ProductFooter() {
  return (
    <footer className="site-footer">
      <Link className="brand footer-brand" href="/">
        <span className="brand-mark">T</span><span>TEC Network</span>
      </Link>
      <p>Test Evidence Credential · An ICS initiative</p>
      <div className="footer-actions">
        <a href="/why">Why TEC</a>
        <a href="/developers">API</a>
        <a href="/pricing">Pricing</a>
        <a href="https://institute-contaminant-standards.kmfp.chatgpt.site" target="_blank" rel="noreferrer">ICS ↗</a>
      </div>
    </footer>
  );
}
