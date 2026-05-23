export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) {
      const body = await res.text();
      return Response.json(
        { error: `ElevenLabs API error: ${res.status} ${body}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return Response.json({
      tier: data.tier,
      characterCount: data.character_count,
      characterLimit: data.character_limit,
      canExtendCharacterLimit: data.can_extend_character_limit,
      nextResetUnix: data.next_character_count_reset_unix,
      status: data.status,
      currency: data.currency,
    });
  } catch (err) {
    console.error("GET /api/usage/elevenlabs error:", err);
    return Response.json({ error: "Failed to fetch ElevenLabs usage" }, { status: 500 });
  }
}
