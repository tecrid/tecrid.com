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

const roles = ["brand", "laboratory", "retailer", "supplier", "certifier"] as const;
const sections = ["overview", "evidence", "portfolio", "requests", "integrations", "settings"] as const;

type SandboxPageProps = {
  searchParams: Promise<{ role?: string; section?: string }>;
};

export default async function SandboxPage({ searchParams }: SandboxPageProps) {
  const search = await searchParams;
  const user = await getChatGPTUser();
  const initialRole = roles.includes(search.role as (typeof roles)[number]) ? search.role as (typeof roles)[number] : "brand";
  const initialSection = sections.includes(search.section as (typeof sections)[number]) ? search.section as (typeof sections)[number] : "overview";
  const returnPath = `/sandbox?role=${initialRole}&section=${initialSection}`;
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
        signInHref={chatGPTSignInPath(returnPath)}
        signOutHref={chatGPTSignOutPath(returnPath)}
        initialRole={initialRole}
        initialSection={initialSection}
      />
      <ProductFooter />
    </main>
  );
}
