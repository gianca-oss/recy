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

  // Resolve workspaceId from the token first.
  const tokenQuery = `{ apiToken { workspaces { id } } }`;
  const tokenRes = await fetch(RAILWAY_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: tokenQuery }),
  });
  const tokenJson = await tokenRes.json();
  const workspaceId: string | undefined =
    tokenJson?.data?.apiToken?.workspaces?.[0]?.id;
  if (!workspaceId) {
    return Response.json(
      { error: "Could not resolve workspaceId from token" },
      { status: 502 }
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const query = `
    query Usage($projectId: String!, $workspaceId: String!, $startDate: DateTime!, $endDate: DateTime!) {
      usage(
        projectId: $projectId
        startDate: $startDate
        endDate: $endDate
        measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, DISK_USAGE_GB]
      ) {
        measurement
        value
      }
      workspace(workspaceId: $workspaceId) {
        plan
        customer {
          currentUsage
          creditBalance
          remainingUsageCreditBalance
          appliedCredits
          hasExhaustedFreePlan
          isTrialing
          trialDaysRemaining
          billingPeriod {
            start
            end
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(RAILWAY_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query,
        variables: {
          projectId,
          workspaceId,
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

    const ws = json.data?.workspace;
    const customer = ws?.customer;

    return Response.json({
      periodStart: customer?.billingPeriod?.start ?? startOfMonth.toISOString(),
      periodEnd: customer?.billingPeriod?.end ?? null,
      plan: ws?.plan ?? null,
      cpuHours: map.CPU_USAGE ?? null,
      memoryGbHours: map.MEMORY_USAGE_GB ?? null,
      networkEgressGb: map.NETWORK_TX_GB ?? null,
      diskGb: map.DISK_USAGE_GB ?? null,
      currentUsageUsd: customer?.currentUsage ?? null,
      creditBalanceUsd: customer?.creditBalance ?? null,
      remainingUsageCreditUsd: customer?.remainingUsageCreditBalance ?? null,
      appliedCreditsUsd: customer?.appliedCredits ?? null,
      hasExhaustedFreePlan: customer?.hasExhaustedFreePlan ?? null,
      isTrialing: customer?.isTrialing ?? null,
      trialDaysRemaining: customer?.trialDaysRemaining ?? null,
    });
  } catch (err) {
    console.error("GET /api/usage/railway error:", err);
    return Response.json({ error: "Failed to fetch Railway usage" }, { status: 500 });
  }
}
