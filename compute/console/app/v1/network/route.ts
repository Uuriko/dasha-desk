const headers = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export async function GET() {
  return Response.json(
    {
      phase: "interface-alpha",
      source_version: "0.3.0",
      providers_online: 0,
      models_available: [],
      jobs_queued: 0,
      inference_live: false,
      streaming_in_source: true,
      privacy_level: "browser-demo-only",
      source_download: "/dasha-compute-open-alpha.tar.gz",
    },
    { headers },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}
