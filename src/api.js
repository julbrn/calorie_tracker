const GEMINI_MODEL = "gemini-3-flash-preview";

export async function callGemini(apiKey, b64, mime, text) {
  const parts = [];
  if (b64) parts.push({ inline_data: { mime_type: mime, data: b64 } });

  const prompt = b64
    ? `Food image${text ? `, also: "${text}"` : ""}. Identify items, estimate calories. All text in Russian. Respond ONLY with raw JSON (no markdown): {"items":[{"name":"название на русском","calories":N}],"total":N,"description":"краткое описание на русском"}`
    : `Estimate calories for: "${text}". All text in Russian. Respond ONLY with raw JSON (no markdown): {"items":[{"name":"название на русском","calories":N}],"total":N,"description":"краткое описание на русском"}`;
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    },
  );

  if (!res.ok) {
    let msg = "";
    try {
      const ej = await res.json();
      msg = ej?.error?.message || "";
    } catch (e) {}
    throw new Error(`HTTP ${res.status}${msg ? ": " + msg : ""}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Неверный формат ответа");

  const parsed = JSON.parse(match[0]);
  if (!parsed.items?.length) throw new Error("Еда не распознана");
  return parsed;
}
