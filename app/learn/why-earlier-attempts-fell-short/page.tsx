import type { Metadata } from "next";
import { Shell, Kicker } from "../../blue-atlas/shared";
import "./article.css";

const canonicalUrl = "https://tecrid.com/learn/why-earlier-attempts-fell-short";
const title = "What earlier attempts to verify lab results ran into, and what TECRID does differently";
const description = "What earlier lab report verification and blockchain projects ran into, and how TECRID connects reports to verified laboratories with signatures and fingerprints.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: true },
  authors: [{ name: "Institute of Contaminant Standards", url: "https://contaminantstandards.com" }],
  openGraph: { title, description, type: "article", url: canonicalUrl, images: ["https://tecrid.com/og.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["https://tecrid.com/og.png"] },
};

const article = {
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${canonicalUrl}#article`,
  headline: title,
  description,
  url: canonicalUrl,
  mainEntityOfPage: canonicalUrl,
  inLanguage: "en",
  image: "https://tecrid.com/og.png",
  author: { "@type": "Organization", "@id": "https://contaminantstandards.com/#organization", name: "Institute of Contaminant Standards", url: "https://contaminantstandards.com" },
  publisher: { "@id": "https://contaminantstandards.com/#organization" },
};

export default function EarlierAttemptsPage() {
  return <Shell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article).replaceAll("<", "\\u003c") }} />
    <article className="atlas-article" aria-labelledby="article-title">
      <header className="atlas-article-header">
        <Kicker>Learn / Report verification</Kicker>
        <h1 id="article-title">{title}</h1>
        <p className="atlas-article-byline">By <a href="https://contaminantstandards.com" rel="author">Institute of Contaminant Standards</a></p>
      </header>
      <div className="atlas-article-copy">
        <p>{"A laboratory tests a sample and issues a report. A brand forwards the PDF to a distributor. The distributor sends it to a retailer. By the time a buyer opens it, the document may have passed through several inboxes."}</p>
        <p>{"The buyer can read the results. What the buyer may have no way to establish from that PDF alone is whether the named lab actually issued it, whether the numbers are unchanged, and whether the document matches the original report."}</p>
        <p>{"A certificate of analysis, commonly called a COA, can look convincing without providing that proof. A lab logo, report number, and image of a signature can all be copied. A QR code can lead to a document without establishing who created it or whether someone changed it."}</p>
        <p>{"This is a documented problem. In a June 2025 warning letter to Boothwyn Pharmacy, the FDA reported that the pharmacist in charge had altered COAs issued by the pharmacy’s contract laboratory, changing failing bacterial endotoxin results to passing results. The problem arose after the laboratory had issued its reports. "}<a href={"https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/boothwyn-pharmacy-llc-710247-06092025"}>{"FDA warning letter"}</a></p>
        <p>{"A buyer can contact the issuing lab and ask it to confirm a report. That remains a useful check. But it requires someone to identify a trustworthy contact, send the document, and wait for an answer. When verification depends on that exchange, a forwarded PDF creates work for both the recipient and the laboratory."}</p>
        <p>{"The challenge is to give the report a checkable connection to its source, wherever the report travels."}</p>
        <p>{"Between 2017 and 2020, several initiatives approached related problems through blockchain. Some addressed entire supply chains. Others brought laboratory testing and COAs into broader systems for tracking products. Their histories explain both the appeal of that approach and the difficulties that technology alone could not remove."}</p>
        <p>{"In September 2017, Ambrosus announced a token sale for a supply chain system combining sensors, blockchain, and smart contracts. Its stated aim was to assure the quality, safety, and origins of food, pharmaceuticals, and other essential products. The proposal connected sensor measurements with records it described as publicly verifiable. "}<a href={"https://www.prnewswire.com/news-releases/swiss-supply-chain-startup-ambrosus-launches-token-generation-event-646818773.html"}>{"Ambrosus launch announcement"}</a></p>
        <p>{"Ambrosus later changed direction. In September 2022, its team announced AirDAO, describing an ecosystem centered on cryptocurrency applications, including an exchange, token staking, and transfers between blockchains. That announcement documents a shift toward financial applications. It does not establish a particular reason why the earlier supply chain focus changed. "}<a href={"https://www.accessnewswire.com/newsroom/en/blockchain-and-cryptocurrency/airdao-launches-to-bring-all-defi-transactions-under-one-roof-716172"}>{"AirDAO announcement"}</a></p>
        <p>{"TradeLens, announced in 2018 and jointly developed by IBM and a Maersk division, addressed shipping information and documents. Its outcome is more explicit. In November 2022, Maersk and IBM announced that they would discontinue it. Maersk said that while it had developed a viable platform, “the need for full global industry collaboration has not been achieved.” As a result, TradeLens had not reached the commercial viability necessary to continue. "}<a href={"https://www.maersk.com/news/articles/2022/11/29/maersk-and-ibm-to-discontinue-tradelens"}>{"Maersk discontinuation announcement"}</a></p>
        <p>{"TradeLens was a shipping platform, so its closure cannot explain the fate of every laboratory verification project. It does illustrate a coordination problem: functioning software does not, by itself, bring enough independent organizations into a shared way of working."}</p>
        <p>{"Laboratory data projects pursued more specific applications. TruTrace Technologies, previously called BLOCKStrain, described plans in its 2019 quarterly filing to make authenticated COAs available through blockchain and QR codes for a proposed CBD beverage application. The same filing described the Shoppers Drug Mart medical cannabis pilot using TruTrace’s StrainSecure platform for testing, verification, product identity, and inventory information. These were efforts to connect laboratory evidence with products moving through commerce. "}<a href={"https://www.otcmarkets.com/file/company/financial-report/230770/content"}>{"TruTrace’s 2019 filing"}</a></p>
        <p>{"In March 2020, TruTrace reported that implementation of the Shoppers pilot was continuing. It also warned that some cannabis industry participants might delay adoption as they reduced costs during the economic slowdown associated with COVID-19. That statement documents an anticipated adoption obstacle, rather than a shutdown of the pilot. "}<a href={"https://webfiles.thecse.com/2020-03-27-trutrace-PR.pdf?86uzovtuIjajXgfVS0ROMQa3Dt643kIf="}>{"TruTrace’s March 2020 update"}</a></p>
        <p>{"These examples have different outcomes: discontinuation, a change of focus, and continued implementation accompanied by adoption risks. The historical record does not support treating every blockchain project as the same failure."}</p>
        <p>{"It does support separating two questions. Can a system preserve a digital record? And can the people receiving that record establish that its source is legitimate and its contents are trustworthy?"}</p>
        <p>{"NIST explained this distinction in its 2018 overview of blockchain technology. Information entering a blockchain can still be inaccurate. People can submit false information, and sensors can supply bad data. Preserving that information does not establish that the original claim was true. "}<a href={"https://nvlpubs.nist.gov/nistpubs/ir/2018/NIST.IR.8202.pdf"}>{"NIST’s blockchain overview"}</a></p>
        <p>{"For laboratory reports, that distinction is central. A permanent record of an uploaded document does not, on its own, establish that the named laboratory issued it. Someone still has to verify the issuer and connect that issuer to the exact report."}</p>
        <p>{"The design lesson we draw from these histories is practical: report verification should begin with the issuing laboratory and the report itself. It should also give each participant a clear role, without requiring an entire supply chain to adopt a shared tracking system before one buyer can check one report."}</p>
        <p>{"TECRID follows that approach."}</p>
        <p>{"TECRID is a free, cryptographic digital safety tag for lab test results. It works like a digital serial number that proves a lab report is real, came from the lab that issued it, and has not been altered. It is an open initiative of the Institute of Contaminant Standards, or ICS."}</p>
        <p>{"Its focus is the authenticity of the laboratory record."}</p>
        <p>{"TECRID uses no blockchain, tokens, or cryptocurrency wallets. Its technical foundation combines standard Ed25519 laboratory signatures with SHA-256 fingerprints."}</p>
        <p>{"An Ed25519 digital signature connects the signed record to the issuing lab’s cryptographic key. The lab signs using a private key. Verification uses the corresponding public key to check that signature. This is a mathematical check, rather than a visual comparison with a signature printed on a page. Ed25519 is specified in RFC 8032. "}<a href={"https://www.rfc-editor.org/rfc/rfc8032.html"}>{"Ed25519 specification"}</a></p>
        <p>{"SHA-256 provides a digital fingerprint of the protected report content. That fingerprint allows the content being checked to be compared with the content originally recorded. Altering the protected content produces a different fingerprint. SHA-256 is defined in NIST’s Secure Hash Standard. "}<a href={"https://csrc.nist.gov/pubs/fips/180-4/upd1/final"}>{"NIST Secure Hash Standard"}</a></p>
        <p>{"The two mechanisms serve different purposes. A fingerprint helps establish whether content matches. A signature connects the signed record to a particular key. TECRID combines those checks with verification of the laboratory behind that key."}</p>
        <p>{"That last step matters. A valid cryptographic signature can show that a particular key signed something. Establishing which laboratory controls that key requires an identity and approval process."}</p>
        <p>{"Before a lab can issue through TECRID, ICS must verify it. That process includes ISO/IEC 17025 checks and requires two separate ICS approvals. Issuing authority depends on completing those checks."}</p>
        <p>{"This gives the process a defined starting point. The laboratory is verified before it can issue. Its signature establishes the origin of the signed record. The fingerprint allows protected content to be checked for changes."}</p>
        <p>{"Simply copying a TECRID number onto another document does not transfer the original report’s proof to that document. Verification depends on checking the associated signed record and matching content. The number is the route to the evidence."}</p>
        <p>{"TECRID also addresses a practical concern about sharing test results: a brand may need to provide evidence to a buyer without making every laboratory result public."}</p>
        <p>{"A brand can choose to keep a record’s results controlled and decide who sees them. Authenticity and access are separate questions. Anyone can still confirm who issued a record and whether it is current, while the results stay under the brand’s control."}</p>
        <p>{"For a brand, this means the decision to share laboratory evidence remains deliberate. For a retailer or buyer receiving access, it means there is a basis for checking the record’s origin and integrity."}</p>
        <p>{"TECRID is free to issue and free to check. Checking a report does not require buying a token or managing a wallet. The purpose is to make a basic verification step available to the people who issue, share, and receive laboratory evidence."}</p>
        <p>{"Its responsibilities also have a clear boundary. TECRID does not certify product safety or rule on results."}</p>
        <p>{"An authentic report can contain a failing result. It can describe a different batch from the one a buyer is considering. It may cover only some of the tests relevant to a purchasing decision. Those questions still require the report to be read and assessed."}</p>
        <p>{"TECRID lets people check the authenticity of the evidence used in that assessment. Laboratories remain responsible for their testing and reports. Brands, retailers, and buyers remain responsible for deciding what those results mean for their purposes."}</p>
        <h2>{"Why take this approach now?"}</h2>
        <p>{"The answer is not that digital signatures have only recently become possible. RFC 8032 was published in January 2017, and the cited edition of NIST’s Secure Hash Standard was published in August 2015. The core tools were available during the earlier wave of blockchain projects."}</p>
        <p>{"What has changed is the evidence available about implementation, adoption, and the continuing weaknesses of document handling. The industry can learn from discontinued platforms, changed priorities, and projects that encountered customer adoption pressures. A recent FDA warning letter also shows that report alteration remains a concrete problem."}</p>
        <p>{"For laboratories, the issue extends beyond producing an accurate report. A laboratory’s name can remain on a document after someone else changes its contents. A signature connected to a verified lab gives recipients a way to check the record against its claimed source."}</p>
        <p>{"For brands, commissioning testing and preserving proof of that testing are connected responsibilities. A report needs to remain checkable when it moves from the person who ordered it to the people evaluating a purchase. Brand control over who sees the results makes that possible without requiring unrestricted publication."}</p>
        <p>{"For retailers, checking the relationship between a document and a particular batch is already an operational concern. In December 2024, Minnesota’s Office of Cannabis Management advised retailers of hemp-derived cannabinoid products to check the QR code links to COAs for each product batch when taking in new product, and to document those checks. The bulletin also explained that legitimate corrections should be made by the laboratory through an amended and reissued report. "}<a href={"https://content.govdelivery.com/accounts/MNOCM/bulletins/3c665e0"}>{"Minnesota’s COA guidance"}</a></p>
        <p>{"That is one specific regulatory example, but the practical question applies more broadly: does the evidence in front of the buyer correspond to the laboratory report being claimed?"}</p>
        <p>{"TECRID’s approach makes that question the starting point. A verified laboratory issues the signed record. The brand can control who sees the results. The recipient checks its authenticity before evaluating the results."}</p>
        <p>{"The intended benefit is straightforward for each participant. Labs can make the origin of their records checkable. Brands can share evidence with control over who sees the results. Retailers and buyers can assess results with proof of where the record came from and whether its protected contents match."}</p>
        <p>{"If you already have a TECRID, look it up at "}<a href={"https://tecrid.com/verify"}>{"tecrid.com/verify"}</a>{". You can also check a PDF there by its fingerprint. If the reports you receive do not have one, invite the issuing laboratory to participate. Laboratories can "}<a href={"https://tecrid.com/join?role=laboratory"}>{"start at tecrid.com/join"}</a>{" and complete ICS verification so their reports can carry a checkable digital safety tag."}</p>
        <h2>{"Sources"}</h2>
        <ul className="atlas-article-sources"><li>{"FDA, "}<a href={"https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/boothwyn-pharmacy-llc-710247-06092025"}>{"warning letter to Boothwyn Pharmacy LLC"}</a>{", June 9, 2025"}</li><li>{"Ambrosus, "}<a href={"https://www.prnewswire.com/news-releases/swiss-supply-chain-startup-ambrosus-launches-token-generation-event-646818773.html"}>{"token generation event announcement"}</a>{", September 22, 2017"}</li><li>{"AirDAO, "}<a href={"https://www.accessnewswire.com/newsroom/en/blockchain-and-cryptocurrency/airdao-launches-to-bring-all-defi-transactions-under-one-roof-716172"}>{"launch announcement"}</a>{", September 21, 2022"}</li><li>{"Maersk, "}<a href={"https://www.maersk.com/news/articles/2022/11/29/maersk-and-ibm-to-discontinue-tradelens"}>{"TradeLens discontinuation announcement"}</a>{", November 29, 2022"}</li><li>{"TruTrace Technologies, "}<a href={"https://www.otcmarkets.com/file/company/financial-report/230770/content"}>{"quarterly management discussion and analysis"}</a>{", September 23, 2019"}</li><li>{"TruTrace Technologies, "}<a href={"https://webfiles.thecse.com/2020-03-27-trutrace-PR.pdf?86uzovtuIjajXgfVS0ROMQa3Dt643kIf="}>{"financial results and corporate update"}</a>{", March 27, 2020"}</li><li>{"NIST, "}<a href={"https://nvlpubs.nist.gov/nistpubs/ir/2018/NIST.IR.8202.pdf"}>{"Blockchain Technology Overview (NISTIR 8202)"}</a>{", October 2018"}</li><li><a href={"https://www.rfc-editor.org/rfc/rfc8032.html"}>{"RFC 8032, Edwards-Curve Digital Signature Algorithm (EdDSA)"}</a>{", January 2017"}</li><li>{"NIST, "}<a href={"https://csrc.nist.gov/pubs/fips/180-4/upd1/final"}>{"FIPS 180-4, Secure Hash Standard"}</a>{", August 2015"}</li><li>{"Minnesota Office of Cannabis Management, "}<a href={"https://content.govdelivery.com/accounts/MNOCM/bulletins/3c665e0"}>{"Cannabis Compliance Connector bulletin on COAs"}</a>{", December 16, 2024"}</li></ul>
      </div>
    </article>
  </Shell>;
}
