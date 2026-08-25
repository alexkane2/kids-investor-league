// Serverless function — runs on Vercel's servers, NOT in the browser.
// Your Alpaca keys stay private here (set as env vars in the Vercel dashboard).
//
// Returns three things the app needs to value each portfolio:
//
//   prices     — per ticker: { price, open, prevClose } from the snapshots
//                endpoint (latest trade, today's open, previous close)
//   base       — per ticker: the market open on the day that position was
//                bought. Most tickers use the league's start (ANCHOR_DATE);
//                anything in LATER_BUYS uses its own buy date.
//   dividends  — per ticker: every cash dividend actually paid since that
//                position was bought, each annotated with the closing price on
//                its pay date so the app can reinvest it into more shares.

const TICKERS = ["NVDA", "GEV", "AMZN", "LLY", "MP", "AVGE", "VOO", "QQQ", "SCHD", "SGOV", "GDX", "AVSC", "IGV", "CRCL", "IBIT"];

// Fixed starting line: the trading day the league began. "Total" gains are
// measured from this day's market open and stay anchored here permanently.
const ANCHOR_DATE = "2026-06-17";

// Positions opened after the league started. A ticker listed here is priced
// from the market open on ITS buy date instead of the anchor date, so a
// mid-league switch isn't credited with moves from before the money went in.
// It also gates dividends: you only collect one if you held through the ex-date.
//
// NOTE: buy dates are per TICKER, not per person. If two people ever hold the
// same ticker bought on different dates, this needs to move onto the holding.
const LATER_BUYS = {
  IGV: "2026-08-25",   // Al's switch out of SPMO
  CRCL: "2026-08-25",
  IBIT: "2026-08-25",
};

const buyDateFor = ticker => LATER_BUYS[ticker] || ANCHOR_DATE;

// Market dates are US/Eastern. Using the UTC date would roll over at 8pm ET
// and start asking for a session that hasn't happened yet.
const marketToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

// Alpaca treats a daily-bar range end as exclusive, so asking for
// [date, date+1) returns exactly that one day's bar per symbol.
function nextDay(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Walks paginated market-data responses, folding each page into one accumulator.
// The page cap is a safety stop — at 10k rows a page it is never reached in
// practice, but it keeps a bad next_page_token from spinning forever.
async function fetchAllPages(url, headers, merge) {
  const acc = {};
  let pageToken = null;
  for (let page = 0; page < 20; page++) {
    const res = await fetch(pageToken ? `${url}&page_token=${encodeURIComponent(pageToken)}` : url, { headers });
    if (!res.ok) return { ok: false, status: res.status, detail: await res.text().catch(() => ""), data: acc };
    const json = await res.json();
    merge(acc, json);
    pageToken = json?.next_page_token;
    if (!pageToken) break;
  }
  return { ok: true, data: acc };
}

// Daily bars come back ascending by timestamp. Both lookups take the first
// session ON or AFTER the target date, so a buy or pay date that lands on a
// weekend or market holiday rolls forward to the next real trading day.
const barDate = bar => String(bar?.t || "").slice(0, 10);
const openOnOrAfter = (bars, date) => {
  for (const b of bars) if (barDate(b) >= date && b.o > 0) return b.o;
  return null;
};
const closeOnOrAfter = (bars, date) => {
  for (const b of bars) if (barDate(b) >= date && b.c > 0) return b.c;
  return null;
};

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
  const asOf = marketToday();

  // One snapshot call gives us, per ticker, the latest trade (current price),
  // today's daily bar (whose open `o` is today's market open) and yesterday's close.
  const snapshotUrl = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${symbols}&feed=iex`;

  // Every daily bar from the league's start through today. This one range
  // serves both purchase prices (the open on a buy date) and dividend
  // reinvestment prices (the close on a pay date).
  //
  // adjustment=split is deliberate and load-bearing: it back-adjusts splits but
  // NOT dividends. Switching to adjustment=all would fold dividends into the
  // prices themselves, and we would then count them a second time below.
  const barsUrl = `https://data.alpaca.markets/v2/stocks/bars?symbols=${symbols}&timeframe=1Day&start=${ANCHOR_DATE}&end=${nextDay(asOf)}&feed=iex&adjustment=split&limit=10000`;

  // Cash dividends declared over the same window.
  const divUrl = `https://data.alpaca.markets/v1/corporate-actions?symbols=${symbols}&types=cash_dividend&start=${ANCHOR_DATE}&end=${asOf}&limit=1000`;

  try {
    const [snapRes, barsResult, divResult] = await Promise.all([
      fetch(snapshotUrl, { headers }),
      fetchAllPages(barsUrl, headers, (acc, json) => {
        for (const [sym, bars] of Object.entries(json?.bars || {})) {
          if (!Array.isArray(bars)) continue;
          acc[sym] = (acc[sym] || []).concat(bars);
        }
      }),
      // Some response shapes nest the action lists under `corporate_actions`,
      // others put them at the top level — accept either.
      fetchAllPages(divUrl, headers, (acc, json) => {
        const actions = json?.corporate_actions || json || {};
        for (const d of actions.cash_dividends || []) {
          if (!d?.symbol) continue;
          acc[d.symbol] = (acc[d.symbol] || []).concat(d);
        }
      }),
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

    if (Object.keys(prices).length === 0) {
      res.status(502).json({ error: "No prices returned from Alpaca" });
      return;
    }

    const bars = barsResult.data;

    // Purchase price per ticker: the open on its buy date. Non-fatal if the bar
    // is missing — the app shows "—" for that holding until the data lands.
    const base = {};
    const buyDates = {};
    for (const ticker of TICKERS) {
      const buyDate = buyDateFor(ticker);
      buyDates[ticker] = buyDate;
      const open = openOnOrAfter(bars[ticker] || [], buyDate);
      if (open) base[ticker] = open;
    }

    // A position bought today may not have a settled daily bar on the IEX feed
    // yet. The snapshot already carries today's open, so fall back to that.
    for (const ticker of Object.keys(LATER_BUYS)) {
      if (base[ticker] == null && prices[ticker]?.open) {
        base[ticker] = prices[ticker].open;
      }
    }

    // Dividends actually PAID since each position was bought. Two gates:
    //   ex_date >= buy date — you only collect if you held through the ex-date
    //   payable_date <= today — the cash has to have actually landed
    // Between those two dates a real brokerage shows the price drop without the
    // cash, and so does this.
    const dividends = {};
    for (const ticker of TICKERS) {
      const buyDate = buyDateFor(ticker);
      const paid = (divResult.data[ticker] || [])
        .map(d => ({
          exDate: d.ex_date,
          payDate: d.payable_date || d.ex_date,
          rate: Number(d.rate),
        }))
        .filter(d => d.exDate && d.payDate && d.rate > 0 && d.exDate >= buyDate && d.payDate <= asOf)
        .sort((a, b) => a.payDate.localeCompare(b.payDate));

      if (paid.length === 0) continue;
      dividends[ticker] = paid.map(d => ({
        ...d,
        // Reinvest at the close on the pay date. If that session hasn't closed
        // yet (a dividend paying today), fall back to the live price so the
        // cash still buys shares instead of sitting idle.
        reinvestPrice: closeOnOrAfter(bars[ticker] || [], d.payDate) || prices[ticker]?.price || null,
      }));
    }

    // Cache for 30s at the edge to avoid hammering Alpaca on rapid refreshes
    res.setHeader("Cache-Control", "public, s-maxage=30");
    res.status(200).json({
      prices,
      base,
      dividends,
      buyDates,
      asOf,
      anchorDate: ANCHOR_DATE,
      // Surfaced so a missing-dividend problem is diagnosable from the payload
      // rather than looking like every stock simply stopped paying.
      dividendsOk: divResult.ok,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
