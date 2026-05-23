const RAILWAY_GRAPHQL = "https://backboard.railway.app/graphql/v2";

export async function GET() {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) {
    return Response.json({ error: "RAILWAY_API_TOKEN not set" }, { status: 503 });
  }
  const query = `
    {
      __schema {
        queryType {
          fields(includeDeprecated: true) {
            name
            args { name type { name kind ofType { name kind } } }
          }
        }
      }
    }
  `;
  const res = await fetch(RAILWAY_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}
