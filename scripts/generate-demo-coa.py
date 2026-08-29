#!/usr/bin/env python3
"""Generate the fictional source COA bound to the public TECRID sample."""

from __future__ import annotations

import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfgen import canvas as pdf_canvas


BLUE = colors.HexColor("#1743E3")
INK = colors.HexColor("#131C2C")
MUTED = colors.HexColor("#5E6878")
LINE = colors.HexColor("#D8DCE5")
PALE_BLUE = colors.HexColor("#EDF3FF")
PALE_AMBER = colors.HexColor("#FFF4D1")
WHITE = colors.white


RESULTS = [
    ("Lead", "42 ug/kg", "10 ug/kg", "100 ug/kg", "Within fictional specification"),
    ("Mercury", "6 ug/kg", "2 ug/kg", "20 ug/kg", "Within fictional specification"),
    ("Arsenic (total)", "84 ug/kg", "10 ug/kg", "120 ug/kg", "Within fictional specification"),
    ("Cadmium", "312 ug/kg", "10 ug/kg", "500 ug/kg", "Within fictional specification"),
    ("Nickel", "680 ug/kg", "20 ug/kg", "Not specified", "Reported - no specification"),
    ("Aluminum", "3.8 mg/kg", "0.10 mg/kg", "5.0 mg/kg", "Within fictional specification"),
    ("Chromium(VI)", "< 10 ug/kg", "10 ug/kg", "20 ug/kg", "Below reporting limit"),
    ("Tin", "0.24 mg/kg", "0.05 mg/kg", "1.0 mg/kg", "Within fictional specification"),
]


def build(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=7.6,
        leading=10.5,
        textColor=INK,
        spaceAfter=0,
    )
    small = ParagraphStyle(
        "Small",
        parent=body,
        fontSize=6.4,
        leading=8.2,
        textColor=MUTED,
    )
    label = ParagraphStyle(
        "Label",
        parent=small,
        fontName="Helvetica-Bold",
        fontSize=6.1,
        leading=7.5,
        textColor=BLUE,
        uppercase=True,
    )
    title = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=18,
        textColor=INK,
        alignment=TA_RIGHT,
    )
    section = ParagraphStyle(
        "Section",
        parent=body,
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=10,
        textColor=BLUE,
        spaceBefore=3,
        spaceAfter=4,
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=small,
        fontName="Helvetica-Bold",
        textColor=WHITE,
    )

    def p(value: str, style: ParagraphStyle = body) -> Paragraph:
        return Paragraph(value, style)

    def field(name: str, value: str) -> list[Paragraph]:
        return [p(name.upper(), label), p(value, body)]

    def page_footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.line(18 * mm, 13 * mm, 192 * mm, 13 * mm)
        canvas.setFont("Helvetica", 6.2)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 8.5 * mm, "TECRID DEMONSTRATION - NOT LABORATORY EVIDENCE")
        canvas.drawRightString(192 * mm, 8.5 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=14 * mm,
        bottomMargin=18 * mm,
        title="Northstar Laboratory Demonstration - Fictional Certificate of Analysis",
        author="TECRID demonstration",
        subject="Fictional source report for TECRID DEMO-26-HM0001",
    )

    story = []
    header = Table(
        [
            [p("NORTHSTAR LABORATORY", ParagraphStyle("Brand", parent=body, fontName="Helvetica-Bold", fontSize=13, leading=15, textColor=BLUE)), p("Certificate of Analysis", title)],
            [p("Fictional demonstration organization", small), p("TECRID DEMO-26-HM0001", ParagraphStyle("Tecrid", parent=small, alignment=TA_RIGHT, fontName="Helvetica-Bold", textColor=BLUE))],
        ],
        colWidths=[90 * mm, 84 * mm],
    )
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
    story.extend([header, Spacer(1, 5 * mm)])

    banner = Table([[p("FICTIONAL DEMONSTRATION - NO LIVE LABORATORY, ACCREDITATION, PRODUCT OR FINDINGS", ParagraphStyle("Banner", parent=body, fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=INK))]], colWidths=[174 * mm])
    banner.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PALE_AMBER), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#D4B350")), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.extend([banner, Spacer(1, 5 * mm)])

    parties = Table(
        [
            [p("PREPARED FOR", section), p("LABORATORY CONTACT", section)],
            [
                p("<b>Organization</b>  Atlas Pantry Demonstration<br/><b>Brand</b>  Atlas Pantry<br/><b>Account code</b>  DEMO-ATL<br/><b>Contact</b>  Withheld from public sample"),
                p("<b>Name</b>  Morgan Vale<br/><b>Title</b>  Laboratory Director - fictional<br/><b>Location</b>  Demonstration environment only<br/><b>Issuer code</b>  DEMO-NLA"),
            ],
        ],
        colWidths=[87 * mm, 87 * mm],
    )
    parties.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    story.extend([parties, Spacer(1, 4 * mm), p("REPORT AND SAMPLE IDENTITY", section)])

    facts = [
        ("Product", "Unsweetened Cocoa Powder", "SKU", "ATL-COCOA-340"),
        ("Package", "340 g retail pouch", "Lot", "DEMO-CP-0826"),
        ("Sample ID", "DEMO-SMP-260821-04", "Assay", "Expanded elemental panel"),
        ("Report", "DEMO-NS-260823-01", "Test", "DEMO-TST-260821-04"),
        ("Order", "DEMO-ORD-0821", "Serving size", "5.0 grams"),
        ("Date received", "2026-08-21", "Date tested", "2026-08-22"),
        ("Date released", "2026-08-23", "Location", "In-house - demonstration only"),
    ]
    fact_rows = []
    for left_name, left_value, right_name, right_value in facts:
        fact_rows.append([*field(left_name, left_value), *field(right_name, right_value)])
    fact_table = Table(fact_rows, colWidths=[25 * mm, 62 * mm, 25 * mm, 62 * mm])
    fact_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7F8FB")),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.extend([fact_table, Spacer(1, 4 * mm), p("ANALYTICAL RESULTS", section)])

    result_rows = [[p("Analyte", table_header), p("Result", table_header), p("LOQ", table_header), p("Limit", table_header), p("Status", table_header)]]
    for analyte, result, loq, limit_value, status in RESULTS:
        result_rows.append([p(analyte), p(result), p(loq), p(limit_value), p(status, small)])
    result_table = Table(result_rows, colWidths=[38 * mm, 27 * mm, 26 * mm, 28 * mm, 55 * mm], repeatRows=1)
    row_backgrounds = [("BACKGROUND", (0, row), (-1, row), colors.HexColor("#F3F4F7")) for row in range(2, len(result_rows), 2)]
    result_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        *row_backgrounds,
    ]))
    story.extend([result_table, Spacer(1, 4 * mm)])

    method_block = KeepTogether([
        p("METHOD AND INTERPRETATION", section),
        p("<b>Method code:</b> DEMO-NLA-MET-01. Illustrative microwave digestion and ICP-MS workflow. Chromium(VI) uses the separate fictional method DEMO-NLA-CR6-01, modeled as alkaline extraction followed by IC-ICP-MS. Results are reported on an as-received basis."),
        Spacer(1, 1.5 * mm),
        p("<b>Limit source:</b> Fictional customer specification DEMO-SPEC-MET-01. These are not regulatory limits and must not be used for a real safety, compliance or certification decision.", small),
        Spacer(1, 1.5 * mm),
        p("<b>Accreditation:</b> None claimed. Northstar Laboratory Demonstration is not a legal laboratory and has no ISO/IEC 17025 scope, accreditation number or signing key.", small),
    ])
    story.extend([method_block, Spacer(1, 4 * mm)])

    approval = Table(
        [[p("RESULTS APPROVED BY", section), p("SOURCE AND RELEASE", section)],
         [p("<b>Morgan Vale</b><br/>Laboratory Director - fictional<br/>Demonstration approval only<br/>No cryptographic laboratory signature"), p("<b>Date released</b>  2026-08-23<br/><b>Source report</b>  northstar-demo-heavy-metals-report.pdf<br/><b>TECRID</b>  DEMO-26-HM0001<br/><b>Public source document</b>  Yes - fictional sample")]],
        colWidths=[87 * mm, 87 * mm],
    )
    approval.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#B8C7F8")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    story.extend([approval, Spacer(1, 3 * mm), p("This fictional report exists only to demonstrate how TECRID binds a complete source certificate to structured data, visibility rules, a document fingerprint and an append-only version. No person, product, brand, laboratory, accreditation or analytical finding on this certificate is real.", small)])

    def invariant_canvas(*args, **kwargs):
        kwargs["invariant"] = 1
        return pdf_canvas.Canvas(*args, **kwargs)

    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer, canvasmaker=invariant_canvas)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: generate-demo-coa.py OUTPUT.pdf")
    build(Path(sys.argv[1]).resolve())
