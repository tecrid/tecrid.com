import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { getOrganizationForUser } from "../../lib/tec";
import { parseRole } from "../../lib/roles";
import { ProductFooter, ProductNav } from "../site-nav";
import { EmailSignInForm } from "../sign-in/sign-in-form";
import { emailAuthReady } from "../../lib/email-auth";
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "https://tecrid.com/join" }, title: "Join TECRID", description: "Start with your email. Choose your role. TECRID is free." };
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const role = parseRole((await searchParams).role);
  const user = await getChatGPTUser();
  if (user) redirect((await getOrganizationForUser(user.userId)) ? "/dashboard" : role ? `/welcome?role=${role}` : "/welcome");
  return <main className="product-page"><ProductNav compact /><section className="email-auth-shell"><p className="section-kicker">TECRID is free</p><h1>Start with your email.</h1><p>We will send a secure sign-in link. Then choose your role and you are in.</p><EmailSignInForm returnTo="/dashboard" ready={emailAuthReady()} hasError={false} initialRole={role} /><p><a href="/privacy">Privacy</a></p></section><ProductFooter /></main>;
}
