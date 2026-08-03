# Kids Investor League

A portfolio tracker for three kids' ETF holdings. Built with React + Vite, uses the Alpaca Markets API for live prices.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Add your Alpaca API keys:
   - Sign up at https://alpaca.markets (paper trading account is free)
   - Get your API Key ID and Secret from the dashboard
   - Copy `.env.local.example` to `.env.local`
   - Replace the placeholder values with your real keys (`ALPACA_KEY` and `ALPACA_SECRET`)
   - **Never commit real keys.** `.env.local` is gitignored; `.env.local.example` should only ever hold placeholders.
   - The keys are used only by the serverless function in `api/prices.js` (server-side) and are never sent to the browser. Do not add a `VITE_` prefix — `VITE_`-prefixed vars get bundled into the public client JS.

   For production on Vercel, set `ALPACA_KEY` and `ALPACA_SECRET` in the Vercel dashboard under **Settings → Environment Variables** instead of using `.env.local`.

3. Add the kid photos to `public/`:
   - `hudson.png`
   - `cameron.png`
   - `violet.png`

4. Start the dev server:
   ```
   npm run dev
   ```

5. Open http://localhost:5173 in your browser.

## How it works

- `src/App.jsx` — the entire app (single file)
- `PORTFOLIOS` array at the top of App.jsx defines each kid's holdings (ticker, shares, cost basis)
- Refresh button fetches latest prices from Alpaca and recalculates value/return
- Prices cached in localStorage so values persist between page loads

`npm run dev` serves `api/prices.js` locally through a small Vite plugin in
`vite.config.js`, reading `ALPACA_KEY` / `ALPACA_SECRET` from `.env.local`. Dev
and production therefore run the same handler code.

## Alpaca data feeds

`api/prices.js` doesn't hardcode a feed. Each request tries `sip` (the full
consolidated tape) first and falls back to `iex` if Alpaca replies that the
account's subscription doesn't cover it, so the same code works on the free
plan and on a paid one. The feed actually used comes back in the response as
`feeds: { snapshot, bars }`.

This matters because `iex` only sees the small share of volume that trades on
IEX, so a thinly traded ETF may have no recent trade there. When a snapshot has
no `latestTrade`, the handler falls back through the minute bar, the daily bar,
the quote midpoint, and finally the previous close rather than showing a dash.

Historical data older than 15 minutes is available on SIP even for free
accounts, so the anchor-date bars normally resolve on the accurate feed
regardless of plan.

If anything is only partially available the response carries a `warnings`
array, and the app displays it beneath the header instead of silently rendering
empty cards.

## Edit the portfolios

To change holdings, edit the `PORTFOLIOS` array at the top of `src/App.jsx`. Each holding needs:
- `ticker`: the ETF symbol (uppercase)
- `shares`: number of shares owned
- `costBasis`: dollar amount originally invested
