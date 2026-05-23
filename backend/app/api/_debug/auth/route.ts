export async function GET(request: Request) {
  const apiKey = process.env.API_KEY;
  const headerKey = request.headers.get("x-api-key");
  return Response.json({
    apiKeyConfigured: !!apiKey,
    apiKeyLength: apiKey?.length ?? 0,
    apiKeyFirst4: apiKey?.slice(0, 4) ?? null,
    apiKeyLast4: apiKey?.slice(-4) ?? null,
    headerReceived: !!headerKey,
    headerLength: headerKey?.length ?? 0,
    headerFirst4: headerKey?.slice(0, 4) ?? null,
    headerLast4: headerKey?.slice(-4) ?? null,
    match: apiKey === headerKey,
  });
}
