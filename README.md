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

## Dividends

Dividends are collected automatically and **reinvested** (DRIP), matching a real
brokerage account with reinvestment switched on.

`api/prices.js` pulls cash dividends from Alpaca's corporate-actions feed and
attaches the closing price on each pay date. `calcPortfolio` in `src/App.jsx`
then replays them in pay order: each dividend buys more shares at that day's
close, and the next dividend pays on the larger position. That is the
compounding, so the replay order matters.

Two gates decide whether a dividend counts:
- **ex-date on or after the buy date** — you only collect if you held through it,
  so a mid-league buyer doesn't get paid for quarters they weren't invested in
- **pay date on or before today** — the cash has to have actually landed

Between the ex-date and the pay date a real brokerage shows the price drop
without the cash yet, and so does this.

Dividends are already inside "Total return" — they arrive as extra shares, which
lift current value. The 💵 Dividends row on each card is a breakdown of how much
of that came from payouts, not a number to add on top.

If the corporate-actions feed is unavailable (it needs a data subscription), the
app still serves prices and keeps the last known dividend history rather than
wiping it to zero. `dividendsOk: false` in the API response flags that case.

Two things to know about the current model: buy dates live per *ticker* in
`LATER_BUYS`, so two people holding the same ticker bought on different dates
would need that moved onto the holding. And bars are fetched with
`adjustment=split` on purpose — `adjustment=all` would bake dividends into the
prices and count them twice.

## How it works

- `src/App.jsx` — the entire app (single file)
- `PORTFOLIOS` array at the top of App.jsx defines each kid's holdings (ticker, shares, cost basis)
- Refresh button fetches latest prices from Alpaca and recalculates value/return
- Prices cached in localStorage so values persist between page loads

## Edit the portfolios

To change holdings, edit the `PORTFOLIOS` array at the top of `src/App.jsx`. Each holding needs:
- `ticker`: the symbol (uppercase)
- `invested`: dollar amount put into that position

Share counts aren't stored — they're derived as `invested / purchase price`, and
the purchase price comes from the server (see below).

### Selling a position mid-league

Everyone starts with the same $300 stake, so a mid-league switch must not reset
the cost basis — that would erase the seller's gain or loss and scramble the
standings. When someone sells and redeploys, set three optional fields on their
portfolio:
- `stake`: the original amount they put in, kept as the basis for `%` returns
- `realizedGain`: profit or loss banked on the sold position (negative for a loss)
- `realizedNote`: short label for the card, e.g. `"sold SPMO"`

Then list the new holdings with the cash actually redeployed, and register the
buy date in `LATER_BUYS` in `api/prices.js` so the new positions are priced from
the open on the day they were bought rather than the league's start date.

Total return stays `current value − redeployed cash + realized gain`, measured
against the original stake.
