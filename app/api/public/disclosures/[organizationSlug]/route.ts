import {
  getPublicDisclosureFeed,
  publicDisclosureFeedDocument,
} from "../../../../../lib/disclosures";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ organizationSlug: string }> };

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safeText) ? `"${safeText.replaceAll('"', '""')}"` : safeText;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { organizationSlug } = await params;
  const feed = await getPublicDisclosureFeed(decodeURIComponent(organizationSlug));
  if (!feed) {
    return Response.json(
      { error: { code: "not_found", message: "No public disclosure portfolio was found." } },
      { status: 404 },
    );
  }
  const document = publicDisclosureFeedDocument(feed);
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const columns = [
      "canonical_url", "product_name", "product_sku", "upc", "batch_code",
      "production_date", "shelf_life_end", "retain_until", "laboratory_name",
      "laboratory_report_number", "source_sha256", "lead_ppb", "cadmium_ppb",
      "arsenic_ppb", "mercury_ppb", "authority", "linked_tecrid", "published_at",
    ];
    const rows = document.records.map((record) => {
      const value = (analyte: string) => record.results.find((result) => result.analyte === analyte)?.result ?? "";
      return [
        record.canonicalUrl, record.product.name, record.product.sku, record.product.upc,
        record.batchCode, record.productionDate, record.shelfLifeEnd, record.retainUntil,
        record.laboratoryName, record.laboratoryReportNumber, record.sourceSha256,
        value("Lead"), value("Cadmium"), value("Arsenic"), value("Mercury"),
        record.representation, record.linkedTecrid, record.publishedAt,
      ].map(csvCell).join(",");
    });
    return new Response([columns.join(","), ...rows].join("\r\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${feed.organization.slug}-disclosures.csv"`,
        "cache-control": "public, max-age=60",
      },
    });
  }
  return Response.json(document, {
    headers: { "cache-control": "public, max-age=60" },
  });
}
