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
