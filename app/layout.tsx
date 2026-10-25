import type { Metadata, Viewport } from "next";
import { headers, cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile.css";
import "./notifications.css";
import { getChatGPTUser } from "./chatgpt-auth";
import { getOrganizationForUser } from "../lib/tec";
import { organizationRole, parseRole, ROLE_COOKIE } from "../lib/roles";
import { RoleProvider } from "./role-context";
import "./simple.css";
import { NotificationProvider } from "./notification-center";
import { MobileNavigation } from "./mobile-navigation";
import {
  ICS_ORGANIZATION_ID,
  TECRID_SERVICE_ID,
  TECRID_WEBSITE_ID,
  icsOrganization,
  karenPerson,
  tecridService,
} from "../lib/entity-graph";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "TECRID — Verifiable Laboratory Reports and COA Authentication";
export const viewport: Viewport = {
  // Vinext currently serializes width but omits viewportFit. Keep one viewport tag.
  width: "device-width, viewport-fit=cover",
  initialScale: 1,
  themeColor: "#f4f1e9",
};
const description =
  "TECRID is a persistent identifier and verification record for laboratory reports. Authenticate the issuer, structured findings, source fingerprint, status, and version history.";

const siteIdentity = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": TECRID_WEBSITE_ID,
      url: "https://tecrid.com",
      name: "TECRID",
      alternateName: "TEC Registry",
      description,
      publisher: { "@id": ICS_ORGANIZATION_ID },
      about: { "@id": TECRID_SERVICE_ID },
    },
    icsOrganization,
    karenPerson,
    tecridService,
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "tecrid.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    metadataBase: new URL("https://tecrid.com"),
    title,
    description,
    applicationName: "TECRID",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "TECRID", statusBarStyle: "default" },
    other: { "apple-mobile-web-app-capable": "yes" },
    formatDetection: { telephone: false },
    authors: [{ name: "Institute of Contaminant Standards", url: "https://contaminantstandards.com" }],
    creator: "Institute of Contaminant Standards",
    publisher: "Institute of Contaminant Standards",
    alternates: { canonical: "https://tecrid.com/" },
    verification: {
      google: "1NWO0uv6B0GJqNBADyugLLo1W4d9dXlJ5T9nEide21Y",
    },
    robots: { index: true, follow: true },
    icons: {
      icon: [
        { url: "/icons/tecrid.svg", type: "image/svg+xml" },
        { url: "/icons/tecrid-64.png", type: "image/png", sizes: "64x64" },
      ],
      apple: [{ url: "/icons/tecrid-180.png", type: "image/png", sizes: "180x180" }],
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "TECRID · TEC Registry",
      url: "https://tecrid.com",
      images: [{ url: image, width: 1734, height: 907, alt: "TEC Registry — the neutral trust layer for laboratory evidence" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getChatGPTUser();
  const membership = user ? await getOrganizationForUser(user.userId) : null;
  const preference = parseRole((await cookies()).get(ROLE_COOKIE)?.value) ?? "public";
  const role = membership ? organizationRole(membership.organization.organizationType) : preference;
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteIdentity).replaceAll("<", "\\u003c") }} />
        <RoleProvider initialRole={role} signedIn={!!user} hasWorkspace={!!membership}><NotificationProvider>{children}<MobileNavigation /></NotificationProvider></RoleProvider>
      </body>
    </html>
  );
}
