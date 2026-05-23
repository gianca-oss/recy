const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY_EVO || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Nessuna API key Anthropic configurata" }, { status: 503 });
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    const body = await res.text();
    return Response.json({
      ok: res.ok,
      status: res.status,
      model,
      response: body.slice(0, 800),
    }, { status: res.ok ? 200 : 502 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
