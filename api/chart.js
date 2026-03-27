// api/chart.js — OHLCV data for charts
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Cache-Control","s-maxage=300");
  if(req.method==="OPTIONS") return res.status(200).end();

  const {sym,range="1y",interval="1d"}=req.query;
  if(!sym) return res.status(400).json({error:"sym required"});

  try{
    const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}`;
    const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(8000)});
    if(!r.ok) return res.status(502).json({error:"Yahoo error "+r.status});
    const data=await r.json();
    const result=data?.chart?.result?.[0];
    if(!result) return res.status(404).json({error:"No data"});
    const meta=result.meta||{};
    const ts=result.timestamp||[];
    const q=result.indicators?.quote?.[0]||{};
    const adj=result.indicators?.adjclose?.[0]?.adjclose||[];
    const candles=ts.map((t,i)=>({
      t:t*1000,
      o:q.open?.[i],c:q.close?.[i],h:q.high?.[i],l:q.low?.[i],v:q.volume?.[i],
    })).filter(c=>c.c!=null);
    return res.status(200).json({
      sym,name:meta.longName||meta.shortName||sym,
      currency:meta.currency,exchange:meta.exchangeName,
      candles,
      currentPrice:meta.regularMarketPrice,
      previousClose:meta.chartPreviousClose||meta.previousClose,
    });
  }catch(e){
    return res.status(500).json({error:e.message});
  }
}
