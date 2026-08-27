export async function POST() {
  return Response.json(
    {
      error: "The hosted coordinator is not accepting providers yet.",
      source_download: "/dasha-compute-open-alpha.tar.gz",
      source_version: "0.3.0",
      local_route: "/v1/providers/poll",
    },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "86400" } },
  );
}
