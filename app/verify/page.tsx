import {TECRID_DEFINITION} from "../../lib/tecrid-definition";
import type {Metadata} from 'next';
import {SAMPLE_SOURCE_FINGERPRINT,SAMPLE_TECRID} from '../../lib/sample-tecrid';
import {VerificationClient} from './verification-client';
import {Shell,Kicker} from '../blue-atlas/shared';
export const metadata: Metadata = {
  alternates: { canonical: "https://tecrid.com/verify" },
  title: "TECRID | Verify a lab report",
  description: "Check a TECRID or compare a local PDF fingerprint with the public TECRID records.",
};

export default function VerifyPage(){return <Shell><section className="atlas-about-hero"><div className="atlas-container"><div><Kicker>Verify at the source</Kicker><h1>A report.<br/><span>A source you can check.</span></h1><p>{TECRID_DEFINITION}</p><p>Look up a TECRID or compare the fingerprint of a PDF. Your browser computes the fingerprint locally; the document is not uploaded for this check.</p></div></div></section><div className="atlas-live-verifier"><VerificationClient sampleTecrid={SAMPLE_TECRID} sampleFingerprint={SAMPLE_SOURCE_FINGERPRINT}/></div><section className="atlas-end-cta"><div className="atlas-container"><Kicker>What a match means</Kicker><h2>Identity and integrity.</h2><p>A verified match means the current public record, laboratory authority, fingerprint, signature, and version checks pass. It does not establish representative sampling, resolve uncertainty, or determine product safety or compliance.</p></div></section></Shell>}
