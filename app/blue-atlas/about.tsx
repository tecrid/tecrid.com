import {Icon} from './icons';
import {Shell,EarlierAttemptsLink,Kicker,ButtonLink,TextLink,samplePath} from './shared';
import {getDemoRecord,demoLaboratory} from '../../lib/demo-records';
import {SAMPLE_TECRID,SAMPLE_SOURCE_FINGERPRINT} from '../../lib/sample-tecrid';
import {TECRID_TITLE} from '../../lib/tecrid-definition';

const example = getDemoRecord('heavy-metals');
const questions = [
  ['Is it free?', 'Yes. TECRID is free. Checking a public record does not require an account. Restricted fields still require permission; signing in alone does not grant access.'],
  ['Is my data public?', 'No. Only what you choose to share is visible. A record can stay private, be shared with named recipients, or be made public. Creating a TECRID does not publish the underlying data.'],
  ['Can a brand issue a laboratory credential?', 'A brand can request laboratory confirmation of an existing report. Production issuance requires a verified laboratory, a reviewed signing key, and the laboratory’s signature. Choosing a role at sign-up does not grant issuance authority.'],
  ['Is a TECRID a safety certificate?', 'No. It checks the origin and integrity of a lab result. Interpretation, applicable standards, and certification decisions remain separate.'],
  ['What happens when a report changes?', 'The tag links to the record’s current status and version history, showing corrections, newer versions, or revocation. What you can view depends on the record’s disclosure settings.'],
];

export function AboutPage(){return <Shell className="atlas-definition-page">
  <section className="atlas-definition-hero"><div className="atlas-container">
    <h1>{TECRID_TITLE}</h1>
    <p>This free cryptographic digital safety tag works like a digital serial number: check which lab signed the report, whether its numbers changed, and whether a newer version exists.</p>
    <div className="atlas-tag-proof">
      <article className="atlas-example-tag" aria-label="Example TECRID tag">
        <div className="atlas-tag-heading"><img src="/icons/tecrid.svg" alt="" width="36" height="36"/><strong>TECRID</strong><span>Example · fictional data</span></div>
        <p className="atlas-tag-id">{SAMPLE_TECRID}</p>
        <dl><div><dt>Laboratory</dt><dd>{demoLaboratory.name}</dd></div><div><dt>Product</dt><dd>{example.report!.productName}</dd></div><div><dt>Report</dt><dd>{example.report!.reportNumber}</dd></div><div><dt>Lot</dt><dd>{example.lot}</dd></div><div><dt>Example result</dt><dd>{example.results[0].analyte}: {example.results[0].result} {example.results[0].unit}</dd></div><div><dt>Version</dt><dd>1 · demonstration</dd></div></dl>
        <div className="atlas-tag-fingerprint"><Icon name="fingerprint" size={25}/><div><span>Source PDF fingerprint</span><code>{SAMPLE_SOURCE_FINGERPRINT}</code></div></div>
        <p className="atlas-fine">Fictional laboratory and results. No verified laboratory signature is claimed.</p>
        <TextLink href={samplePath}>Inspect the example record</TextLink>
      </article>
      <div className="atlas-tag-proofs" aria-label="What a production TECRID proves">
        <article><Icon name="shield" size={30}/><div><h2>Real</h2><p>Signed by the lab. Check that the report came from the verified laboratory that signed it.</p></div></article>
        <article><Icon name="fingerprint" size={30}/><div><h2>Unaltered</h2><p>Any edit breaks the fingerprint. Check that the report’s numbers have not been changed.</p></div></article>
        <article><Icon name="layers" size={30}/><div><h2>Current</h2><p>Shows if a newer version exists. Check the report’s status before relying on it.</p></div></article>
      </div>
    </div>
  </div></section>
  <section className="atlas-container atlas-definition-how" id="how-it-works"><div><Kicker>How it works</Kicker><h2>From the lab.<br/>To one click.</h2></div><ol className="atlas-process">
    <li><span>01</span><div><h3>The lab issues it</h3><p>A verified laboratory signs the result and attaches its TECRID tag.</p></div></li>
    <li><span>02</span><div><h3>TECRID checks the signature</h3><p>The signature and fingerprint connect the report to the lab and the exact numbers it issued.</p></div></li>
    <li><span>03</span><div><h3>Anyone with access checks it in one click</h3><p>Open the tag to check the report’s origin, changes, and current version. Private data still needs permission.</p></div></li>
  </ol></section>
  <section className="atlas-definition-audiences"><div className="atlas-container"><Kicker>Who it is for</Kicker><h2>One tag. A clear source for everyone.</h2><ul>
    <li><TextLink href="/for-brands">Brands</TextLink><p>Share lab results buyers can check.</p></li>
    <li><TextLink href="/for-laboratories">Labs</TextLink><p>Keep your signature and corrections attached to your reports.</p></li>
    <li><TextLink href="/for-certifiers-retailers">Retailers and certifiers</TextLink><p>Check the evidence behind a product decision.</p></li>
    <li><TextLink href="/join?role=public">Shoppers</TextLink><p>Follow a product’s tag to the lab result you have access to.</p></li>
  </ul></div></section>
  <section className="atlas-container atlas-definition-limits"><Kicker>What a TECRID does not prove</Kicker><h2>A real report still needs judgment.</h2><p>Authenticity is one part of assessing evidence. TECRID helps identify fabricated or altered reports, but it does not establish:</p><ul><li>Representative sampling, a suitable analytical method, or correct scientific interpretation.</li><li>Product safety, regulatory compliance, or certification.</li><li>The truth of every claim across a supply chain.</li></ul></section>
  <section className="atlas-container atlas-faq-section"><div><Kicker>FAQ</Kicker><h2>A few useful<br/>answers.</h2></div><div className="atlas-faq">{questions.map(([question,answer],index)=><details key={question} open={index===0}><summary>{question}<Icon name="chevron" size={20}/></summary><p>{answer}</p></details>)}</div></section>
  <section className="atlas-end-cta"><div className="atlas-container"><Kicker>Try it yourself</Kicker><h2>See the tag behind a result.</h2><p>Explore the complete, clearly labeled fictional laboratory report.</p><ButtonLink href={samplePath} light>Open the example record</ButtonLink></div></section>
<EarlierAttemptsLink/></Shell>}
