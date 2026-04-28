import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { festivalAPI } from '../utils/api';
import './FestivalBanner.css';

/* ── Festival config ────────────────────────────────────── */
const FESTIVAL_CONFIG = {
  Dashain:   { emoji: '🎑',  label: 'Dashain',   bg: 'linear-gradient(90deg,#6b0f0f,#b91c1c 30%,#dc2626 50%,#b91c1c 70%,#6b0f0f)', border: '#ef4444', gold: '#fca5a5' },
  Tihar:     { emoji: '🪔',  label: 'Tihar',     bg: 'linear-gradient(90deg,#1a0836,#2d0f6b 30%,#3b1282 50%,#2d0f6b 70%,#1a0836)', border: '#c53030', gold: '#ffd700' },
  Chatt:     { emoji: '🌅',  label: 'Chhath',    bg: 'linear-gradient(90deg,#7c2d12,#c2410c 30%,#ea580c 50%,#c2410c 70%,#7c2d12)', border: '#fb923c', gold: '#fde68a' },
  Eid:       { emoji: '☪️',  label: 'Eid',       bg: 'linear-gradient(90deg,#064e3b,#065f46 30%,#047857 50%,#065f46 70%,#064e3b)', border: '#34d399', gold: '#a7f3d0' },
  Christmas: { emoji: '🎄',  label: 'Christmas', bg: 'linear-gradient(90deg,#14532d,#15803d 30%,#16a34a 50%,#15803d 70%,#14532d)', border: '#ef4444', gold: '#fde047' },
  Custom:    { emoji: '🎉',  label: 'Festival',  bg: 'linear-gradient(90deg,#1e1b4b,#3730a3 30%,#4338ca 50%,#3730a3 70%,#1e1b4b)', border: '#818cf8', gold: '#fde68a' },
};

/* ── Countdown hook ─────────────────────────────────────── */
const useCountdown = (endDate) => {
  const calc = useCallback(() => {
    if (!endDate) return null;
    const diff = new Date(endDate) - new Date();
    if (diff <= 0) return { days: 0, hrs: 0, mins: 0, secs: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hrs:  Math.floor((diff % 86400000) / 3600000),
      mins: Math.floor((diff % 3600000)  / 60000),
      secs: Math.floor((diff % 60000)    / 1000),
    };
  }, [endDate]);

  const [time, setTime] = useState(calc);
  useEffect(() => {
    if (!endDate) return;
    setTime(calc());
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [endDate, calc]);
  return time;
};

const pad = (n) => String(n ?? 0).padStart(2, '0');

/* ══════════════════════════════════════════════════════════
   DECORATION COMPONENTS — one per festival type
══════════════════════════════════════════════════════════ */

/* Dashain — kites flying in the sky */
const KiteDecor = () => (
  <svg className="fb-decor fb-decor--kites" viewBox="0 0 1200 56" preserveAspectRatio="none" aria-hidden="true">
    {/* Kite 1 */}
    <g className="kite k1">
      <polygon points="60,8 74,22 60,36 46,22" fill="#ef4444" stroke="#fca5a5" strokeWidth="1"/>
      <line x1="60" y1="36" x2="56" y2="52" stroke="#fca5a5" strokeWidth="1"/>
      <line x1="56" y1="44" x2="52" y2="46" stroke="#fca5a5" strokeWidth="0.8"/>
      <line x1="56" y1="48" x2="60" y2="50" stroke="#fca5a5" strokeWidth="0.8"/>
      <line x1="46" y1="22" x2="74" y2="22" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
      <line x1="60" y1="8"  x2="60" y2="36" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
    </g>
    {/* Kite 2 */}
    <g className="kite k2">
      <polygon points="200,4 218,20 200,36 182,20" fill="#fbbf24" stroke="#fde68a" strokeWidth="1"/>
      <line x1="200" y1="36" x2="195" y2="54" stroke="#fde68a" strokeWidth="1"/>
      <line x1="197" y1="44" x2="192" y2="47" stroke="#fde68a" strokeWidth="0.8"/>
      <line x1="196" y1="50" x2="201" y2="52" stroke="#fde68a" strokeWidth="0.8"/>
      <line x1="182" y1="20" x2="218" y2="20" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
      <line x1="200" y1="4"  x2="200" y2="36" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
    </g>
    {/* Kite 3 */}
    <g className="kite k3">
      <polygon points="420,10 432,22 420,34 408,22" fill="#34d399" stroke="#a7f3d0" strokeWidth="1"/>
      <line x1="420" y1="34" x2="416" y2="50" stroke="#a7f3d0" strokeWidth="1"/>
      <line x1="418" y1="41" x2="414" y2="43" stroke="#a7f3d0" strokeWidth="0.8"/>
      <line x1="417" y1="47" x2="421" y2="49" stroke="#a7f3d0" strokeWidth="0.8"/>
      <line x1="408" y1="22" x2="432" y2="22" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
      <line x1="420" y1="10" x2="420" y2="34" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
    </g>
    {/* Kite 4 */}
    <g className="kite k4">
      <polygon points="680,6 696,20 680,34 664,20" fill="#818cf8" stroke="#c7d2fe" strokeWidth="1"/>
      <line x1="680" y1="34" x2="675" y2="52" stroke="#c7d2fe" strokeWidth="1"/>
      <line x1="677" y1="42" x2="672" y2="45" stroke="#c7d2fe" strokeWidth="0.8"/>
      <line x1="676" y1="49" x2="680" y2="51" stroke="#c7d2fe" strokeWidth="0.8"/>
      <line x1="664" y1="20" x2="696" y2="20" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
      <line x1="680" y1="6"  x2="680" y2="34" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
    </g>
    {/* Kite 5 */}
    <g className="kite k5">
      <polygon points="900,3 914,16 900,29 886,16" fill="#f472b6" stroke="#fbcfe8" strokeWidth="1"/>
      <line x1="900" y1="29" x2="895" y2="48" stroke="#fbcfe8" strokeWidth="1"/>
      <line x1="897" y1="37" x2="893" y2="40" stroke="#fbcfe8" strokeWidth="0.8"/>
      <line x1="896" y1="44" x2="900" y2="46" stroke="#fbcfe8" strokeWidth="0.8"/>
      <line x1="886" y1="16" x2="914" y2="16" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
      <line x1="900" y1="3"  x2="900" y2="29" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
    </g>
    {/* Kite 6 */}
    <g className="kite k6">
      <polygon points="1100,8 1112,20 1100,32 1088,20" fill="#ef4444" stroke="#fca5a5" strokeWidth="1"/>
      <line x1="1100" y1="32" x2="1096" y2="50" stroke="#fca5a5" strokeWidth="1"/>
      <line x1="1098" y1="40" x2="1093" y2="43" stroke="#fca5a5" strokeWidth="0.8"/>
      <line x1="1097" y1="47" x2="1101" y2="49" stroke="#fca5a5" strokeWidth="0.8"/>
      <line x1="1088" y1="20" x2="1112" y2="20" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
      <line x1="1100" y1="8"  x2="1100" y2="32" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
    </g>
  </svg>
);

/* Tihar — string lights */
const StringLights = () => (
  <svg className="fb-decor fb-decor--lights" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0,10 Q150,22 300,10 Q450,22 600,10 Q750,22 900,10 Q1050,22 1200,10"
          stroke="#c084fc" strokeWidth="1.5" fill="none" opacity="0.6"/>
    {[60,120,180,240,300,360,420,480,540,600,660,720,780,840,900,960,1020,1080,1140].map((x, i) => {
      const colors = ['#fbbf24','#f87171','#34d399','#60a5fa','#a78bfa','#f472b6'];
      const c = colors[i % colors.length];
      const y = i % 2 === 0 ? 18 : 24;
      return (
        <g key={x}>
          <line x1={x} y1="10" x2={x} y2={y - 4} stroke="#c084fc" strokeWidth="1" opacity="0.5"/>
          <ellipse cx={x} cy={y} rx="5" ry="7" fill={c} opacity="0.9"
                   style={{ filter: `drop-shadow(0 0 4px ${c})` }}/>
        </g>
      );
    })}
  </svg>
);

/* Chhath — sun rays */
const SunRays = () => (
  <svg className="fb-decor fb-decor--sun" viewBox="0 0 1200 56" preserveAspectRatio="none" aria-hidden="true">
    {[0,60,120,180,240,300,360,420,480,540,600,660,720,780,840,900,960,1020,1080,1140,1200].map((x,i) => (
      <line key={i} x1={x} y1="0" x2={x + 20} y2="56"
            stroke="#fde68a" strokeWidth="12" opacity="0.06"/>
    ))}
    <circle cx="600" cy="-20" r="44" fill="#fbbf24" opacity="0.18"/>
  </svg>
);

/* Eid — crescent + stars */
const CrescentStars = () => (
  <svg className="fb-decor fb-decor--eid" viewBox="0 0 1200 56" preserveAspectRatio="none" aria-hidden="true">
    {[80,200,350,520,700,860,1000,1130].map((x,i) => (
      <text key={i} x={x} y={i % 2 === 0 ? 18 : 32} fontSize="10" fill="#a7f3d0" opacity="0.6"
            style={{ userSelect:'none' }}>★</text>
    ))}
    <text x="560" y="40" fontSize="28" fill="#34d399" opacity="0.18"
          style={{ userSelect:'none' }}>☪</text>
  </svg>
);

/* Christmas — snowflakes */
const Snowflakes = () => (
  <svg className="fb-decor fb-decor--snow" viewBox="0 0 1200 56" preserveAspectRatio="none" aria-hidden="true">
    {[60,160,280,400,520,640,760,880,1000,1100].map((x,i) => (
      <text key={i} x={x} y={i % 2 === 0 ? 20 : 38} fontSize="14" fill="#bfdbfe" opacity="0.55"
            className={`snowflake sf${i}`} style={{ userSelect:'none' }}>❄</text>
    ))}
  </svg>
);

/* Custom / fallback — confetti dots */
const ConfettiDecor = () => (
  <svg className="fb-decor fb-decor--confetti" viewBox="0 0 1200 56" preserveAspectRatio="none" aria-hidden="true">
    {[...Array(24)].map((_, i) => (
      <circle key={i} cx={50 * i + 10} cy={i % 2 === 0 ? 14 : 32} r="3"
              fill={['#fde68a','#818cf8','#f472b6','#34d399'][i % 4]} opacity="0.5"/>
    ))}
  </svg>
);

const DECOR_MAP = {
  Dashain:   <KiteDecor />,
  Tihar:     <StringLights />,
  Chatt:     <SunRays />,
  Eid:       <CrescentStars />,
  Christmas: <Snowflakes />,
  Custom:    <ConfettiDecor />,
};

/* ── Lantern (only for Tihar / light festivals) ─────────── */
const Lantern = ({ flip }) => (
  <span className={`fb-lantern ${flip ? 'fb-lantern--flip' : ''}`} aria-hidden="true">🏮</span>
);

/* ══════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════ */
const FestivalBanner = () => {
  const [banner, setBanner] = useState(null);
  const [visible, setVisible] = useState(true);
  const navigate = useNavigate();
  const time = useCountdown(banner?.endDate);

  useEffect(() => {
    festivalAPI.getActive()
      .then(res => { if (res.data.data) setBanner(res.data.data); })
      .catch(() => {});
  }, []);

  if (!banner || !visible) return null;

  const cfg = FESTIVAL_CONFIG[banner.festivalName] || FESTIVAL_CONFIG.Custom;
  const emoji = cfg.emoji;
  const displayName = banner.festivalName === 'Custom'
    ? (banner.customFestivalName || 'Festival')
    : cfg.label;

  const isTihar = banner.festivalName === 'Tihar';

  const bannerStyle = {
    background:        cfg.bg,
    borderTopColor:    cfg.border,
    borderBottomColor: cfg.border,
    '--fb-gold':       cfg.gold,
  };

  const discountParts = banner.discountText.split(/(OFF)/i);

  return (
    <div className="fb-wrap" style={bannerStyle}>
      {/* Festival-specific top decoration */}
      {DECOR_MAP[banner.festivalName] || <ConfettiDecor />}

      {/* Container keeps content aligned with navbar/products/search */}
      <div className="container">
      <div className="fb-inner">
        {/* Side decorations */}
        {isTihar ? <><Lantern /><Lantern /></> : <span className="fb-side-emoji">{emoji}</span>}

        {/* ── Title ──────────────────────────────── */}
        <div className="fb-title-block">
          <span className="fb-party-emoji">{emoji}</span>
          <span className="fb-title">{displayName} {banner.title}</span>
        </div>

        <div className="fb-divider" />

        {/* ── Discount ───────────────────────────── */}
        <div className="fb-discount">
          {discountParts.map((part, i) =>
            /OFF/i.test(part)
              ? <span key={i} className="fb-off">{part}</span>
              : <span key={i}>{part}</span>
          )}
          {banner.subtitle && <span className="fb-subtitle"> {banner.subtitle}</span>}
        </div>

        <div className="fb-divider" />

        {/* ── Countdown ──────────────────────────── */}
        {time !== null ? (
          <div className="fb-countdown">
            <span className="fb-countdown__label">Offer<br/>ends in:</span>
            <div className="fb-countdown__units">
              {[
                { val: pad(time.days), label: 'Days' },
                { val: pad(time.hrs),  label: 'Hrs'  },
                { val: pad(time.mins), label: 'Mins' },
                { val: pad(time.secs), label: 'Secs' },
              ].map(({ val, label }) => (
                <div key={label} className="fb-unit">
                  <span className="fb-unit__val">{val}</span>
                  <span className="fb-unit__label">{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="fb-badge">{banner.discountText}</div>
        )}

        {/* ── CTA ────────────────────────────────── */}
        <button className="fb-cta" onClick={() => navigate(`/festival-sale/${banner._id}`)}>
          Shop Now →
        </button>

        {/* Right side decoration */}
        {isTihar ? <><Lantern flip /><Lantern flip /></> : <span className="fb-side-emoji">{emoji}</span>}

        <button className="fb-close" onClick={() => setVisible(false)} aria-label="Close">✕</button>
      </div>
      </div>{/* end .container */}
    </div>
  );
};

export default FestivalBanner;
