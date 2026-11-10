import { PublicPage, PageHero } from "../../../blue-atlas/public-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVerificationReceipt } from "../../../../lib/lab-defense";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verification receipt, TECRID" };

type RouteContext = { params: Promise<{ receiptId: string }> };

export default async function VerificationReceiptPage({ params }: RouteContext) {
  const { receiptId } = await params;
  const receipt = await getVerificationReceipt(receiptId);
  if (!receipt) notFound();
  return (
    <PublicPage className="atlas-verification-receipt-page">

      <PageHero className="atlas-record-page-hero atlas-verification-receipt-hero"><div><p className="atlas-kicker">TECRID verification receipt</p><h1>{receipt.outcome.replaceAll("_", " ")}</h1><p>Checked {new Date(receipt.createdAt).toLocaleString()}</p></div><span className="atlas-workspace-code">Receipt <strong>{receipt.id.slice(0, 8)}</strong></span></PageHero>
      <section className="atlas-verification-receipt-shell">
        <div className="atlas-verification-receipt-boundary"><strong>What this preserves</strong><p>The exact lookup, verification outcome, record fingerprint, and time of the check. The receipt fingerprint is a tamper-evident record digest, not a laboratory signature or a safety determination.</p></div>
        <dl className="atlas-verification-receipt-register">
          <div><dt>Lookup type</dt><dd>{receipt.lookupType.replaceAll("_", " ")}</dd></div>
          <div><dt>Lookup value</dt><dd><code>{receipt.lookupValue}</code></dd></div>
          <div><dt>Outcome</dt><dd>{receipt.outcome.replaceAll("_", " ")}</dd></div>
          <div><dt>Credential</dt><dd>{receipt.credentialIdentifier ? <a href={`/records/${encodeURIComponent(receipt.credentialIdentifier)}`}>{receipt.credentialIdentifier} ↗</a> : "No public match"}</dd></div>
          <div><dt>Record fingerprint</dt><dd><code>{receipt.recordFingerprint || "Not available"}</code></dd></div>
          <div><dt>Receipt fingerprint</dt><dd><code>{receipt.receiptFingerprint}</code></dd></div>
        </dl>
      </section>

    </PublicPage>
  );
}
