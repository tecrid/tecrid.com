export async function GET() {
  return Response.json({
    status: "operational",
    service: "TEC Network API",
    version: "v1",
    time: new Date().toISOString(),
  });
}
