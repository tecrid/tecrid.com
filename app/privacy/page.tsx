import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";

export const metadata: Metadata = {
  title: "TECRID Privacy & Data Governance — TEC Registry",
  description: "How the Institute of Contaminant Standards protects, uses, shares, and governs data in TECRID.",
};

const updated = "August 29, 2026";

export default function PrivacyPage() {
  return (
    <main className="product-page privacy-page">
      <ProductNav compact />
      <header className="privacy-hero">
        <div>
          <p className="section-kicker light">Privacy &amp; data governance</p>
          <h1>Private by default.<br />Published by choice.</h1>
          <p>TECRID is operated by the Institute of Contaminant Standards (“ICS”). A TECRID can exist without its report or findings becoming public. Access follows the authority, scope, recipient, and purpose recorded for the evidence.</p>
        </div>
        <aside><span>Effective</span><strong>{updated}</strong><small>Policy version 1.0</small></aside>
      </header>

      <section className="privacy-promises" aria-label="Core TECRID privacy commitments">
        <article><span>01</span><strong>Private is a real state.</strong><p>Uploading, fingerprinting, reserving, or assigning a TECRID does not itself publish the underlying report.</p></article>
        <article><span>02</span><strong>Sharing is recipient-specific.</strong><p>Controlled evidence moves only through an authorized grant, code, integration, or legal obligation.</p></article>
        <article><span>03</span><strong>Data is not merchandise.</strong><p>ICS does not sell confidential evidence, use it for targeted advertising, or train general-purpose AI models on it.</p></article>
        <article><span>04</span><strong>Trends do not expose sources.</strong><p>Global analysis is governed to prevent an organization, product, lot, laboratory, or person from being identified.</p></article>
      </section>

      <div className="privacy-shell">
        <nav className="privacy-index" aria-label="Privacy policy sections">
          <p className="section-kicker">In this policy</p>
          <a href="#scope">1 · Scope and roles</a>
          <a href="#data">2 · Data we process</a>
          <a href="#visibility">3 · Public and private states</a>
          <a href="#uses">4 · How ICS uses data</a>
          <a href="#trends">5 · Trends and standards</a>
          <a href="#disclosures">6 · Disclosures</a>
          <a href="#legal">7 · Legal requests</a>
          <a href="#security">8 · Confidentiality and security</a>
          <a href="#retention">9 · Retention and corrections</a>
          <a href="#rights">10 · Choices and rights</a>
          <a href="#international">11 · International use</a>
          <a href="#contact">12 · Contact and changes</a>
        </nav>

        <article className="privacy-policy">
          <section className="privacy-summary">
            <p className="section-kicker light">Plain-language boundary</p>
            <h2>A private TECRID cannot be turned into a public record by a requester.</h2>
            <p>A laboratory, retailer, certification body, regulator, customer, or member of the public cannot change a private record&apos;s visibility merely by knowing its identifier, requesting it, paying ICS, or creating an account. Publication requires a separate authorized action. A legally required confidential disclosure does not change the TECRID to public or create a public resolver page.</p>
          </section>

          <section id="scope">
            <p className="policy-number">01 / Scope and roles</p>
            <h2>ICS operates the registry; participating organizations control their evidence.</h2>
            <p>This policy covers tecrid.com, the TEC Registry service, its APIs, organization workspaces, evidence-routing tools, laboratory confirmation workflows, and related support and billing interactions.</p>
            <p>ICS generally acts as the service operator for confidential evidence submitted by a laboratory, brand, supplier, retailer, certification body, research organization, or government program. The participating organization is responsible for having authority to submit the data and to name its permitted recipients. ICS separately determines how account, security, billing, registry-integrity, and de-identified network analytics data are processed.</p>
            <div className="policy-callout"><strong>Customer agreements still matter.</strong><p>A data-processing agreement, certification agreement, laboratory agreement, or enterprise contract may add protections and instructions. If a contract is more protective than this policy, ICS will follow the contract.</p></div>
          </section>

          <section id="data">
            <p className="policy-number">02 / Data we process</p>
            <h2>We collect what is needed to identify authority, preserve evidence, and operate the network.</h2>
            <div className="policy-grid">
              <article><strong>Account and organization</strong><p>Name, work email, organization, role, website, membership, issuer application, and contacts you invite.</p></article>
              <article><strong>Laboratory evidence</strong><p>Reports, findings, analytes, units, methods, sample and matrix descriptions, SKUs, lots, dates, report numbers, chain-of-custody context, and source-document metadata.</p></article>
              <article><strong>Integrity and authority</strong><p>TECRIDs, hashes, signatures, public keys, confirmation events, version history, disputes, verification checks, grants, revocations, redemptions, and audit receipts.</p></article>
              <article><strong>Commercial and support</strong><p>Plan, billing status, transaction references, implementation briefs, support communications, and integration settings. Payment-card details are handled by the payment provider rather than stored by TECRID.</p></article>
              <article><strong>Technical and security</strong><p>Authentication identifiers, IP and device information made available by infrastructure providers, request logs, API-key usage, error records, and security events.</p></article>
              <article><strong>Derived information</strong><p>Authority states, coverage summaries, exceptions, descriptive portfolio insights, and safeguarded aggregate trends. These are not automatic safety or compliance conclusions.</p></article>
            </div>
            <p>Sources include users and their organizations, issuing laboratories, authorized recipients, connected systems and APIs, identity and payment providers, and ordinary technical operation of the service.</p>
          </section>

          <section id="visibility">
            <p className="policy-number">03 / Public and private states</p>
            <h2>A TECRID is an identifier—not consent to disclose.</h2>
            <div className="visibility-table" role="table" aria-label="TECRID visibility states">
              <div role="row"><strong role="cell">Private intake or draft</strong><span role="cell">Not publicly resolvable. Original PDFs, transcriptions, contacts, and findings stay inside the authorized workflow.</span></div>
              <div role="row"><strong role="cell">Controlled credential</strong><span role="cell">Findings are withheld from the public. A limited identity or status record may resolve when required for verification, while results require a scoped recipient grant.</span></div>
              <div role="row"><strong role="cell">Public credential</strong><span role="cell">The authorized issuer has intentionally released the structured record. Public records carry version and correction history; the original PDF is not public unless separately and explicitly released.</span></div>
              <div role="row"><strong role="cell">Participant directory</strong><span role="cell">Organization listing is opt-in. Directory participation does not make its evidence public or imply endorsement.</span></div>
            </div>
            <p>Access to one record, SKU, analyte set, or recipient does not authorize access to another. A recipient may not forward controlled evidence unless a separate authorization or applicable law permits it.</p>
          </section>

          <section id="uses">
            <p className="policy-number">04 / How ICS uses data</p>
            <h2>Every use must fit a stated registry purpose.</h2>
            <ul className="policy-list">
              <li>Provide organization workspaces, TECRID issuance, resolution, verification, evidence routing, certification intake, and integrations.</li>
              <li>Confirm laboratory identity and authority; validate signatures and fingerprints; preserve version, correction, and audit history.</li>
              <li>Fulfill a user&apos;s scoped sharing instruction and notify the organizations involved.</li>
              <li>Operate billing, support, onboarding, service communications, and contracted implementation work.</li>
              <li>Detect abuse, fabrication indicators, security threats, conflicts, anomalous submissions, and attempts to bypass authorization.</li>
              <li>Comply with law, enforce agreements, protect legal rights, and investigate disputes.</li>
              <li>Create safeguarded internal statistics and global trend analysis as described below.</li>
            </ul>
            <p>Where data-protection law applies, processing may be necessary to perform a contract, comply with legal obligations, pursue legitimate interests in registry integrity, evidence security, research, and service improvement, or act on consent for optional publication and directory features. ICS does not use confidential evidence for unrelated advertising or commercial data brokerage.</p>
          </section>

          <section id="trends">
            <p className="policy-number">05 / Global trends and certification standards</p>
            <h2>ICS may learn from the network without exposing the participants.</h2>
            <p>ICS may analyze safeguarded data to detect emerging contaminant patterns, method gaps, recurring documentation failures, inter-laboratory variation, geographic or category-level changes, and areas where certification sampling, analyte panels, audit frequency, or technical standards may need review.</p>
            <div className="trend-rules">
              <article><span>Minimize</span><p>Use only the fields needed for the question and separate direct organization and person identifiers from analytical work where feasible.</p></article>
              <article><span>De-identify</span><p>Use pseudonymized, de-identified, or aggregated data when the purpose can be achieved without identified records.</p></article>
              <article><span>Suppress</span><p>Externally reported trends must suppress small cohorts, rare combinations, and organization, laboratory, product, SKU, lot, report, and person identifiers.</p></article>
              <article><span>Govern</span><p>Identified confidential evidence is not provided to standards committees or commercial participants unless authorized, legally required, or necessary for a documented integrity investigation.</p></article>
            </div>
            <p>Trend signals may inform research priorities or proposed standards. They do not, by themselves, create an adverse certification decision against a named organization. Program decisions require the applicable certification process, relevant evidence, and human review. ICS may keep fraud-detection logic, alert thresholds, and security methods confidential when disclosure would enable evasion or increase re-identification risk.</p>
            <div className="policy-callout"><strong>No general-purpose AI training.</strong><p>ICS does not use private laboratory reports or controlled findings to train a general-purpose artificial-intelligence model. A materially different future use would require advance notice and, where appropriate, affirmative contractual authorization.</p></div>
          </section>

          <section id="disclosures">
            <p className="policy-number">06 / When data is disclosed</p>
            <h2>Disclosure follows instruction, infrastructure necessity, or law.</h2>
            <p>ICS may disclose the minimum necessary data to: a recipient expressly authorized through TECRID; personnel and contractors with a need to operate or secure the service and confidentiality duties; identity, hosting, storage, security, communications, support, and payment service providers acting under contract; professional advisers; or authorities when legally required.</p>
            <p>Current service categories may include ChatGPT/OpenAI identity and application services, Cloudflare network, compute and storage infrastructure, and Stripe payment services. Those providers process information under their own terms and contractual roles. ICS does not sell personal information or confidential evidence and does not share it for cross-context behavioral advertising.</p>
          </section>

          <section id="legal">
            <p className="policy-number">07 / Legal and government requests</p>
            <h2>Government access is not automatic, and legal disclosure is not publication.</h2>
            <p>A regulator or government account receives controlled evidence through the same recorded authorization model as another recipient unless a valid legal obligation applies. When ICS receives compulsory legal process, it will, where legally permitted and reasonably practicable:</p>
            <ol className="policy-list numbered">
              <li>verify the authority, jurisdiction, authenticity, and scope of the demand;</li>
              <li>seek to narrow or challenge demands that are defective, overbroad, or inconsistent with protected confidentiality;</li>
              <li>notify the affected organization before disclosure unless legally prohibited or an emergency makes prior notice impracticable;</li>
              <li>disclose only the information legally required and seek confidential treatment where available; and</li>
              <li>record the request and response in a restricted legal-access log.</li>
            </ol>
            <p>No policy can lawfully guarantee that data will never be disclosed under valid compulsory process. Such a disclosure does not change a private TECRID&apos;s registry visibility, authorize onward public release, or make the underlying record public on tecrid.com.</p>
          </section>

          <section id="security">
            <p className="policy-number">08 / Confidentiality and security</p>
            <h2>Confidentiality is enforced through people, permissions, and evidence trails.</h2>
            <p>ICS maintains strict confidentiality rules and uses technical and organizational measures designed for the sensitivity of laboratory and supply-chain data. Current controls include authenticated workspaces, role and organization boundaries, private document storage, cryptographic fingerprints and signatures, hashed API and sharing credentials, expiring and revocable grants, recipient and SKU scopes, restricted administrative access, and append-only audit or receipt records.</p>
            <p>ICS personnel and contractors may access confidential data only for an authorized operational, security, support, legal, or integrity purpose and are expected to follow confidentiality duties. No online service can promise absolute security; ICS will investigate suspected incidents and provide notice when required by law or contract.</p>
          </section>

          <section id="retention">
            <p className="policy-number">09 / Retention, correction, and deletion</p>
            <h2>Evidence integrity requires retention—but not unlimited identified use.</h2>
            <p>ICS retains account, private evidence, permission, security, billing, and support data only for as long as reasonably necessary for the service, the organization&apos;s instructions and contract, registry integrity, audit and dispute requirements, security, and applicable law. The relevant criteria include whether a credential remains active, whether evidence is part of a certification or dispute record, the risk of fabrication or inconsistent versions, and legal or contractual recordkeeping periods.</p>
            <p>Issued public TECRIDs, their fingerprints, status, and correction history are designed as durable records and may be retained indefinitely. Corrections create a new version rather than silently rewriting history. When deletion of private or personal data is required, ICS may retain a minimal cryptographic tombstone, legal hold, or audit fact that no longer exposes the deleted content. De-identified aggregate statistics may be retained for longitudinal analysis when they cannot reasonably be linked back to a person or participating organization.</p>
          </section>

          <section id="rights">
            <p className="policy-number">10 / Choices and privacy rights</p>
            <h2>Organizations control disclosure; people retain applicable privacy rights.</h2>
            <p>Depending on location and applicable law, a person may request access, correction, deletion, portability, restriction, or objection regarding personal information, and may appeal or complain to a regulator. ICS will verify the requester and may need to protect another organization&apos;s confidential information, trade secrets, legal rights, or immutable public-record history when responding.</p>
            <ul className="policy-list">
              <li>Public participant profiles are optional and can be removed without changing private evidence.</li>
              <li>Active grants and unredeemed share codes can be revoked from the controlling workspace.</li>
              <li>Public publication and each recipient grant are separate choices.</li>
              <li>ICS does not sell or share personal information for targeted advertising, so there is no such sale to opt out of.</li>
              <li>Authorized correction and status procedures remain available when an evidentiary record cannot be erased without undermining integrity or legal obligations.</li>
            </ul>
          </section>

          <section id="international">
            <p className="policy-number">11 / International use and children</p>
            <h2>TECRID is a business evidence service used across borders.</h2>
            <p>Information may be processed in the United States and other locations where ICS or its service providers operate. ICS will use contractual or other recognized safeguards where required for international transfers. TECRID is intended for organizations and professional users, not children, and ICS does not knowingly collect personal information from children through the service.</p>
          </section>

          <section id="contact">
            <p className="policy-number">12 / Contact, complaints, and policy changes</p>
            <h2>Privacy questions should reach the registry operator.</h2>
            <p>Contact ICS at <a href="mailto:privacy@tecrid.com">privacy@tecrid.com</a> for a privacy request, confidentiality concern, legal-process question, or complaint. Include the organization name and enough information to verify authority, but do not email a raw laboratory report or a share code.</p>
            <p>ICS may update this policy as the registry, law, or data practices change. Material changes will be posted here with a new effective date and, when appropriate, presented in the organization workspace before the new use begins. ICS will not make a private record public through a policy update alone.</p>
          </section>
        </article>
      </div>

      <ProductFooter />
    </main>
  );
}
