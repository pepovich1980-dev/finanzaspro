export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query, mode } = req.body || {};
  if (!query || query.trim().length < 2) return res.status(400).json({ error: "Query demasiado corta" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada" });

  // mode=screener: return larger list for screener universe building
  const isScreener = mode === "screener";
  const maxResults = isScreener ? 50 : 10;

  const prompt = isScreener
    ? `Eres un experto en mercados financieros globales. El usuario quiere hacer un screener sobre: "${query.trim()}".

Devuelve una lista AMPLIA y COMPLETA de acciones cotizadas que encajan con esa descripción. Incluye empresas de TODO EL MUNDO relevantes para esa categoría.

Responde SOLO con JSON array sin markdown:
[{"name":"Nombre","ticker":"TICKER","type":"Acciones|ETF|Fondo inversión","exchange":"Bolsa","currency":"EUR|USD|etc"}]

Reglas de ticker:
- España: SAN.MC, BBVA.MC, ITX.MC, TEF.MC, REP.MC, IBE.MC, CABK.MC, ACS.MC, FER.MC
- Alemania: SAP.DE, SIE.DE, ALV.DE, BMW.DE, VOW3.DE, BAYN.DE, ADS.DE, MBG.DE
- Francia: MC.PA, OR.PA, TTE.PA, BNP.PA, AIR.PA, SAN.PA, KER.PA
- UK: SHEL.L, AZN.L, HSBA.L, BP.L, GSK.L, ULVR.L, RIO.L
- USA: AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA, JPM, JNJ, V, UNH, PG, MA, HD
- Italia: ENI.MI, ISP.MI, UCG.MI, STM.MI, ENEL.MI
- Holanda: ASML.AS, HEIA.AS, PHIA.AS, ING.AS
- Suiza: NOVN.SW, ROG.SW, NESN.SW, ZURN.SW
- Japón: 7203.T, 6758.T, 9984.T, 6861.T, 9432.T
- China/HK: 0700.HK, 0939.HK, BABA, 9988.HK, 0005.HK
- Korea: 005930.KS, 000660.KS
- Taiwan: TSM, 2330.TW
- ETFs globales: VWCE.DE, IWDA.AS, CSPX.L, SPY, QQQ, EQQQ.DE, IEMM.AS

Devuelve ${maxResults} resultados o más si hay muchas empresas relevantes. Sé GENEROSO con los resultados.`

    : `Busca el activo financiero: "${query.trim()}". Responde SOLO con JSON array sin markdown:
[{"name":"Nombre completo","ticker":"TICKER","type":"Acciones|ETF|Fondo inversión|Bono","exchange":"Bolsa","currency":"EUR|USD","isin":""}]
Reglas: españolas=SAN.MC BBVA.MC, europeas=sufijo .PA .DE .MI .AS .L, USA=AAPL MSFT (sin sufijo), ETFs=VWCE.DE IWDA.AS. Máximo ${maxResults} resultados.`;

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
        max_tokens: isScreener ? 3000 : 800,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("API failed:", response.status, err.slice(0, 200));
      return res.status(502).json({ error: "Error API: " + response.status });
    }

    const data = await response.json();
    const text = (data.content?.[0]?.text || "[]").replace(/```json|```/g, "").trim();
    let results = [];
    try { results = JSON.parse(text); } catch(e) {}
    return res.status(200).json({ 
      results: Array.isArray(results) ? results.filter(r => r.name && r.ticker) : [] 
    });

  } catch (err) {
    console.error("Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
