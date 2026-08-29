export const demoLaboratory = {
  name: "Northstar Laboratory Demonstration",
  code: "DEMO-NLA",
  legalName: "Fictional organization — no legal entity",
  location: "Demonstration environment only",
  status: "Not registered · not ICS verified",
  scope: "Illustrative contaminant and edible-oil authenticity interfaces",
  key: "No signing key · no issuance authority",
};

export type DemoResult = {
  analyte: string;
  symbol: string;
  result: string;
  unit: string;
  loq?: string;
  qualifier?: "reported" | "less_than" | "not_detected";
  numericValue?: number | null;
  limit?: string;
  limitSource?: string;
  status?: string;
  basis?: string;
  interpretation: string;
  method?: string;
};

export type DemoReportDetails = {
  preparedFor: string;
  productName: string;
  brandName: string;
  sku: string;
  packageFormat: string;
  sampleId: string;
  reportNumber: string;
  orderNumber: string;
  testNumber: string;
  assay: string;
  servingSize: string;
  testingLocation: string;
  receivedAt: string;
  testedAt: string;
  releasedAt: string;
  methodCode: string;
  methodReference: string;
  accreditation: string;
  approverName: string;
  approverTitle: string;
  approvalState: string;
  sourceFilename: string;
  sourcePath: string;
  notes: string;
};

export type DemoRecord = {
  slug: "heavy-metals" | "avocado-oil";
  demoId: string;
  title: string;
  sample: string;
  lot: string;
  matrix: string;
  method: string;
  finding: string;
  findingDetail: string;
  results: DemoResult[];
  source?: { label: string; href: string; detail: string };
  declaration?: string;
  custody?: string;
  report?: DemoReportDetails;
};

export const demoRecords: DemoRecord[] = [
  {
    slug: "heavy-metals",
    demoId: "TECRID·DEMO-26-HM0001",
    title: "Expanded elemental panel",
    sample: "Cocoa powder, retail composite — fictional sample",
    lot: "DEMO-CP-0826",
    matrix: "Food · Cocoa powder",
    method: "Microwave digestion + ICP-MS; separate Cr(VI) extraction/speciation — illustrative",
    report: {
      preparedFor: "Atlas Pantry Demonstration",
      productName: "Unsweetened Cocoa Powder",
      brandName: "Atlas Pantry",
      sku: "ATL-COCOA-340",
      packageFormat: "340 g retail pouch",
      sampleId: "DEMO-SMP-260821-04",
      reportNumber: "DEMO-NS-260823-01",
      orderNumber: "DEMO-ORD-0821",
      testNumber: "DEMO-TST-260821-04",
      assay: "Expanded elemental panel",
      servingSize: "5.0 grams",
      testingLocation: "In-house · fictional demonstration environment",
      receivedAt: "2026-08-21",
      testedAt: "2026-08-22",
      releasedAt: "2026-08-23",
      methodCode: "DEMO-NLA-MET-01",
      methodReference: "Illustrative microwave digestion and ICP-MS workflow; Chromium(VI) uses a separate illustrative alkaline extraction and IC-ICP-MS method.",
      accreditation: "No accreditation claimed · fictional laboratory and method",
      approverName: "Morgan Vale",
      approverTitle: "Laboratory Director · fictional",
      approvalState: "Demonstration approval recorded · no cryptographic laboratory signature",
      sourceFilename: "northstar-demo-heavy-metals-report.pdf",
      sourcePath: "/demo/northstar-demo-heavy-metals-report.pdf",
      notes: "Retail composite submitted in an original sealed pouch; all identifiers and findings are invented.",
    },
    finding: "Eight-analyte demonstration",
    findingDetail: "These invented values demonstrate mixed units, detection limits, total-element results, and a separately specified hexavalent-chromium result. They do not establish safety or compliance.",
    results: [
      { analyte: "Lead", symbol: "Pb", result: "42", unit: "µg/kg", qualifier: "reported", numericValue: 42, loq: "10 µg/kg", limit: "100 µg/kg", limitSource: "Fictional customer specification DEMO-SPEC-MET-01", status: "Within fictional specification", basis: "As received", interpretation: "Invented reported value" },
      { analyte: "Mercury", symbol: "Hg", result: "6", unit: "µg/kg", qualifier: "reported", numericValue: 6, loq: "2 µg/kg", limit: "20 µg/kg", limitSource: "Fictional customer specification DEMO-SPEC-MET-01", status: "Within fictional specification", basis: "As received", interpretation: "Invented reported value" },
      { analyte: "Arsenic (total)", symbol: "As", result: "84", unit: "µg/kg", qualifier: "reported", numericValue: 84, loq: "10 µg/kg", limit: "120 µg/kg", limitSource: "Fictional customer specification DEMO-SPEC-MET-01", status: "Within fictional specification", basis: "As received", interpretation: "Invented total-element value" },
      { analyte: "Cadmium", symbol: "Cd", result: "312", unit: "µg/kg", qualifier: "reported", numericValue: 312, loq: "10 µg/kg", limit: "500 µg/kg", limitSource: "Fictional customer specification DEMO-SPEC-MET-01", status: "Within fictional specification", basis: "As received", interpretation: "Invented reported value" },
      { analyte: "Nickel", symbol: "Ni", result: "680", unit: "µg/kg", qualifier: "reported", numericValue: 680, loq: "20 µg/kg", limit: "Not specified", limitSource: "No fictional customer specification supplied", status: "Reported · no specification", basis: "As received", interpretation: "Invented reported value" },
      { analyte: "Aluminum", symbol: "Al", result: "3.8", unit: "mg/kg", qualifier: "reported", numericValue: 3.8, loq: "0.10 mg/kg", limit: "5.0 mg/kg", limitSource: "Fictional customer specification DEMO-SPEC-MET-01", status: "Within fictional specification", basis: "As received", interpretation: "Invented reported value" },
      { analyte: "Chromium(VI)", symbol: "Cr⁶⁺", result: "< 10", unit: "µg/kg", qualifier: "less_than", numericValue: null, loq: "10 µg/kg", limit: "20 µg/kg", limitSource: "Fictional customer specification DEMO-SPEC-MET-01", status: "Below reporting limit", basis: "As received", interpretation: "Invented below-LOQ result; separate speciation method", method: "DEMO-NLA-CR6-01 · alkaline extraction + IC-ICP-MS · illustrative" },
      { analyte: "Tin", symbol: "Sn", result: "0.24", unit: "mg/kg", qualifier: "reported", numericValue: 0.24, loq: "0.05 mg/kg", limit: "1.0 mg/kg", limitSource: "Fictional customer specification DEMO-SPEC-MET-01", status: "Within fictional specification", basis: "As received", interpretation: "Invented reported value" },
    ],
  },
  {
    slug: "avocado-oil",
    demoId: "DEMO-TECRID·NLA-26-AO0001",
    title: "Avocado-oil authenticity finding",
    sample: "Oil extracted from fictional avocado-oil-labeled tortilla chips",
    lot: "DEMO-AO-1184",
    matrix: "Processed food · Extracted oil fraction",
    method: "GC-FID fatty-acid profile + GC sterol profile — illustrative",
    declaration: "Supplier declaration: “100% refined avocado oil; no other oils.”",
    custody: "Fictional supplier lot → fictional manufacturer receipt → retained sample → demonstration laboratory",
    finding: "Illustrative profile inconsistent with authentic avocado oil",
    findingDetail: "The invented marker pattern is compatible with a substantial non-avocado vegetable-oil contribution. It does not identify a specific seed oil or implicate any real supplier, laboratory, or brand.",
    results: [
      { analyte: "Palmitic acid", symbol: "C16:0", result: "5.1", unit: "% total fatty acids", interpretation: "Below invented demonstration reference" },
      { analyte: "Palmitoleic acid", symbol: "C16:1", result: "0.7", unit: "% total fatty acids", interpretation: "Below invented demonstration reference" },
      { analyte: "Cis-vaccenic acid", symbol: "C18:1 n-7", result: "1.1", unit: "% total fatty acids", interpretation: "Below invented demonstration reference" },
      { analyte: "Stearic acid", symbol: "C18:0", result: "6.2", unit: "% total fatty acids", interpretation: "Above invented demonstration reference" },
      { analyte: "β-sitosterol", symbol: "β-SIT", result: "45.0", unit: "% total sterols", interpretation: "Below invented demonstration reference" },
      { analyte: "Campesterol", symbol: "CAM", result: "22.0", unit: "% total sterols", interpretation: "Above invented demonstration reference" },
      { analyte: "Stigmasterol", symbol: "STI", result: "8.6", unit: "% total sterols", interpretation: "Above invented demonstration reference" },
      { analyte: "Δ7-stigmastenol", symbol: "Δ7-STI", result: "4.9", unit: "% total sterols", interpretation: "Above invented demonstration reference" },
    ],
    source: {
      label: "UC Davis · 2026 processed-food authenticity study",
      href: "https://www.ucdavis.edu/food/news/avocado-oil-chip-youre-eating-may-not-be-made-pure-avocado-oil",
      detail: "The directional marker pattern follows the study summary; every number, name, lot, declaration, and conclusion on this demonstration page is invented.",
    },
  },
];

export function getDemoRecord(slug: DemoRecord["slug"]) {
  return demoRecords.find((record) => record.slug === slug)!;
}
