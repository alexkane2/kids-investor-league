import { useState, useEffect, useCallback, useMemo } from "react";

const PORTFOLIOS = [
  {
    id: "hudson",
    name: "Hudson",
    avatar: "🦁",
    color: "#e84545",
    bg: "#fff5f5",
    border: "#e84545",
    accent: "#ff8c8c",
    holdings: [
      { ticker: "NVDA", invested: 60 },
      { ticker: "GEV", invested: 60 },
      { ticker: "AMZN", invested: 60 },
      { ticker: "LLY", invested: 60 },
      { ticker: "HBM", invested: 60 },
    ],
  },
  {
    id: "cameron",
    name: "Cameron",
    avatar: "🐺",
    color: "#f5a623",
    bg: "#fffbf0",
    border: "#f5a623",
    accent: "#ffd47e",
    holdings: [{ ticker: "AVGE", invested: 300 }],
  },
  {
    id: "violet",
    name: "Violet",
    avatar: "🦄",
    color: "#c44dc8",
    bg: "#fdf5ff",
    border: "#c44dc8",
    accent: "#e89aeb",
    holdings: [
      { ticker: "VOO", invested: 100 },
      { ticker: "QQQ", invested: 100 },
      { ticker: "SCHD", invested: 100 },
    ],
  },
  {
    id: "steph",
    name: "Steph",
    avatar: "🦊",
    color: "#2d9bf0",
    bg: "#f0f8ff",
    border: "#2d9bf0",
    accent: "#9ad0f5",
    holdings: [
      { ticker: "VOO", invested: 270 },
      { ticker: "SGOV", invested: 30 },
    ],
  },
  {
    id: "north",
    name: "North",
    avatar: "🐻",
    color: "#19b37a",
    bg: "#f0fbf6",
    border: "#19b37a",
    accent: "#8fe0c2",
    holdings: [
      { ticker: "AMZN", invested: 150 },
      { ticker: "GDX", invested: 150 },
    ],
  },
  {
    id: "al",
    name: "Al",
    avatar: "🦉",
    color: "#5c6bc0",
    bg: "#f4f5fc",
    border: "#5c6bc0",
    accent: "#aeb6e8",
    holdings: [
      { ticker: "SPMO", invested: 300 },
    ],
  },
];

const MEDALS = ["🥇", "🥈", "🥉"];
const ALL_TICKERS = [...new Set(PORTFOLIOS.flatMap(p => p.holdings.map(h => h.ticker)))];

function calcPortfolio(portfolio, prices, basePrices) {
  let totalInvested = 0;
  let currentValue = 0;
  const holdings = portfolio.holdings.map(h => {
    const bp = basePrices[h.ticker];
    const cp = prices[h.ticker];
    if (!bp || !cp) return { ...h, shares: null, currentValue: null, gain: null, gainPct: null, currentPrice: null };
    const shares = h.invested / bp;
    const val = shares * cp;
    totalInvested += h.invested;
    currentValue += val;
    return { ...h, shares, currentValue: val, gain: val - h.invested, gainPct: ((val - h.invested) / h.invested) * 100, currentPrice: cp };
  });
  const totalGain = currentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  return { ...portfolio, holdings, totalInvested, currentValue, totalGain, totalGainPct };
}

async function fetchLivePrices() {
  const res = await fetch("/api/prices");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function Cloud({ top, left, scale = 1, opacity = 1 }) {
  return (
    <div style={{ position: "absolute", top, left, transform: `scale(${scale})`, opacity, transformOrigin: "left top", zIndex: 1, pointerEvents: "none" }}>
      <div style={{ position: "relative", width: 100, height: 50 }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, width: 100, height: 38, background: "white", borderRadius: 50, boxShadow: "3px 3px 0 #e0e0e0" }} />
        <div style={{ position: "absolute", bottom: 20, left: 16, width: 48, height: 48, background: "white", borderRadius: "50%", boxShadow: "2px -2px 0 #e0e0e0" }} />
        <div style={{ position: "absolute", bottom: 18, left: 48, width: 38, height: 38, background: "white", borderRadius: "50%" }} />
      </div>
    </div>
  );
}

export default function App() {
  const [prices, setPrices] = useState({});
  const [basePrices, setBasePrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = document.createElement("style");
    s.id = "peppa-styles";
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@600;700;800;900&display=swap');
      body { margin: 0; }
      .fredoka { font-family: 'Fredoka One', cursive; }
      .nunito { font-family: 'Nunito', sans-serif; }
      @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
      @keyframes wiggle { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(4deg)} }
      @keyframes popIn { 0%{transform:scale(0.75);opacity:0} 70%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
      @keyframes floatAvatar { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-7px) scale(1.04)} }
      @keyframes spinSlow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
      @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
      @keyframes grassSway { 0%,100%{transform:rotate(-2deg) scaleY(1)} 50%{transform:rotate(2deg) scaleY(1.05)} }

      .peppa-card {
        animation: popIn 0.5s cubic-bezier(.34,1.56,.64,1) forwards;
        opacity: 0;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .peppa-card:hover { transform: translateY(-6px) rotate(0.8deg); }
      .peppa-btn {
        font-family: 'Fredoka One', cursive;
        cursor: pointer;
        border: none;
        transition: all 0.15s cubic-bezier(.34,1.56,.64,1);
        letter-spacing: 0.5px;
      }
      .peppa-btn:hover:not(:disabled) { transform: scale(1.08) translateY(-2px); }
      .peppa-btn:active:not(:disabled) { transform: scale(0.95); }
      .peppa-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      .bounce { animation: bounce 2s ease-in-out infinite; }
      .wiggle { animation: wiggle 3s ease-in-out infinite; }
      .blink { animation: blink 1s infinite; }
      .float-avatar { animation: floatAvatar 3s ease-in-out infinite; }
    `;
    document.head.appendChild(s);
    return () => { const el = document.getElementById("peppa-styles"); if (el) el.remove(); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const bp = localStorage.getItem("kil-base-2026-06-17");
        if (bp) setBasePrices(JSON.parse(bp));
        const lp = localStorage.getItem("kil-last-2026-06-17");
        if (lp) setPrices(JSON.parse(lp));
        const ts = localStorage.getItem("kil-ts-2026-06-17");
        if (ts) setLastUpdated(ts);
      } catch {}
      setReady(true);
    })();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLivePrices();
      const current = data.current || {};
      const base = data.base || {};
      setPrices(current);
      localStorage.setItem("kil-last-2026-06-17", JSON.stringify(current));
      const ts = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      setLastUpdated(ts);
      localStorage.setItem("kil-ts-2026-06-17", ts);
      // Starting line is always today's market open, provided by the server.
      if (Object.keys(base).length > 0) {
        setBasePrices(base);
        localStorage.setItem("kil-base-2026-06-17", JSON.stringify(base));
      }
    } catch (e) {
      setError("Oops! Couldn't get prices right now.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (ready) refresh(); }, [ready, refresh]);

  // Keep the running tab live: auto-refresh every 60s while the page is open.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => refresh(), 60000);
    return () => clearInterval(id);
  }, [ready, refresh]);

  const allData = PORTFOLIOS.map(p => calcPortfolio(p, prices, basePrices));
  const ranked = [...allData].sort((a, b) => b.totalGain - a.totalGain);
  const rankOf = id => ranked.findIndex(r => r.id === id);
  const hasData = Object.keys(prices).length > 0;
  const familyValue = allData.reduce((s, p) => s + (p.currentValue || 0), 0);
  const familyGain = familyValue - allData.reduce((s, p) => s + (p.currentValue > 0 ? p.totalInvested : 0), 0);

  // Cards displayed left→right by highest current value
  const cardOrder = [...allData].sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));

  return (
    <div style={{ minHeight: "100vh", background: "#6ec6e6", position: "relative", overflow: "hidden", fontFamily: "'Nunito', sans-serif" }}>

      {/* Sky gradient */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #5ab8e0 0%, #8fd4f0 40%, #b0e0f8 65%, #70b84a 65%, #55a030 100%)" }} />

      {/* Clouds */}
      <Cloud top={14} left="4%" scale={1.1} />
      <Cloud top={38} left="22%" scale={0.7} opacity={0.9} />
      <Cloud top={8} left="50%" scale={1.25} />
      <Cloud top={44} left="70%" scale={0.65} opacity={0.85} />
      <Cloud top={20} left="88%" scale={0.8} />

      {/* Sun */}
      <div style={{ position: "absolute", top: 20, right: 36, zIndex: 2, pointerEvents: "none" }}>
        <div style={{
          width: 70, height: 70, background: "#FFD700", borderRadius: "50%",
          boxShadow: "0 0 0 7px #FFE566, 0 0 0 13px rgba(255,220,80,0.3)",
          animation: "spinSlow 30s linear infinite",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
        }}>☀️</div>
      </div>

      {/* Grass flowers */}
      {["8%","20%","36%","52%","66%","80%","93%"].map((left, i) => (
        <div key={i} style={{ position: "absolute", bottom: 4, left, zIndex: 3, pointerEvents: "none" }}>
          <div style={{ fontSize: 18, animation: `wiggle ${2.2 + i * 0.25}s ease-in-out infinite`, animationDelay: `${i * 0.35}s` }}>
            {["🌸","🌼","🌺","🌻","🌷","🌸","🌼"][i]}
          </div>
        </div>
      ))}

      {/* Page content */}
      <div style={{ position: "relative", zIndex: 4, padding: "28px 20px 72px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── TITLE ── */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div className="fredoka" style={{
            fontSize: "clamp(24px, 5.5vw, 48px)",
            color: "#fff",
            textShadow: "3px 3px 0 #e84545, 6px 6px 0 rgba(0,0,0,0.1)",
            lineHeight: 1.15,
          }}>
            🐷 The Great Investor League 🐷
          </div>
          <div className="fredoka" style={{ color: "rgba(255,255,255,0.88)", fontSize: "clamp(14px, 2.8vw, 20px)", marginTop: 6, textShadow: "1px 1px 0 rgba(0,0,0,0.12)" }}>
            Who will be the best investor? 🌟
          </div>

          {hasData && familyValue > 0 && (
            <div style={{ animation: "slideUp 0.5s ease", marginTop: 18, display: "inline-flex", alignItems: "center", gap: 14, background: "#fff", border: "4px solid #e84545", borderRadius: 60, padding: "10px 28px", boxShadow: "4px 5px 0 #b32d2d" }}>
              <span className="fredoka" style={{ color: "#e84545", fontSize: 18 }}>💰 Family Total:</span>
              <span className="fredoka" style={{ color: "#333", fontSize: 20 }}>${familyValue.toFixed(2)}</span>
              <span className="nunito" style={{ fontWeight: 900, fontSize: 16, color: familyGain >= 0 ? "#27ae60" : "#e84545" }}>
                {familyGain >= 0 ? "▲ +" : "▼ "}${Math.abs(familyGain).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* ── LOADING ── */}
        {loading && !hasData && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 72 }} className="bounce">🐽</div>
            <div className="fredoka" style={{ color: "#fff", fontSize: 22, marginTop: 16, textShadow: "2px 2px 0 rgba(0,0,0,0.1)" }}>
              Getting prices<span className="blink">...</span>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {error && (
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ display: "inline-block", background: "#fff3f3", border: "3px solid #e84545", borderRadius: 20, padding: "10px 24px", boxShadow: "3px 3px 0 #e84545" }}>
              <span className="fredoka" style={{ color: "#e84545", fontSize: 16 }}>😬 {error}</span>
            </div>
          </div>
        )}

        {/* ── CARDS ── */}
        {hasData && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(295px, 1fr))", gap: 22, marginBottom: 24 }}>
            {cardOrder.map((p, i) => {
              const rank = rankOf(p.id);
              return (
                <div key={p.id} className="peppa-card" style={{
                  animationDelay: `${i * 0.14}s`,
                  background: "#fff",
                  border: `5px solid ${p.border}`,
                  borderRadius: 28,
                  padding: "0 0 22px",
                  boxShadow: `5px 8px 0 ${p.color}88`,
                  overflow: "hidden", position: "relative",
                }}>

                  {/* Color header bar */}
                  <div style={{ background: p.color, padding: "12px 18px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 56, height: 56,
                        background: "rgba(255,255,255,0.25)",
                        borderRadius: "50%",
                        border: "3px solid rgba(255,255,255,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 30,
                        overflow: "hidden",
                      }} className="float-avatar">
                        <img
                          src={`/${p.id}.png`}
                          alt={p.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => { e.currentTarget.replaceWith(document.createTextNode(p.avatar)); }}
                        />
                      </div>
                      <div>
                        <div className="fredoka" style={{ color: "#fff", fontSize: 22, textShadow: "1px 1px 0 rgba(0,0,0,0.15)" }}>{p.name}</div>
                        <div className="nunito" style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700 }}>Invested ${p.totalInvested.toFixed(0)}</div>
                      </div>
                    </div>
                    <div className="bounce fredoka" style={{ fontSize: 30, animationDelay: `${i * 0.4}s`, color: "#fff" }}>{MEDALS[rank] || `#${rank + 1}`}</div>
                  </div>

                  {/* Holdings */}
                  <div style={{ padding: "14px 16px 10px" }}>
                    <div style={{ background: p.bg, border: `3px solid ${p.accent}`, borderRadius: 16, overflow: "hidden" }}>
                      {/* Table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", padding: "7px 12px", background: p.accent }}>
                        {["Ticker","Price","Gain"].map(h => (
                          <div key={h} className="fredoka" style={{ color: "#fff", fontSize: 13 }}>{h}</div>
                        ))}
                      </div>
                      {p.holdings.map((h, hi) => (
                        <div key={h.ticker} style={{
                          display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr",
                          padding: "9px 12px", alignItems: "center",
                          borderTop: hi > 0 ? `2px dashed ${p.accent}70` : "none",
                        }}>
                          <div>
                            <div className="fredoka" style={{ color: p.color, fontSize: 14 }}>{h.ticker}</div>
                            {h.shares != null && (
                              <div className="nunito" style={{ color: "#ccc", fontSize: 10, fontWeight: 700 }}>{h.shares.toFixed(3)} sh</div>
                            )}
                          </div>
                          <div className="nunito" style={{ color: "#555", fontSize: 13, fontWeight: 800 }}>
                            {h.currentPrice ? `$${h.currentPrice.toFixed(2)}` : "—"}
                          </div>
                          <div>
                            {h.gain != null ? (
                              <>
                                <div className="nunito" style={{ fontSize: 13, fontWeight: 900, color: h.gain >= 0 ? "#27ae60" : "#e84545" }}>
                                  {h.gain >= 0 ? "+" : ""}${h.gain.toFixed(2)}
                                </div>
                                <div className="nunito" style={{ fontSize: 11, fontWeight: 700, color: h.gain >= 0 ? "#27ae60" : "#e84545", opacity: 0.75 }}>
                                  {h.gainPct >= 0 ? "+" : ""}{h.gainPct.toFixed(2)}%
                                </div>
                              </>
                            ) : (
                              <div className="nunito" style={{ color: "#ccc", fontSize: 13 }}>—</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Value pill */}
                  <div style={{ padding: "0 16px" }}>
                    <div style={{
                      background: p.color,
                      borderRadius: 20,
                      padding: "14px 16px",
                      textAlign: "center",
                      boxShadow: `0 4px 0 ${p.color}66`,
                    }}>
                      <div className="nunito" style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>Current Value</div>
                      <div className="fredoka" style={{ color: "#fff", fontSize: 28, marginTop: 2, textShadow: "2px 2px 0 rgba(0,0,0,0.12)" }}>
                        {p.currentValue > 0 ? `$${p.currentValue.toFixed(2)}` : "—"}
                      </div>
                      {p.currentValue > 0 && (
                        <div style={{ marginTop: 7, display: "inline-flex", background: "rgba(255,255,255,0.22)", borderRadius: 30, padding: "3px 14px", gap: 8, alignItems: "center" }}>
                          <span className="nunito" style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                            {p.totalGain >= 0 ? "▲ +" : "▼ "}${Math.abs(p.totalGain).toFixed(2)}
                          </span>
                          <span className="nunito" style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700 }}>
                            ({p.totalGainPct >= 0 ? "+" : ""}{p.totalGainPct.toFixed(2)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* ── LEADERBOARD ── */}
        {hasData && (
          <div style={{
            background: "#fff",
            border: "5px solid #f5a623",
            borderRadius: 24,
            padding: "14px 22px",
            marginBottom: 22,
            boxShadow: "5px 5px 0 #d4891c",
            display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
          }}>
            <div className="fredoka" style={{ color: "#f5a623", fontSize: 20 }}>🏆 Leaderboard</div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", flex: 1 }}>
              {ranked.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="bounce fredoka" style={{ fontSize: 24, animationDelay: `${i * 0.3}s`, color: "#bbb" }}>{MEDALS[i] || `#${i + 1}`}</span>
                  <div>
                    <div className="fredoka" style={{ color: p.color, fontSize: 17 }}>{p.name}</div>
                    {p.currentValue > 0 && (
                      <div className="nunito" style={{ fontWeight: 900, fontSize: 13, color: p.totalGain >= 0 ? "#27ae60" : "#e84545" }}>
                        {p.totalGain >= 0 ? "+" : ""}${p.totalGain.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {loading && <div className="fredoka" style={{ color: "#bbb", fontSize: 13 }}>Updating<span className="blink">...</span></div>}
          </div>
        )}

        {/* ── BUTTONS ── */}
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <button className="peppa-btn" disabled={loading} onClick={() => refresh()} style={{
              background: "#e84545", color: "#fff",
              padding: "13px 30px", borderRadius: 50, fontSize: 17,
              boxShadow: "0 5px 0 #a82e2e",
            }}>
              {loading ? "🔄 Loading..." : "🔄 Refresh Prices!"}
            </button>
          </div>
          {lastUpdated && (
            <div className="nunito" style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Updated: {lastUpdated} • Starting line: open on 6/17/26
            </div>
          )}
          <div className="nunito" style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700 }}>
            For fun only • Not financial advice!
          </div>
        </div>

      </div>
    </div>
  );
}
