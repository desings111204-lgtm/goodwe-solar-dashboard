import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

const TARIFA_EXP = 0.06;
const TARIFA_PUNTA = 0.1102;
const TARIFA_VALLE = 0.033;
const STATION_ID = '8445d981-4fbe-414b-9d12-60bac0b7eeb1';
const SEMS = 'https://www.semsportal.com/api/v2';

const getTarifa = () => new Date().getHours() >= 8 ? TARIFA_PUNTA : TARIFA_VALLE;
function fW(w) {
  if (w == null || isNaN(w)) return '0 W';
  const a = Math.abs(w);
  return a >= 1000 ? `${(a/1000).toFixed(2)} kW` : `${Math.round(a)} W`;
}
function extractFields(d) {
  if (!d) return { ppv:0, pload:0, pgrid:0, pbat:0, soc:0, batCharging:false, batDischarging:false };
  const pf = d.powerflow;
  if (pf) {
    const raw = parseFloat(pf.bettery ?? pf.battery ?? pf.pbat ?? 0);
    return { ppv: parseFloat(pf.pv ?? pf.ppv ?? 0), pload: parseFloat(pf.load ?? pf.pload ?? 0),
      pgrid: parseFloat(pf.grid ?? pf.pgrid ?? 0), pbat: raw,
      batCharging: raw < 0, batDischarging: raw > 0, soc: parseFloat(pf.soc ?? d.soc ?? 0) };
  }
  const kpi = d.kpi || {}; const inv = d.inverter?.[0] || {}; const invD = inv.d || inv;
  const raw = parseFloat(invD.pbat ?? 0);
  return { ppv: parseFloat(kpi.pac ?? invD.ppv ?? 0), pload: parseFloat(kpi.load ?? invD.pload ?? 0),
    pgrid: parseFloat(invD.pgrid ?? 0), pbat: raw,
    batCharging: raw < 0, batDischarging: raw > 0, soc: parseFloat(d.soc ?? inv.soc ?? invD.soc ?? 0) };
}

// ===== ILLUSTRATED POWER FLOW SVG =====
function FlowScene({ ppv, pload, pgrid, pbat, soc, batCharging, batDischarging }) {
  const importing = pgrid > 0;
  const exporting = pgrid < 0;
  const hasSolar = ppv > 0;
  const hasBat = Math.abs(pbat) > 2;

  // Animated dash offset for flow lines
  const flowAnim = (reverse) => (
    <animate attributeName="stroke-dashoffset" from={reverse ? "24" : "0"} to={reverse ? "0" : "24"} dur="1.2s" repeatCount="indefinite"/>
  );

  return (
    <div style={{background:'linear-gradient(180deg,#07071a 0%,#0a0a1f 100%)',borderRadius:20,padding:'8px 4px',border:'1px solid rgba(255,255,255,0.05)'}}>
      <svg viewBox="0 0 360 320" width="100%" style={{overflow:'visible',display:'block'}}>
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="softglow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Room warm light gradient */}
          <radialGradient id="roomLight" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* ===== UTILITY POLE (left) ===== */}
        {/* Pole */}
        <rect x="28" y="80" width="6" height="160" rx="2" fill="#2a2a2a" stroke="#3a3a3a" strokeWidth="0.5"/>
        {/* Cross arm */}
        <rect x="10" y="88" width="42" height="5" rx="1.5" fill="#333"/>
        {/* Insulators */}
        <circle cx="14" cy="90" r="3" fill="#555"/>
        <circle cx="48" cy="90" r="3" fill="#555"/>
        {/* Power lines to house */}
        <line x1="14" y1="90" x2="105" y2="98" stroke={importing?'#f87171':exporting?'#34d399':'#333'} strokeWidth="1.5" strokeDasharray={pgrid!==0?'8 4':'none'}>
          {pgrid !== 0 && <animate attributeName="stroke-dashoffset" from={importing?"0":"24"} to={importing?"24":"0"} dur="1.5s" repeatCount="indefinite"/>}
        </line>
        <line x1="48" y1="90" x2="105" y2="98" stroke={importing?'#f87171':exporting?'#34d399':'#333'} strokeWidth="1"/>
        {/* GRID label */}
        <text x="31" y="77" textAnchor="middle" fill={importing?'#f87171':exporting?'#34d399':'#555'} fontSize="8" fontFamily="Space Mono">{importing?'IMPORT':exporting?'EXPORT':'RED'}</text>
        <text x="31" y="248" textAnchor="middle" fill="#444" fontSize="7" fontFamily="Space Mono">{fW(pgrid)}</text>

        {/* ===== HOUSE ===== */}
        {/* Foundation */}
        <rect x="95" y="195" width="185" height="95" rx="3" fill="#111122" stroke="rgba(99,102,241,0.2)" strokeWidth="1"/>
        {/* Roof */}
        <polygon points="87,198 187,118 283,198" fill="#0d0d20" stroke="rgba(99,102,241,0.35)" strokeWidth="1.5"/>
        {/* Roof detail */}
        <polygon points="87,198 187,120 283,198 283,200 87,200" fill="rgba(99,102,241,0.05)"/>
        {/* Wall texture lines */}
        <line x1="95" y1="215" x2="280" y2="215" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        <line x1="95" y1="235" x2="280" y2="235" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        <line x1="95" y1="255" x2="280" y2="255" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        <line x1="95" y1="275" x2="280" y2="275" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        {/* Chimney */}
        <rect x="220" y="128" width="16" height="30" fill="#111122" stroke="rgba(99,102,241,0.2)" strokeWidth="1"/>
        {/* Door */}
        <rect x="163" y="255" width="28" height="35" rx="2" fill="#0a0a18" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
        <circle cx="188" cy="273" r="2" fill="#fbbf24"/>
        {/* ROOM WINDOW with warm light */}
        <rect x="230" y="210" width="40" height="35" rx="3" fill="rgba(253,230,138,0.08)" stroke="rgba(253,230,138,0.3)" strokeWidth="1"/>
        <rect x="230" y="210" width="40" height="35" rx="3" fill="url(#roomLight)"/>
        {/* Window cross */}
        <line x1="250" y1="210" x2="250" y2="245" stroke="rgba(253,230,138,0.2)" strokeWidth="1"/>
        <line x1="230" y1="227" x2="270" y2="227" stroke="rgba(253,230,138,0.2)" strokeWidth="1"/>
        {/* Room light bulb */}
        <circle cx="250" cy="225" r="5" fill="#fde68a" opacity="0.8" filter="url(#softglow)"/>
        {/* Window glow ambient */}
        <ellipse cx="250" cy="230" rx="25" ry="20" fill="rgba(253,230,138,0.04)"/>
        {/* Small left window */}
        <rect x="105" y="218" width="32" height="24" rx="2" fill="#0a0a18" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
        <line x1="121" y1="218" x2="121" y2="242" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
        <line x1="105" y1="230" x2="137" y2="230" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
        {/* Consumption label */}
        <text x="187" y="208" textAnchor="middle" fill="#818cf8" fontSize="9" fontFamily="Space Mono" fontWeight="700">{fW(pload)}</text>
        <text x="187" y="218" textAnchor="middle" fill="rgba(129,140,248,0.4)" fontSize="7" fontFamily="Space Mono">CONSUMO</text>

        {/* ===== SOLAR PANELS on roof ===== */}
        {/* Panel group - angled with roof */}
        <g transform="translate(140, 140) rotate(-27)">
          {/* Panel 1 */}
          <rect x="0" y="0" width="22" height="14" rx="1" fill={hasSolar?'rgba(96,165,250,0.15)':'rgba(30,30,50,0.8)'} stroke={hasSolar?'rgba(96,165,250,0.5)':'rgba(60,60,80,0.5)'} strokeWidth="0.8"/>
          <line x1="0" y1="5" x2="22" y2="5" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="0" y1="9" x2="22" y2="9" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="7" y1="0" x2="7" y2="14" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="14" y1="0" x2="14" y2="14" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          {/* Panel 2 */}
          <rect x="25" y="0" width="22" height="14" rx="1" fill={hasSolar?'rgba(96,165,250,0.15)':'rgba(30,30,50,0.8)'} stroke={hasSolar?'rgba(96,165,250,0.5)':'rgba(60,60,80,0.5)'} strokeWidth="0.8"/>
          <line x1="25" y1="5" x2="47" y2="5" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="25" y1="9" x2="47" y2="9" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="32" y1="0" x2="32" y2="14" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="39" y1="0" x2="39" y2="14" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          {/* Panel 3 */}
          <rect x="50" y="0" width="22" height="14" rx="1" fill={hasSolar?'rgba(96,165,250,0.15)':'rgba(30,30,50,0.8)'} stroke={hasSolar?'rgba(96,165,250,0.5)':'rgba(60,60,80,0.5)'} strokeWidth="0.8"/>
          <line x1="50" y1="5" x2="72" y2="5" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="50" y1="9" x2="72" y2="9" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="57" y1="0" x2="57" y2="14" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="64" y1="0" x2="64" y2="14" stroke={hasSolar?'rgba(96,165,250,0.2)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          {/* Row 2 */}
          <rect x="0" y="17" width="22" height="14" rx="1" fill={hasSolar?'rgba(96,165,250,0.12)':'rgba(30,30,50,0.8)'} stroke={hasSolar?'rgba(96,165,250,0.4)':'rgba(60,60,80,0.4)'} strokeWidth="0.8"/>
          <line x1="7" y1="17" x2="7" y2="31" stroke={hasSolar?'rgba(96,165,250,0.15)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="14" y1="17" x2="14" y2="31" stroke={hasSolar?'rgba(96,165,250,0.15)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <rect x="25" y="17" width="22" height="14" rx="1" fill={hasSolar?'rgba(96,165,250,0.12)':'rgba(30,30,50,0.8)'} stroke={hasSolar?'rgba(96,165,250,0.4)':'rgba(60,60,80,0.4)'} strokeWidth="0.8"/>
          <line x1="32" y1="17" x2="32" y2="31" stroke={hasSolar?'rgba(96,165,250,0.15)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="39" y1="17" x2="39" y2="31" stroke={hasSolar?'rgba(96,165,250,0.15)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <rect x="50" y="17" width="22" height="14" rx="1" fill={hasSolar?'rgba(96,165,250,0.12)':'rgba(30,30,50,0.8)'} stroke={hasSolar?'rgba(96,165,250,0.4)':'rgba(60,60,80,0.4)'} strokeWidth="0.8"/>
          <line x1="57" y1="17" x2="57" y2="31" stroke={hasSolar?'rgba(96,165,250,0.15)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          <line x1="64" y1="17" x2="64" y2="31" stroke={hasSolar?'rgba(96,165,250,0.15)':'rgba(60,60,80,0.3)'} strokeWidth="0.5"/>
          {/* Solar glow when active */}
          {hasSolar && <ellipse cx="36" cy="15" rx="40" ry="20" fill="rgba(96,165,250,0.05)" filter="url(#softglow)"/>}
        </g>

        {/* Solar PV value */}
        {hasSolar && (
          <>
            <circle cx="187" cy="95" r="26" fill="rgba(96,165,250,0.08)" stroke="rgba(96,165,250,0.3)" strokeWidth="1" filter="url(#softglow)"/>
            <text x="187" y="91" textAnchor="middle" fill="#60a5fa" fontSize="12" fontFamily="Space Mono" fontWeight="700">{fW(ppv)}</text>
            <text x="187" y="103" textAnchor="middle" fill="rgba(96,165,250,0.6)" fontSize="7" fontFamily="Space Mono">FV</text>
          </>
        )}
        {!hasSolar && (
          <>
            <circle cx="187" cy="95" r="22" fill="rgba(30,30,50,0.5)" stroke="rgba(60,60,80,0.3)" strokeWidth="1"/>
            <text x="187" y="91" textAnchor="middle" fill="#333" fontSize="11" fontFamily="Space Mono">0 W</text>
            <text x="187" y="103" textAnchor="middle" fill="#2a2a3a" fontSize="7" fontFamily="Space Mono">SIN SOL</text>
          </>
        )}

        {/* ===== INVERTERS (below house, center-left) ===== */}
        {/* Inverter 1 */}
        <rect x="130" y="302" width="38" height="28" rx="4" fill="#111" stroke="rgba(99,102,241,0.4)" strokeWidth="1"/>
        <rect x="133" y="305" width="32" height="22" rx="2" fill="rgba(99,102,241,0.05)"/>
        <circle cx="144" cy="314" r="4" fill="none" stroke="rgba(99,102,241,0.5)" strokeWidth="1"/>
        <circle cx="144" cy="314" r="1.5" fill={hasSolar||hasBat?'#818cf8':'#333'}/>
        <text x="149" y="311" fill="rgba(255,255,255,0.3)" fontSize="5" fontFamily="Space Mono">GW</text>
        <text x="149" y="318" fill="rgba(255,255,255,0.2)" fontSize="4" fontFamily="Space Mono">3600</text>
        <text x="149" y="323" fill="rgba(255,255,255,0.15)" fontSize="4" fontFamily="Space Mono">EH</text>
        <text x="149" y="332" textAnchor="middle" fill="rgba(99,102,241,0.4)" fontSize="6" fontFamily="Space Mono">INV 1</text>
        {/* Inverter 2 */}
        <rect x="178" y="302" width="38" height="28" rx="4" fill="#111" stroke="rgba(99,102,241,0.4)" strokeWidth="1"/>
        <rect x="181" y="305" width="32" height="22" rx="2" fill="rgba(99,102,241,0.05)"/>
        <circle cx="192" cy="314" r="4" fill="none" stroke="rgba(99,102,241,0.5)" strokeWidth="1"/>
        <circle cx="192" cy="314" r="1.5" fill={hasSolar||hasBat?'#818cf8':'#333'}/>
        <text x="197" y="311" fill="rgba(255,255,255,0.3)" fontSize="5" fontFamily="Space Mono">GW</text>
        <text x="197" y="318" fill="rgba(255,255,255,0.2)" fontSize="4" fontFamily="Space Mono">3600</text>
        <text x="197" y="323" fill="rgba(255,255,255,0.15)" fontSize="4" fontFamily="Space Mono">EH</text>
        <text x="197" y="332" textAnchor="middle" fill="rgba(99,102,241,0.4)" fontSize="6" fontFamily="Space Mono">INV 2</text>

        {/* ===== BATTERY (right side of inverters) ===== */}
        <rect x="268" y="296" width="28" height="48" rx="4" fill="#0a0a15" stroke={batCharging?'rgba(96,165,250,0.5)':batDischarging?'rgba(167,139,250,0.5)':'rgba(60,60,80,0.4)'} strokeWidth="1.2"/>
        {/* Battery terminal */}
        <rect x="277" y="293" width="10" height="4" rx="1" fill={batCharging?'rgba(96,165,250,0.4)':batDischarging?'rgba(167,139,250,0.4)':'#333'}/>
        {/* Battery fill level */}
        {soc > 0 && (
          <>
            <rect x="271" y="300" width="22" height="38" rx="2" fill="rgba(0,0,0,0.5)"/>
            <rect x="272" y={300 + Math.round(38 * (1 - soc/100))} width="20" height={Math.round(38 * soc/100)} rx="2"
              fill={soc > 50 ? (batCharging?'rgba(96,165,250,0.4)':'rgba(52,211,153,0.35)') : soc > 20 ? 'rgba(251,191,36,0.35)' : 'rgba(248,113,113,0.35)'}
              stroke={soc > 50 ? (batCharging?'rgba(96,165,250,0.3)':'rgba(52,211,153,0.3)') : 'rgba(251,191,36,0.3)'} strokeWidth="0.5"/>
          </>
        )}
        {/* SOC text */}
        <text x="282" y="322" textAnchor="middle" fill={batCharging?'#60a5fa':batDischarging?'#a78bfa':'#888'} fontSize="9" fontFamily="Space Mono" fontWeight="700">{soc > 0 ? `${soc}%` : '--'}</text>
        <text x="282" y="333" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="Space Mono">{batCharging?'↓carg':batDischarging?'↑desc':'repos'}</text>
        <text x="282" y="348" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="6" fontFamily="Space Mono">{fW(pbat)}</text>
        {/* Battery label */}
        <text x="282" y="355" textAnchor="middle" fill="rgba(255,255,255,0.1)" fontSize="6" fontFamily="Space Mono">LXD5</text>

        {/* ===== FLOW LINES ===== */}
        {/* Solar → Inverters (from roof to inverters) */}
        {hasSolar && (
          <line x1="187" y1="190" x2="187" y2="302" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="6 4" filter="url(#glow)">
            <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1s" repeatCount="indefinite"/>
          </line>
        )}
        {!hasSolar && <line x1="187" y1="190" x2="187" y2="302" stroke="rgba(60,60,80,0.3)" strokeWidth="1" strokeDasharray="4 6"/>}

        {/* Inverter 1 → Battery */}
        {hasBat && (
          <line x1="228" y1="316" x2="268" y2="316" stroke={batCharging?'#60a5fa':'#a78bfa'} strokeWidth="1.5" strokeDasharray="5 4" filter="url(#glow)">
            <animate attributeName="stroke-dashoffset" from={batCharging?"0":"18"} to={batCharging?"18":"0"} dur="1s" repeatCount="indefinite"/>
          </line>
        )}
        {!hasBat && <line x1="228" y1="316" x2="268" y2="316" stroke="rgba(60,60,80,0.25)" strokeWidth="1" strokeDasharray="3 6"/>}

        {/* Inverters → House (load) */}
        {pload > 0 && (
          <line x1="168" y1="302" x2="168" y2="290" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="5 4">
            <animate attributeName="stroke-dashoffset" from="0" to="18" dur="1s" repeatCount="indefinite"/>
          </line>
        )}

        {/* Grid line to house (already at top, connecting pole to house wall) */}
        {/* Visual connection dot at house wall */}
        <circle cx="105" cy="98" r="3" fill={importing?'#f87171':exporting?'#34d399':'#333'}/>

        {/* ===== LABELS ===== */}
        {/* Grid power label near pole */}
        <text x="65" y="88" fill={importing?'#f87171':exporting?'#34d399':'#444'} fontSize="8" fontFamily="Space Mono" fontWeight="700">{fW(pgrid)}</text>

        {/* Battery indicator bar bottom */}
        <text x="282" y="308" textAnchor="middle" fill="rgba(255,255,255,0.08)" fontSize="5" fontFamily="Space Mono">BAT</text>

        {/* Ground line */}
        <line x1="80" y1="292" x2="320" y2="292" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
      </svg>
    </div>
  );
}

// ===== DONUT =====
function Donut({ pct, color, label, value }) {
  const r = 34; const circ = 2*Math.PI*r;
  const dash = Math.max(0, Math.min(pct,1)) * circ;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8"/>
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ*0.25}
          strokeLinecap="round" style={{filter:`drop-shadow(0 0 4px ${color})`}}/>
        <text x="40" y="36" textAnchor="middle" fill="white" fontSize="10" fontFamily="Space Mono" fontWeight="700">{value}</text>
        <text x="40" y="48" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="Space Mono">kWh</text>
      </svg>
      <div style={{fontSize:9,color:'#555',fontFamily:'Space Mono',textAlign:'center'}}>{label}</div>
    </div>
  );
}

// ===== LINE CHART =====
function LineChart({ points, color }) {
  if (!points||points.length<2) return <div style={{height:90,display:'flex',alignItems:'center',justifyContent:'center',color:'#222',fontFamily:'Space Mono',fontSize:10}}>Sin datos</div>;
  const vals = points.map(p=>p.v);
  const max = Math.max(...vals, 0.01);
  const W=100, H=90;
  const pts = points.map((p,i)=>{
    const x=(i/(points.length-1))*W;
    const y=H-(p.v/max)*(H-8)-4;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{display:'block'}}>
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <polygon points={`0,${H} `+pts+` ${W},${H}`} fill="url(#cg)"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" style={{filter:`drop-shadow(0 0 3px ${color})`}}/>
    </svg>
  );
}

export default function Dashboard() {
  const [step,setStep]=useState('login');
  const [acct,setAcct]=useState('');
  const [pwd,setPwd]=useState('');
  const [token,setToken]=useState(null);
  const [live,setLive]=useState(null);
  const [kpi,setKpi]=useState(null);
  const [chartPts,setChartPts]=useState([]);
  const [period,setPeriod]=useState('day');
  const [date,setDate]=useState('');
  const [tab,setTab]=useState('live');
  const [err,setErr]=useState('');
  const [monErr,setMonErr]=useState(null);
  const [loading,setLoading]=useState(false);
  const [histLoading,setHistLoading]=useState(false);
  const [lastUp,setLastUp]=useState(null);
  const [acc,setAcc]=useState({imp:0,exp:0,self:0});
  const lastRef=useRef(null);
  const intRef=useRef(null);

  const doLogin=async()=>{
    setLoading(true);setErr('');
    try{
      const r=await fetch('/api/sems',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:acct,pwd})});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error||'Login failed');
      setToken(j);setStep('dashboard');
    }catch(e){setErr(e.message);}finally{setLoading(false);}
  };

  const fetchLive=useCallback(async()=>{
    if(!token) return;
    try{
      setMonErr(null);
      const r=await fetch(`${SEMS}/PowerStation/GetMonitorDetailByPowerstationId`,{
        method:'POST',headers:{'Content-Type':'application/json','Token':JSON.stringify(token)},
        body:JSON.stringify({powerStationId:STATION_ID})
      });
      const raw=await r.text();
      let res;try{res=JSON.parse(raw);}catch(e){throw new Error('No JSON');}
      if(parseInt(res.code)!==0) throw new Error(`${res.code}: ${res.msg}`);
      const d=res.data;
      setKpi(d.kpi);
      const f=extractFields(d);
      setLive(f);
      setLastUp(new Date());
      const now=Date.now();
      if(lastRef.current){
        const dtH=(now-lastRef.current)/3600000;
        setAcc(p=>({
          imp: p.imp+(f.pgrid>0?f.pgrid*dtH/1000:0),
          exp: p.exp+(f.pgrid<0?Math.abs(f.pgrid)*dtH/1000:0),
          self: p.self+(Math.max(0,f.ppv-Math.max(0,-f.pgrid))*dtH/1000),
        }));
      }
      lastRef.current=now;
    }catch(e){setMonErr(e.message);}
  },[token]);

  const fetchHistory=useCallback(async(p,d)=>{
    if(!token) return;
    setHistLoading(true);setChartPts([]);
    try{
      const today=new Date();
      const ds=d||today.toISOString().split('T')[0];
      let endpoint,body;
      if(p==='day'){endpoint='/PowerStation/GetPowerStationPowerChart';body={powerStationId:STATION_ID,date:ds};}
      else if(p==='week'){const mon=new Date(today);mon.setDate(today.getDate()-((today.getDay()+6)%7));endpoint='/PowerStation/GetPowerStationChart';body={powerStationId:STATION_ID,date:mon.toISOString().split('T')[0],chartType:2};}
      else if(p==='month'){endpoint='/PowerStation/GetPowerStationChart';body={powerStationId:STATION_ID,date:`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`,chartType:3};}
      else{endpoint='/PowerStation/GetPowerStationChart';body={powerStationId:STATION_ID,date:`${today.getFullYear()}-01-01`,chartType:4};}
      const r=await fetch(`${SEMS}${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','Token':JSON.stringify(token)},body:JSON.stringify(body)});
      const raw=await r.text();
      let res;try{res=JSON.parse(raw);}catch(e){return;}
      if(parseInt(res.code)!==0) return;
      const data=res.data;
      const arr=data?.lines?.[0]?.xy||data?.power||data?.pac||data?.list||(Array.isArray(data)?data:null)||(data&&Object.values(data).find(v=>Array.isArray(v)));
      if(Array.isArray(arr)){
        setChartPts(arr.map((pt,i)=>({t:pt.x||pt.time||i,v:Math.max(0,parseFloat(pt.y??pt.value??pt.power??pt.pac??0))})));
      }
    }catch(e){console.log('History err:',e);}finally{setHistLoading(false);}
  },[token]);

  useEffect(()=>{
    if(step==='dashboard'){
      fetchLive();
      intRef.current=setInterval(fetchLive,30000);
      fetchHistory(period,date);
    }
    return()=>clearInterval(intRef.current);
  },[step,fetchLive]);

  useEffect(()=>{
    if(step==='dashboard') fetchHistory(period,date);
  },[period,date]);

  const tarifa=getTarifa();
  const ie=acc.exp*TARIFA_EXP;
  const aa=acc.self*tarifa;
  const gi=acc.imp*tarifa;
  const neto=ie+aa-gi;

  const xLabels=period==='day'?['00','04','08','12','16','20']:period==='week'?['L','M','X','J','V','S','D']:period==='month'?['1','5','10','15','20','25','30']:['E','F','M','A','M','J','J','A','S','O','N','D'];

  return(
    <>
      <Head>
        <title>Solar Dashboard</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>
      <div className="app">

      {step==='login'&&(
        <div className="lp">
          <div className="lg"/>
          <div className="lb">
            <div className="sun">☀️</div>
            <h1 className="lt">GoodWe<br/><span>Dashboard</span></h1>
            <p style={{color:'#444',fontSize:13,fontWeight:300}}>Monitor solar en tiempo real</p>
            <input className="inp" type="email" placeholder="Email SEMS+" value={acct} onChange={e=>setAcct(e.target.value)}/>
            <input className="inp" type="password" placeholder="Contraseña" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
            {err&&<div className="err">{err}</div>}
            <button className="btnl" onClick={doLogin} disabled={loading}>{loading?'Conectando...':'Entrar →'}</button>
          </div>
        </div>
      )}

      {step==='dashboard'&&(
        <div className="dash">
          <header className="hdr">
            <div>
              <div className="eyebrow">INSTALACIÓN SOLAR • PONFERRADA</div>
              <div className="htitle">David Vega</div>
            </div>
            <div className="clock">
              <div className="dot"/>
              <span>{lastUp?lastUp.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--:--:--'}</span>
            </div>
          </header>

          {/* Top KPI strip */}
          {kpi&&(
            <div className="kstrip">
              <div className="ks">
                <div className="ksv yellow">{kpi.power??0}<span className="ksu">kWh</span></div>
                <div className="ksl">Hoy</div>
              </div>
              <div className="ksdiv"/>
              <div className="ks">
                <div className="ksv green">{kpi.day_income??'0'}<span className="ksu">€</span></div>
                <div className="ksl">Ingresos</div>
              </div>
              <div className="ksdiv"/>
              <div className="ks">
                <div className="ksv red">{gi>0?gi.toFixed(3):'0.000'}<span className="ksu">€</span></div>
                <div className="ksl">Gasto red</div>
              </div>
              <div className="ksdiv"/>
              <div className="ks">
                <div className={`ksv ${neto>=0?'green':'red'}`}>{neto>=0?'+':''}{neto.toFixed(3)}<span className="ksu">€</span></div>
                <div className="ksl">Balance</div>
              </div>
            </div>
          )}

          <nav className="tabs">
            {[['live','⚡ Directo'],['history','📊 Histórico'],['balance','💰 Balance']].map(([k,l])=>(
              <button key={k} className={`tb ${tab===k?'on':''}`} onClick={()=>setTab(k)}>{l}</button>
            ))}
          </nav>

          {monErr&&<div className="merr">{monErr}</div>}

          {tab==='live'&&(
            <div className="tc">
              <div className="sec">
                <div className="sl">FLUJO EN VIVO</div>
                {live?<FlowScene {...live}/>:<div className="ldtxt">Conectando...</div>}
              </div>
              {live&&(
                <div className="sec">
                  <div className="sl">VALORES ACTUALES</div>
                  <div className="g2">
                    <div className="sc solar"><div className="sci">☀️</div><div className="scv">{fW(live.ppv)}</div><div className="scl">Solar FV</div><div className="scs">{live.ppv>0?'Generando':'Sin sol'}</div></div>
                    <div className={`sc ${live.pgrid>0?'imp':live.pgrid<0?'exp':'neut'}`}><div className="sci">{live.pgrid>0?'⬇️':live.pgrid<0?'⬆️':'↔️'}</div><div className="scv">{fW(live.pgrid)}</div><div className="scl">Red</div><div className="scs">{live.pgrid>0?'Importando':live.pgrid<0?'Exportando':'Neutro'}</div></div>
                    <div className="sc load"><div className="sci">🏠</div><div className="scv">{fW(live.pload)}</div><div className="scl">Consumo casa</div><div className="scs">Carga total</div></div>
                    <div className={`sc ${live.batCharging?'batc':live.batDischarging?'batd':'neut'}`}><div className="sci">🔋</div><div className="scv">{live.soc>0?`${live.soc}%`:'—'}</div><div className="scl">Batería LXD5</div><div className="scs">{live.batCharging?`Cargando ${fW(live.pbat)}`:live.batDischarging?`Descargando ${fW(live.pbat)}`:'Reposo'}</div></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==='history'&&(
            <div className="tc">
              <div className="sec">
                <div className="prow">
                  {[['day','Hoy'],['week','Semana'],['month','Mes'],['year','Año']].map(([k,l])=>(
                    <button key={k} className={`pb ${period===k?'on':''}`} onClick={()=>setPeriod(k)}>{l}</button>
                  ))}
                </div>
                <div className="drow">
                  <input type="date" className="dinp" value={date} onChange={e=>setDate(e.target.value)}/>
                  <button className="dclear" onClick={()=>setDate('')}>Hoy</button>
                </div>
              </div>
              {kpi&&(
                <div className="sec">
                  <div className="sl">DISTRIBUCIÓN HOY</div>
                  <div style={{display:'flex',justifyContent:'space-around',padding:'8px 0'}}>
                    <Donut pct={1} color="#fbbf24" label="Generado" value={(kpi.power??0).toFixed(1)}/>
                    <Donut pct={0.18} color="#818cf8" label="Autoconsumo" value={(parseFloat(kpi.power||0)*0.18).toFixed(1)}/>
                    <Donut pct={0.82} color="#34d399" label="Inyectado" value={(parseFloat(kpi.power||0)*0.82).toFixed(1)}/>
                  </div>
                </div>
              )}
              <div className="sec">
                <div className="sl">CURVA — {period==='day'?'HOY':period==='week'?'ESTA SEMANA':period==='month'?'ESTE MES':'ESTE AÑO'}</div>
                <div className="chartc">
                  {histLoading?<div className="ldtxt">Cargando...</div>:chartPts.length>1?(
                    <><LineChart points={chartPts} color="#fbbf24"/><div className="xlabs">{xLabels.map((l,i)=><span key={i} className="xl">{l}</span>)}</div></>
                  ):(
                    <div style={{textAlign:'center',padding:'28px 0',color:'#333',fontSize:12}}>
                      <div style={{fontSize:26,marginBottom:6}}>📊</div>
                      <div>Sin datos para este período</div>
                      <button className="btnr" onClick={()=>fetchHistory(period,date)} style={{marginTop:10}}>Recargar</button>
                    </div>
                  )}
                </div>
              </div>
              {period==='week'&&(
                <div className="sec">
                  <div className="sl">DÍAS DE LA SEMANA</div>
                  <div className="wbars">
                    {['L','M','X','J','V','S','D'].map((d,i)=>{
                      const tod=(new Date().getDay()+6)%7;
                      const pt=chartPts[i]||{v:0};
                      const pct=chartPts.length?pt.v/Math.max(...chartPts.map(p=>p.v),0.01):0;
                      return(
                        <div key={d} className="wbc">
                          <div className="wbv" style={{height:`${Math.max(4,pct*80)}px`,background:i===tod?'linear-gradient(to top,#f59e0b,#fbbf24)':'linear-gradient(to top,#1a1a28,#252535)',opacity:i===tod?1:0.5}}>
                            {pt.v>0&&<div className="wbnum">{pt.v.toFixed(1)}</div>}
                          </div>
                          <div className="wbl" style={{color:i===tod?'#fbbf24':'#333'}}>{d}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==='balance'&&(
            <div className="tc">
              <div className="sec">
                <div className="sl">GASTO ENERGÍA COMPRADA (SESIÓN)</div>
                <div className="costhero">
                  <div style={{fontSize:28,marginBottom:6}}>🔌</div>
                  <div className="chv">{gi.toFixed(6)} €</div>
                  <div className="chk">{acc.imp.toFixed(4)} kWh importados</div>
                  <div className="cht">Tarifa: {tarifa} €/kWh ({new Date().getHours()>=8?'Punta 08-24h':'Valle 00-08h'})</div>
                </div>
              </div>
              <div className="sec">
                <div className="sl">BALANCE NETO (SESIÓN)</div>
                <div className="balc">
                  <div className="br"><span className="bl">💰 Ingresos exportación</span><span className="bv pos">+{ie.toFixed(6)} €</span></div>
                  <div className="br"><span className="bl">⚡ Ahorro autoconsumo</span><span className="bv pos">+{aa.toFixed(6)} €</span></div>
                  <div className="br"><span className="bl">🔌 Gasto importación</span><span className="bv neg">−{gi.toFixed(6)} €</span></div>
                  <div className="bdiv"/>
                  <div className="bneto"><span>BALANCE NETO</span><span className={neto>=0?'npos':'nneg'}>{neto>=0?'+':''}{neto.toFixed(6)} €</span></div>
                </div>
              </div>
              {kpi&&(
                <div className="sec">
                  <div className="sl">TOTALES SEMS</div>
                  <div className="balc">
                    <div className="br"><span className="bl">⚡ Generación hoy</span><span className="bv pos">{kpi.power} kWh</span></div>
                    <div className="br"><span className="bl">💰 Ingresos hoy</span><span className="bv pos">{kpi.day_income} €</span></div>
                    <div className="br"><span className="bl">📊 Total generado</span><span className="bv pos">{kpi.total_power} kWh</span></div>
                    <div className="br"><span className="bl">🏦 Ingresos totales</span><span className="bv pos">{kpi.total_income} €</span></div>
                  </div>
                </div>
              )}
              <div className="sec">
                <div className="sl">TARIFAS</div>
                <div className="balc">
                  <div className="br"><span className="bl">Exportación (fija)</span><span className="bv" style={{color:'#a3e635'}}>{TARIFA_EXP} €/kWh</span></div>
                  <div className="br"><span className="bl">Importación punta (08-24h)</span><span className="bv" style={{color:'#fb923c'}}>{TARIFA_PUNTA} €/kWh</span></div>
                  <div className="br"><span className="bl">Importación valle (00-08h)</span><span className="bv" style={{color:'#60a5fa'}}>{TARIFA_VALLE} €/kWh</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#030309;color:#e8e8f4;font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased}
        .app{min-height:100vh;max-width:480px;margin:0 auto}
        .lp{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden}
        .lg{position:absolute;top:-80px;left:50%;transform:translateX(-50%);width:360px;height:360px;background:radial-gradient(circle,rgba(251,191,36,.1),transparent 70%);pointer-events:none}
        .lb{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:360px;z-index:1}
        .sun{font-size:50px;filter:drop-shadow(0 0 16px rgba(251,191,36,.5));animation:ps 3s infinite}
        @keyframes ps{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        .lt{font-size:33px;font-weight:900;text-align:center;line-height:1;letter-spacing:-1px}
        .lt span{color:#fbbf24;text-shadow:0 0 16px rgba(251,191,36,.4)}
        .inp{width:100%;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 16px;color:#e8e8f4;font-size:15px;font-family:'Outfit',sans-serif;outline:none;transition:border-color .2s}
        .inp:focus{border-color:rgba(251,191,36,.4)}
        .btnl{width:100%;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#000;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer;box-shadow:0 0 18px rgba(251,191,36,.2)}
        .btnl:disabled{opacity:.5}
        .err{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:8px;padding:10px 14px;color:#f87171;font-size:12px;width:100%}
        .dash{padding-bottom:48px}
        .hdr{display:flex;justify-content:space-between;align-items:center;padding:16px 14px 10px;border-bottom:1px solid rgba(255,255,255,.04)}
        .eyebrow{font-family:'Space Mono',monospace;font-size:8px;letter-spacing:2.5px;color:#252535;margin-bottom:3px}
        .htitle{font-size:19px;font-weight:700;letter-spacing:-.5px}
        .clock{display:flex;align-items:center;gap:5px;font-family:'Space Mono',monospace;font-size:11px;color:#3a3a4a}
        .dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;animation:pd 2s infinite}
        @keyframes pd{0%,100%{opacity:1}50%{opacity:.3}}
        .kstrip{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.04);gap:4px}
        .ksdiv{width:1px;height:28px;background:rgba(255,255,255,.06)}
        .ks{display:flex;flex-direction:column;align-items:center;gap:2px}
        .ksv{font-family:'Space Mono',monospace;font-size:13px;font-weight:700;text-align:center}
        .ksu{font-size:8px;opacity:0.6;margin-left:2px}
        .ksl{font-size:8px;color:#333;text-align:center}
        .yellow{color:#fbbf24;text-shadow:0 0 8px rgba(251,191,36,.3)}
        .green{color:#34d399;text-shadow:0 0 8px rgba(52,211,153,.3)}
        .red{color:#f87171;text-shadow:0 0 8px rgba(248,113,113,.3)}
        .tabs{display:flex;gap:4px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.03)}
        .tb{flex:1;background:transparent;border:1px solid transparent;border-radius:10px;padding:9px 4px;font-size:12px;font-weight:500;font-family:'Outfit',sans-serif;color:#3a3a4a;cursor:pointer;transition:all .2s;white-space:nowrap}
        .tb.on{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08);color:#e8e8f4}
        .tc{padding-bottom:20px}
        .merr{margin:10px 12px;background:rgba(248,113,113,.07);border:1px solid rgba(248,113,113,.15);border-radius:10px;padding:10px 12px;color:#f87171;font-size:12px}
        .sec{padding:14px 12px 0}
        .sl{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#1e1e2e;margin-bottom:10px}
        .ldtxt{text-align:center;padding:30px;color:#2a2a3a;font-family:'Space Mono',monospace;font-size:11px}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .sc{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:13px;position:relative;overflow:hidden}
        .sc::after{content:'';position:absolute;top:0;left:0;right:0;height:1.5px;border-radius:14px 14px 0 0}
        .sc.solar::after{background:linear-gradient(90deg,#60a5fa,transparent)}
        .sc.load::after{background:linear-gradient(90deg,#818cf8,transparent)}
        .sc.imp::after{background:linear-gradient(90deg,#f87171,transparent)}
        .sc.exp::after{background:linear-gradient(90deg,#34d399,transparent)}
        .sc.batc::after{background:linear-gradient(90deg,#60a5fa,transparent)}
        .sc.batd::after{background:linear-gradient(90deg,#a78bfa,transparent)}
        .sci{font-size:18px;margin-bottom:5px}
        .scv{font-family:'Space Mono',monospace;font-size:16px;font-weight:700;margin-bottom:2px}
        .sc.solar .scv{color:#60a5fa}
        .sc.load .scv{color:#818cf8}
        .sc.imp .scv{color:#f87171}
        .sc.exp .scv{color:#34d399}
        .sc.batc .scv{color:#60a5fa}
        .sc.batd .scv{color:#a78bfa}
        .scl{font-size:11px;font-weight:600;color:#666}
        .scs{font-size:9px;color:#2a2a3a;font-family:'Space Mono',monospace;margin-top:2px}
        .prow{display:flex;gap:6px;margin-bottom:10px}
        .pb{flex:1;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:9px 4px;font-size:11px;font-weight:600;font-family:'Outfit',sans-serif;color:#3a3a4a;cursor:pointer;transition:all .2s}
        .pb.on{background:rgba(251,191,36,.07);border-color:rgba(251,191,36,.2);color:#fbbf24}
        .drow{display:flex;gap:8px}
        .dinp{flex:1;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:9px 12px;color:#888;font-size:13px;font-family:'Outfit',sans-serif;outline:none}
        .dclear{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:9px 14px;color:#555;font-size:12px;font-family:'Outfit',sans-serif;cursor:pointer}
        .chartc{background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.04);border-radius:14px;padding:14px;overflow:hidden}
        .xlabs{display:flex;justify-content:space-between;margin-top:5px}
        .xl{font-size:9px;color:#1e1e2e;font-family:'Space Mono',monospace}
        .btnr{background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.18);border-radius:8px;padding:8px 16px;color:#fbbf24;font-size:12px;font-family:'Outfit',sans-serif;cursor:pointer}
        .wbars{display:flex;gap:6px;align-items:flex-end;height:100px;padding:6px 2px}
        .wbc{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end}
        .wbv{width:100%;border-radius:3px 3px 0 0;min-height:4px;display:flex;align-items:flex-start;justify-content:center;transition:height .4s}
        .wbnum{font-size:7px;color:rgba(0,0,0,.5);font-family:'Space Mono',monospace;padding-top:2px}
        .wbl{font-size:10px;font-weight:600}
        .costhero{background:linear-gradient(135deg,rgba(248,113,113,.05),rgba(10,5,5,1));border:1px solid rgba(248,113,113,.12);border-radius:16px;padding:20px;text-align:center}
        .chv{font-family:'Space Mono',monospace;font-size:26px;font-weight:700;color:#f87171;text-shadow:0 0 14px rgba(248,113,113,.4);margin-bottom:6px}
        .chk{font-size:12px;color:rgba(248,113,113,.5);margin-bottom:5px;font-family:'Space Mono',monospace}
        .cht{font-size:10px;color:#444;font-family:'Space Mono',monospace}
        .balc{background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.04);border-radius:14px;padding:14px}
        .br{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:12px}
        .bl{color:#444;font-size:11px}
        .bv{font-family:'Space Mono',monospace;font-size:12px;font-weight:700}
        .pos{color:#34d399}
        .neg{color:#f87171}
        .bdiv{height:1px;background:rgba(255,255,255,.05);margin:6px 0}
        .bneto{display:flex;justify-content:space-between;align-items:center;padding-top:6px;font-weight:700;font-size:13px}
        .npos{font-family:'Space Mono',monospace;color:#34d399;font-size:17px;text-shadow:0 0 10px rgba(52,211,153,.35)}
        .nneg{font-family:'Space Mono',monospace;color:#f87171;font-size:17px}
      `}</style>
    </>
  );
}
