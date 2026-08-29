import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVerificationReceipt } from "../../../../lib/lab-defense";
import { ProductFooter, ProductNav } from "../../../site-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verification receipt — TEC Registry" };

type RouteContext = { params: Promise<{ receiptId: string }> };

export default async function VerificationReceiptPage({ params }: RouteContext) {
  const { receiptId } = await params;
  const receipt = await getVerificationReceipt(receiptId);
  if (!receipt) notFound();
  return (
    <main className="product-page verification-receipt-page">
      <ProductNav compact />
      <header className="record-page-hero verification-receipt-hero"><div><p className="section-kicker light">Registry verification receipt</p><h1>{receipt.outcome.replaceAll("_", " ")}</h1><p>Checked {new Date(receipt.createdAt).toLocaleString()}</p></div><span className="workspace-code">Receipt <strong>{receipt.id.slice(0, 8)}</strong></span></header>
      <section className="verification-receipt-shell">
        <div className="verification-receipt-boundary"><strong>What this preserves</strong><p>The exact lookup, registry outcome, record fingerprint, and time of the check. The receipt fingerprint is a tamper-evident registry digest—not a laboratory signature or a safety determination.</p></div>
        <dl className="verification-receipt-register">
          <div><dt>Lookup type</dt><dd>{receipt.lookupType.replaceAll("_", " ")}</dd></div>
          <div><dt>Lookup value</dt><dd><code>{receipt.lookupValue}</code></dd></div>
          <div><dt>Outcome</dt><dd>{receipt.outcome.replaceAll("_", " ")}</dd></div>
          <div><dt>Credential</dt><dd>{receipt.credentialIdentifier ? <a href={`/records/${encodeURIComponent(receipt.credentialIdentifier)}`}>{receipt.credentialIdentifier} ↗</a> : "No public match"}</dd></div>
          <div><dt>Record fingerprint</dt><dd><code>{receipt.recordFingerprint || "Not available"}</code></dd></div>
          <div><dt>Receipt fingerprint</dt><dd><code>{receipt.receiptFingerprint}</code></dd></div>
        </dl>
      </section>
      <ProductFooter />
    </main>
  );
}
