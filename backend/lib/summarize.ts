const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `Sei un assistente che aiuta studenti universitari a studiare le proprie lezioni a partire da una trascrizione testuale.

Produci un riassunto strutturato della lezione in italiano. Mantieni un tono chiaro, preciso e didattico. Non inventare contenuti: se la trascrizione è poco chiara per via di errori di trascrizione, segnalalo brevemente in fondo.

Struttura della risposta in Markdown:

# Titolo sintetico
Una riga che descriva l'argomento della lezione.

## Argomenti trattati
- elenco puntato dei temi principali, nell'ordine in cui compaiono

## Sintesi
3–6 paragrafi che spiegano i contenuti chiave, riformulati in modo organico (non copia/incolla).

## Concetti e definizioni
- termine — definizione concisa
(includi solo termini realmente trattati nella lezione)

## Esempi e applicazioni
- eventuali esempi pratici o applicazioni menzionate

## Punti da approfondire
- aspetti citati ma non sviluppati, o concetti che meritano studio aggiuntivo

Se mancano contenuti per una sezione, ometti la sezione invece di scrivere "nessuno".`;

export async function summarizeTranscript(text: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY_EVO || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY_EVO or ANTHROPIC_API_KEY not set");

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Ecco la trascrizione della lezione. Producine il riassunto come richiesto.\n\n---\n${text}\n---`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const block = Array.isArray(data.content) ? data.content[0] : null;
  if (!block || block.type !== "text" || typeof block.text !== "string") {
    throw new Error("Unexpected Anthropic response shape");
  }
  return block.text;
}
