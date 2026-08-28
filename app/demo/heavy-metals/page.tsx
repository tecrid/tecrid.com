import type { Metadata } from "next";
import { getDemoRecord } from "../../../lib/demo-records";
import { DemoRecordPage } from "../demo-record";

const record = getDemoRecord("heavy-metals");

export const metadata: Metadata = {
  title: `${record.title} — TEC demonstration`,
  description: "Invented eight-analyte heavy-metals panel demonstrating a TEC record interface.",
  robots: { index: false, follow: true },
  openGraph: { title: `${record.title} — TEC demonstration`, description: "Invented values; not a public TEC or laboratory finding.", images: [] },
  twitter: { title: `${record.title} — TEC demonstration`, description: "Invented values; not a public TEC or laboratory finding.", images: [] },
};

export default function HeavyMetalsDemoPage() {
  return <DemoRecordPage record={record} />;
}
