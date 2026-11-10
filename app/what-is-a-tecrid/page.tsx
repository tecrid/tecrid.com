import type {Metadata} from "next";
import {AboutPage} from "../blue-atlas/about";
const canonicalUrl = "https://tecrid.com/what-is-a-tecrid";
const definition = "A TECRID is a permanent identifier for a laboratory-issued Test Evidence Credential: a structured digital record of what was tested, what the laboratory reported, who issued it, and whether the record has changed.";

export const metadata: Metadata = {
  title: "What is a TECRID? Meaning, purpose and how it works",
  description: "TECRID stands for Test Evidence Credential Record Identifier. Learn what it identifies, who uses it, how it reduces laboratory-report fraud, and what it does not prove.",
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: "What is a TECRID?",
    description: "The permanent, verifiable identifier for laboratory-issued digital evidence records.",
    type: "article",
    url: canonicalUrl,
    images: [{ url: "https://tecrid.com/og.png", width: 1734, height: 907, alt: "TECRID · verifiable identifiers for laboratory evidence" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "What is a TECRID?",
    description: "The permanent, verifiable identifier for laboratory-issued digital evidence records.",
    images: ["https://tecrid.com/og.png"],
  },
};

const term={"@context":"https://schema.org","@type":"DefinedTerm",name:"TECRID",alternateName:"Test Evidence Credential Record Identifier",description:definition,url:canonicalUrl};
export default function Page(){return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(term).replaceAll("<", "\\u003c")}}/><AboutPage/></>}
