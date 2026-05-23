const RAILWAY_GRAPHQL = "https://backboard.railway.app/graphql/v2";

export async function GET(request: Request) {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) {
    return Response.json({ error: "RAILWAY_API_TOKEN not set" }, { status: 503 });
  }

  const url = new URL(request.url);
  const typeName = url.searchParams.get("type");
  if (!typeName) {
    return Response.json({ error: "pass ?type=..." }, { status: 400 });
  }

  const query = `
    query($name: String!) {
      __type(name: $name) {
        name
        kind
        fields {
          name
          description
          type { name kind ofType { name kind ofType { name kind } } }
        }
        enumValues { name }
      }
    }
  `;

  const res = await fetch(RAILWAY_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables: { name: typeName } }),
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}
