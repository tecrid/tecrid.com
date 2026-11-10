import { PublicPage, PageHero } from "../blue-atlas/public-page";
import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { getOrganizationForUser } from "../../lib/tec";
import { parseRole } from "../../lib/roles";
import { RolePicker } from "../role-picker";
import { EmailSignInForm } from "../sign-in/sign-in-form";
import { emailAuthReady } from "../../lib/email-auth";
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "https://tecrid.com/join" }, title: "Join TECRID", description: "Start with your email. Choose your role. TECRID is free." };
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const role = parseRole((await searchParams).role);
  const user = await getChatGPTUser();
  if (user) redirect((await getOrganizationForUser(user.userId)) ? "/dashboard" : role ? `/welcome?role=${role}` : "/welcome");
  if (!role) return <PublicPage><PageHero className="atlas-simple-welcome"><h1>Join TECRID.</h1><p>TECRID is free. Choose your role to begin.</p></PageHero><RolePicker /></PublicPage>;
  return <PublicPage><section className="atlas-email-auth-shell"><p className="atlas-kicker">TECRID is free</p><h1>Confirm your work email.</h1><p>We will send a one-time sign-in link. Labs must complete verification before issuing.</p><EmailSignInForm returnTo="/dashboard" ready={emailAuthReady()} hasError={false} initialRole={role} /><p><a href="/privacy">Privacy</a></p></section></PublicPage>;
}
