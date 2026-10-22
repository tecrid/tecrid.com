import {ProductNav,ProductFooter} from "../site-nav";
import {getChatGPTUser,chatGPTSignInPath} from "../chatgpt-auth";
import {SampleLabClient} from "./sample-lab-client";
export const dynamic="force-dynamic";
export const metadata={title:"Sample laboratory · Kasandrinos integration — TECRID",robots:{index:false,follow:false}};
export default async function SampleLabPage(){
 const user=await getChatGPTUser();
 return <main className="product-page sample-lab-page"><ProductNav compact/>
 <header className="form-page-header"><div><p className="section-kicker light">Integration workspace · sample laboratory</p><h1>Eight reports.<br/>One integration to test.</h1><p>Prepare the Light Labs → Kasandrinos → VLE connection using the reports already in hand.</p></div><span className="workspace-code">Environment<strong>SANDBOX</strong></span></header>
 <section className="sample-lab-shell"><div className="sample-lab-boundary"><strong>Real source-report references. Test identifiers.</strong><p>These eight IDs resolve now and can be used in VLE’s test display. They are not lab-issued TECRIDs. Light Labs remains the source-report issuer; TECRID Sample Laboratory is the test signer. Production IDs remain pending until laboratory review and signing.</p></div>
 <SampleLabClient signedIn={Boolean(user)} signInUrl={chatGPTSignInPath("/sample-lab")}/>
 <div className="sample-lab-guide"><article><p className="section-kicker">01 · Exercise the API</p><h2>Prepare, sign, verify, save.</h2><p>The sample lab signs the report associations with a temporary browser-held Ed25519 key. The server verifies and saves those test proofs in your personal sandbox. Repeating the test reuses the existing proof. Original PDFs and analytical results are not published here.</p><a href="/api/sandbox/lab/reports">View report manifest JSON →</a></article><article><p className="section-kicker">02 · Connect Light Labs later</p><h2>Keep report matching intact.</h2><p>Use the report number and original PDF fingerprint to match each approved production credential back to its test reference. Add the real production identifier after Light Labs signs. Keep the historical testing dates and lot descriptions; never treat a test ID as a production credential.</p><a href="/downloads/sample-lab-integration.zip" download>Download runnable sample-lab API client →</a></article></div>
 <p><a href="/dashboard/issuance">Production onboarding and issuance</a> · <a href="/sandbox">Personal sandbox API keys</a></p></section><ProductFooter/></main>;
}
