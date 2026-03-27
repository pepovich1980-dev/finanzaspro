// api/yahoo.js — Proxy para Yahoo Finance (evita CORS)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=180");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { ticker, range, interval } = req.query;
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range || "1y"}&interval=${interval || "1d"}&includePrePost=false`;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return res.status(r.status).json({ error: `Yahoo ${r.status}` });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
