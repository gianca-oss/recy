const RAILWAY_GRAPHQL = "https://backboard.railway.app/graphql/v2";

export async function GET() {
  const token = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  if (!token || !projectId) {
    return Response.json({ error: "missing env" }, { status: 503 });
  }

  const query = `
    query($projectId: String!) {
      estimatedUsage(
        projectId: $projectId
        measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, DISK_USAGE_GB, BACKUP_USAGE_GB]
      ) {
        measurement
        estimatedValue
        projectId
      }
      apiToken {
        workspaces { id name }
      }
    }
  `;

  const res = await fetch(RAILWAY_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables: { projectId } }),
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}
