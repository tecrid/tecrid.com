import { PublicPage, PageHero } from "../blue-atlas/public-page";
import type { Metadata } from "next";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";
import { SandboxClient } from "./sandbox-client";

export const metadata: Metadata = {
  title: "Interactive sandbox, TECRID",
  description: "Try controlled TECRID evidence routing as a fictional brand, laboratory, supplier, retailer, or third-party certifier.",
  robots: { index: false, follow: true },
  openGraph: { title: "Interactive sandbox, TECRID", description: "A resettable demonstration workspace with fictional data.", images: [] },
  twitter: { title: "Interactive sandbox, TECRID", description: "A resettable demonstration workspace with fictional data.", images: [] },
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
    <PublicPage className="atlas-sandbox-page">

      <PageHero className="atlas-sandbox-hero">
        <div>
          <p className="atlas-kicker">Public sandbox · fictional data</p>
          <h1>Run the workflow from every side.</h1>
          <p>Switch between five organizations and run a controlled record from laboratory issuance through recipient-specific certification and retailer delivery.</p>
        </div>
        <span className="atlas-sandbox-boundary">Isolated from live TECRID records</span>
      </PageHero>
      <SandboxClient
        viewer={user ? { displayName: user.displayName, email: user.email } : null}
        signInHref={chatGPTSignInPath(returnPath)}
        signOutHref={chatGPTSignOutPath(returnPath)}
        initialRole={initialRole}
        initialSection={initialSection}
      />

    </PublicPage>
  );
}
