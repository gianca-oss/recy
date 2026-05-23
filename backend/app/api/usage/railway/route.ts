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

    const plan: string | null = ws?.plan ?? null;
    // Hobby plan includes $5/mo usage credit, Pro $20/mo, Free $0.
    const includedUsd =
      plan === 'PRO' ? 20 :
      plan === 'HOBBY' ? 5 :
      0;
    const currentUsageUsd: number = customer?.currentUsage ?? 0;
    const remainingIncludedUsd = Math.max(0, includedUsd - currentUsageUsd);

    // Bill breakdown from published Railway pricing.
    // API metrics: CPU_USAGE/MEMORY_USAGE_GB/DISK_USAGE_GB are in (m)inutely units,
    // NETWORK_TX_GB is total GB.
    const PRICE_PER_VCPU_MINUTE = 0.000463;
    const PRICE_PER_GB_MEM_MINUTE = 0.000231;
    const PRICE_PER_GB_EGRESS = 0.05;
    const PRICE_PER_GB_VOLUME_MINUTE = 0.000003;

    const cpuVal = map.CPU_USAGE ?? 0;
    const memVal = map.MEMORY_USAGE_GB ?? 0;
    const egressVal = map.NETWORK_TX_GB ?? 0;
    const diskVal = map.DISK_USAGE_GB ?? 0;

    const breakdown = [
      { label: 'Memoria', units: memVal, unitLabel: 'GB·min', cost: memVal * PRICE_PER_GB_MEM_MINUTE },
      { label: 'CPU', units: cpuVal, unitLabel: 'vCPU·min', cost: cpuVal * PRICE_PER_VCPU_MINUTE },
      { label: 'Traffico in uscita', units: egressVal, unitLabel: 'GB', cost: egressVal * PRICE_PER_GB_EGRESS },
      { label: 'Disco (Volume)', units: diskVal, unitLabel: 'GB·min', cost: diskVal * PRICE_PER_GB_VOLUME_MINUTE },
    ];
    const breakdownSubtotal = breakdown.reduce((a, b) => a + b.cost, 0);

    return Response.json({
      periodStart: customer?.billingPeriod?.start ?? startOfMonth.toISOString(),
      periodEnd: customer?.billingPeriod?.end ?? null,
      plan,
      currentUsageUsd,
      includedUsd,
      remainingIncludedUsd: Number(remainingIncludedUsd.toFixed(2)),
      creditBalanceUsd: customer?.creditBalance ?? null,
      appliedCreditsUsd: customer?.appliedCredits ?? null,
      hasExhaustedFreePlan: customer?.hasExhaustedFreePlan ?? null,
      isTrialing: customer?.isTrialing ?? null,
      trialDaysRemaining: customer?.trialDaysRemaining ?? null,
      breakdown: breakdown.map((b) => ({
        label: b.label,
        units: Number(b.units.toFixed(2)),
        unitLabel: b.unitLabel,
        costUsd: Number(b.cost.toFixed(4)),
      })),
      breakdownSubtotalUsd: Number(breakdownSubtotal.toFixed(4)),
    });
  } catch (err) {
    console.error("GET /api/usage/railway error:", err);
    return Response.json({ error: "Failed to fetch Railway usage" }, { status: 500 });
  }
}
