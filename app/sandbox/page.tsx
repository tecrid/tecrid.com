import type { Metadata } from "next";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";
import { ProductFooter, ProductNav } from "../site-nav";
import { SandboxClient } from "./sandbox-client";

export const metadata: Metadata = {
  title: "Interactive sandbox — TEC Registry",
  description: "Try controlled TEC evidence routing as a fictional brand, laboratory, supplier, retailer, or third-party certifier.",
  robots: { index: false, follow: true },
  openGraph: { title: "Interactive sandbox — TEC Registry", description: "A resettable demonstration workspace with fictional data.", images: [] },
  twitter: { title: "Interactive sandbox — TEC Registry", description: "A resettable demonstration workspace with fictional data.", images: [] },
};

export const dynamic = "force-dynamic";

export default async function SandboxPage() {
  const user = await getChatGPTUser();
  return (
    <main className="product-page sandbox-page">
      <ProductNav compact />
      <header className="sandbox-hero">
        <div>
          <p className="section-kicker light">Public sandbox · fictional data</p>
          <h1>Run the workflow from every side.</h1>
          <p>Switch between five organizations and run a controlled record from laboratory issuance through recipient-specific certification and retailer delivery.</p>
        </div>
        <span className="sandbox-boundary">Isolated from the live registry</span>
      </header>
      <SandboxClient
        viewer={user ? { displayName: user.displayName, email: user.email } : null}
        signInHref={chatGPTSignInPath("/sandbox")}
        signOutHref={chatGPTSignOutPath("/sandbox")}
      />
      <ProductFooter />
    </main>
  );
}
