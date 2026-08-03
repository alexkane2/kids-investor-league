// Serverless function — runs on Vercel's servers, NOT in the browser.
// Your Alpaca keys stay private here (set as env vars in the Vercel dashboard).
//
// For each ticker it returns a { price, open, prevClose } triple derived from
// Alpaca's snapshots endpoint (one request covers every symbol):
//   price     — the latest live trade price (current price)
//   open      — TODAY's market open (the open of today's daily bar)
//   prevClose — the previous session's closing price ("Today's return" baseline)
//
// It also returns `base`: each ticker's OPENING price on the league's start
// date (ANCHOR_DATE). The app measures "Total" gains from that fixed purchase
// price and "Today" gains from each ticker's prevClose above.
//
// Feeds: Alpaca gates data by subscription. The free/Basic plan only gets
// real-time IEX, while historical data older than 15 minutes is available on
// SIP (full-market) even for free accounts. Rather than hardcoding a feed and
// breaking on the wrong plan, each request negotiates: it tries the best feed
// first and falls back when Alpaca reports the subscription doesn't allow it.

const TICKERS = ["NVDA", "GEV", "AMZN", "LLY", "MP", "AVGE", "VOO", "QQQ", "SCHD", "SGOV", "GDX", "SPMO", "AVSC"];

// Fixed starting line: the trading day the league began. "Total" gains are
// measured from this day's market open and stay anchored here permanently.
const ANCHOR_DATE = "2026-06-17";
// We ask for a window rather than a single day so a holiday, an early close, or
// a symbol that simply didn't print that morning still resolves — the first bar
// on or after ANCHOR_DATE wins. Alpaca treats the range end as exclusive.
const ANCHOR_WINDOW_END = "2026-07-02";

const DATA_BASE = "https://data.alpaca.markets/v2/stocks";
const FETCH_TIMEOUT_MS = 8000;

// Best feed first. `sip` is full-market consolidated tape; `iex` sees only the
// ~2% of volume that trades on IEX, so it's the fallback, not the default.
const SNAPSHOT_FEEDS = ["sip", "iex"];
const BARS_FEEDS = ["sip", "iex"];

// Alpaca signals "your plan doesn't cover this feed" with a 403, and sometimes
// a 400 whose body mentions the subscription. Either way we retry on a lesser
// feed instead of failing the whole request.
function isSubscriptionError(status, body) {
  if (status === 403) return true;
  if (status === 400 && /subscription|not authorized|permitted/i.test(body || "")) return true;
  return false;
}

async function fetchJson(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

// Try each feed in order, returning the first that Alpaca actually serves.
// Returns { json, feed } on success, or { error, status } if all feeds failed.
async function fetchWithFeed(buildUrl, headers, feeds) {
  let last = null;
  for (const feed of feeds) {
    const result = await fetchJson(buildUrl(feed), headers);
    if (result.ok) return { json: result.json, feed };
    last = result;
    if (!isSubscriptionError(result.status, result.text)) break;
  }
  const detail = last?.json?.message || last?.text || "";
  return { error: `Alpaca ${last?.status ?? "request failed"}`, status: last?.status ?? 502, detail: detail.slice(0, 200) };
}

// IEX only prints a fraction of the market, so a thinly traded ETF can come
// back with no `latestTrade` at all. Walk from most to least current rather
// than dropping the ticker and showing the kid a dash.
function pickPrice(snap) {
  const candidates = [
    snap?.latestTrade?.p,
    snap?.minuteBar?.c,
    snap?.dailyBar?.c,
    // Quote midpoint, only when both sides are present.
    snap?.latestQuote?.ap > 0 && snap?.latestQuote?.bp > 0
      ? (snap.latestQuote.ap + snap.latestQuote.bp) / 2
      : null,
    snap?.prevDailyBar?.c,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && c > 0) return c;
  }
  return null;
}

function positiveOrNull(n) {
  return typeof n === "number" && n > 0 ? n : null;
}

// Bars come back paginated. One day of daily bars over 13 symbols fits in a
// single page today, but following the token costs nothing and stops this from
// silently truncating if the window or ticker list ever grows.
async function fetchAnchorBars(symbols, headers) {
  const build = (feed) => (token) =>
    `${DATA_BASE}/bars?symbols=${symbols}&timeframe=1Day` +
    `&start=${ANCHOR_DATE}&end=${ANCHOR_WINDOW_END}` +
    `&feed=${feed}&adjustment=split&limit=10000` +
    (token ? `&page_token=${encodeURIComponent(token)}` : "");

  const first = await fetchWithFeed((feed) => build(feed)(null), headers, BARS_FEEDS);
  if (first.error) return first;

  const collected = {};
  const absorb = (bars) => {
    for (const [ticker, list] of Object.entries(bars || {})) {
      if (!Array.isArray(list)) continue;
      (collected[ticker] ||= []).push(...list);
    }
  };

  absorb(first.json?.bars);
  let token = first.json?.next_page_token;
  let guard = 0;
  while (token && guard++ < 10) {
    const page = await fetchJson(build(first.feed)(token), headers);
    if (!page.ok) break;
    absorb(page.json?.bars);
    token = page.json?.next_page_token;
  }

  // The purchase price is the open of the earliest bar in the window.
  const base = {};
  for (const [ticker, list] of Object.entries(collected)) {
    if (!TICKERS.includes(ticker)) continue;
    const sorted = [...list].sort((a, b) => String(a.t).localeCompare(String(b.t)));
    const open = positiveOrNull(sorted[0]?.o);
    if (open) base[ticker] = open;
  }
  return { base, feed: first.feed };
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
  const warnings = [];

  try {
    const [snapResult, barsResult] = await Promise.all([
      fetchWithFeed(
        (feed) => `${DATA_BASE}/snapshots?symbols=${symbols}&feed=${feed}`,
        headers,
        SNAPSHOT_FEEDS
      ),
      fetchAnchorBars(symbols, headers),
    ]);

    if (snapResult.error) {
      res.status(snapResult.status).json({ error: snapResult.error, detail: snapResult.detail });
      return;
    }

    // The multi-symbol snapshots endpoint returns a map keyed by ticker
    // (some API versions nest it under a `snapshots` key — handle both).
    const snapData = snapResult.json;
    const snapshots = snapData?.snapshots || snapData || {};
    const prices = {};
    for (const [ticker, snap] of Object.entries(snapshots)) {
      if (!snap || !TICKERS.includes(ticker)) continue;
      const price = pickPrice(snap);
      if (price == null) continue;
      prices[ticker] = {
        price,
        open: positiveOrNull(snap.dailyBar?.o),
        prevClose: positiveOrNull(snap.prevDailyBar?.c),
      };
    }

    if (Object.keys(prices).length === 0) {
      res.status(502).json({ error: "No prices returned from Alpaca" });
      return;
    }

    const missingPrices = TICKERS.filter((t) => !prices[t]);
    if (missingPrices.length) {
      warnings.push(`No price for: ${missingPrices.join(", ")}`);
    }

    // Fixed purchase prices (anchor-date opens). Non-fatal on its own, but
    // without them the app can't compute share counts — so say so loudly in
    // the payload instead of silently rendering a page full of dashes.
    let base = {};
    if (barsResult.error) {
      warnings.push(`Anchor prices unavailable (${barsResult.error}${barsResult.detail ? `: ${barsResult.detail}` : ""})`);
    } else {
      base = barsResult.base;
      const missingBase = TICKERS.filter((t) => !base[t]);
      if (missingBase.length) {
        warnings.push(`No anchor price for: ${missingBase.join(", ")}`);
      }
    }

    // Cache for 30s at the edge to avoid hammering Alpaca on rapid refreshes
    res.setHeader("Cache-Control", "public, s-maxage=30");
    res.status(200).json({
      prices,
      base,
      anchorDate: ANCHOR_DATE,
      feeds: { snapshot: snapResult.feed, bars: barsResult.feed || null },
      warnings,
    });
  } catch (err) {
    const message = err?.name === "AbortError" ? "Alpaca request timed out" : err?.message || "Unknown server error";
    res.status(500).json({ error: message });
  }
}
