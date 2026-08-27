const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
  "Retry-After": "86400",
};

export async function POST() {
  return Response.json(
    {
      error: {
        message: "This bundled local console does not proxy Dasha's hosted provider network. It does not read, retain or relay the submitted prompt. Download source v0.3 to run streamed or complete requests locally.",
        type: "provider_unavailable",
        code: "network_not_live",
        source_download: "/dasha-compute-open-alpha.tar.gz",
        source_version: "0.3.0",
      },
    },
    { status: 503, headers },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}
