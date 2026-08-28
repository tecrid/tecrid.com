/* eslint-disable @next/next/no-html-link-for-pages */

export function ProductNav({ compact = false }: { compact?: boolean }) {
  return (
    <nav className={`nav ${compact ? "nav-compact" : ""}`} aria-label="Primary navigation">
      <a className="brand" href="/" aria-label="TEC Registry home">
        <span className="brand-mark" aria-hidden="true">T</span>
        <span className="brand-stack">
          <strong>TEC Registry</strong>
          <small>Institute of Contaminant Standards</small>
        </span>
      </a>
      <div className="nav-links">
        <a href="/why">Why TEC</a>
        <a href="/standard">Standard</a>
        <a href="/issuers">Issuers</a>
        <a href="/developers">API</a>
        <a href="/dashboard">Dashboard</a>
        <a className="nav-cta nav-cta-link" href="/join">Join the registry</a>
      </div>
    </nav>
  );
}

export function ProductFooter() {
  return (
    <footer className="site-footer">
      <a className="brand footer-brand" href="/">
        <span className="brand-mark">T</span><span>TEC Registry</span>
      </a>
      <p>Test Evidence Credentials and permanent TECRIDs · An ICS initiative</p>
      <div className="footer-actions">
        <a href="/why">Why TEC</a>
        <a href="/standard">Standard</a>
        <a href="/issuers">Issuers</a>
        <a href="/developers">API</a>
        <a href="/pricing">Pricing</a>
        <a href="https://contaminantstandards.com" target="_blank" rel="noreferrer">ICS ↗</a>
      </div>
    </footer>
  );
}
