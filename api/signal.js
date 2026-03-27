// api/signal.js — Trading signals via Claude AI
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=900"); // 15min cache

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { sym, name, perf } = req.body || {};
  if (!sym) return res.status(400).json({ error: "sym required" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const perfStr = perf ? Object.entries(perf).map(([k,v])=>`${k}: ${v!=null?v.toFixed(2)+'%':'N/A'}`).join(', ') : 'no disponible';

  const prompt = `Eres un analista técnico experto. Analiza el activo "${name}" (${sym}).

Rendimientos históricos conocidos: ${perfStr}

Basándote en estos datos y en tu conocimiento del activo, genera señales de trading para 5 frecuencias.
Responde SOLO con este JSON exacto, sin markdown:
{
  "signal_15m": {"signal":"Compra fuerte|Compra|Neutral|Venta|Venta fuerte","score":1-5,"reason":"razón breve"},
  "signal_1h":  {"signal":"Compra fuerte|Compra|Neutral|Venta|Venta fuerte","score":1-5,"reason":"razón breve"},
  "signal_1d":  {"signal":"Compra fuerte|Compra|Neutral|Venta|Venta fuerte","score":1-5,"reason":"razón breve"},
  "signal_1w":  {"signal":"Compra fuerte|Compra|Neutral|Venta|Venta fuerte","score":1-5,"reason":"razón breve"},
  "signal_1mo": {"signal":"Compra fuerte|Compra|Neutral|Venta|Venta fuerte","score":1-5,"reason":"razón breve"},
  "summary": "resumen breve del análisis en 1 frase"
}
score: 1=Venta fuerte, 2=Venta, 3=Neutral, 4=Compra, 5=Compra fuerte.
IMPORTANTE: Incluye disclaimer que esto NO es asesoramiento financiero.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Error API: " + response.status });
    }

    const data = await response.json();
    const text = (data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim();
    let result = {};
    try { result = JSON.parse(text); } catch(e) {}
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
