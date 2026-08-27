import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome to TEC Network",
  description: "Continue Founding Organization onboarding with TEC Network.",
};

export default async function JoinSuccessPage() {
  const user = await getChatGPTUser();
  const dashboardHref = user ? "/dashboard" : chatGPTSignInPath("/dashboard");
  return (
    <main className="product-page success-page">
      <ProductNav compact />
      <section className="success-hero">
        <span className="success-seal">✓</span>
        <p className="section-kicker light">Payment received by Stripe</p>
        <h1>Welcome to the founding cohort.</h1>
        <p>Create or open your TEC organization using the same email address entered at checkout. The billing event will be matched to your workspace automatically.</p>
        <a className="button-mint" href={dashboardHref}>{user ? "Open your dashboard" : "Create your TEC account"} <span>→</span></a>
        <small>Issuer verification remains a separate standards review and is never purchased through membership.</small>
      </section>
      <ProductFooter />
    </main>
  );
}
