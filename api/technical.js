export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Cache-Control","s-maxage=300");
  if(req.method==="OPTIONS") return res.status(200).end();
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const {sym}=req.body||{};
  if(!sym) return res.status(400).json({error:"sym required"});

  const FREQS=[
    {key:"5m", interval:"5m",  range:"5d"},
    {key:"1h", interval:"60m", range:"60d"},
    {key:"1d", interval:"1d",  range:"1y"},
    {key:"1w", interval:"1wk", range:"5y"},
    {key:"1mo",interval:"1mo", range:"10y"},
  ];

  const ema=(a,n)=>{if(!a||a.length<n)return null;const k=2/(n+1);let v=a.slice(0,n).reduce((x,y)=>x+y,0)/n;for(let i=n;i<a.length;i++)v=a[i]*k+v*(1-k);return v;};

  function rsi(c,p=14){
    if(c.length<p+1)return null;
    let ag=0,al=0;
    for(let i=c.length-p;i<c.length;i++){const d=c[i]-c[i-1];d>0?ag+=d:al-=d;}
    ag/=p;al/=p;
    if(al===0)return 100;
    return 100-(100/(1+ag/al));
  }

  function macd(c){
    if(c.length<26)return null;
    const fast=ema(c,12),slow=ema(c,26);
    if(!fast||!slow)return null;
    const line=fast-slow;
    const hist=[];
    for(let i=26;i<=c.length;i++){const f=ema(c.slice(0,i),12),s=ema(c.slice(0,i),26);if(f&&s)hist.push(f-s);}
    const sig=hist.length>=9?ema(hist,9):null;
    const h=sig!=null?line-sig:null;
    const prevH=hist.length>=10&&sig?hist[hist.length-2]-ema(hist.slice(0,-1),9)||0:0;
    return{line,signal:sig,hist:h,cross:h!=null&&prevH!=null?(prevH<=0&&h>0?1:prevH>=0&&h<0?-1:0):0};
  }

  function bollinger(c,p=20){
    if(c.length<p)return null;
    const sl=c.slice(-p),mean=sl.reduce((a,b)=>a+b,0)/p;
    const std=Math.sqrt(sl.map(v=>(v-mean)**2).reduce((a,b)=>a+b,0)/p);
    const last=c[c.length-1];
    const pct=std>0?(last-(mean-2*std))/(4*std):0.5;
    return{pct,upper:mean+2*std,lower:mean-2*std,width:std>0?4*std/mean:0};
  }

  function stoch(c,h,l,kp=14){
    if(!h||!l||c.length<kp)return null;
    const hh=Math.max(...h.slice(-kp)),ll=Math.min(...l.slice(-kp));
    if(hh===ll)return{k:50,d:50};
    const k=((c[c.length-1]-ll)/(hh-ll))*100;
    const kVals=[];
    for(let i=kp;i<=c.length;i++){
      const hh2=Math.max(...h.slice(i-kp,i)),ll2=Math.min(...l.slice(i-kp,i));
      kVals.push(hh2===ll2?50:((c[i-1]-ll2)/(hh2-ll2))*100);
    }
    const d=kVals.length>=3?kVals.slice(-3).reduce((a,b)=>a+b,0)/3:k;
    return{k,d,prev:kVals.length>=2?kVals[kVals.length-2]:k};
  }

  function willr(c,h,l,p=14){
    if(!h||!l||c.length<p)return null;
    const hh=Math.max(...h.slice(-p)),ll=Math.min(...l.slice(-p));
    if(hh===ll)return -50;
    return((hh-c[c.length-1])/(hh-ll))*-100;
  }

  function roc(c,p=12){
    if(c.length<p+1)return null;
    const prev=c[c.length-1-p];
    return prev&&prev!==0?((c[c.length-1]-prev)/prev)*100:null;
  }

  function getThresh(k){
    const T={
      "5m": {rsiBuy:40,rsiSell:60,rocBuy:0.3,rocSell:-0.3},
      "1h": {rsiBuy:38,rsiSell:62,rocBuy:0.8,rocSell:-0.8},
      "1d": {rsiBuy:35,rsiSell:65,rocBuy:2.0,rocSell:-2.0},
      "1w": {rsiBuy:32,rsiSell:68,rocBuy:5.0,rocSell:-5.0},
      "1mo":{rsiBuy:30,rsiSell:70,rocBuy:10.0,rocSell:-10.0},
    };
    return T[k]||T["1d"];
  }

  function compute(closes,highs,lows,key){
    const last=closes[closes.length-1];
    const th=getThresh(key);
    let buy=0,sell=0,total=0;
    const indicators={};

    function vote(name,sig,val=null,extra=null){
      indicators[name]={signal:sig,value:val,extra};
      if(sig==="Compra")buy++;else if(sig==="Venta")sell++;
      total++;
    }

    // RSI
    const r=rsi(closes);
    if(r!=null){
      const prevR=closes.length>2?rsi(closes.slice(0,-1)):r;
      const rising=prevR!=null&&r>prevR;
      vote("rsi",
        r<th.rsiBuy?"Compra":r>th.rsiSell?"Venta":
        r<45&&!rising?"Venta":r>55&&rising?"Compra":"Neutral",
        r.toFixed(1));
    }

    // MACD — crossovers count double
    const m=macd(closes);
    if(m&&m.hist!=null){
      if(m.cross===1){buy++;total++;}
      else if(m.cross===-1){sell++;total++;}
      vote("macd",
        m.line>0&&m.hist>0?"Compra":
        m.line<0&&m.hist<0?"Venta":
        m.hist>0?"Compra":"Venta",
        m.line?.toFixed(4),`H:${m.hist?.toFixed(4)}`);
    }

    // Bollinger
    const b=bollinger(closes);
    if(b){
      vote("bollinger",
        b.pct<0.1?"Compra":b.pct>0.9?"Venta":
        b.pct<0.3?"Compra":b.pct>0.7?"Venta":"Neutral",
        (b.pct*100).toFixed(0)+"%");
    }

    // Stochastic — crossovers count double
    const st=stoch(closes,highs,lows);
    if(st){
      const cross=st.prev<st.d&&st.k>st.d?1:st.prev>st.d&&st.k<st.d?-1:0;
      if(cross===1&&st.k<50){buy++;total++;}
      else if(cross===-1&&st.k>50){sell++;total++;}
      vote("stochastic",
        st.k<25?"Compra":st.k>75?"Venta":
        st.k<40&&st.k>st.d?"Compra":
        st.k>60&&st.k<st.d?"Venta":"Neutral",
        st.k.toFixed(1),`D:${st.d.toFixed(1)}`);
    }

    // Williams %R
    const w=willr(closes,highs,lows);
    if(w!=null){
      vote("williams",
        w<-80?"Compra":w>-20?"Venta":
        w<-60?"Compra":w>-40?"Venta":"Neutral",
        w.toFixed(1));
    }

    // ROC
    const rc=roc(closes);
    if(rc!=null){
      vote("roc",
        rc>th.rocBuy*2?"Compra":rc<th.rocSell*2?"Venta":
        rc>th.rocBuy?"Compra":rc<th.rocSell?"Venta":"Neutral",
        rc.toFixed(2)+"%");
    }

    // EMA 9/21 cross
    const e9=ema(closes,9),e21=ema(closes,21);
    if(e9&&e21){
      vote("ema9_21",
        last>e9&&e9>e21?"Compra":
        last<e9&&e9<e21?"Venta":"Neutral",
        `${e9.toFixed(2)}/${e21.toFixed(2)}`);
    }

    // EMA 50
    const e50=ema(closes,50);
    if(e50){
      const d=(last-e50)/e50*100;
      vote("ema50",Math.abs(d)<0.2?"Neutral":d>0?"Compra":"Venta",e50.toFixed(2),d.toFixed(1)+"%");
    }

    // EMA 200
    const e200=ema(closes,200);
    if(e200){
      const d=(last-e200)/e200*100;
      vote("ema200",Math.abs(d)<0.3?"Neutral":d>0?"Compra":"Venta",e200.toFixed(2),d.toFixed(1)+"%");
    }

    if(total===0)return{signal:"Neutral",score:3,buyVotes:0,sellVotes:0,neutralVotes:0,totalVotes:0,indicators};

    const ratio=buy/total;
    let signal,score;
    if(ratio>=0.62){signal="Compra fuerte";score=5;}
    else if(ratio>=0.48){signal="Compra";score=4;}
    else if(ratio>=0.36){signal="Neutral";score=3;}
    else if(ratio>=0.22){signal="Venta";score=2;}
    else{signal="Venta fuerte";score=1;}

    return{signal,score,buyVotes:Math.round(buy),sellVotes:Math.round(sell),neutralVotes:Math.max(0,total-Math.round(buy)-Math.round(sell)),totalVotes:total,indicators};
  }

  const signals={};
  await Promise.all(FREQS.map(async({key,interval,range})=>{
    try{
      const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}`;
      const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},signal:AbortSignal.timeout(8000)});
      if(!r.ok)return;
      const data=await r.json();
      const result=data?.chart?.result?.[0];
      if(!result)return;
      const q=result.indicators?.quote?.[0]||{};
      const closes=(q.close||[]).filter(c=>c!=null);
      const highs=(q.high||[]).filter(c=>c!=null);
      const lows=(q.low||[]).filter(c=>c!=null);
      if(closes.length<5)return;
      signals[key]=compute(closes,highs,lows,key);
    }catch(e){}
  }));

  return res.status(200).json({sym,signals});
}
