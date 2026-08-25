// Serverless function — runs on Vercel's servers, NOT in the browser.
// Your Alpaca keys stay private here (set as env vars in the Vercel dashboard).
//
// For each ticker it returns a { price, open, prevClose } trio, all from
// Alpaca's snapshots endpoint (one request covers every symbol):
//   price     — the latest live trade price (current price)
//   open      — TODAY's market open (the open of today's daily bar)
//   prevClose — the previous trading day's close
//
// It also returns `base`: each ticker's purchase price. For most tickers that
// is the OPENING price on the league's start date (ANCHOR_DATE). Tickers
// bought mid-league (see LATER_BUYS) are priced from the open on the day they
// were actually bought. The app measures "Total" gains from that purchase
// price and "Today" gains from each ticker's prevClose above.

const TICKERS = ["NVDA", "GEV", "AMZN", "LLY", "MP", "AVGE", "VOO", "QQQ", "SCHD", "SGOV", "GDX", "AVSC", "IGV", "CRCL", "IBIT"];

// Fixed starting line: the trading day the league began. "Total" gains are
// measured from this day's market open and stay anchored here permanently.
const ANCHOR_DATE = "2026-06-17";

// Positions opened after the league started. A ticker listed here is priced
// from the market open on ITS buy date instead of the anchor date, so a
// mid-league switch isn't credited with moves from before the money went in.
const LATER_BUYS = {
  IGV: "2026-08-25",   // Al's switch out of SPMO
  CRCL: "2026-08-25",
  IBIT: "2026-08-25",
};

// Alpaca treats a daily-bar range end as exclusive, so asking for
// [date, date+1) returns exactly that one day's bar per symbol.
function nextDay(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// One bar query per distinct purchase date: the anchor date for the original
// holdings, plus a group for each day a later position was opened.
function buyDateGroups() {
  const groups = [{ date: ANCHOR_DATE, symbols: TICKERS.filter(t => !LATER_BUYS[t]) }];
  const byDate = {};
  for (const [ticker, date] of Object.entries(LATER_BUYS)) {
    (byDate[date] = byDate[date] || []).push(ticker);
  }
  for (const [date, symbols] of Object.entries(byDate)) {
    groups.push({ date, symbols });
  }
  return groups.filter(g => g.symbols.length > 0);
}

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
  const barsUrl = ({ date, symbols: syms }) =>
    `https://data.alpaca.markets/v2/stocks/bars?symbols=${syms.join(",")}&timeframe=1Day&start=${date}&end=${nextDay(date)}&feed=iex&adjustment=split`;

  const groups = buyDateGroups();

  try {
    const [snapRes, ...barsResList] = await Promise.all([
      fetch(snapshotUrl, { headers }),
      ...groups.map(g => fetch(barsUrl(g), { headers })),
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
      const prevClose = snap.prevDailyBar?.c;
      if (typeof price === "number" && price > 0) {
        prices[ticker] = {
          price,
          open: typeof open === "number" && open > 0 ? open : null,
          prevClose: typeof prevClose === "number" && prevClose > 0 ? prevClose : null,
        };
      }
    }

    // Fixed purchase prices (the open on each position's buy date). Non-fatal
    // if a query fails — the app shows "—" until the opening data is available.
    const base = {};
    for (const barsRes of barsResList) {
      if (!barsRes.ok) continue;
      const barsData = await barsRes.json().catch(() => null);
      if (!barsData?.bars) continue;
      for (const [ticker, bars] of Object.entries(barsData.bars)) {
        const open = Array.isArray(bars) && bars[0] ? bars[0].o : null;
        if (typeof open === "number" && open > 0) {
          base[ticker] = open;
        }
      }
    }

    // A position bought today may not have a settled daily bar on the IEX feed
    // yet. The snapshot already carries today's open, so fall back to that.
    for (const ticker of Object.keys(LATER_BUYS)) {
      if (base[ticker] == null && prices[ticker]?.open) {
        base[ticker] = prices[ticker].open;
      }
    }

    if (Object.keys(prices).length === 0) {
      res.status(502).json({ error: "No prices returned from Alpaca" });
      return;
    }

    // Cache for 30s at the edge to avoid hammering Alpaca on rapid refreshes
    res.setHeader("Cache-Control", "public, s-maxage=30");
    res.status(200).json({ prices, base, anchorDate: ANCHOR_DATE, laterBuys: LATER_BUYS });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
