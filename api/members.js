// api/members.js — Get index members from Yahoo Finance
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=3600"); // 1h cache

  if (req.method === "OPTIONS") return res.status(200).end();

  const { index } = req.query;
  if (!index) return res.status(400).json({ error: "index required" });

  // Predefined member lists for major indices
  const MEMBERS = {
    "^IBEX": [
      "ACS.MC","ACX.MC","ANA.MC","BBVA.MC","BKT.MC","CABK.MC","CLNX.MC","COL.MC",
      "ELE.MC","ENG.MC","FER.MC","GRF.MC","IAG.MC","IBE.MC","IDR.MC","ITX.MC",
      "LOG.MC","MAP.MC","MEL.MC","MRL.MC","MTS.MC","NTGY.MC","RED.MC","REP.MC",
      "ROVI.MC","SAB.MC","SAN.MC","SCYR.MC","SOL.MC","TEF.MC","UNI.MC","VIS.MC"
    ],
    "^GDAXI": [
      "ADS.DE","AIR.DE","ALV.DE","BAS.DE","BAYN.DE","BEI.DE","BMW.DE","BNR.DE",
      "CON.DE","1COV.DE","DHER.DE","DHL.DE","DTE.DE","EOAN.DE","FRE.DE","HEI.DE",
      "HEN3.DE","IFX.DE","LIN.DE","MBG.DE","MRK.DE","MTX.DE","MUV2.DE","PAH3.DE",
      "PORK.DE","RHM.DE","RWE.DE","SAP.DE","SHL.DE","SIE.DE","SRT3.DE","VOW3.DE","VNA.DE","ZAL.DE"
    ],
    "^FCHI": [
      "AI.PA","AIR.PA","ALO.PA","ATO.PA","BN.PA","BNP.PA","CA.PA","CAP.PA","CS.PA",
      "DG.PA","DSY.PA","ENGI.PA","EL.PA","EN.PA","ERF.PA","GLE.PA","HO.PA","KER.PA",
      "LR.PA","MC.PA","ML.PA","MT.PA","ORA.PA","PUB.PA","RI.PA","RMS.PA","SAF.PA",
      "SAN.PA","SGO.PA","STLAP.PA","STM.PA","SU.PA","TTE.PA","URW.PA","VIE.PA","VIV.PA","WLN.PA"
    ],
    "^FTSE": [
      "AAL.L","ABF.L","ADM.L","AHT.L","ANTO.L","AZN.L","BA.L","BARC.L","BATS.L",
      "BKG.L","BP.L","BREN.L","BT-A.L","CCH.L","COB.L","CPG.L","CRH.L","DGE.L",
      "EDV.L","EXPN.L","EZJ.L","FERG.L","FLTR.L","GSK.L","HLMA.L","HSBA.L","IAG.L",
      "IHG.L","IMB.L","INF.L","ITV.L","JD.L","KGF.L","LAND.L","LGEN.L","LLOY.L",
      "LSE.L","MKS.L","MNDI.L","MNG.L","MRO.L","NG.L","NWG.L","NXT.L","PHNX.L",
      "PRU.L","PSH.L","PSN.L","PSON.L","REL.L","RIO.L","RKT.L","RR.L","RS1.L",
      "SGE.L","SHEL.L","SKG.L","SMT.L","SN.L","SPX.L","SSE.L","STAN.L","STJ.L",
      "SVT.L","TSCO.L","TW.L","ULVR.L","UTG.L","UU.L","VOD.L","WEIR.L","WPP.L"
    ],
    "^GSPC": [
      "AAPL","MSFT","NVDA","AMZN","META","GOOGL","GOOG","BRK-B","LLY","AVGO",
      "JPM","TSLA","UNH","V","XOM","MA","JNJ","PG","COST","HD","ABBV","WMT","BAC",
      "MRK","CVX","NFLX","KO","AMD","PEP","CRM","TMO","ORCL","LIN","ACN","MCD",
      "ABT","GE","QCOM","CSCO","DHR","GS","TXN","NOW","CAT","ISRG","IBM","BKNG",
      "PM","RTX","AMGN","SPGI","AMAT","INTU","BLK","LOW","SYK","AXP","PLD","VRTX"
    ],
    "^IXIC": [
      "AAPL","MSFT","NVDA","AMZN","META","GOOGL","TSLA","AVGO","COST","NFLX",
      "AMD","QCOM","INTU","AMAT","ISRG","BKNG","TXN","CSCO","MRVL","ADP",
      "PANW","LRCX","MU","ADI","KLAC","ASML","CDNS","CRWD","MELI","SNPS",
      "ORLY","CEG","FTNT","ABNB","MAR","PCAR","WDAY","MNST","ADSK","CTAS"
    ],
    "^DJI": [
      "AAPL","AMGN","AXP","BA","CAT","CRM","CSCO","CVX","DIS","DOW",
      "GS","HD","HON","IBM","INTC","JNJ","JPM","KO","MCD","MMM",
      "MRK","MSFT","NKE","PG","SHW","TRV","UNH","V","VZ","WMT"
    ],
    "^N225": [
      "7203.T","9984.T","6758.T","8306.T","7974.T","4063.T","6367.T","9432.T",
      "8035.T","6861.T","4502.T","7751.T","8058.T","9433.T","3382.T","2914.T",
      "7267.T","4543.T","6501.T","8316.T","5108.T","8802.T","6098.T","7011.T"
    ],
    "^HSI": [
      "0700.HK","0941.HK","1299.HK","0005.HK","0883.HK","2318.HK","1398.HK",
      "0939.HK","3690.HK","2020.HK","9988.HK","1810.HK","0388.HK","2382.HK",
      "0016.HK","0011.HK","0012.HK","0002.HK","0003.HK","1177.HK"
    ],
    "^STOXX50E": [
      "ABI.BR","AD.AS","AI.PA","AIR.PA","ALV.DE","ASML.AS","AZN.L","BAS.DE",
      "BAYN.DE","BBVA.MC","BMW.DE","BN.PA","BNP.PA","CS.PA","DG.PA","EL.PA",
      "ENGI.PA","ENI.MI","EXO1.MI","IFX.DE","INGA.AS","ISP.MI","ITX.MC","KER.PA",
      "LIN.DE","MC.PA","MBG.DE","MUV2.DE","OR.PA","ORA.PA","PHIA.AS","REP.MC",
      "RMS.PA","RWE.DE","SAF.PA","SAN.MC","SAP.DE","SAN.PA","SGO.PA","SIE.DE",
      "STLAM.MI","SU.PA","TTE.PA","UCG.MI","UNA.AS","VIV.PA","VOW3.DE"
    ],
  };

  const syms = MEMBERS[index];
  if (!syms) return res.status(404).json({ error: "Index not found", available: Object.keys(MEMBERS) });

  // Fetch prices for all members in parallel
  const results = {};
  await Promise.all(syms.map(async (sym) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) return;
      const data = await r.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta || !meta.regularMarketPrice) return;
      results[sym] = {
        price: meta.regularMarketPrice,
        prev:  meta.chartPreviousClose || meta.previousClose,
        name:  meta.shortName || meta.longName || sym,
        currency: meta.currency,
      };
    } catch {}
  }));

  return res.status(200).json({ index, members: syms, prices: results });
}
