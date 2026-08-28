export function rejectCrossOriginWrite(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin === new URL(request.url).origin) return null;
  return Response.json(
    { error: "Cross-origin state changes are not allowed." },
    { status: 403 },
  );
}
