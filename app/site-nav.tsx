/* eslint-disable @next/next/no-html-link-for-pages */

export function ProductNav({ compact = false }: { compact?: boolean }) {
  return (
    <nav className={`nav ${compact ? "nav-compact" : ""}`} aria-label="Primary navigation">
      <a className="brand" href="/" aria-label="TEC Registry home">
        <img className="brand-mark" src="/brand/tecrid-logo.png" alt="" width="30" height="30" />
        <span className="brand-stack">
          <strong>TEC Registry</strong>
          <small>Institute of Contaminant Standards</small>
        </span>
      </a>
      <div className="nav-links">
        <details className="nav-group">
          <summary>Understand <span>⌄</span></summary>
          <div><a href="/what-is-a-tecrid">What is a TECRID?</a><a href="/why">Why TECRID</a><a href="/standard">The standard</a><a href="/participants">Participants</a><a href="/issuers">Verified issuers</a></div>
        </details>
        <details className="nav-group">
          <summary>For organizations <span>⌄</span></summary>
          <div><a href="/for-laboratories">Laboratories</a><a href="/laboratory-pilot">Laboratory pilot</a><a href="/for-brands">Brands &amp; suppliers</a><a href="/for-certifiers-retailers">Certifiers &amp; retailers</a></div>
        </details>
        <details className="nav-group">
          <summary>Use TECRID <span>⌄</span></summary>
          <div><a href="/verify">Verify a report</a><a href="/submit-report">Submit an existing report</a><a href="/sandbox">Run the sandbox</a><a href="/developers">API &amp; integrations</a><a href="/badge">TECRID badge</a></div>
        </details>
        <a href="/dashboard">Dashboard</a>
        <a className="nav-cta nav-cta-link" href="/join">Join the registry</a>
        <details className="nav-mobile-menu"><summary aria-label="Open site navigation">Menu</summary><div><a href="/what-is-a-tecrid">What is a TECRID?</a><a href="/why">Why TECRID</a><a href="/for-laboratories">For laboratories</a><a href="/laboratory-pilot">Laboratory pilot</a><a href="/for-brands">For brands</a><a href="/for-certifiers-retailers">For certifiers &amp; retailers</a><a href="/verify">Verify</a><a href="/participants">Participants</a><a href="/sandbox">Sandbox</a><a href="/developers">API</a><a href="/dashboard">Dashboard</a></div></details>
      </div>
    </nav>
  );
}

export function ProductFooter() {
  return (
    <footer className="site-footer">
      <a className="brand footer-brand" href="/">
        <img className="brand-mark" src="/brand/tecrid-logo.png" alt="" width="30" height="30" /><span>TEC Registry</span>
      </a>
      <p>Test Evidence Credentials and permanent TECRIDs · An ICS initiative</p>
      <div className="footer-actions">
        <a href="/verify">Verify report</a>
        <a href="/what-is-a-tecrid">What is a TECRID?</a>
        <a href="/for-laboratories">For laboratories</a>
        <a href="/laboratory-pilot">Laboratory pilot</a>
        <a href="/for-brands">For brands</a>
        <a href="/for-certifiers-retailers">For certifiers &amp; retailers</a>
        <a href="/why">Why TEC</a>
        <a href="/standard">Standard</a>
        <a href="/issuers">Issuers</a>
        <a href="/participants">Participants</a>
        <a href="/badge">TECRID badge</a>
        <a href="/sandbox">Sandbox</a>
        <a href="/submit-report">Submit report</a>
        <a href="/demo/lab-defense">Lab dispute demo</a>
        <a href="/developers">API</a>
        <a href="/pricing">Pricing</a>
        <a href="/privacy">Privacy &amp; data governance</a>
        <a href="https://contaminantstandards.com" target="_blank" rel="noreferrer">ICS ↗</a>
      </div>
    </footer>
  );
}
