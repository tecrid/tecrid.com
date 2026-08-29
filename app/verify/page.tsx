import type { Metadata } from "next";
import { SAMPLE_SOURCE_FINGERPRINT, SAMPLE_TECRID } from "../../lib/sample-tecrid";
import { ProductFooter, ProductNav } from "../site-nav";
import { VerificationClient } from "./verification-client";

export const metadata: Metadata = {
  title: "Verify a laboratory report — TEC Registry",
  description: "Check a TECRID or compare a local PDF fingerprint with the public registry.",
};

export default function VerifyPage() {
  return (
    <main className="product-page verification-page">
      <ProductNav compact />
      <header className="product-hero verification-hero">
        <p className="section-kicker light">Public verification · free</p>
        <h1>Did this report come<br />from the registry?</h1>
        <p>Enter a TECRID or choose a PDF. Your browser computes the PDF&apos;s SHA-256 fingerprint; the document itself is not uploaded to this check.</p>
      </header>
      <VerificationClient sampleTecrid={SAMPLE_TECRID} sampleFingerprint={SAMPLE_SOURCE_FINGERPRINT} />
      <section className="verification-boundary">
        <div><p className="section-kicker">What a match means</p><h2>Identity and integrity—not a safety verdict.</h2></div>
        <div><p>A verified match shows that the current public registry record is issued, its laboratory is verified, and its recorded fingerprint and issuer signature pass the registry checks.</p><p>It does not prove the sample represented an entire lot, resolve measurement uncertainty, or determine regulatory compliance.</p></div>
      </section>
      <ProductFooter />
    </main>
  );
}
