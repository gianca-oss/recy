const RAILWAY_GRAPHQL = "https://backboard.railway.app/graphql/v2";

interface RailwayMetric {
  measurement: string;
  value: number;
}

export async function GET() {
  const token = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;

  if (!token) {
    return Response.json({ error: "RAILWAY_API_TOKEN not set" }, { status: 503 });
  }
  if (!projectId) {
    return Response.json({ error: "RAILWAY_PROJECT_ID not set" }, { status: 503 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const query = `
    query Usage($projectId: String!, $startDate: DateTime!, $endDate: DateTime!) {
      usage(
        projectId: $projectId
        startDate: $startDate
        endDate: $endDate
        measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, DISK_USAGE_GB]
      ) {
        measurement
        value
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
        variables: {
          projectId,
          startDate: startOfMonth.toISOString(),
          endDate: now.toISOString(),
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return Response.json(
        { error: `Railway API error: ${res.status} ${body}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    if (json.errors) {
      return Response.json({ error: json.errors }, { status: 502 });
    }

    const metrics: RailwayMetric[] = json.data?.usage ?? [];
    const map: Record<string, number> = {};
    for (const m of metrics) map[m.measurement] = m.value;

    return Response.json({
      periodStart: startOfMonth.toISOString(),
      periodEnd: now.toISOString(),
      cpuHours: map.CPU_USAGE ?? null,
      memoryGbHours: map.MEMORY_USAGE_GB ?? null,
      networkEgressGb: map.NETWORK_TX_GB ?? null,
      diskGb: map.DISK_USAGE_GB ?? null,
    });
  } catch (err) {
    console.error("GET /api/usage/railway error:", err);
    return Response.json({ error: "Failed to fetch Railway usage" }, { status: 500 });
  }
}
