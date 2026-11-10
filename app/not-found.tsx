import type { Metadata } from "next";
import { PublicPage, PageHero } from "./blue-atlas/public-page";
import { Kicker, ButtonLink } from "./blue-atlas/shared";

export const metadata: Metadata = { title: "Page not found | TECRID", robots: "noindex" };

export default function NotFound() {
  return <PublicPage><PageHero><div><Kicker>404 · Page not found</Kicker><h1>This page has<br />no current address.</h1><p>Check the link or return to TECRID. If you have a record identifier, you can look it up directly.</p><div className="atlas-page-actions"><ButtonLink href="/">Return to TECRID</ButtonLink><ButtonLink href="/verify" outline>Look up a record</ButtonLink></div></div></PageHero></PublicPage>;
}
