export const TECRID_ORIGIN = "https://tecrid.com";
export const TECRID_WEBSITE_ID = `${TECRID_ORIGIN}/#website`;
export const TECRID_SERVICE_ID = `${TECRID_ORIGIN}/#service`;
export const TECRID_SPECIFICATION_DOI = "10.5281/zenodo.22232196";
export const TECRID_SPECIFICATION_DOI_URL = `https://doi.org/${TECRID_SPECIFICATION_DOI}`;
export const TECRID_SPECIFICATION_CONCEPT_DOI = "10.5281/zenodo.22232195";
export const TECRID_SPECIFICATION_CONCEPT_DOI_URL = `https://doi.org/${TECRID_SPECIFICATION_CONCEPT_DOI}`;
export const TECRID_SPECIFICATION_REPOSITORY_URL = "https://github.com/tecrid/tecrid-specification";

export const ICS_ORIGIN = "https://contaminantstandards.com";
export const ICS_ORGANIZATION_ID = `${ICS_ORIGIN}/#organization`;

export const KAREN_PROFILE_URL = `${ICS_ORIGIN}/people/karen-pendergrass`;
export const KAREN_PERSON_ID = `${KAREN_PROFILE_URL}#person`;
export const KAREN_ORCID_URL = "https://orcid.org/0000-0002-2348-7259";

export const HMI_WEBSITE_ID = "https://heavymetalindex.com/#website";
export const HMTC_ORGANIZATION_ID = "https://heavymetalcertified.com/#organization";

export const karenPerson = {
  "@type": "Person",
  "@id": KAREN_PERSON_ID,
  name: "Karen Pendergrass",
  url: KAREN_PROFILE_URL,
  jobTitle: "Founder, Chief Executive Officer, Standards Architect, and Research Lead",
  worksFor: { "@id": ICS_ORGANIZATION_ID },
  sameAs: [KAREN_ORCID_URL],
  identifier: {
    "@type": "PropertyValue",
    propertyID: "ORCID",
    value: "0000-0002-2348-7259",
    url: KAREN_ORCID_URL,
  },
};

export const icsOrganization = {
  "@type": "Organization",
  "@id": ICS_ORGANIZATION_ID,
  name: "Institute of Contaminant Standards",
  alternateName: "ICS",
  legalName: "Paleo Certified, Inc.",
  url: ICS_ORIGIN,
  founder: { "@id": KAREN_PERSON_ID },
  employee: { "@id": KAREN_PERSON_ID },
  subOrganization: { "@id": HMTC_ORGANIZATION_ID },
  hasPart: [
    { "@type": "WebSite", "@id": HMI_WEBSITE_ID, name: "Heavy Metal Index", url: "https://heavymetalindex.com" },
    { "@type": "WebSite", "@id": TECRID_WEBSITE_ID, name: "TECRID", url: TECRID_ORIGIN },
  ],
};

export const tecridService = {
  "@type": "Service",
  "@id": TECRID_SERVICE_ID,
  name: "TECRID Registry",
  alternateName: "Test Evidence Credential Record Identifier Registry",
  serviceType: "Laboratory evidence registration and verification",
  url: TECRID_ORIGIN,
  description:
    "Persistent identifiers, signed structured evidence records, public resolution, controlled sharing, and append-only version history for laboratory reports.",
  provider: { "@id": ICS_ORGANIZATION_ID },
  areaServed: "Worldwide",
  isRelatedTo: [
    { "@id": HMI_WEBSITE_ID },
    { "@id": HMTC_ORGANIZATION_ID },
  ],
};
