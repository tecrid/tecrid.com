import type {Metadata} from "next";
import {AboutPage} from "../blue-atlas/about";
import {TECRID_DEFINITION,TECRID_TITLE} from "../../lib/tecrid-definition";
const canonicalUrl = "https://tecrid.com/what-is-a-tecrid";

export const metadata: Metadata = {
  title: TECRID_TITLE,
  description: TECRID_DEFINITION,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: TECRID_TITLE,
    description: TECRID_DEFINITION,
    type: "article",
    url: canonicalUrl,
    images: [{ url: "https://tecrid.com/og.png", width: 1734, height: 907, alt: "TECRID, a digital receipt for a lab test result" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TECRID_TITLE,
    description: TECRID_DEFINITION,
    images: ["https://tecrid.com/og.png"],
  },
};

const term={"@context":"https://schema.org","@type":"DefinedTerm",name:"TECRID",description:TECRID_DEFINITION,url:canonicalUrl};
export default function Page(){return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(term).replaceAll("<", "\\u003c")}}/><AboutPage/></>}
