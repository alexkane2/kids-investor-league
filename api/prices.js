// Serverless function — runs on Vercel's servers, NOT in the browser.
// Your Alpaca keys stay private here (set as env vars in the Vercel dashboard).
//
// For each ticker it returns a { price, open } pair, both from Alpaca's
// snapshots endpoint (one request covers every symbol):
//   price — the latest live trade price (current price)
//   open  — TODAY's market open (the open of today's daily bar)
//
// It also returns `base`: each ticker's OPENING price on the league's start
// date (ANCHOR_DATE). The app measures "Total" gains from that fixed purchase
// price and "Today" gains from each ticker's today open above.

const TICKERS = ["NVDA", "GEV", "AMZN", "LLY", "HBM", "AVGE", "VOO", "QQQ", "SCHD", "SGOV", "GDX", "SPMO"];

// Fixed starting line: the trading day the league began. "Total" gains are
// measured from this day's market open and stay anchored here permanently.
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

  // One snapshot call gives us, per ticker, the latest trade (current price)
  // and today's daily bar (whose open `o` is today's market open).
  const snapshotUrl = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${symbols}&feed=iex`;
  // Daily bar for the anchor date — its open `o` is the fixed purchase price
  // (the league's starting line). The narrow date range returns just that
  // day's bar per ticker, and we read the first (earliest) bar below.
  const barsUrl = `https://data.alpaca.markets/v2/stocks/bars?symbols=${symbols}&timeframe=1Day&start=${ANCHOR_DATE}&end=${ANCHOR_END}&feed=iex&adjustment=split`;

  try {
    const [snapRes, barsRes] = await Promise.all([
      fetch(snapshotUrl, { headers }),
      fetch(barsUrl, { headers }),
    ]);

    if (!snapRes.ok) {
      const detail = await snapRes.text().catch(() => "");
      res.status(snapRes.status).json({ error: `Alpaca ${snapRes.status}`, detail: detail.slice(0, 200) });
      return;
    }

    // The multi-symbol snapshots endpoint returns a map keyed by ticker
    // (some API versions nest it under a `snapshots` key — handle both).
    const snapData = await snapRes.json();
    const snapshots = snapData?.snapshots || snapData || {};
    const prices = {};
    for (const [ticker, snap] of Object.entries(snapshots)) {
      if (!snap || !TICKERS.includes(ticker)) continue;
      const price = snap.latestTrade?.p;
      const open = snap.dailyBar?.o;
      if (typeof price === "number" && price > 0) {
        prices[ticker] = {
          price,
          open: typeof open === "number" && open > 0 ? open : null,
        };
      }
    }

    // Fixed purchase prices (anchor-date opens). Non-fatal if this fails — the
    // app simply shows "—" for gains until the opening data is available.
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

    if (Object.keys(prices).length === 0) {
      res.status(502).json({ error: "No prices returned from Alpaca" });
      return;
    }

    // Cache for 30s at the edge to avoid hammering Alpaca on rapid refreshes
    res.setHeader("Cache-Control", "public, s-maxage=30");
    res.status(200).json({ prices, base, anchorDate: ANCHOR_DATE });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
