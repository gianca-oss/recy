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

    // Railway pricing (Hobby/Pro, as of 2025):
    // CPU $0.027/vCPU-hour, RAM $0.0139/GB-hour,
    // Egress $0.05/GB, Disk $0.15/GB/mo prorated
    const cpu = map.CPU_USAGE ?? 0;
    const mem = map.MEMORY_USAGE_GB ?? 0;
    const egress = map.NETWORK_TX_GB ?? 0;
    const disk = map.DISK_USAGE_GB ?? 0;

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const elapsedDays = (now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24);
    const diskCost = disk * 0.15 * (elapsedDays / daysInMonth);

    const estimatedCost =
      cpu * 0.027 + mem * 0.0139 + egress * 0.05 + diskCost;

    // Pro plan includes $20/mo, Hobby includes $5/mo.
    // Default assumption: Hobby. Override with RAILWAY_PLAN_INCLUDED_USD env var.
    const includedCredit = parseFloat(process.env.RAILWAY_PLAN_INCLUDED_USD || "5");
    const remainingCredit = Math.max(0, includedCredit - estimatedCost);

    return Response.json({
      periodStart: startOfMonth.toISOString(),
      periodEnd: now.toISOString(),
      cpuHours: cpu,
      memoryGbHours: mem,
      networkEgressGb: egress,
      diskGb: disk,
      estimatedCostUsd: Number(estimatedCost.toFixed(2)),
      includedCreditUsd: includedCredit,
      remainingCreditUsd: Number(remainingCredit.toFixed(2)),
    });
  } catch (err) {
    console.error("GET /api/usage/railway error:", err);
    return Response.json({ error: "Failed to fetch Railway usage" }, { status: 500 });
  }
}
