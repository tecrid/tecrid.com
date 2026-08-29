import { ProductFooter, ProductNav } from "./site-nav";

type RolePageProps = {
  kicker: string;
  eyebrow: string;
  title: string;
  intro: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  problemTitle: string;
  problemCopy: string;
  proofPoints: Array<{ value: string; label: string }>;
  benefits: Array<{ label: string; title: string; copy: string }>;
  workflowTitle: string;
  workflow: Array<{ title: string; copy: string }>;
  boundaryTitle: string;
  boundaries: string[];
  ctaTitle: string;
  ctaCopy: string;
};

export function RolePage(props: RolePageProps) {
  return (
    <main className="product-page role-page">
      <ProductNav compact />
      <section className="role-hero">
        <div><p className="section-kicker light">{props.kicker}</p><h1>{props.title}</h1><p>{props.intro}</p><div className="role-hero-actions"><a className="button-mint" href={props.primaryHref}>{props.primaryLabel} →</a><a href={props.secondaryHref}>{props.secondaryLabel} →</a></div></div>
        <aside><span>{props.eyebrow}</span><strong>The neutral trust layer between laboratories, suppliers, brands, retailers, certifiers, regulators, and the public.</strong></aside>
      </section>

      <section className="role-problem">
        <div><p className="section-kicker">The operational problem</p><h2>{props.problemTitle}</h2><p>{props.problemCopy}</p></div>
        <div className="role-proof-grid">{props.proofPoints.map((point) => <article key={point.label}><strong>{point.value}</strong><span>{point.label}</span></article>)}</div>
      </section>

      <section className="role-benefits" aria-labelledby="role-benefits-title">
        <div><p className="section-kicker">What changes</p><h2 id="role-benefits-title">A report becomes reusable evidence.</h2></div>
        <div>{props.benefits.map((benefit, index) => <article key={benefit.title}><span>{String(index + 1).padStart(2, "0")} · {benefit.label}</span><h3>{benefit.title}</h3><p>{benefit.copy}</p></article>)}</div>
      </section>

      <section className="role-workflow">
        <div><p className="section-kicker light">A controlled workflow</p><h2>{props.workflowTitle}</h2></div>
        <ol>{props.workflow.map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><p>{step.copy}</p></div></li>)}</ol>
      </section>

      <section className="role-boundaries">
        <div><p className="section-kicker">Trust without overclaiming</p><h2>{props.boundaryTitle}</h2></div>
        <ul>{props.boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}</ul>
      </section>

      <section className="role-cta"><div><p className="section-kicker light">Begin with one workflow</p><h2>{props.ctaTitle}</h2><p>{props.ctaCopy}</p></div><a href={props.primaryHref}>{props.primaryLabel} <span>↗</span></a></section>
      <ProductFooter />
    </main>
  );
}
