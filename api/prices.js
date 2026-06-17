// Serverless function — runs on Vercel's servers, NOT in the browser.
// Your Alpaca keys stay private here (set as env vars in the Vercel dashboard).

const TICKERS = ["NVDA", "GEV", "AMZN", "LLY", "HBM", "AVGE", "VOO", "QQQ", "SCHD"];

export default async function handler(req, res) {
  const key = process.env.ALPACA_KEY;
  const secret = process.env.ALPACA_SECRET;

  if (!key || !secret) {
    res.status(500).json({ error: "Server missing ALPACA_KEY / ALPACA_SECRET env vars" });
    return;
  }

  const url = `https://data.alpaca.markets/v2/stocks/trades/latest?symbols=${TICKERS.join(",")}&feed=iex`;

  try {
    const apiRes = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
        "Accept": "application/json",
      },
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(() => "");
      res.status(apiRes.status).json({ error: `Alpaca ${apiRes.status}`, detail: detail.slice(0, 200) });
      return;
    }

    const data = await apiRes.json();
    const out = {};
    if (data?.trades) {
      for (const [ticker, trade] of Object.entries(data.trades)) {
        if (trade && typeof trade.p === "number" && trade.p > 0) {
          out[ticker] = trade.p;
        }
      }
    }

    if (Object.keys(out).length === 0) {
      res.status(502).json({ error: "No prices returned from Alpaca" });
      return;
    }

    // Cache for 30s at the edge to avoid hammering Alpaca on rapid refreshes
    res.setHeader("Cache-Control", "public, s-maxage=30");
    res.status(200).json(out);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
