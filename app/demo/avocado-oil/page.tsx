import type { Metadata } from "next";
import { getDemoRecord } from "../../../lib/demo-records";
import { DemoRecordPage } from "../demo-record";

const record = getDemoRecord("avocado-oil");

export const metadata: Metadata = {
  title: `${record.title} — TEC demonstration`,
  description: "Invented avocado-oil authenticity profile inspired by documented supplier-level adulteration concerns.",
  robots: { index: false, follow: true },
  openGraph: { title: `${record.title} — TEC demonstration`, description: "Fictional profile; no real supplier, brand, or laboratory is implicated.", images: [] },
  twitter: { title: `${record.title} — TEC demonstration`, description: "Fictional profile; no real supplier, brand, or laboratory is implicated.", images: [] },
};

export default function AvocadoOilDemoPage() {
  return <DemoRecordPage record={record} />;
}
