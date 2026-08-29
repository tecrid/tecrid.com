"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "brand" | "laboratory" | "retailer" | "supplier";
type Stage = "submitted" | "claimed" | "confirmed" | "issued";
type Mode = "portal" | "api";
type Action = "claim" | "confirm" | "issue";
type PortalSection = "overview" | "evidence" | "portfolio" | "requests" | "integrations" | "settings";
type Viewer = { displayName: string; email: string } | null;

const workspaces: Array<{ role: Role; name: string; label: string; note: string }> = [
  { role: "brand", name: "Atlas Pantry", label: "Brand", note: "Requests and portfolio" },
  { role: "laboratory", name: "Northstar Analytical", label: "Laboratory", note: "Claims and issuance" },
  { role: "supplier", name: "Sierra Ingredients", label: "Supplier", note: "Ingredient declarations" },
  { role: "retailer", name: "Market Square", label: "Retailer", note: "Procurement validation" },
];

const stages: Array<{ key: Stage; short: string; label: string }> = [
  { key: "submitted", short: "01", label: "Brand submitted" },
  { key: "claimed", short: "02", label: "Lab claimed" },
  { key: "confirmed", short: "03", label: "Data confirmed" },
  { key: "issued", short: "04", label: "TECRID issued" },
];

const stageIndex: Record<Stage, number> = { submitted: 0, claimed: 1, confirmed: 2, issued: 3 };
const stageTitle: Record<Stage, string> = {
  submitted: "Awaiting laboratory claim",
  claimed: "Laboratory review in progress",
  confirmed: "Ready for laboratory signature",
  issued: "Sandbox TECRID issued",
};

const findings = [
  { analyte: "Oleic acid", result: "68.4", unit: "% total fatty acids", state: "Consistent" },
  { analyte: "Linoleic acid", result: "13.2", unit: "% total fatty acids", state: "Consistent" },
  { analyte: "Campesterol", result: "0.18", unit: "% total sterols", state: "Reported" },
  { analyte: "Stigmasterol", result: "0.09", unit: "% total sterols", state: "Reported" },
];

function StagePill({ stage }: { stage: Stage }) {
  return <span className={`sandbox-status sandbox-status-${stage}`}>{stageTitle[stage]}</span>;
}

export function SandboxClient({ viewer, signInHref, signOutHref }: { viewer: Viewer; signInHref: string; signOutHref: string }) {
  const [role, setRole] = useState<Role>("brand");
  const [stage, setStage] = useState<Stage>("submitted");
  const [mode, setMode] = useState<Mode>("portal");
  const [portalSection, setPortalSection] = useState<PortalSection>("overview");
  const [pending, setPending] = useState(false);
  const [persistent, setPersistent] = useState(false);
  const [activeSandboxKey, setActiveSandboxKey] = useState<string | null>(null);
  const [message, setMessage] = useState("The brand has submitted a private legacy report and invited the named laboratory.");
  const [apiResponse, setApiResponse] = useState("Select “Send request” to inspect the live sandbox response.");

  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;
    fetch("/api/sandbox/session")
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (cancelled || !response.ok) return;
        setStage(body.sandbox.stage);
        setPersistent(true);
        setMessage("Your saved personal sandbox is ready. Every simulated action will persist across visits.");
      })
      .catch(() => {
        if (!cancelled) setMessage("The personal sandbox could not be loaded. The public preview remains available.");
      });
    return () => { cancelled = true; };
  }, [viewer]);

  const active = workspaces.find((workspace) => workspace.role === role)!;
  const progress = stageIndex[stage];
  const activity = useMemo(() => [
    ...(progress >= 3 ? [{ time: "Just now", title: "Sandbox TECRID issued", detail: "Northstar signed the confirmed canonical record." }] : []),
    ...(progress >= 2 ? [{ time: "1 min ago", title: "Transcription confirmed", detail: "The laboratory accepted the sample, method, findings, and source fingerprint." }] : []),
    ...(progress >= 1 ? [{ time: "2 min ago", title: "Laboratory claimed report", detail: "Northstar authenticated the invitation and accepted review responsibility." }] : []),
    { time: "3 min ago", title: "Private report submitted", detail: "Atlas Pantry preserved the source fingerprint and sent a laboratory claim request." },
  ], [progress]);

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    setMode("portal");
    setPortalSection("overview");
    setMessage(`Viewing the same fictional evidence as ${workspaces.find((workspace) => workspace.role === nextRole)?.name}.`);
  }

  async function advance(action: Action) {
    setPending(true);
    setMessage("");
    const response = await fetch(viewer ? "/api/sandbox/session" : "/api/sandbox/v1/scenario", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, currentStage: stage }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(body.error?.message ?? "The sandbox transition could not be completed.");
      return;
    }
    setStage((body.sandbox ?? body.scenario).stage);
    setMessage(body.message);
  }

  async function reset() {
    if (viewer) {
      setPending(true);
      const response = await fetch("/api/sandbox/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const body = await response.json();
      setPending(false);
      if (!response.ok) {
        setMessage(body.error?.message ?? "Your sandbox could not be reset.");
        return;
      }
    }
    setStage("submitted");
    setRole("brand");
    setMode("portal");
    setPortalSection("overview");
    setApiResponse("Select “Send request” to inspect the live sandbox response.");
    setMessage("Sandbox reset. The brand has submitted a private legacy report and invited the named laboratory.");
  }

  async function sendApiRequest() {
    setPending(true);
    const response = await fetch(`/api/sandbox/v1/scenario?stage=${encodeURIComponent(stage)}`, {
      headers: activeSandboxKey ? { authorization: `Bearer ${activeSandboxKey}` } : {},
    });
    const body = await response.json();
    setPending(false);
    setApiResponse(JSON.stringify(body, null, 2));
  }

  return (
    <section className="sandbox-shell">
      <aside className="sandbox-workspaces" aria-label="Demo organization">
        <span>{viewer ? "Personal sandbox roles" : "View the workflow as"}</span>
        {workspaces.map((workspace) => (
          <button className={workspace.role === role ? "active" : ""} key={workspace.role} onClick={() => switchRole(workspace.role)}>
            <small>{workspace.label}</small>
            <strong>{workspace.name}</strong>
            <i>{workspace.note}</i>
          </button>
        ))}
        {viewer ? (
          <div className="sandbox-aside-note sandbox-personal-note">
            <small>Signed in as</small>
            <strong>{viewer.displayName}</strong>
            <p>{viewer.email}<br />Your stage and sandbox keys are saved. Fictional organizations remain isolated from the live registry.</p>
            <a href="/dashboard">Open real workspace →</a><a href={signOutHref}>Sign out</a>
          </div>
        ) : (
          <div className="sandbox-aside-note">
            <strong>Public preview</strong>
            <p>All organizations, findings, signatures, and identifiers here are invented. Sign in to save your own state and create sandbox API keys.</p>
            <a href={signInHref}>Create my sandbox →</a>
          </div>
        )}
      </aside>

      <div className="sandbox-console">
        <div className="sandbox-console-heading">
          <div><p className="section-kicker">{active.label} workspace</p><h2>{active.name}</h2></div>
          <div className="sandbox-console-actions"><span>{persistent ? "Saved personal sandbox" : "Temporary public preview"}</span><button className="sandbox-reset" type="button" disabled={pending} onClick={reset}>Reset sandbox</button></div>
        </div>

        <div className="sandbox-progress" aria-label="Scenario progress">
          {stages.map((item, index) => (
            <div className={index <= progress ? "complete" : ""} key={item.key}>
              <span>{index < progress ? "✓" : item.short}</span>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>

        <div className="sandbox-mode-tabs" role="tablist" aria-label="Sandbox view">
          <button className={mode === "portal" ? "active" : ""} role="tab" aria-selected={mode === "portal"} onClick={() => setMode("portal")}>Organization portal</button>
          <button className={mode === "api" ? "active" : ""} role="tab" aria-selected={mode === "api"} onClick={() => setMode("api")}>API console</button>
        </div>

        {mode === "portal" ? (
          <nav className="sandbox-portal-nav" aria-label="Organization portal sections">
            {([
              ["overview", "Overview"],
              ["evidence", "Evidence workflow"],
              ["portfolio", "Portfolio"],
              ["requests", "Requests"],
              ["integrations", "API & integrations"],
              ["settings", "Organization settings"],
            ] as Array<[PortalSection, string]>).map(([section, label]) => (
              <button key={section} className={portalSection === section ? "active" : ""} type="button" onClick={() => setPortalSection(section)}>{label}</button>
            ))}
          </nav>
        ) : null}

        <p className="sandbox-message" role="status"><i />{message}</p>

        {mode === "api" ? (
          <ApiConsole stage={stage} pending={pending} response={apiResponse} sendRequest={sendApiRequest} authenticated={Boolean(activeSandboxKey)} openSettings={() => { setMode("portal"); setPortalSection("integrations"); }} />
        ) : (
          <>
            {portalSection === "overview" ? <><RoleSummary role={role} stage={stage} /><PortalWelcome role={role} stage={stage} viewer={viewer} setSection={setPortalSection} /></> : null}
            {portalSection === "evidence" ? <>
              {role === "brand" ? <BrandPortal stage={stage} switchRole={switchRole} /> : null}
              {role === "laboratory" ? <LaboratoryPortal stage={stage} pending={pending} advance={advance} /> : null}
              {role === "supplier" ? <SupplierPortal stage={stage} switchRole={switchRole} /> : null}
              {role === "retailer" ? <RetailerPortal stage={stage} switchRole={switchRole} /> : null}
              <ActivityPanel activity={activity} />
            </> : null}
            {portalSection === "portfolio" ? <PortfolioPanel role={role} stage={stage} setSection={setPortalSection} /> : null}
            {portalSection === "requests" ? <RequestsPanel role={role} stage={stage} setSection={setPortalSection} /> : null}
            {portalSection === "integrations" ? <ApiSettings viewer={viewer} signInHref={signInHref} onNewKey={setActiveSandboxKey} openConsole={() => setMode("api")} /> : null}
            {portalSection === "settings" ? <OrganizationSettings viewer={viewer} active={active} signInHref={signInHref} signOutHref={signOutHref} persistent={persistent} /> : null}
          </>
        )}
      </div>
    </section>
  );
}

function PortalWelcome({ role, stage, viewer, setSection }: { role: Role; stage: Stage; viewer: Viewer; setSection: (section: PortalSection) => void }) {
  return (
    <section className="sandbox-portal-welcome">
      <div>
        <p className="section-kicker">Organization portal</p>
        <h3>{viewer ? "This is your saved rehearsal space." : "This is what a joined workspace feels like."}</h3>
        <p>{viewer ? "Your identity owns the sandbox, while the four organizations remain fictional roles you can safely simulate." : "The public preview is temporary. Sign in to preserve progress and issue revocable sandbox API keys under your own identity."}</p>
      </div>
      <div className="sandbox-portal-shortcuts">
        <button type="button" onClick={() => setSection("evidence")}><span>Continue workflow</span><strong>{stageTitle[stage]}</strong><i>Open evidence →</i></button>
        <button type="button" onClick={() => setSection("integrations")}><span>Developer access</span><strong>API & integrations</strong><i>{viewer ? "Manage sandbox keys →" : "See sign-in boundary →"}</i></button>
        <button type="button" onClick={() => setSection("settings")}><span>{role} account</span><strong>Organization settings</strong><i>Inspect account model →</i></button>
      </div>
    </section>
  );
}

function PortfolioPanel({ role, stage, setSection }: { role: Role; stage: Stage; setSection: (section: PortalSection) => void }) {
  const issued = stage === "issued";
  return (
    <section className="sandbox-portal-panel">
      <div className="sandbox-portal-panel-head"><div><p className="section-kicker">Public portfolio</p><h3>{role === "brand" ? "Atlas Pantry evidence" : `${workspaces.find((item) => item.role === role)?.name} records`}</h3></div><span>{issued ? "1 public sample" : "0 public records"}</span></div>
      {issued ? (
        <div className="sandbox-portfolio-row"><span className="sandbox-status sandbox-status-issued">Sandbox only</span><div><strong>Refined avocado oil · Lot SI-AVO-260812</strong><code>SBX·NORTHSTAR-26-AVO8F2C1</code></div><small>Current · version 1</small><button type="button" onClick={() => setSection("evidence")}>View record →</button></div>
      ) : (
        <div className="sandbox-empty-panel"><strong>No public record yet.</strong><p>The private PDF does not appear here until the fictional laboratory claims, confirms, and signs the structured record.</p><button className="button-dark" type="button" onClick={() => setSection("evidence")}>Continue the issuance workflow →</button></div>
      )}
    </section>
  );
}

function RequestsPanel({ role, stage, setSection }: { role: Role; stage: Stage; setSection: (section: PortalSection) => void }) {
  return (
    <section className="sandbox-portal-panel">
      <div className="sandbox-portal-panel-head"><div><p className="section-kicker">Requests</p><h3>Evidence request queue</h3></div><span>1 fictional request</span></div>
      <div className="sandbox-request-row">
        <span className={`sandbox-status sandbox-status-${stage}`}>{stage.replaceAll("_", " ")}</span>
        <div><strong>TR-2041 · Avocado oil authenticity</strong><p>{role === "laboratory" ? "Atlas Pantry requested confirmation of report NS-260814-77." : "Evidence moves between the same named parties without sharing account credentials."}</p></div>
        <small>Updated in this sandbox</small>
        <button type="button" onClick={() => setSection("evidence")}>Open →</button>
      </div>
    </section>
  );
}

type SandboxKey = {
  id: string;
  label: string;
  keyPrefix: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function ApiSettings({ viewer, signInHref, onNewKey, openConsole }: { viewer: Viewer; signInHref: string; onNewKey: (key: string | null) => void; openConsole: () => void }) {
  const [keys, setKeys] = useState<SandboxKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;
    fetch("/api/sandbox/keys")
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!cancelled && response.ok) setKeys(body.keys);
      })
      .catch(() => {
        if (!cancelled) setMessage("Sandbox keys could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [viewer]);

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/sandbox/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: form.get("label") }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error?.message ?? "Sandbox key could not be created.");
    setKeys((current) => [body.key, ...current]);
    setNewKey(body.key.plainTextKey);
    onNewKey(body.key.plainTextKey);
    setMessage("Copy this key now. Only its one-way hash is stored.");
  }

  async function revokeKey(id: string) {
    setPending(true);
    const response = await fetch("/api/sandbox/keys", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error?.message ?? "Sandbox key could not be revoked.");
    setKeys((current) => current.map((key) => key.id === id ? { ...key, revokedAt: body.key.revokedAt } : key));
    setNewKey(null);
    onNewKey(null);
    setMessage("Sandbox key revoked.");
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setMessage("Copied. Use it only against the sandbox endpoint.");
  }

  return (
    <section className="sandbox-portal-panel sandbox-integrations-panel">
      <div className="sandbox-portal-panel-head"><div><p className="section-kicker">Portal settings</p><h3>API & integrations</h3></div><a href="/developers">Production docs ↗</a></div>
      <div className="sandbox-integration-grid">
        <div className="sandbox-key-settings">
          <p>Sandbox keys authenticate only <code>/api/sandbox/v1/*</code>. They cannot read private production reports, publish records, or become laboratory signing keys. Each personal sandbox may keep five active keys.</p>
          {!viewer ? (
            <div className="sandbox-signin-gate"><strong>Create keys under your own identity.</strong><p>Sign in to receive a persistent personal sandbox and revocable <code>tec_sandbox_…</code> credentials.</p><a className="button-dark" href={signInHref}>Sign in and create my sandbox →</a></div>
          ) : (
            <>
              {newKey ? <div className="sandbox-new-key"><span>New sandbox key · shown once</span><code>{newKey}</code><button type="button" onClick={copyKey}>Copy key</button></div> : null}
              <form className="sandbox-key-form" onSubmit={createKey}><input name="label" aria-label="Sandbox API key label" placeholder="My test integration" maxLength={60} /><button type="submit" disabled={pending}>{pending ? "Creating…" : "Create sandbox key"}</button></form>
              <p className="sandbox-key-message" role="status">{message}</p>
              <div className="sandbox-key-list">
                {keys.length ? keys.map((key) => <div key={key.id}><span className={key.revokedAt ? "revoked" : "active"}>{key.revokedAt ? "Revoked" : "Active"}</span><strong>{key.label}</strong><code>{key.keyPrefix}••••••{key.lastFour}</code><small>{key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}</small>{!key.revokedAt ? <button type="button" disabled={pending} onClick={() => revokeKey(key.id)}>Revoke</button> : <i />}</div>) : <p>No sandbox keys yet.</p>}
              </div>
            </>
          )}
        </div>
        <div className="sandbox-endpoint-card">
          <span>Sandbox base URL</span><code>https://tecrid.com/api/sandbox/v1</code>
          <span>Authorization</span><code>Bearer tec_sandbox_…</code>
          <span>Environment boundary</span><strong>Persistent test state · no production authority</strong>
          <button type="button" onClick={openConsole}>Open API console →</button>
        </div>
      </div>
    </section>
  );
}

function OrganizationSettings({ viewer, active, signInHref, signOutHref, persistent }: { viewer: Viewer; active: (typeof workspaces)[number]; signInHref: string; signOutHref: string; persistent: boolean }) {
  return (
    <section className="sandbox-portal-panel">
      <div className="sandbox-portal-panel-head"><div><p className="section-kicker">Account</p><h3>Organization settings</h3></div><span>{persistent ? "Saved" : "Preview"}</span></div>
      <div className="sandbox-settings-grid">
        <dl><div><dt>Workspace name</dt><dd>{active.name}</dd></div><div><dt>Organization type</dt><dd>{active.label}</dd></div><div><dt>Environment</dt><dd>Fictional personal sandbox</dd></div><div><dt>Production issuance</dt><dd>Disabled</dd></div></dl>
        <div className="sandbox-account-card"><span>Sandbox owner</span><strong>{viewer?.displayName ?? "Anonymous visitor"}</strong><small>{viewer?.email ?? "No saved identity"}</small><p>{viewer ? "Your identity owns the saved sandbox state. It does not authenticate any fictional laboratory role or grant registry authority." : "Sign in to own this sandbox. Creating a live organization happens separately so demo state never leaks into production."}</p>{viewer ? <><a className="button-dark" href="/dashboard">Open my real organization workspace →</a><a href={signOutHref}>Sign out</a></> : <a className="button-dark" href={signInHref}>Create my sandbox →</a>}</div>
      </div>
    </section>
  );
}

function RoleSummary({ role, stage }: { role: Role; stage: Stage }) {
  const issued = stage === "issued";
  const values: Record<Role, Array<[string, string, string]>> = {
    brand: [["Private reports", "1", "Awaiting or issued"], ["Public portfolio", issued ? "1" : "0", issued ? "Evidence available" : "No publication yet"], ["Laboratory requests", "1", stage === "submitted" ? "Awaiting claim" : "Accepted"]],
    laboratory: [["Confirmation inbox", stage === "submitted" ? "1" : "0", "Customer requests"], ["In review", stage === "claimed" || stage === "confirmed" ? "1" : "0", stageTitle[stage]], ["Issued today", issued ? "1" : "0", issued ? "Sandbox credential" : "No issuance yet"]],
    supplier: [["Declarations", "1", "One ingredient lot"], ["Linked reports", "1", "Brand-submitted evidence"], ["Verified claims", issued ? "1" : "0", issued ? "Lab evidence attached" : "Laboratory pending"]],
    retailer: [["Monitored products", "1", "Atlas avocado oil"], ["Open evidence gaps", issued ? "0" : "1", issued ? "Required fields present" : "No issued credential"], ["Procurement status", issued ? "Pass" : "Hold", issued ? "Current evidence accepted" : "Review remains open"]],
  };

  return <div className="sandbox-summary">{values[role].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>;
}

function BrandPortal({ stage, switchRole }: { stage: Stage; switchRole: (role: Role) => void }) {
  return (
    <section className="sandbox-panel">
      <div className="sandbox-panel-heading"><div><p className="section-kicker">Evidence request TR-2041</p><h3>Refined avocado oil · Lot SI-AVO-260812</h3></div><StagePill stage={stage} /></div>
      <div className="sandbox-record-grid">
        <dl>
          <div><dt>Product</dt><dd>Atlas Pantry Avocado Oil Sea Salt Chips</dd></div>
          <div><dt>Supplier</dt><dd>Sierra Ingredients</dd></div>
          <div><dt>Named laboratory</dt><dd>Northstar Analytical</dd></div>
          <div><dt>Source fingerprint</dt><dd><code>8a4e90f2…c72bd140</code></dd></div>
        </dl>
        <div className="sandbox-next-action">
          <span>What the brand sees</span>
          {stage === "issued" ? <><strong>The laboratory-issued record is ready.</strong><p>The brand can now add this evidence to its public portfolio and share the sandbox resolver without controlling the laboratory assertion.</p><button type="button" onClick={() => switchRole("retailer")}>See the retailer view →</button></> : <><strong>The PDF is evidence, not yet a TECRID.</strong><p>Atlas has preserved the original file fingerprint. Northstar must claim, compare, confirm, and sign the transcription.</p><button type="button" onClick={() => switchRole("laboratory")}>Continue as the laboratory →</button></>}
        </div>
      </div>
    </section>
  );
}

function LaboratoryPortal({ stage, pending, advance }: { stage: Stage; pending: boolean; advance: (action: Action) => void }) {
  const action = stage === "submitted" ? "claim" : stage === "claimed" ? "confirm" : stage === "confirmed" ? "issue" : null;
  const button = stage === "submitted" ? "Claim this report" : stage === "claimed" ? "Confirm the transcription" : stage === "confirmed" ? "Sign and issue sandbox TECRID" : "Issued — no action required";
  return (
    <section className="sandbox-panel">
      <div className="sandbox-panel-heading"><div><p className="section-kicker">Laboratory confirmation inbox</p><h3>Atlas Pantry · Report NS-260814-77</h3></div><StagePill stage={stage} /></div>
      <div className="sandbox-lab-review">
        <div className="sandbox-document-match">
          <span>Private source document</span>
          <strong>NS-260814-77-avocado-authenticity.pdf</strong>
          <code>SHA-256 · 8a4e90f2…c72bd140</code>
          <p>The source remains private. Its fingerprint, report number, method, dates, lot, and confirmed findings become part of the signed record.</p>
        </div>
        <div className="sandbox-findings">
          <div><strong>Transcribed findings</strong><small>Method · GC-FID + sterol profile</small></div>
          {findings.map((finding) => <div className="sandbox-finding-row" key={finding.analyte}><span>{finding.analyte}</span><code>{finding.result} {finding.unit}</code><i>{finding.state}</i></div>)}
        </div>
      </div>
      <div className="sandbox-lab-action">
        <div><strong>{stage === "submitted" ? "Authenticate the laboratory relationship." : stage === "claimed" ? "Compare every field with the source report." : stage === "confirmed" ? "Apply the sandbox laboratory signature." : "The append-only record is complete."}</strong><p>{stage === "issued" ? "A correction or revocation would create a new version rather than erase this one." : "This action is validated by the sandbox endpoint and affects only this browser session."}</p></div>
        <button className="button-dark" type="button" disabled={pending || !action} onClick={() => action && advance(action)}>{pending ? "Validating…" : button} {action ? "→" : "✓"}</button>
      </div>
    </section>
  );
}

function SupplierPortal({ stage, switchRole }: { stage: Stage; switchRole: (role: Role) => void }) {
  return (
    <section className="sandbox-panel">
      <div className="sandbox-panel-heading"><div><p className="section-kicker">Ingredient declaration SD-882</p><h3>100% refined avocado oil</h3></div><StagePill stage={stage} /></div>
      <div className="sandbox-declaration">
        <div><span>Supplier lot</span><strong>SI-AVO-260812</strong></div><div><span>Declared composition</span><strong>Avocado oil · no other oils declared</strong></div><div><span>Destination</span><strong>Atlas Pantry</strong></div><div><span>Evidence relationship</span><strong>{stage === "issued" ? "Laboratory-issued record linked" : "Brand report awaiting full confirmation"}</strong></div>
      </div>
      <div className="sandbox-boundary-card"><strong>A supplier declaration is not a laboratory finding.</strong><p>TECRID preserves both statements as different evidence objects. It does not silently turn the supplier’s claim into a laboratory conclusion.</p><button type="button" onClick={() => switchRole("laboratory")}>Inspect the laboratory evidence →</button></div>
    </section>
  );
}

function RetailerPortal({ stage, switchRole }: { stage: Stage; switchRole: (role: Role) => void }) {
  const issued = stage === "issued";
  return (
    <section className="sandbox-panel">
      <div className="sandbox-panel-heading"><div><p className="section-kicker">Procurement review PR-901</p><h3>Atlas Pantry Avocado Oil Sea Salt Chips</h3></div><span className={`sandbox-procurement ${issued ? "pass" : "hold"}`}>{issued ? "Evidence pass" : "Evidence hold"}</span></div>
      <div className="sandbox-gates">
        <div className="complete"><span>✓</span><strong>Supplier and lot identified</strong><small>SI-AVO-260812</small></div>
        <div className="complete"><span>✓</span><strong>Source report fingerprinted</strong><small>Original private evidence preserved</small></div>
        <div className={stageIndex[stage] >= 2 ? "complete" : ""}><span>{stageIndex[stage] >= 2 ? "✓" : "—"}</span><strong>Laboratory data confirmed</strong><small>{stageIndex[stage] >= 2 ? "Method and findings accepted" : "Confirmation outstanding"}</small></div>
        <div className={issued ? "complete" : ""}><span>{issued ? "✓" : "—"}</span><strong>Issuer signature verified</strong><small>{issued ? "Sandbox proof valid" : "No issued TECRID"}</small></div>
      </div>
      <div className="sandbox-retailer-action"><p>{issued ? "Every required evidence field is present in this fictional procurement policy. A retailer could monitor future correction, revocation, or expiration events." : "The retailer can see exactly why the product remains on hold without emailing the brand for another PDF."}</p><button type="button" onClick={() => switchRole(issued ? "brand" : "laboratory")}>{issued ? "Return to the brand →" : "Resolve the gap as the laboratory →"}</button></div>
    </section>
  );
}

function ActivityPanel({ activity }: { activity: Array<{ time: string; title: string; detail: string }> }) {
  return <section className="sandbox-activity"><div><p className="section-kicker">Shared audit trail</p><h3>Every party sees the same sequence.</h3></div><ol>{activity.map((item) => <li key={item.title}><span>{item.time}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></li>)}</ol></section>;
}

function ApiConsole({ stage, pending, response, sendRequest, authenticated, openSettings }: { stage: Stage; pending: boolean; response: string; sendRequest: () => void; authenticated: boolean; openSettings: () => void }) {
  const tecrid = stage === "issued" ? "SBX·NORTHSTAR-26-AVO8F2C1" : null;
  return (
    <section className="sandbox-api-console">
      <div className="sandbox-api-intro">
        <p className="section-kicker">Interactive API surface</p>
        <h3>Public docs in front.<br />Credentials and activity in the portal.</h3>
        <p>The public website should explain what the API does and show examples. API keys, scopes, usage, webhooks, logs, and test tools belong inside the authenticated organization portal.</p>
        <dl><div><dt>Environment</dt><dd>{authenticated ? "Personal sandbox" : "Public preview"}</dd></div><div><dt>Authentication</dt><dd>{authenticated ? "Sandbox bearer key" : "No credential selected"}</dd></div><div><dt>Persistence</dt><dd>{authenticated ? "Saved to your identity" : "Browser demonstration"}</dd></div><div><dt>Live issuance</dt><dd>Disabled</dd></div></dl>
        <button className="sandbox-api-settings-link" type="button" onClick={openSettings}>Manage keys in Organization portal → API & integrations.</button>
        <a href="/developers">Open production API reference ↗</a>
      </div>
      <div className="sandbox-api-request">
        <div className="sandbox-api-bar"><span>GET</span><code>/api/sandbox/v1/scenario?stage={stage}</code><button type="button" disabled={pending} onClick={sendRequest}>{pending ? "Sending…" : "Send request"}</button></div>
        <pre><code>{response}</code></pre>
        <div className="sandbox-api-note"><strong>{tecrid ? `Current sandbox identifier · ${tecrid}` : "No identifier has been issued."}</strong><span>{authenticated ? "This request used the new key held only in this browser. Refreshing removes the plaintext credential." : "Create a sandbox key under API & integrations to test an authenticated request."} This endpoint cannot create, modify, or resolve production TECRIDs.</span></div>
      </div>
    </section>
  );
}
