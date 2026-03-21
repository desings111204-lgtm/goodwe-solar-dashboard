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
  const abs = Math.abs(w);
  return abs >= 1000 ? `${(abs/1000).toFixed(2)} kW` : `${Math.round(abs)} W`;
}

function extractFields(d) {
  if (!d) return { ppv:0, pload:0, pgrid:0, pbat:0, soc:0 };
  const pf = d.powerflow;
  if (pf) {
    // En SEMS powerflow: bettery positivo = descarga (bateria da energia), negativo = carga
    const rawBat = parseFloat(pf.bettery ?? pf.battery ?? pf.pbat ?? 0);
    return {
      ppv:   parseFloat(pf.pv    ?? pf.ppv   ?? 0),
      pload: parseFloat(pf.load  ?? pf.pload ?? 0),
      pgrid: parseFloat(pf.grid  ?? pf.pgrid ?? 0),
      pbat:  rawBat,
      batCharging: rawBat < 0,
      batDischarging: rawBat > 0,
      soc:   parseFloat(pf.soc ?? d.soc ?? 0),
    };
  }
  const kpi = d.kpi || {};
  const inv = d.inverter?.[0] || d.solarList?.[0] || {};
  const invD = inv.d || inv;
  const rawBat = parseFloat(invD.pbat ?? 0);
  return {
    ppv:   parseFloat(kpi.pac  ?? invD.ppv  ?? 0),
    pload: parseFloat(kpi.load ?? invD.pload ?? 0),
    pgrid: parseFloat(invD.pgrid ?? 0),
    pbat:  rawBat,
    batCharging: rawBat < 0,
    batDischarging: rawBat > 0,
    soc:   parseFloat(d.soc ?? inv.soc ?? invD.soc ?? 0),
  };
}

// ─── POWER FLOW VISUAL ───────────────────────────────────────────────────────
function FlowArrow({ active, color, path, reverse }) {
  if (!active) return null;
  return (
    <>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="8 4"
        style={{filter:`drop-shadow(0 0 3px ${color})`}}>
        <animate attributeName="stroke-dashoffset" from={reverse?"24":"0"} to={reverse?"0":"24"} dur="1.2s" repeatCount="indefinite"/>
      </path>
    </>
  );
}

function PowerFlowCard({ ppv, pload, pgrid, pbat, soc, batCharging, batDischarging }) {
  const importing = pgrid > 0;
  const exporting = pgrid < 0;
  return (
    <div className="pfc">
      <svg viewBox="0 0 300 280" width="100%" style={{overflow:'visible'}}>
        {/* ─ Lines ─ */}
        {/* Solar → House */}
        <FlowArrow active={ppv > 0} color="#fbbf24" path="M 80 80 Q 140 70 150 120" />
        {/* Grid ↔ House */}
        <FlowArrow active={pgrid !== 0} color={importing?'#f87171':'#34d399'} path="M 220 80 Q 165 70 150 120" reverse={exporting} />
        {/* Battery ↔ House */}
        <FlowArrow active={Math.abs(pbat) > 5} color={batCharging?'#60a5fa':'#a78bfa'} path="M 80 200 Q 130 185 150 155" reverse={batCharging} />
        {/* Load from House */}
        <FlowArrow active={pload > 0} color="#818cf8" path="M 150 155 Q 165 185 220 200" />

        {/* ─ Solar Node ─ */}
        <circle cx="80" cy="80" r="38" fill="rgba(251,191,36,0.08)" stroke="rgba(251,191,36,0.3)" strokeWidth="1"/>
        <text x="80" y="66" textAnchor="middle" fill="#fbbf24" fontSize="20">☀️</text>
        <text x="80" y="82" textAnchor="middle" fill="#fbbf24" fontSize="11" fontFamily="Space Mono" fontWeight="700">{fW(ppv)}</text>
        <text x="80" y="95" textAnchor="middle" fill="rgba(251,191,36,0.5)" fontSize="9" fontFamily="Space Mono">Solar</text>

        {/* ─ Grid Node ─ */}
        <circle cx="220" cy="80" r="38" fill={importing?'rgba(248,113,113,0.08)':'rgba(52,211,153,0.08)'} stroke={importing?'rgba(248,113,113,0.3)':'rgba(52,211,153,0.3)'} strokeWidth="1"/>
        <text x="220" y="66" textAnchor="middle" fill={importing?'#f87171':'#34d399'} fontSize="20">{importing?'🔌':'⚡'}</text>
        <text x="220" y="82" textAnchor="middle" fill={importing?'#f87171':'#34d399'} fontSize="11" fontFamily="Space Mono" fontWeight="700">{fW(pgrid)}</text>
        <text x="220" y="95" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="Space Mono">{importing?'Importando':exporting?'Exportando':'Red'}</text>

        {/* ─ House (Center) ─ */}
        <polygon points="150,105 180,130 180,165 120,165 120,130" fill="rgba(99,102,241,0.1)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5"/>
        <polygon points="150,90 188,125 112,125" fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5"/>
        <text x="150" y="152" textAnchor="middle" fill="#c7d2fe" fontSize="11" fontFamily="Space Mono" fontWeight="700">{fW(pload)}</text>
        <text x="150" y="175" textAnchor="middle" fill="rgba(199,210,254,0.4)" fontSize="8" fontFamily="Space Mono">Consumo</text>

        {/* ─ Battery Node ─ */}
        <circle cx="80" cy="210" r="38" fill={batCharging?'rgba(96,165,250,0.08)':batDischarging?'rgba(167,139,250,0.08)':'rgba(255,255,255,0.03)'} stroke={batCharging?'rgba(96,165,250,0.3)':batDischarging?'rgba(167,139,250,0.3)':'rgba(255,255,255,0.1)'} strokeWidth="1"/>
        <text x="80" y="196" textAnchor="middle" fill={batCharging?'#60a5fa':batDischarging?'#a78bfa':'#555'} fontSize="20">🔋</text>
        <text x="80" y="212" textAnchor="middle" fill={batCharging?'#60a5fa':batDischarging?'#a78bfa':'#888'} fontSize="12" fontFamily="Space Mono" fontWeight="700">{soc > 0 ? `${soc}%` : '—'}</text>
        <text x="80" y="226" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="Space Mono">{batCharging?'Cargando':batDischarging?'Descargando':'Reposo'}</text>

        {/* ─ Inverter Node (center bottom) ─ */}
        <rect x="220" cy="172" x="195" y="182" width="50" height="38" rx="6" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        <text x="220" y="198" textAnchor="middle" fill="#555" fontSize="9" fontFamily="Space Mono">INVERSOR</text>
        <text x="220" y="210" textAnchor="middle" fill="#444" fontSize="8" fontFamily="Space Mono">2×GW3600</text>
      </svg>
    </div>
  );
}

// ─── DONUT ───────────────────────────────────────────────────────────────────
function Donut({ pct, color, label, value }) {
  const r = 34; const circ = 2*Math.PI*r;
  const dash = Math.max(0, Math.min(pct, 1)) * circ;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ*0.25}
          strokeLinecap="round" style={{filter:`drop-shadow(0 0 5px ${color})`}}/>
        <text x="40" y="36" textAnchor="middle" fill="white" fontSize="10" fontFamily="Space Mono" fontWeight="700">{value}</text>
        <text x="40" y="48" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="Space Mono">kWh</text>
      </svg>
      <div style={{fontSize:10,color:'#666',fontFamily:'Space Mono',textAlign:'center',lineHeight:1.3}}>{label}</div>
    </div>
  );
}

// ─── LINE CHART ──────────────────────────────────────────────────────────────
function LineChart({ points, color }) {
  if (!points || points.length < 2) return <div style={{height:100,display:'flex',alignItems:'center',justifyContent:'center',color:'#222',fontFamily:'Space Mono',fontSize:10}}>Sin datos para este período</div>;
  const vals = points.map(p => p.v);
  const max = Math.max(...vals, 0.01);
  const w = 100; const h = 90;
  const pts = points.map((p,i) => {
    const x = (i/(points.length-1))*w;
    const y = h - (p.v/max)*(h-8)-4;
    return `${x},${y}`;
  }).join(' ');
  const area = `0,${h} `+pts+` ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{display:'block'}}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#cg)"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" style={{filter:`drop-shadow(0 0 3px ${color})`}}/>
    </svg>
  );
}

export default function Dashboard() {
  const [step, setStep]   = useState('login');
  const [acct, setAcct]   = useState('');
  const [pwd, setPwd]     = useState('');
  const [token, setToken] = useState(null);
  const [live, setLive]   = useState(null);
  const [kpi, setKpi]     = useState(null);
  const [chartPts, setChartPts] = useState([]);
  const [period, setPeriod]     = useState('day');
  const [date, setDate]         = useState('');
  const [tab, setTab]           = useState('live');
  const [err, setErr]           = useState('');
  const [monErr, setMonErr]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [lastUp, setLastUp]     = useState(null);
  const [acc, setAcc]           = useState({ imp:0, exp:0, self:0 });
  const lastRef = useRef(null);
  const intRef  = useRef(null);

  const doLogin = async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/sems',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:acct,pwd})});
      const j = await r.json();
      if (!r.ok) throw new Error(j.error||'Login failed');
      setToken(j); setStep('dashboard');
    } catch(e){setErr(e.message);} finally{setLoading(false);}
  };

  const fetchLive = useCallback(async () => {
    if (!token) return;
    try {
      setMonErr(null);
      const r = await fetch(`${SEMS}/PowerStation/GetMonitorDetailByPowerstationId`,{
        method:'POST',headers:{'Content-Type':'application/json','Token':JSON.stringify(token)},
        body:JSON.stringify({powerStationId:STATION_ID})
      });
      const raw = await r.text();
      let res; try{res=JSON.parse(raw);}catch(e){throw new Error('No JSON');}
      if (parseInt(res.code)!==0) throw new Error(`${res.code}: ${res.msg}`);
      const d = res.data;
      setKpi(d.kpi);
      setLive(extractFields(d));
      setLastUp(new Date());
      const now = Date.now();
      if (lastRef.current) {
        const dtH = (now-lastRef.current)/3600000;
        const {ppv,pgrid} = extractFields(d);
        setAcc(p => ({
          imp:  p.imp  + (pgrid>0 ? pgrid*dtH/1000 : 0),
          exp:  p.exp  + (pgrid<0 ? Math.abs(pgrid)*dtH/1000 : 0),
          self: p.self + (Math.max(0,ppv-Math.max(0,-pgrid))*dtH/1000),
        }));
      }
      lastRef.current = now;
    } catch(e){setMonErr(e.message);}
  },[token]);

  const fetchHistory = useCallback(async (p, d) => {
    if (!token) return;
    setHistLoading(true); setChartPts([]);
    try {
      const today = new Date();
      const ds = d || today.toISOString().split('T')[0];
      let endpoint, body;
      if (p==='day') {
        endpoint='/PowerStation/GetPowerStationPowerChart';
        body={powerStationId:STATION_ID, date:ds};
      } else if (p==='week') {
        const mon=new Date(today); mon.setDate(today.getDate()-((today.getDay()+6)%7));
        endpoint='/PowerStation/GetPowerStationChart';
        body={powerStationId:STATION_ID, date:mon.toISOString().split('T')[0], chartType:2};
      } else if (p==='month') {
        endpoint='/PowerStation/GetPowerStationChart';
        body={powerStationId:STATION_ID, date:`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`, chartType:3};
      } else {
        endpoint='/PowerStation/GetPowerStationChart';
        body={powerStationId:STATION_ID, date:`${today.getFullYear()}-01-01`, chartType:4};
      }
      const r = await fetch(`${SEMS}${endpoint}`,{
        method:'POST',headers:{'Content-Type':'application/json','Token':JSON.stringify(token)},
        body:JSON.stringify(body)
      });
      const raw = await r.text();
      let res; try{res=JSON.parse(raw);}catch(e){return;}
      if (parseInt(res.code)!==0) return;
      const data = res.data;
      // Buscar array de puntos en todas las posibles rutas
      const arr = data?.lines?.[0]?.xy || data?.power || data?.pac || data?.list ||
                  (Array.isArray(data) ? data : null) ||
                  (data && Object.values(data).find(v=>Array.isArray(v)));
      if (Array.isArray(arr)) {
        setChartPts(arr.map((pt,i) => ({
          t: pt.x || pt.time || pt.date || i,
          v: Math.max(0, parseFloat(pt.y ?? pt.value ?? pt.power ?? pt.pac ?? 0))
        })));
      }
    } catch(e){console.log('History err:',e);} finally{setHistLoading(false);}
  },[token]);

  useEffect(()=>{
    if(step==='dashboard'){
      fetchLive();
      intRef.current = setInterval(fetchLive,30000);
      fetchHistory(period, date);
    }
    return ()=>clearInterval(intRef.current);
  },[step,fetchLive]);

  // Refetch history cuando cambia period o date
  useEffect(()=>{
    if(step==='dashboard') fetchHistory(period,date);
  },[period,date]);

  const tarifa = getTarifa();
  const ie  = acc.exp  * TARIFA_EXP;
  const aa  = acc.self * tarifa;
  const gi  = acc.imp  * tarifa;
  const neto = ie+aa-gi;

  const xLabels = period==='day' ? ['00','04','08','12','16','20'] :
                  period==='week' ? ['L','M','X','J','V','S','D'] :
                  period==='month' ? ['1','5','10','15','20','25','30'] :
                  ['E','F','M','A','M','J','J','A','S','O','N','D'];

  return (
    <>
      <Head>
        <title>Solar Dashboard</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>
      <div className="app">

      {step==='login' && (
        <div className="login-page">
          <div className="login-glow"/>
          <div className="login-box">
            <div className="sun">☀️</div>
            <h1 className="lt">GoodWe<br/><span>Dashboard</span></h1>
            <p className="ls">Monitor solar en tiempo real</p>
            <input className="inp" type="email" placeholder="Email SEMS+" value={acct} onChange={e=>setAcct(e.target.value)}/>
            <input className="inp" type="password" placeholder="Contraseña" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
            {err && <div className="err">{err}</div>}
            <button className="btn-l" onClick={doLogin} disabled={loading}>{loading?'Conectando...':'Entrar →'}</button>
          </div>
        </div>
      )}

      {step==='dashboard' && (
        <div className="dash">
          <header className="hdr">
            <div>
              <div className="eyebrow">INSTALACIÓN SOLAR</div>
              <div className="htitle">David Vega</div>
            </div>
            <div className="clock">
              <div className="dot"/>
              <span>{lastUp?lastUp.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--:--:--'}</span>
            </div>
          </header>

          <nav className="tabs">
            {[['live','⚡'],['history','📊'],['balance','💰']].map(([k,l])=>(
              <button key={k} className={`tb ${tab===k?'on':''}`} onClick={()=>setTab(k)}>{l} {k==='live'?'Directo':k==='history'?'Histórico':'Balance'}</button>
            ))}
          </nav>

          {monErr && <div className="merr">{monErr}</div>}

          {/* ──── LIVE ──── */}
          {tab==='live' && (
            <div className="tc">

              {/* Cost warning box */}
              {kpi && (
                <div className="cost-banner">
                  <div className="cb-row">
                    <div className="cb-item">
                      <div className="cb-label">Generación hoy</div>
                      <div className="cb-val yellow">{kpi.power ?? 0} kWh</div>
                    </div>
                    <div className="cb-sep"/>
                    <div className="cb-item">
                      <div className="cb-label">Ingresos hoy</div>
                      <div className="cb-val green">{kpi.day_income ?? '0'} €</div>
                    </div>
                    <div className="cb-sep"/>
                    <div className="cb-item">
                      <div className="cb-label">Gasto red (sesión)</div>
                      <div className="cb-val red">{gi.toFixed(4)} €</div>
                    </div>
                    <div className="cb-sep"/>
                    <div className="cb-item">
                      <div className="cb-label">Balance neto</div>
                      <div className={`cb-val ${neto>=0?'green':'red'}`}>{neto>=0?'+':''}{neto.toFixed(4)} €</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Power Flow */}
              <div className="sec">
                <div className="sl">FLUJO DE POTENCIA EN VIVO</div>
                <div className="pf-wrap">
                  {live ? <PowerFlowCard {...live}/> : <div className="ldtxt">Cargando flujos...</div>}
                </div>
              </div>

              {/* Stat cards */}
              {live && (
                <div className="sec">
                  <div className="sl">VALORES ACTUALES</div>
                  <div className="g2">
                    <div className="sc solar"><div className="sci">☀️</div><div className="scv">{fW(live.ppv)}</div><div className="scl">Solar</div><div className="scs">{live.ppv>0?'Generando':'Sin sol'}</div></div>
                    <div className="sc load"><div className="sci">🏠</div><div className="scv">{fW(live.pload)}</div><div className="scl">Consumo</div><div className="scs">Casa</div></div>
                    <div className={`sc ${live.pgrid>0?'imp':live.pgrid<0?'exp':'neut'}`}>
                      <div className="sci">{live.pgrid>0?'⬇️':live.pgrid<0?'⬆️':'↔️'}</div>
                      <div className="scv">{fW(live.pgrid)}</div>
                      <div className="scl">Red</div>
                      <div className="scs">{live.pgrid>0?'Importando':live.pgrid<0?'Exportando':'Neutro'}</div>
                    </div>
                    <div className={`sc ${live.batCharging?'batc':live.batDischarging?'batd':'neut'}`}>
                      <div className="sci">🔋</div>
                      <div className="scv">{live.soc>0?`${live.soc}%`:'—'}</div>
                      <div className="scl">Batería</div>
                      <div className="scs">{live.batCharging?`Cargando ${fW(live.pbat)}`:live.batDischarging?`Descargando ${fW(live.pbat)}`:'Reposo'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* KPIs totales */}
              {kpi && (
                <div className="sec">
                  <div className="sl">ACUMULADOS</div>
                  <div className="kpis">
                    <div className="kp"><div className="kv yellow">{kpi.total_power??0}</div><div className="kl">kWh totales</div></div>
                    <div className="kp"><div className="kv green">{kpi.total_income??0} €</div><div className="kl">Ingresos totales</div></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──── HISTORY ──── */}
          {tab==='history' && (
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

              {/* Donuts */}
              {kpi && (
                <div className="sec">
                  <div className="sl">DISTRIBUCIÓN HOY</div>
                  <div className="donuts">
                    <Donut pct={1} color="#fbbf24" label="Generado" value={(kpi.power??0).toFixed(1)}/>
                    <Donut pct={0.18} color="#818cf8" label="Autoconsumo" value={(parseFloat(kpi.power||0)*0.18).toFixed(1)}/>
                    <Donut pct={0.82} color="#34d399" label="Inyectado" value={(parseFloat(kpi.power||0)*0.82).toFixed(1)}/>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="sec">
                <div className="sl">CURVA — {period==='day'?'HOY':period==='week'?'ESTA SEMANA':period==='month'?'ESTE MES':'ESTE AÑO'}</div>
                <div className="chartc">
                  {histLoading ? (
                    <div className="ldtxt">Cargando datos...</div>
                  ) : chartPts.length > 1 ? (
                    <>
                      <LineChart points={chartPts} color="#fbbf24"/>
                      <div className="xlabs">
                        {xLabels.map((l,i)=><span key={i} className="xl">{l}</span>)}
                      </div>
                    </>
                  ) : (
                    <div style={{textAlign:'center',padding:'30px 0',color:'#333',fontSize:12}}>
                      <div style={{fontSize:28,marginBottom:8}}>📊</div>
                      <div>No hay datos para este período</div>
                      <button className="btn-r" onClick={()=>fetchHistory(period,date)} style={{marginTop:12}}>Recargar</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Week bars */}
              {period==='week' && (
                <div className="sec">
                  <div className="sl">DÍAS DE LA SEMANA</div>
                  <div className="wbars">
                    {['L','M','X','J','V','S','D'].map((d,i)=>{
                      const tod = (new Date().getDay()+6)%7;
                      const isToday = i===tod;
                      const pt = chartPts[i] || {v:0};
                      const pct = chartPts.length ? pt.v / Math.max(...chartPts.map(p=>p.v),0.01) : 0;
                      return (
                        <div key={d} className="wbc">
                          <div className="wbv" style={{height:`${Math.max(4,pct*80)}px`,background:isToday?'linear-gradient(to top,#f59e0b,#fbbf24)':'linear-gradient(to top,#1e1e2e,#2d2d3e)',opacity:isToday?1:0.6}}>
                            {pt.v>0 && <div className="wbnum">{pt.v.toFixed(1)}</div>}
                          </div>
                          <div className="wbl" style={{color:isToday?'#fbbf24':'#444'}}>{d}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──── BALANCE ──── */}
          {tab==='balance' && (
            <div className="tc">

              {/* GASTO DESTACADO */}
              <div className="sec">
                <div className="sl">GASTO ENERGÍA COMPRADA (SESIÓN)</div>
                <div className="cost-hero">
                  <div className="ch-icon">🔌</div>
                  <div className="ch-val">{gi.toFixed(6)} €</div>
                  <div className="ch-kwh">{acc.imp.toFixed(4)} kWh importados</div>
                  <div className="ch-tarifa">Tarifa actual: {tarifa} €/kWh ({new Date().getHours()>=8?'Punta 08-24h':'Valle 00-08h'})</div>
                </div>
              </div>

              <div className="sec">
                <div className="sl">BALANCE NETO (SESIÓN)</div>
                <div className="balc">
                  <div className="br"><span className="bl">💰 Ingresos exportación</span><span className="bv pos">+{ie.toFixed(6)} €</span></div>
                  <div className="br"><span className="bl">⚡ Ahorro autoconsumo</span><span className="bv pos">+{aa.toFixed(6)} €</span></div>
                  <div className="br"><span className="bl">🔌 Gasto importación</span><span className="bv neg">−{gi.toFixed(6)} €</span></div>
                  <div className="bdiv"/>
                  <div className="bneto">
                    <span>BALANCE NETO</span>
                    <span className={neto>=0?'npos':'nneg'}>{neto>=0?'+':''}{neto.toFixed(6)} €</span>
                  </div>
                </div>
              </div>

              <div className="sec">
                <div className="sl">kWh ACUMULADOS (SESIÓN)</div>
                <div className="kwhrow">
                  <div className="kwc"><div className="kwv" style={{color:'#34d399'}}>{acc.exp.toFixed(4)}</div><div className="kwl">kWh\nExportado</div></div>
                  <div className="kwc"><div className="kwv" style={{color:'#818cf8'}}>{acc.self.toFixed(4)}</div><div className="kwl">kWh\nAutoconsumo</div></div>
                  <div className="kwc"><div className="kwv" style={{color:'#f87171'}}>{acc.imp.toFixed(4)}</div><div className="kwl">kWh\nImportado</div></div>
                </div>
              </div>

              {kpi && (
                <div className="sec">
                  <div className="sl">TOTALES HISTÓRICOS (SEMS)</div>
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

        /* LOGIN */
        .login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden}
        .login-glow{position:absolute;top:-80px;left:50%;transform:translateX(-50%);width:380px;height:380px;background:radial-gradient(circle,rgba(251,191,36,.12),transparent 70%);pointer-events:none}
        .login-box{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:360px;z-index:1}
        .sun{font-size:52px;filter:drop-shadow(0 0 18px rgba(251,191,36,.6));animation:ps 3s infinite}
        @keyframes ps{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        .lt{font-size:34px;font-weight:900;text-align:center;line-height:1;letter-spacing:-1px}
        .lt span{color:#fbbf24;text-shadow:0 0 18px rgba(251,191,36,.5)}
        .ls{color:#444;font-size:13px;font-weight:300}
        .inp{width:100%;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 16px;color:#e8e8f4;font-size:15px;font-family:'Outfit',sans-serif;outline:none;transition:border-color .2s,box-shadow .2s}
        .inp:focus{border-color:rgba(251,191,36,.4);box-shadow:0 0 0 3px rgba(251,191,36,.07)}
        .btn-l{width:100%;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#000;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer;box-shadow:0 0 20px rgba(251,191,36,.25);transition:opacity .2s}
        .btn-l:disabled{opacity:.5}
        .err{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);border-radius:8px;padding:10px 14px;color:#f87171;font-size:12px;width:100%}

        /* DASH */
        .dash{padding-bottom:48px}
        .hdr{display:flex;justify-content:space-between;align-items:center;padding:18px 16px 12px;border-bottom:1px solid rgba(255,255,255,.04)}
        .eyebrow{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:3px;color:#2d2d3d;margin-bottom:3px}
        .htitle{font-size:20px;font-weight:700;letter-spacing:-.5px}
        .clock{display:flex;align-items:center;gap:6px;font-family:'Space Mono',monospace;font-size:11px;color:#444}
        .dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;animation:pd 2s infinite}
        @keyframes pd{0%,100%{opacity:1}50%{opacity:.35}}
        .tabs{display:flex;gap:4px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.03)}
        .tb{flex:1;background:transparent;border:1px solid transparent;border-radius:10px;padding:9px 4px;font-size:12px;font-weight:500;font-family:'Outfit',sans-serif;color:#444;cursor:pointer;transition:all .2s;white-space:nowrap}
        .tb.on{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.09);color:#e8e8f4}
        .tc{padding-bottom:20px}
        .merr{margin:12px;background:rgba(248,113,113,.07);border:1px solid rgba(248,113,113,.18);border-radius:10px;padding:10px 12px;color:#f87171;font-size:12px}

        /* COST BANNER */
        .cost-banner{margin:14px 12px 0;background:linear-gradient(135deg,rgba(15,15,30,1),rgba(20,20,40,1));border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px}
        .cb-row{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;align-items:center;gap:4px}
        .cb-sep{width:1px;height:32px;background:rgba(255,255,255,.07)}
        .cb-item{display:flex;flex-direction:column;align-items:center;gap:2px}
        .cb-label{font-size:9px;color:#444;text-align:center;font-family:'Space Mono',monospace;line-height:1.2}
        .cb-val{font-family:'Space Mono',monospace;font-size:12px;font-weight:700;text-align:center}
        .cb-val.yellow{color:#fbbf24;text-shadow:0 0 8px rgba(251,191,36,.4)}
        .cb-val.green{color:#34d399;text-shadow:0 0 8px rgba(52,211,153,.4)}
        .cb-val.red{color:#f87171;text-shadow:0 0 8px rgba(248,113,113,.4)}

        /* SECTIONS */
        .sec{padding:16px 12px 0}
        .sl{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#242434;margin-bottom:10px}
        .ldtxt{text-align:center;padding:30px;color:#333;font-family:'Space Mono',monospace;font-size:11px}

        /* POWER FLOW CARD */
        .pf-wrap{background:rgba(255,255,255,.018);border:1px solid rgba(255,255,255,.05);border-radius:18px;padding:8px 4px;overflow:hidden}
        .pfc{width:100%}

        /* STAT CARDS */
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .sc{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:13px;position:relative;overflow:hidden}
        .sc::after{content:'';position:absolute;top:0;left:0;right:0;height:1.5px;border-radius:14px 14px 0 0}
        .sc.solar::after{background:linear-gradient(90deg,#fbbf24,transparent)}
        .sc.load::after{background:linear-gradient(90deg,#818cf8,transparent)}
        .sc.imp::after{background:linear-gradient(90deg,#f87171,transparent)}
        .sc.exp::after{background:linear-gradient(90deg,#34d399,transparent)}
        .sc.batc::after{background:linear-gradient(90deg,#60a5fa,transparent)}
        .sc.batd::after{background:linear-gradient(90deg,#a78bfa,transparent)}
        .sci{font-size:18px;margin-bottom:5px}
        .scv{font-family:'Space Mono',monospace;font-size:16px;font-weight:700;margin-bottom:2px}
        .sc.solar .scv{color:#fbbf24;text-shadow:0 0 8px rgba(251,191,36,.35)}
        .sc.load .scv{color:#818cf8}
        .sc.imp .scv{color:#f87171;text-shadow:0 0 8px rgba(248,113,113,.25)}
        .sc.exp .scv{color:#34d399;text-shadow:0 0 8px rgba(52,211,153,.25)}
        .sc.batc .scv{color:#60a5fa}
        .sc.batd .scv{color:#a78bfa}
        .scl{font-size:11px;font-weight:600;color:#888}
        .scs{font-size:9px;color:#333;font-family:'Space Mono',monospace;margin-top:2px}

        /* KPIS */
        .kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .kp{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:14px;text-align:center}
        .kv{font-family:'Space Mono',monospace;font-size:15px;font-weight:700;margin-bottom:4px}
        .yellow{color:#fbbf24;text-shadow:0 0 10px rgba(251,191,36,.4)}
        .green{color:#34d399;text-shadow:0 0 10px rgba(52,211,153,.4)}
        .kl{font-size:10px;color:#444}

        /* PERIOD */
        .prow{display:flex;gap:6px;margin-bottom:10px}
        .pb{flex:1;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:9px 4px;font-size:11px;font-weight:600;font-family:'Outfit',sans-serif;color:#444;cursor:pointer;transition:all .2s}
        .pb.on{background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.25);color:#fbbf24}
        .drow{display:flex;gap:8px}
        .dinp{flex:1;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:9px 12px;color:#aaa;font-size:13px;font-family:'Outfit',sans-serif;outline:none}
        .dclear{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:9px 14px;color:#666;font-size:12px;font-family:'Outfit',sans-serif;cursor:pointer}

        /* DONUTS */
        .donuts{display:flex;justify-content:space-around;padding:6px 0}

        /* CHART */
        .chartc{background:rgba(255,255,255,.018);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px;overflow:hidden}
        .xlabs{display:flex;justify-content:space-between;margin-top:5px}
        .xl{font-size:9px;color:#2a2a3a;font-family:'Space Mono',monospace}
        .btn-r{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:8px;padding:8px 16px;color:#fbbf24;font-size:12px;font-family:'Outfit',sans-serif;cursor:pointer}

        /* WEEK BARS */
        .wbars{display:flex;gap:6px;align-items:flex-end;height:100px;padding:6px 2px}
        .wbc{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end}
        .wbv{width:100%;border-radius:3px 3px 0 0;min-height:4px;display:flex;align-items:flex-start;justify-content:center;transition:height .4s}
        .wbnum{font-size:7px;color:rgba(0,0,0,.6);font-family:'Space Mono',monospace;padding-top:2px}
        .wbl{font-size:10px;font-weight:600}

        /* COST HERO */
        .cost-hero{background:linear-gradient(135deg,rgba(248,113,113,.06),rgba(15,5,5,1));border:1px solid rgba(248,113,113,.15);border-radius:16px;padding:20px;text-align:center}
        .ch-icon{font-size:32px;margin-bottom:8px}
        .ch-val{font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#f87171;text-shadow:0 0 16px rgba(248,113,113,.5);margin-bottom:6px}
        .ch-kwh{font-size:13px;color:#f87171;opacity:.6;margin-bottom:6px;font-family:'Space Mono',monospace}
        .ch-tarifa{font-size:11px;color:#555;font-family:'Space Mono',monospace}

        /* BALANCE */
        .balc{background:rgba(255,255,255,.018);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px}
        .br{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:12px}
        .bl{color:#555}
        .bv{font-family:'Space Mono',monospace;font-size:12px;font-weight:700}
        .pos{color:#34d399}
        .neg{color:#f87171}
        .bdiv{height:1px;background:rgba(255,255,255,.05);margin:6px 0}
        .bneto{display:flex;justify-content:space-between;align-items:center;padding-top:6px;font-weight:700;font-size:13px}
        .npos{font-family:'Space Mono',monospace;color:#34d399;font-size:17px;text-shadow:0 0 10px rgba(52,211,153,.4)}
        .nneg{font-family:'Space Mono',monospace;color:#f87171;font-size:17px}
        .kwhrow{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
        .kwc{background:rgba(255,255,255,.018);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:12px 6px;text-align:center}
        .kwv{font-family:'Space Mono',monospace;font-size:14px;font-weight:700;margin-bottom:4px}
        .kwl{font-size:9px;color:#444;white-space:pre-line;line-height:1.3}
      `}</style>
    </>
  );
}
