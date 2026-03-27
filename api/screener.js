// api/screener.js — Fundamentals via Claude AI (Yahoo Finance blocks server requests)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=86400"); // 24h cache - data doesn't change often

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { symbols } = req.body || {};
  if (!symbols || !symbols.length) return res.status(400).json({ error: "symbols required" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const syms = symbols.slice(0, 15);
  
  const prompt = `Eres un experto en datos financieros. Para cada uno de estos activos cotizados, devuelve datos fundamentales aproximados basados en tu conocimiento (datos del último año fiscal disponible):

Activos: ${syms.join(", ")}

Responde SOLO con un JSON object, sin markdown, sin texto extra:
{
  "TICKER": {
    "marketCap": número_en_USD_o_null,
    "per": ratio_PER_o_null,
    "ebitdaMargin": decimal_entre_0_y_1_o_null,
    "roic": decimal_puede_ser_negativo_o_null,
    "revenueGrowth": decimal_puede_ser_negativo_o_null,
    "currency": "USD" o "EUR" o moneda_local
  }
}

Reglas:
- marketCap en USD (ej: Apple ~3000000000000, Santander ~70000000000)
- per: ratio precio/beneficio (ej: 25.5). null si pérdidas o no aplica
- ebitdaMargin: margen EBITDA como decimal (ej: 0.25 = 25%)
- roic: retorno sobre capital invertido como decimal (ej: 0.15 = 15%)
- revenueGrowth: crecimiento de ingresos YoY como decimal (ej: 0.08 = 8%, -0.05 = -5%)
- Si no conoces el activo con certeza, usa null para ese campo
- Incluye TODOS los tickers de la lista`;

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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      console.error("Claude API error:", response.status);
      return res.status(502).json({ error: "API error: " + response.status });
    }

    const data = await response.json();
    const text = (data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim();
    
    let results = {};
    try {
      results = JSON.parse(text);
    } catch (e) {
      console.error("Parse error:", e.message, text.slice(0, 200));
      return res.status(200).json({});
    }

    // Normalize — ensure all requested symbols are in response
    syms.forEach(sym => {
      if (!results[sym]) results[sym] = { marketCap: null, per: null, ebitdaMargin: null, roic: null, revenueGrowth: null, currency: "USD" };
    });

    return res.status(200).json(results);

  } catch (err) {
    console.error("Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
