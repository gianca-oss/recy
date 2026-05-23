const RAILWAY_GRAPHQL = "https://backboard.railway.app/graphql/v2";

export async function GET(request: Request) {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) {
    return Response.json({ error: "RAILWAY_API_TOKEN not set" }, { status: 503 });
  }

  const url = new URL(request.url);
  const typeName = url.searchParams.get("type");

  const query = typeName
    ? `
      query($name: String!) {
        __type(name: $name) {
          name
          kind
          fields {
            name
            description
            type { name kind ofType { name kind ofType { name kind } } }
          }
          inputFields {
            name
            type { name kind ofType { name kind } }
          }
          enumValues { name }
        }
      }
    `
    : `
      {
        __schema {
          queryType {
            fields { name description }
          }
        }
      }
    `;

  try {
    const res = await fetch(RAILWAY_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        variables: typeName ? { name: typeName } : undefined,
      }),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
