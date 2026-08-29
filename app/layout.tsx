import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "TECRID — Verifiable identifiers for laboratory reports";
const description =
  "A TECRID (Test Evidence Credential Record Identifier) is a permanent identifier for laboratory-issued test evidence. Verify the issuer, record, status, and version history at TEC Registry.";

const siteIdentity = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://tecrid.com/#website",
      url: "https://tecrid.com",
      name: "TECRID",
      alternateName: "TEC Registry",
      description,
      publisher: { "@id": "https://tecrid.com/#ics" },
    },
    {
      "@type": "Organization",
      "@id": "https://tecrid.com/#ics",
      name: "Institute of Contaminant Standards",
      url: "https://contaminantstandards.com",
      brand: { "@type": "Brand", name: "TECRID", alternateName: "TEC Registry" },
    },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "tec-registry.kmfp.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    metadataBase: new URL("https://tecrid.com"),
    title,
    description,
    applicationName: "TECRID",
    authors: [{ name: "Institute of Contaminant Standards", url: "https://contaminantstandards.com" }],
    creator: "Institute of Contaminant Standards",
    publisher: "Institute of Contaminant Standards",
    verification: {
      google: "1NWO0uv6B0GJqNBADyugLLo1W4d9dXlJ5T9nEide21Y",
    },
    robots: { index: true, follow: true },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteIdentity).replaceAll("<", "\\u003c") }} />
        {children}
      </body>
    </html>
  );
}
