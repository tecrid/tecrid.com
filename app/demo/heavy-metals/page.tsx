import type { Metadata } from "next";
import { getDemoRecord } from "../../../lib/demo-records";
import { DemoRecordPage } from "../demo-record";

const record = getDemoRecord("heavy-metals");

export const metadata: Metadata = {
  title: `${record.title} — TEC demonstration`,
  description: "Invented eight-analyte heavy-metals panel underlying TECRID’s reserved resolver sample.",
  robots: { index: false, follow: true },
  openGraph: { title: `${record.title} — TEC demonstration`, description: "Invented values; reserved resolver sample with no production authority.", images: [] },
  twitter: { title: `${record.title} — TEC demonstration`, description: "Invented values; reserved resolver sample with no production authority.", images: [] },
};

export default function HeavyMetalsDemoPage() {
  return <DemoRecordPage record={record} />;
}
