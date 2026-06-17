// Serverless function — runs on Vercel's servers, NOT in the browser.
// Your Alpaca keys stay private here (set as env vars in the Vercel dashboard).
//
// Returns BOTH:
//   current — the latest live price for each ticker
//   base    — each ticker's OPENING price on the competition start date below
//
// Gains are always measured from that fixed opening price, so everyone starts
// at $300 as of the market open on ANCHOR_DATE and the standings update live.

const TICKERS = ["NVDA", "GEV", "AMZN", "LLY", "HBM", "AVGE", "VOO", "QQQ", "SCHD", "SGOV", "GDX", "SPMO"];

// Fixed starting line: the trading day the league began. Gains are measured
// from this day's market open and stay anchored here permanently.
// ANCHOR_END is the day after, so the daily-bar query returns exactly the
// anchor day's bar (Alpaca treats the range end as exclusive of the next day).
const ANCHOR_DATE = "2026-06-17";
const ANCHOR_END = "2026-06-18";

export default async function handler(req, res) {
  const key = process.env.ALPACA_KEY;
  const secret = process.env.ALPACA_SECRET;

  if (!key || !secret) {
    res.status(500).json({ error: "Server missing ALPACA_KEY / ALPACA_SECRET env vars" });
    return;
  }

  const headers = {
    "APCA-API-KEY-ID": key,
    "APCA-API-SECRET-KEY": secret,
    "Accept": "application/json",
  };
  const symbols = TICKERS.join(",");

  // Latest live trade for each ticker (current price)
  const latestUrl = `https://data.alpaca.markets/v2/stocks/trades/latest?symbols=${symbols}&feed=iex`;
  // Daily bar for the anchor date — its open `o` is that day's market open
  // (the starting line). The narrow date range returns just that day's bar per
  // ticker, and we read the first (earliest) bar below.
  const barsUrl = `https://data.alpaca.markets/v2/stocks/bars?symbols=${symbols}&timeframe=1Day&start=${ANCHOR_DATE}&end=${ANCHOR_END}&feed=iex&adjustment=split`;

  try {
    const [latestRes, barsRes] = await Promise.all([
      fetch(latestUrl, { headers }),
      fetch(barsUrl, { headers }),
    ]);

    if (!latestRes.ok) {
      const detail = await latestRes.text().catch(() => "");
      res.status(latestRes.status).json({ error: `Alpaca ${latestRes.status}`, detail: detail.slice(0, 200) });
      return;
    }

    const latestData = await latestRes.json();
    const current = {};
    if (latestData?.trades) {
      for (const [ticker, trade] of Object.entries(latestData.trades)) {
        if (trade && typeof trade.p === "number" && trade.p > 0) {
          current[ticker] = trade.p;
        }
      }
    }

    // Opening prices for the anchor date. Non-fatal if this fails — the app
    // simply shows "—" for gains until the opening data is available.
    const base = {};
    if (barsRes.ok) {
      const barsData = await barsRes.json();
      if (barsData?.bars) {
        for (const [ticker, bars] of Object.entries(barsData.bars)) {
          const open = Array.isArray(bars) && bars[0] ? bars[0].o : null;
          if (typeof open === "number" && open > 0) {
            base[ticker] = open;
          }
        }
      }
    }

    if (Object.keys(current).length === 0) {
      res.status(502).json({ error: "No prices returned from Alpaca" });
      return;
    }

    // Cache for 30s at the edge to avoid hammering Alpaca on rapid refreshes
    res.setHeader("Cache-Control", "public, s-maxage=30");
    res.status(200).json({ current, base, anchorDate: ANCHOR_DATE });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
