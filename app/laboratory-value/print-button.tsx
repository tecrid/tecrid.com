"use client";

export function PrintButton() {
  return <button type="button" className="lab-value-print" onClick={() => window.print()}>Print or save as PDF</button>;
}
