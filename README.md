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
   - Replace the placeholder values with your real keys

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
- `ticker`: the ETF symbol (uppercase)
- `shares`: number of shares owned
- `costBasis`: dollar amount originally invested
