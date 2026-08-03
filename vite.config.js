import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// In production Vercel serves everything in `api/` as serverless functions.
// The Vite dev server knows nothing about that, so `npm run dev` would fall
// through to the SPA and hand `/api/prices` back an HTML page — the fetch then
// fails on JSON parsing regardless of whether the Alpaca keys are correct.
// This plugin mounts the same handlers locally, giving dev and prod one code path.
function vercelApiDev(env) {
  return {
    name: 'vercel-api-dev',
    configureServer(server) {
      const apiDir = path.resolve(server.config.root, 'api')
      if (!fs.existsSync(apiDir)) return

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()

        const name = url.pathname.slice('/api/'.length)
        const file = path.join(apiDir, `${name}.js`)
        if (!name || name.includes('/') || !fs.existsSync(file)) return next()

        // The handlers read credentials from process.env. Vite only exposes
        // VITE_-prefixed vars, and these deliberately have no prefix so they
        // never reach the browser bundle — so bridge them in by hand.
        for (const [k, v] of Object.entries(env)) {
          if (process.env[k] === undefined) process.env[k] = v
        }

        // Minimal Express-shaped response, which is what Vercel handlers expect.
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (body) => {
          if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
          return res
        }

        try {
          // ssrLoadModule keeps the handler hot-reloading on edit.
          const mod = await server.ssrLoadModule(file)
          await mod.default(req, res)
        } catch (err) {
          server.ssrFixStacktrace(err)
          res.status(500).json({ error: err?.message || 'Dev API handler failed' })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Empty prefix so unprefixed vars (ALPACA_KEY / ALPACA_SECRET) are read too.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), vercelApiDev(env)],
  }
})
