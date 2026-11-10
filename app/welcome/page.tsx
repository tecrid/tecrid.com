import { PublicPage, PageHero } from "../blue-atlas/public-page";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { claimInvitedLaboratory } from "../../lib/lab-invite";
import { getOrganizationForUser } from "../../lib/tec";
import { parseRole } from "../../lib/roles";
import { safeReturnPath } from "../../lib/auth-return-path";
import { RolePicker } from "../role-picker";
export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome to TECRID", robots: { index: false } };
export default async function Welcome({ searchParams }: { searchParams: Promise<{ return_to?: string; role?: string }> }) {
  const query = await searchParams;
  const returnTo = safeReturnPath(query.return_to);
  const user = await requireChatGPTUser(`/welcome?return_to=${encodeURIComponent(returnTo)}`);
  await claimInvitedLaboratory(user);
  if (await getOrganizationForUser(user.userId)) redirect(returnTo === "/welcome" ? "/dashboard" : returnTo);
  return <PublicPage><PageHero className="atlas-simple-welcome"><p>Signed in as {user.email}</p><h1>Welcome to TECRID.</h1><p>One choice, then you are in.</p></PageHero><RolePicker onboarding returnTo={returnTo} preferredRole={parseRole(query.role)} /></PublicPage>;
}
