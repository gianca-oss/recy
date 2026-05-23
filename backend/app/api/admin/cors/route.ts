import { configureCors, getCors } from "@/lib/s3";

export async function POST() {
  try {
    await configureCors();
    const rules = await getCors();
    return Response.json({ applied: true, rules });
  } catch (err) {
    console.error("CORS apply failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const rules = await getCors();
    return Response.json({ rules });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
