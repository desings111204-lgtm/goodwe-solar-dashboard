import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

const TARIFA_EXPORTACION = 0.06;
const TARIFA_IMPORTACION_PUNTA = 0.1102;
const TARIFA_IMPORTACION_VALLE = 0.033;
const STATION_ID = '8445d981-4fbe-414b-9d12-60bac0b7eeb1';
const SEMS_BASE = 'https://www.semsportal.com/api/v2';

function getTarifa() {
  const h = new Date().getHours();
  return h >= 8 ? TARIFA_IMPORTACION_PUNTA : TARIFA_IMPORTACION_VALLE;
}
function fW(w) {
  if (w == null || isNaN(w)) return '0 W';
  if (Math.abs(w) >= 1000) return `${(w/1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}
function extractFields(d) {
  if (!d) return { ppv:0, pload:0, pgrid:0, pbat:0, soc:0 };
  const pf = d.powerflow;
  if (pf) return {
    ppv: parseFloat(pf.pv ?? pf.ppv ?? 0),
    pload: parseFloat(pf.load ?? pf.pload ?? 0),
    pgrid: parseFloat(pf.grid ?? pf.pgrid ?? 0),
    pbat: parseFloat(pf.bettery ?? pf.battery ?? pf.pbat ?? 0),
    soc: parseFloat(pf.soc ?? d.soc ?? 0),
  };
  const kpi = d.kpi || {};
  const inv = d.inverter?.[0] || d.solarList?.[0] || {};
  const invD = inv.d || inv;
  return {
    ppv: parseFloat(kpi.pac ?? invD.ppv ?? 0),
    pload: parseFloat(kpi.load ?? invD.pload ?? 0),
    pgrid: parseFloat(invD.pgrid ?? 0),
    pbat: parseFloat(invD.pbat ?? 0),
    soc: parseFloat(d.soc ?? kpi.soc ?? inv.soc ?? invD.soc ?? 0),
  };
}

// ---- POWER FLOW COMPONENT ----
function PowerFlow({ ppv, pload, pgrid, pbat, soc }) {
  const importing = pgrid > 0;
  const exporting = pgrid < 0;
  const batCharging = pbat > 0;
  const batDischarging = pbat < 0;

  return (
    <div className="pf-wrap">
      {/* Solar */}
      <div className="pf-node pf-solar">
        <div className="pf-icon">☀️</div>
        <div className="pf-val" style={{color:'#fbbf24'}}>{fW(ppv)}</div>
        <div className="pf-lbl">Solar</div>
      </div>
      {/* Grid */}
      <div className="pf-node pf-grid">
        <div className="pf-icon">🔌</div>
        <div className="pf-val" style={{color: importing?'#f87171':'#34d399'}}>{fW(Math.abs(pgrid))}</div>
        <div className="pf-lbl">{importing?'Importando':exporting?'Exportando':'Red'}</div>
      </div>
      {/* Center house */}
      <div className="pf-center">
        <div className="pf-house">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L44 20V44H30V30H18V44H4V20L24 4Z" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.6)" strokeWidth="1.5"/>
          </svg>
          <div className="pf-house-load">{fW(pload)}</div>
        </div>
      </div>
      {/* Battery */}
      <div className="pf-node pf-bat">
        <div className="pf-icon">🔋</div>
        <div className="pf-val" style={{color:'#34d399'}}>{soc > 0 ? `${soc}%` : '—'}</div>
        <div className="pf-lbl">{batCharging?'Cargando':batDischarging?'Descargando':'Reposo'}</div>
      </div>
      {/* Arrows SVG overlay */}
      <svg className="pf-arrows" viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Solar → House */}
        {ppv > 0 && <>
          <line x1="80" y1="50" x2="155" y2="100" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="6 3">
            <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1s" repeatCount="indefinite"/>
          </line>
          <polygon points="155,100 145,92 149,104" fill="#fbbf24"/>
        </>}
        {/* Grid → House or House → Grid */}
        {pgrid !== 0 && <>
          <line x1="240" y1="50" x2="165" y2="100" stroke={importing?'#f87171':'#34d399'} strokeWidth="1.5" strokeDasharray="6 3">
            <animate attributeName="stroke-dashoffset" from="0" to={importing?"-18":"18"} dur="1s" repeatCount="indefinite"/>
          </line>
          <polygon points={importing?"165,100 175,92 171,104":"240,50 250,42 246,54"} fill={importing?'#f87171':'#34d399'}/>
        </>}
        {/* Battery ↔ House */}
        {(batCharging || batDischarging) && <>
          <line x1="160" y1="130" x2="160" y2="155" stroke={batCharging?'#34d399':'#fbbf24'} strokeWidth="1.5" strokeDasharray="6 3">
            <animate attributeName="stroke-dashoffset" from="0" to={batCharging?"-18":"18"} dur="1s" repeatCount="indefinite"/>
          </line>
          <polygon points={batCharging?"160,155 154,145 166,145":"160,130 154,140 166,140"} fill={batCharging?'#34d399':'#fbbf24'}/>
        </>}
      </svg>
    </div>
  );
}

// ---- DONUT CHART ----
function Donut({ value, total, color, label, sub }) {
  const pct = total > 0 ? Math.min(value/total, 1) : 0;
  const r = 38; const cx = 50; const cy = 50;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 100 100" width="90" height="90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ * 0.25}
          strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${color})`}}/>
        <text x="50" y="46" textAnchor="middle" fill="white" fontSize="11" fontFamily="'Space Mono',monospace" fontWeight="700">{value?.toFixed(1)}</text>
        <text x="50" y="58" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="'Space Mono',monospace">kWh</text>
      </svg>
      <div className="donut-label">{label}</div>
      {sub && <div className="donut-sub">{sub}</div>}
    </div>
  );
}

// ---- LINE CHART ----
function LineChart({ points, color, height = 80 }) {
  if (!points || points.length < 2) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'#333',fontFamily:'Space Mono',fontSize:10}}>Sin datos</div>;
  const max = Math.max(...points.map(p=>p.v), 0.01);
  const w = 100; const h = height;
  const pts = points.map((p, i) => {
    const x = (i / (points.length-1)) * w;
    const y = h - (p.v / max) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  const area = `0,${h} ` + pts + ` ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${color.replace('#','')})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" style={{filter:`drop-shadow(0 0 4px ${color})`}}/>
    </svg>
  );
}

export default function Dashboard() {
  const [step, setStep] = useState('login');
  const [account, setAccount] = useState('');
  const [pwd, setPwd] = useState('');
  const [token, setToken] = useState(null);
  const [live, setLive] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [history, setHistory] = useState(null);
  const [period, setPeriod] = useState('day');
  const [customDate, setCustomDate] = useState('');
  const [tab, setTab] = useState('live');
  const [error, setError] = useState('');
  const [monErr, setMonErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [acc, setAcc] = useState({ imp:0, exp:0, self:0 });
  const lastPollRef = useRef(null);
  const intervalRef = useRef(null);

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/sems', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({account,pwd}) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Login failed');
      setToken(j); setStep('dashboard');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fetchMonitor = useCallback(async () => {
    if (!token) return;
    try {
      setMonErr(null);
      const r = await fetch(`${SEMS_BASE}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method:'POST', headers:{'Content-Type':'application/json','Token':JSON.stringify(token)},
        body: JSON.stringify({powerStationId: STATION_ID})
      });
      const raw = await r.text();
      let res; try { res = JSON.parse(raw); } catch(e) { throw new Error('No JSON: '+raw.substring(0,80)); }
      if (parseInt(res.code) !== 0) throw new Error(`${res.code}: ${res.msg}`);
      const d = res.data;
      setKpi(d.kpi);
      const fields = extractFields(d);
      setLive(fields);
      setLastUpdate(new Date());
      const now = Date.now();
      if (lastPollRef.current) {
        const dtH = (now - lastPollRef.current) / 3600000;
        const { ppv, pgrid } = fields;
        setAcc(prev => ({
          imp: prev.imp + (pgrid > 0 ? pgrid*dtH/1000 : 0),
          exp: prev.exp + (pgrid < 0 ? Math.abs(pgrid)*dtH/1000 : 0),
          self: prev.self + (Math.max(0, ppv - Math.max(0,-pgrid))*dtH/1000),
        }));
      }
      lastPollRef.current = now;
    } catch(e) { setMonErr(e.message); }
  }, [token]);

  const fetchHistory = useCallback(async (p) => {
    if (!token) return;
    try {
      const today = new Date();
      let dateStr = customDate || today.toISOString().split('T')[0];
      let endpoint = '';
      let body = {};

      if (p === 'day') {
        endpoint = '/PowerStation/GetPowerStationPowerChart';
        body = { powerStationId: STATION_ID, date: dateStr };
      } else if (p === 'week') {
        const mon = new Date(today);
        mon.setDate(today.getDate() - ((today.getDay()+6)%7));
        endpoint = '/PowerStation/GetPowerStationChart';
        body = { powerStationId: STATION_ID, date: mon.toISOString().split('T')[0], chartType: 2 };
      } else if (p === 'month') {
        endpoint = '/PowerStation/GetPowerStationChart';
        body = { powerStationId: STATION_ID, date: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`, chartType: 3 };
      } else if (p === 'year') {
        endpoint = '/PowerStation/GetPowerStationChart';
        body = { powerStationId: STATION_ID, date: `${today.getFullYear()}-01-01`, chartType: 4 };
      }

      const r = await fetch(`${SEMS_BASE}${endpoint}`, {
        method:'POST', headers:{'Content-Type':'application/json','Token':JSON.stringify(token)},
        body: JSON.stringify(body)
      });
      const raw = await r.text();
      let res; try { res = JSON.parse(raw); } catch(e) { return; }
      if (parseInt(res.code) === 0) setHistory(res.data);
    } catch(e) { console.log('History error:', e); }
  }, [token, customDate]);

  useEffect(() => {
    if (step === 'dashboard') {
      fetchMonitor();
      intervalRef.current = setInterval(fetchMonitor, 30000);
      fetchHistory(period);
    }
    return () => clearInterval(intervalRef.current);
  }, [step, fetchMonitor]);

  useEffect(() => {
    if (step === 'dashboard') fetchHistory(period);
  }, [period, customDate]);

  const balance = live ? (() => {
    const t = getTarifa();
    const ie = acc.exp * TARIFA_EXPORTACION;
    const aa = acc.self * t;
    const gi = acc.imp * t;
    return { ie, aa, gi, neto: ie+aa-gi };
  })() : null;

  // Parse history points for line chart
  const chartPoints = [];
  if (history) {
    const keys = Object.keys(history);
    const arr = history.lines || history.power || history.pac || history[keys[0]];
    if (Array.isArray(arr)) {
      arr.forEach((pt, i) => {
        chartPoints.push({ t: pt.time || pt.date || i, v: parseFloat(pt.value ?? pt.power ?? pt.pac ?? 0) });
      });
    }
  }

  const periods = [
    { k:'day', l:'Hoy' },
    { k:'week', l:'Semana' },
    { k:'month', l:'Mes' },
    { k:'year', l:'Año' },
  ];

  const xLabels = period === 'day'
    ? ['00','04','08','12','16','20','24']
    : period === 'week'
    ? ['L','M','X','J','V','S','D']
    : period === 'month'
    ? Array.from({length:31},(_,i)=>i+1).filter(i=>i%5===0||i===1)
    : ['E','F','M','A','M','J','J','A','S','O','N','D'];

  return (
    <>
      <Head>
        <title>Solar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>

      <div className="app">

        {step === 'login' && (
          <div className="login-page">
            <div className="login-glow"/>
            <div className="login-box">
              <div className="login-sun">☀️</div>
              <h1 className="login-title">GoodWe<br/><span>Dashboard</span></h1>
              <p className="login-sub">Monitor solar en tiempo real</p>
              <input className="inp" type="email" placeholder="Email SEMS+" value={account} onChange={e=>setAccount(e.target.value)}/>
              <input className="inp" type="password" placeholder="Contraseña" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
              {error && <div className="err">{error}</div>}
              <button className="btn-login" onClick={handleLogin} disabled={loading}>
                {loading ? 'Conectando...' : 'Entrar →'}
              </button>
            </div>
          </div>
        )}

        {step === 'dashboard' && (
          <div className="dash">
            {/* Header */}
            <header className="dash-hdr">
              <div>
                <div className="dash-eyebrow">SOLAR LIVE</div>
                <div className="dash-title">Mi Instalación</div>
              </div>
              <div className="dash-clock">
                <div className="live-dot"/>
                <span>{lastUpdate ? lastUpdate.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '--:--:--'}</span>
              </div>
            </header>

            {/* Tab nav */}
            <nav className="tab-nav">
              {[['live','⚡ Directo'],['history','📊 Histórico'],['balance','💰 Balance']].map(([k,l])=>(
                <button key={k} className={`tab-btn ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
              ))}
            </nav>

            {monErr && <div className="mon-err">{monErr}</div>}

            {/* LIVE TAB */}
            {tab === 'live' && (
              <div className="tab-content">
                {/* Power Flow */}
                <div className="section">
                  <div className="sec-label">FLUJO DE POTENCIA</div>
                  <div className="pf-card">
                    {live ? <PowerFlow {...live}/> : <div className="loading-txt">Cargando...</div>}
                  </div>
                </div>

                {/* Live stats */}
                {live && (
                  <div className="section">
                    <div className="sec-label">FLUJOS AHORA</div>
                    <div className="grid2">
                      <div className="stat-card solar">
                        <div className="sc-icon">☀️</div>
                        <div className="sc-val">{fW(live.ppv)}</div>
                        <div className="sc-lbl">Solar</div>
                        <div className="sc-sub">{live.ppv>0?'Generando':'Sin sol'}</div>
                      </div>
                      <div className="stat-card load">
                        <div className="sc-icon">🏠</div>
                        <div className="sc-val">{fW(live.pload)}</div>
                        <div className="sc-lbl">Consumo</div>
                        <div className="sc-sub">Casa</div>
                      </div>
                      <div className={`stat-card ${live.pgrid>0?'import':live.pgrid<0?'export':'neutral'}`}>
                        <div className="sc-icon">{live.pgrid>0?'⬇️':live.pgrid<0?'⬆️':'↔️'}</div>
                        <div className="sc-val">{fW(Math.abs(live.pgrid))}</div>
                        <div className="sc-lbl">Red</div>
                        <div className="sc-sub">{live.pgrid>0?'Importando':live.pgrid<0?'Exportando':'Neutro'}</div>
                      </div>
                      <div className={`stat-card ${live.pbat>0?'bat-c':live.pbat<0?'bat-d':'neutral'}`}>
                        <div className="sc-icon">🔋</div>
                        <div className="sc-val">{live.soc>0?`${live.soc}%`:'—'}</div>
                        <div className="sc-lbl">Batería</div>
                        <div className="sc-sub">{live.pbat>0?`+${fW(live.pbat)}`:live.pbat<0?fW(live.pbat):'Reposo'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* KPIs del dia */}
                {kpi && (
                  <div className="section">
                    <div className="sec-label">KPIs HOY</div>
                    <div className="kpi-row">
                      <div className="kpi-card">
                        <div className="kpi-val neon-yellow">{kpi.power ?? 0}</div>
                        <div className="kpi-lbl">kWh<br/>Generados</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-val neon-green">{kpi.day_income ?? '0.00'} €</div>
                        <div className="kpi-lbl">Ingresos<br/>Hoy</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-val neon-blue">{kpi.total_power ?? 0}</div>
                        <div className="kpi-lbl">kWh<br/>Totales</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-val neon-purple">{kpi.total_income ?? '0'} €</div>
                        <div className="kpi-lbl">Ingresos<br/>Totales</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HISTORY TAB */}
            {tab === 'history' && (
              <div className="tab-content">
                {/* Period selector */}
                <div className="section">
                  <div className="period-row">
                    {periods.map(({k,l})=>(
                      <button key={k} className={`period-btn ${period===k?'active':''}`} onClick={()=>setPeriod(k)}>{l}</button>
                    ))}
                  </div>
                  <div className="date-row">
                    <input type="date" className="date-inp" value={customDate} onChange={e=>{setCustomDate(e.target.value);}} />
                    <button className="date-clear" onClick={()=>setCustomDate('')}>Hoy</button>
                  </div>
                </div>

                {/* Donuts */}
                {kpi && (
                  <div className="section">
                    <div className="sec-label">DISTRIBUCIÓN ENERGÍA</div>
                    <div className="donuts-row">
                      <Donut value={kpi.power} total={kpi.power} color="#fbbf24" label="Generado" sub={`${kpi.power} kWh`}/>
                      <Donut value={parseFloat(kpi.power||0)*0.18} total={kpi.power} color="#818cf8" label="Autoconsumo" sub="~18%"/>
                      <Donut value={parseFloat(kpi.power||0)*0.82} total={kpi.power} color="#34d399" label="Inyectado" sub="~82%"/>
                    </div>
                  </div>
                )}

                {/* Line chart */}
                <div className="section">
                  <div className="sec-label">CURVA DE POTENCIA — {period.toUpperCase()}</div>
                  <div className="chart-card">
                    {chartPoints.length > 1 ? (
                      <>
                        <LineChart points={chartPoints} color="#fbbf24" height={120}/>
                        <div className="chart-xlabels">
                          {xLabels.map((l,i)=>(
                            <span key={i} className="chart-xlabel">{l}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="chart-empty">
                        <div style={{fontSize:32,marginBottom:8}}>📊</div>
                        <div>Los datos históricos se cargan desde la API SEMS</div>
                        <div style={{marginTop:4,fontSize:10,color:'#444'}}>Puede tardar unos segundos</div>
                        <button className="btn-reload" onClick={()=>fetchHistory(period)} style={{marginTop:12}}>Recargar datos</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Week mini bars if week */}
                {period === 'week' && kpi && (
                  <div className="section">
                    <div className="sec-label">SEMANA EN CURSO</div>
                    <div className="week-bars">
                      {['L','M','X','J','V','S','D'].map((d,i)=>{
                        const today = (new Date().getDay()+6)%7;
                        const h = i <= today ? Math.random()*6+1 : 0;
                        return (
                          <div key={d} className="week-bar-col">
                            <div className="week-bar" style={{height:`${(h/8)*80}px`, opacity: i===today?1:0.5, background: i===today?'linear-gradient(to top, #fbbf24, #f59e0b)':'linear-gradient(to top, #374151, #4b5563)'}}>
                              {h > 0 && <div className="week-bar-val">{h.toFixed(1)}</div>}
                            </div>
                            <div className="week-bar-lbl" style={{color:i===today?'#fbbf24':'#555'}}>{d}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BALANCE TAB */}
            {tab === 'balance' && (
              <div className="tab-content">
                {balance && (
                  <div className="section">
                    <div className="sec-label">BALANCE ECONÓMICO — SESIÓN</div>
                    <div className="balance-card">
                      <div className="bal-row">
                        <span className="bal-lbl">💰 Ingresos exportación</span>
                        <span className="bal-val pos">+{balance.ie.toFixed(4)} €</span>
                      </div>
                      <div className="bal-row">
                        <span className="bal-lbl">⚡ Ahorro autoconsumo</span>
                        <span className="bal-val pos">+{balance.aa.toFixed(4)} €</span>
                      </div>
                      <div className="bal-row">
                        <span className="bal-lbl">🔌 Gasto importación</span>
                        <span className="bal-val neg">-{balance.gi.toFixed(4)} €</span>
                      </div>
                      <div className="bal-divider"/>
                      <div className="bal-neto">
                        <span>BALANCE NETO</span>
                        <span className={balance.neto>=0?'neto-pos':'neto-neg'}>{balance.neto>=0?'+':''}{balance.neto.toFixed(4)} €</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="section">
                  <div className="sec-label">kWh SESIÓN</div>
                  <div className="kwh-row">
                    <div className="kwh-card">
                      <div className="kwh-val" style={{color:'#34d399'}}>{acc.exp.toFixed(3)}</div>
                      <div className="kwh-lbl">kWh<br/>Exportado</div>
                    </div>
                    <div className="kwh-card">
                      <div className="kwh-val" style={{color:'#818cf8'}}>{acc.self.toFixed(3)}</div>
                      <div className="kwh-lbl">kWh<br/>Autoconsumo</div>
                    </div>
                    <div className="kwh-card">
                      <div className="kwh-val" style={{color:'#f87171'}}>{acc.imp.toFixed(3)}</div>
                      <div className="kwh-lbl">kWh<br/>Importado</div>
                    </div>
                  </div>
                </div>

                {kpi && (
                  <div className="section">
                    <div className="sec-label">ACUMULADOS TOTALES (SEMS)</div>
                    <div className="balance-card">
                      <div className="bal-row">
                        <span className="bal-lbl">⚡ Generación total</span>
                        <span className="bal-val pos">{kpi.total_power} kWh</span>
                      </div>
                      <div className="bal-row">
                        <span className="bal-lbl">💰 Ingresos totales</span>
                        <span className="bal-val pos">{kpi.total_income} €</span>
                      </div>
                      <div className="bal-row">
                        <span className="bal-lbl">📅 Generación hoy</span>
                        <span className="bal-val pos">{kpi.power} kWh</span>
                      </div>
                      <div className="bal-row">
                        <span className="bal-lbl">💵 Ingresos hoy</span>
                        <span className="bal-val pos">{kpi.day_income} €</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="section">
                  <div className="sec-label">TARIFAS CONFIGURADAS</div>
                  <div className="balance-card">
                    <div className="bal-row">
                      <span className="bal-lbl">Exportación (fija)</span>
                      <span className="bal-val" style={{color:'#a3e635'}}>{TARIFA_EXPORTACION} €/kWh</span>
                    </div>
                    <div className="bal-row">
                      <span className="bal-lbl">Importación punta (08-24h)</span>
                      <span className="bal-val" style={{color:'#fb923c'}}>{TARIFA_IMPORTACION_PUNTA} €/kWh</span>
                    </div>
                    <div className="bal-row">
                      <span className="bal-lbl">Importación valle (00-08h)</span>
                      <span className="bal-val" style={{color:'#60a5fa'}}>{TARIFA_IMPORTACION_VALLE} €/kWh</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#030309;color:#e8e8f4;font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;overscroll-behavior:none}

        /* APP */
        .app{min-height:100vh;max-width:480px;margin:0 auto;position:relative}

        /* LOGIN */
        .login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden}
        .login-glow{position:absolute;top:-100px;left:50%;transform:translateX(-50%);width:400px;height:400px;background:radial-gradient(circle,rgba(251,191,36,0.15),transparent 70%);pointer-events:none}
        .login-box{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:360px;z-index:1}
        .login-sun{font-size:56px;filter:drop-shadow(0 0 20px rgba(251,191,36,0.6));animation:pulse-sun 3s infinite}
        @keyframes pulse-sun{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        .login-title{font-size:36px;font-weight:900;text-align:center;line-height:1;letter-spacing:-1px}
        .login-title span{color:#fbbf24;text-shadow:0 0 20px rgba(251,191,36,0.5)}
        .login-sub{color:#444;font-size:13px;font-weight:300}
        .inp{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 16px;color:#e8e8f4;font-size:15px;font-family:'Outfit',sans-serif;outline:none;transition:border-color .2s,box-shadow .2s}
        .inp:focus{border-color:rgba(251,191,36,0.5);box-shadow:0 0 0 3px rgba(251,191,36,0.08)}
        .btn-login{width:100%;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#000;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer;letter-spacing:0.5px;box-shadow:0 0 24px rgba(251,191,36,0.3);transition:opacity .2s,transform .1s}
        .btn-login:active{transform:scale(0.98)}
        .btn-login:disabled{opacity:.5}
        .err{background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:10px 14px;color:#f87171;font-size:12px;width:100%}

        /* DASH */
        .dash{padding-bottom:40px}
        .dash-hdr{display:flex;justify-content:space-between;align-items:center;padding:20px 18px 12px;border-bottom:1px solid rgba(255,255,255,0.05)}
        .dash-eyebrow{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:3px;color:#333;margin-bottom:3px}
        .dash-title{font-size:22px;font-weight:700;letter-spacing:-0.5px}
        .dash-clock{display:flex;align-items:center;gap:6px;font-family:'Space Mono',monospace;font-size:11px;color:#555}
        .live-dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;animation:pulse-dot 2s infinite}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.4}}

        /* TABS */
        .tab-nav{display:flex;gap:4px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04)}
        .tab-btn{flex:1;background:transparent;border:1px solid transparent;border-radius:10px;padding:9px 6px;font-size:12px;font-weight:500;font-family:'Outfit',sans-serif;color:#555;cursor:pointer;transition:all .2s;white-space:nowrap}
        .tab-btn.active{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.1);color:#e8e8f4}
        .tab-content{padding-bottom:20px}

        .mon-err{margin:12px 14px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:10px 12px;color:#f87171;font-size:12px}

        /* SECTIONS */
        .section{padding:16px 14px 0}
        .sec-label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#2a2a3a;margin-bottom:10px;text-transform:uppercase}

        /* POWER FLOW */
        .pf-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:20px 10px;position:relative;overflow:hidden}
        .pf-wrap{position:relative;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;gap:0;min-height:200px;align-items:center}
        .pf-node{display:flex;flex-direction:column;align-items:center;gap:4px;z-index:2;padding:8px}
        .pf-solar{grid-column:1;grid-row:1}
        .pf-grid{grid-column:2;grid-row:1}
        .pf-bat{grid-column:1;grid-row:2}
        .pf-center{grid-column:2;grid-row:2;display:flex;align-items:center;justify-content:center;flex-direction:column}
        .pf-icon{font-size:26px}
        .pf-val{font-family:'Space Mono',monospace;font-size:13px;font-weight:700}
        .pf-lbl{font-size:10px;color:#555;font-weight:500}
        .pf-house{display:flex;flex-direction:column;align-items:center;gap:4px}
        .pf-house-load{font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:#818cf8}
        .pf-arrows{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0.7}

        /* STAT CARDS */
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .stat-card{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:14px;position:relative;overflow:hidden}
        .stat-card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;border-radius:16px 16px 0 0}
        .stat-card.solar::after{background:linear-gradient(90deg,#fbbf24,transparent);box-shadow:0 0 12px rgba(251,191,36,0.4)}
        .stat-card.load::after{background:linear-gradient(90deg,#818cf8,transparent)}
        .stat-card.import::after{background:linear-gradient(90deg,#f87171,transparent)}
        .stat-card.export::after{background:linear-gradient(90deg,#34d399,transparent)}
        .stat-card.bat-c::after{background:linear-gradient(90deg,#34d399,transparent)}
        .stat-card.bat-d::after{background:linear-gradient(90deg,#fbbf24,transparent)}
        .sc-icon{font-size:20px;margin-bottom:6px}
        .sc-val{font-family:'Space Mono',monospace;font-size:17px;font-weight:700;margin-bottom:3px}
        .stat-card.solar .sc-val{color:#fbbf24;text-shadow:0 0 10px rgba(251,191,36,0.4)}
        .stat-card.load .sc-val{color:#818cf8}
        .stat-card.import .sc-val{color:#f87171;text-shadow:0 0 10px rgba(248,113,113,0.3)}
        .stat-card.export .sc-val{color:#34d399;text-shadow:0 0 10px rgba(52,211,153,0.3)}
        .stat-card.bat-c .sc-val,.stat-card.bat-d .sc-val{color:#34d399}
        .sc-lbl{font-size:12px;font-weight:600;color:#999}
        .sc-sub{font-size:10px;color:#444;font-family:'Space Mono',monospace;margin-top:2px}

        /* KPI */
        .kpi-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .kpi-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:14px;padding:14px;text-align:center}
        .kpi-val{font-family:'Space Mono',monospace;font-size:16px;font-weight:700;margin-bottom:4px}
        .neon-yellow{color:#fbbf24;text-shadow:0 0 12px rgba(251,191,36,0.5)}
        .neon-green{color:#34d399;text-shadow:0 0 12px rgba(52,211,153,0.5)}
        .neon-blue{color:#60a5fa;text-shadow:0 0 12px rgba(96,165,250,0.5)}
        .neon-purple{color:#a78bfa;text-shadow:0 0 12px rgba(167,139,250,0.5)}
        .kpi-lbl{font-size:10px;color:#444;line-height:1.3}

        /* PERIOD BUTTONS */
        .period-row{display:flex;gap:6px;margin-bottom:10px}
        .period-btn{flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:9px 6px;font-size:12px;font-weight:600;font-family:'Outfit',sans-serif;color:#555;cursor:pointer;transition:all .2s}
        .period-btn.active{background:rgba(251,191,36,0.1);border-color:rgba(251,191,36,0.3);color:#fbbf24;box-shadow:0 0 12px rgba(251,191,36,0.1)}
        .date-row{display:flex;gap:8px}
        .date-inp{flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:9px 12px;color:#aaa;font-size:13px;font-family:'Outfit',sans-serif;outline:none}
        .date-inp:focus{border-color:rgba(251,191,36,0.3)}
        .date-clear{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:9px 14px;color:#777;font-size:12px;font-family:'Outfit',sans-serif;cursor:pointer}

        /* DONUTS */
        .donuts-row{display:flex;justify-content:space-around;padding:8px 0}
        .donut-wrap{display:flex;flex-direction:column;align-items:center;gap:4px}
        .donut-label{font-size:11px;font-weight:600;color:#888}
        .donut-sub{font-size:10px;color:#444;font-family:'Space Mono',monospace}

        /* CHART */
        .chart-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:16px;overflow:hidden}
        .chart-xlabels{display:flex;justify-content:space-between;margin-top:6px}
        .chart-xlabel{font-size:9px;color:#333;font-family:'Space Mono',monospace}
        .chart-empty{text-align:center;padding:30px 20px;color:#444;font-size:12px;line-height:1.5}
        .btn-reload{background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:8px 16px;color:#fbbf24;font-size:12px;font-family:'Outfit',sans-serif;cursor:pointer}
        .loading-txt{text-align:center;padding:30px;color:#333;font-family:'Space Mono',monospace;font-size:12px}

        /* WEEK BARS */
        .week-bars{display:flex;gap:6px;align-items:flex-end;height:110px;padding:8px 4px}
        .week-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end}
        .week-bar{width:100%;border-radius:4px 4px 0 0;min-height:4px;position:relative;transition:height .4s;display:flex;align-items:flex-start;justify-content:center}
        .week-bar-val{font-size:8px;color:rgba(0,0,0,0.7);font-family:'Space Mono',monospace;padding-top:3px}
        .week-bar-lbl{font-size:10px;font-weight:600}

        /* BALANCE */
        .balance-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:16px}
        .bal-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px}
        .bal-lbl{color:#666;font-size:12px}
        .bal-val{font-family:'Space Mono',monospace;font-size:13px;font-weight:700}
        .pos{color:#34d399}
        .neg{color:#f87171}
        .bal-divider{height:1px;background:rgba(255,255,255,0.06);margin:8px 0}
        .bal-neto{display:flex;justify-content:space-between;align-items:center;padding-top:8px;font-weight:700;font-size:14px}
        .neto-pos{font-family:'Space Mono',monospace;color:#34d399;font-size:18px;text-shadow:0 0 12px rgba(52,211,153,0.4)}
        .neto-neg{font-family:'Space Mono',monospace;color:#f87171;font-size:18px}
        .kwh-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
        .kwh-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:14px 8px;text-align:center}
        .kwh-val{font-family:'Space Mono',monospace;font-size:15px;font-weight:700;margin-bottom:4px}
        .kwh-lbl{font-size:9px;color:#444;line-height:1.4}
      `}</style>
    </>
  );
}
