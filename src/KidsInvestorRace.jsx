import React from 'react';

// A playful, clean cartoon horse vector asset
const CartoonHorse = () => (
  <svg viewBox="0 0 100 70" width="90" height="63" style={{ display: 'block' }}>
    {/* Tail */}
    <path d="M 12 38 C 4 36, 2 48, 8 54 C 10 50, 14 44, 12 38 Z" fill="#8B5A2B" />

    {/* Back Legs */}
    <rect x="22" y="42" width="7" height="22" rx="3.5" fill="#A06D3B" />
    <rect x="29" y="44" width="7" height="22" rx="3.5" fill="#C68E4F" />

    {/* Front Legs */}
    <rect x="62" y="44" width="7" height="22" rx="3.5" fill="#A06D3B" />
    <rect x="69" y="42" width="7" height="22" rx="3.5" fill="#C68E4F" />

    {/* Body */}
    <rect x="20" y="26" width="54" height="24" rx="12" fill="#C68E4F" />

    {/* Neck */}
    <path d="M 62 32 L 78 12 L 86 18 L 72 38 Z" fill="#C68E4F" />

    {/* Head */}
    <path d="M 74 14 C 74 8, 90 6, 92 14 C 94 20, 84 24, 78 18 Z" fill="#C68E4F" />

    {/* Mane */}
    <path d="M 64 26 C 60 16, 70 12, 74 12" stroke="#8B5A2B" strokeWidth="5" strokeLinecap="round" fill="none" />

    {/* Ears */}
    <path d="M 76 10 L 78 2 L 82 8 Z" fill="#8B5A2B" />

    {/* Eye */}
    <circle cx="85" cy="12" r="2.5" fill="#000" />
    <circle cx="86" cy="11" r="0.8" fill="#FFF" />

    {/* Saddle */}
    <path d="M 36 26 C 38 32, 52 32, 54 26 Z" fill="#555" />
  </svg>
);

export default function KidsInvestorRace({ racers = [] }) {
  // Extract gain values to handle relative positioning math
  const gains = racers.map((r) => r.gainPct);
  const maxGain = Math.max(...gains);
  const minGain = Math.min(...gains);
  const range = maxGain - minGain;

  // Map total returns proportionally to track percentage boundaries
  // Leaves safe padding (6% to 72%) so horses never clip off the edges
  const getLeftPercent = (gainPct) => {
    if (range === 0) return 39; // Default mid-track position if tied
    const minTrackPct = 6;
    const maxTrackPct = 72;
    return minTrackPct + ((gainPct - minGain) / range) * (maxTrackPct - minTrackPct);
  };

  return (
    <div
      className="kids-investor-league-race"
      style={{
        backgroundColor: '#76c75b', // Grassy bright green
        padding: '24px',
        borderRadius: '24px',
        boxShadow: '0 12px 0 #5da645, 0 12px 24px rgba(0,0,0,0.15)',
        border: '6px solid #fff',
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'auto',
      }}
    >
      {/* Title Header */}
      <h2
        style={{
          fontFamily: '"Fredoka One", "Comic Sans MS", cursive, sans-serif',
          color: '#fff',
          textAlign: 'center',
          marginTop: 0,
          marginBottom: '24px',
          fontSize: '28px',
          textShadow: '0 3px 0 #4a8c33, 0 4px 6px rgba(0,0,0,0.2)',
          letterSpacing: '0.5px',
        }}
      >
        🏇 The Grand Portfolio Derby 🏇
      </h2>

      {/* Main Track Frame */}
      <div
        style={{
          minWidth: '700px', // Prevents layout squishing on small viewports
          position: 'relative',
          backgroundColor: '#dfb17b', // Soft dirt track color
          borderRadius: '20px',
          overflow: 'hidden',
          border: '5px solid #c9965d',
          boxShadow: 'inset 0 6px 10px rgba(0,0,0,0.15)',
        }}
      >
        {racers.map((racer, index) => {
          const leftPosition = getLeftPercent(racer.gainPct);
          const isPositive = racer.gainPct >= 0;

          return (
            <div
              key={racer.id}
              style={{
                position: 'relative',
                height: '85px',
                // Lanes split by clean white lines; last lane has no border
                borderBottom:
                  index === racers.length - 1
                    ? 'none'
                    : '4px dashed rgba(255, 255, 255, 0.75)',
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box',
              }}
            >
              {/* Ghosted Lane Rank Background Identifier */}
              <div
                style={{
                  position: 'absolute',
                  left: '20px',
                  zIndex: 0,
                  fontFamily: '"Fredoka One", cursive, sans-serif',
                  fontSize: '38px',
                  color: 'rgba(255,255,255,0.3)',
                  userSelect: 'none',
                }}
              >
                #{index + 1}
              </div>

              {/* Smoothly Animated Horse & Jockey Group */}
              <div
                style={{
                  position: 'absolute',
                  left: `${leftPosition}%`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  // Snappy, spring-loaded transition curve ideal for children's UI
                  transition: 'left 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  whiteSpace: 'nowrap',
                  zIndex: racers.length - index, // Keeps front-runners layered layered properly
                }}
              >
                {/* Horse Graphics Frame */}
                <div style={{ position: 'relative', width: '90px', height: '65px' }}>
                  {/* Jockey Circular Avatar */}
                  <img
                    src={racer.avatar}
                    alt={racer.name}
                    style={{
                      position: 'absolute',
                      left: '34px',
                      top: '2px',
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      border: `4px solid ${racer.color}`,
                      backgroundColor: '#fff',
                      objectFit: 'cover',
                      zIndex: 2,
                      boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
                    }}
                  />
                  {/* Base Horse Design */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 1 }}>
                    <CartoonHorse />
                  </div>
                </div>

                {/* Racer Performance Label Tag */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    fontFamily: '"Nunito", "Helvetica Neue", sans-serif',
                    fontWeight: '800',
                    lineHeight: '1.2',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '6px 12px',
                    borderRadius: '14px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
                    border: '2px solid rgba(255,255,255,1)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      color: '#2c3e50',
                      fontFamily: '"Fredoka One", sans-serif',
                    }}
                  >
                    {racer.name}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      color: isPositive ? '#27ae60' : '#e74c3c',
                    }}
                  >
                    {isPositive ? '▲ +' : '▼ '}{racer.gainPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
