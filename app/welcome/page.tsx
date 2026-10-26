import { getDb } from "../../db";
import { passkey } from "../../db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getOrganizationForUser } from "../../lib/tec";
import { parseRole } from "../../lib/roles";
import { safeReturnPath } from "../../lib/auth-return-path";
import { ProductNav, ProductFooter } from "../site-nav";
import { PasskeyEnrollment } from "../passkey-controls";
import { RolePicker } from "../role-picker";
export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome to TECRID", robots: { index: false } };
export default async function Welcome({ searchParams }: { searchParams: Promise<{ return_to?: string; role?: string }> }) {
  const query = await searchParams;
  const returnTo = safeReturnPath(query.return_to);
  const user = await requireChatGPTUser(`/welcome?return_to=${encodeURIComponent(returnTo)}`);
  const membership=await getOrganizationForUser(user.userId);
  if(membership && user.userId.startsWith("email:")){
    const [saved]=await getDb().select({id:passkey.id}).from(passkey).where(eq(passkey.userId,user.userId.slice(6))).limit(1);
    if(!saved)return <main className="product-page phone-review-page"><h1>Welcome back.</h1><PasskeyEnrollment/><a href={returnTo === "/welcome" ? "/dashboard" : returnTo}>Continue to your workspace</a></main>;
  }
  if(membership)redirect(returnTo === "/welcome" ? "/dashboard" : returnTo);
  return <main className="product-page"><ProductNav compact /><header className="simple-welcome"><p>Signed in as {user.email}</p><h1>Welcome to TECRID.</h1><p>One choice, then you are in.</p></header><PasskeyEnrollment/><RolePicker onboarding returnTo={returnTo} preferredRole={parseRole(query.role)} /><ProductFooter /></main>;
}
