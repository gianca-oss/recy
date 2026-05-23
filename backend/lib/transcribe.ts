const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export interface TranscriptionResult {
  text: string;
  languageCode: string | null;
  words: Array<{ text: string; start: number; end: number; type?: string }>;
  raw: unknown;
}

export async function transcribeAudio(
  audioUrl: string,
  contentType: string = "audio/mp4"
): Promise<TranscriptionResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(`Failed to download audio: ${audioRes.status}`);
  }
  const audioBlob = await audioRes.blob();

  const form = new FormData();
  form.append("file", audioBlob, "audio.m4a");
  form.append("model_id", "scribe_v1");
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");

  const res = await fetch(ELEVENLABS_STT_URL, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`ElevenLabs STT failed: ${res.status} ${errBody}`);
  }

  const data = await res.json();

  return {
    text: data.text ?? "",
    languageCode: data.language_code ?? null,
    words: data.words ?? [],
    raw: data,
  };
}
