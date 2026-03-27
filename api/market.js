export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Cache-Control","s-maxage=300");
  if(req.method==="OPTIONS") return res.status(200).end();

  const {symbols, mode, range} = req.query;
  if(!symbols) return res.status(400).json({error:"symbols required"});
  const symbolList = symbols.split(",").slice(0,40).map(s=>s.trim());

  // ── MODE: chart — single symbol historical prices ──────────────────────────
  if(mode==="chart"){
    const sym = symbolList[0];
    const r = range||"6mo";
    const intervals = {
      "1mo":"1d","3mo":"1d","6mo":"1d","1y":"1d",
      "2y":"1wk","5y":"1wk","10y":"1mo"
    };
    const interval = intervals[r]||"1d";
    try{
      const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${r}`;
      const resp=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(8000)});
      if(!resp.ok) return res.status(200).json({prices:[]});
      const data=await resp.json();
      const result=data?.chart?.result?.[0];
      if(!result) return res.status(200).json({prices:[]});
      const timestamps=result.timestamp||[];
      const closes=result.indicators?.quote?.[0]?.close||[];
      const prices=timestamps.map((t,i)=>({
        date:new Date(t*1000).toISOString().slice(0,10),
        close:closes[i]
      })).filter(p=>p.close!=null);
      return res.status(200).json({prices});
    }catch(e){
      return res.status(200).json({prices:[]});
    }
  }

  // ── MODE: perf_bulk — all symbols performance ──────────────────────────────
  if(mode==="perf_bulk"){
    const RANGES=[
      {key:"1d",range:"5d",  interval:"1d"},
      {key:"1w",range:"1mo", interval:"1d"},
      {key:"1m",range:"1mo", interval:"1d"},
      {key:"3m",range:"3mo", interval:"1wk"},
      {key:"6m",range:"6mo", interval:"1wk"},
      {key:"ytd",range:"ytd",interval:"1mo"},
      {key:"1y",range:"1y",  interval:"1mo"},
      {key:"3y",range:"3y",  interval:"3mo"},
      {key:"5y",range:"5y",  interval:"3mo"},
      {key:"10y",range:"10y",interval:"3mo"},
    ];
    const allPerf={};
    await Promise.all(
      symbolList.flatMap(sym=>
        RANGES.map(async({key,range,interval})=>{
          try{
            const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}`;
            const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(8000)});
            if(!r.ok)return;
            const data=await r.json();
            const result=data?.chart?.result?.[0];
            if(!result)return;
            if(!allPerf[sym])allPerf[sym]={};
            const closes=(result.indicators?.quote?.[0]?.close||[]).filter(c=>c!=null);
            if(closes.length<2)return;
            if(key==="1d"){
              const meta=result.meta;
              const prev=meta?.chartPreviousClose||meta?.previousClose||closes[0];
              const curr=meta?.regularMarketPrice||closes[closes.length-1];
              allPerf[sym][key]=prev>0?((curr-prev)/prev)*100:null;
            }else{
              allPerf[sym][key]=closes[0]>0?((closes[closes.length-1]-closes[0])/closes[0])*100:null;
            }
          }catch(e){}
        })
      )
    );
    return res.status(200).json(allPerf);
  }

  // ── DEFAULT: current prices ────────────────────────────────────────────────
  const results={};
  await Promise.all(symbolList.map(async(sym)=>{
    try{
      const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
      const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(8000)});
      if(!r.ok)return;
      const data=await r.json();
      const meta=data?.chart?.result?.[0]?.meta;
      if(!meta)return;
      results[sym]={
        price:meta.regularMarketPrice,
        prev:meta.chartPreviousClose||meta.previousClose,
        name:meta.longName||meta.shortName||sym,
        currency:meta.currency,
      };
    }catch(e){}
  }));
  return res.status(200).json(results);
}
