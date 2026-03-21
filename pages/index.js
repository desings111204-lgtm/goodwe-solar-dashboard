import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

const TARIFA_EXPORTACION = 0.06;
const TARIFA_IMPORTACION_PUNTA = 0.1102;
const TARIFA_IMPORTACION_VALLE = 0.033;
const STATION_ID = '8445d981-4fbe-414b-9d12-60bac0b7eeb1';
const SEMS_BASE = 'https://www.semsportal.com/api/v2';

function getTarifaImportacion() {
  const h = new Date().getHours();
  return h >= 8 ? TARIFA_IMPORTACION_PUNTA : TARIFA_IMPORTACION_VALLE;
}
function formatW(w) {
  if (w == null || isNaN(w)) return '—';
  if (Math.abs(w) >= 1000) return `${(w/1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

// Extrae todos los campos posibles de la respuesta SEMS
function extractFields(d) {
  if (!d) return { ppv:0, pload:0, pgrid:0, pbat:0, soc:0 };

  // Estructura powerflow (inversor con bateria)
  const pf = d.powerflow;
  if (pf) {
    return {
      ppv:   parseFloat(pf.pv   ?? pf.ppv   ?? 0),
      pload: parseFloat(pf.load ?? pf.pload ?? 0),
      pgrid: parseFloat(pf.grid ?? pf.pgrid ?? 0),
      pbat:  parseFloat(pf.bettery ?? pf.battery ?? pf.pbat ?? 0),
      soc:   parseFloat(pf.soc ?? d.soc ?? d.kpi?.soc ?? 0),
    };
  }

  // Estructura kpi (la que vemos en los datos brutos)
  const kpi = d.kpi || {};
  const inv = d.inverter?.[0] || d.solarList?.[0] || {};
  const invD = inv.d || inv;

  return {
    ppv:   parseFloat(kpi.pac   ?? invD.ppv   ?? invD.pac   ?? 0),
    pload: parseFloat(kpi.load  ?? invD.pload ?? 0),
    pgrid: parseFloat(invD.pgrid ?? invD.grid  ?? 0),
    pbat:  parseFloat(invD.pbat  ?? invD.battery ?? 0),
    soc:   parseFloat(d.soc ?? kpi.soc ?? inv.soc ?? invD.soc ?? d.info?.battery_capacity ?? 0),
  };
}

export default function Dashboard() {
  const [step, setStep] = useState('login');
  const [account, setAccount] = useState('');
  const [pwd, setPwd] = useState('');
  const [token, setToken] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [monitorError, setMonitorError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [accumulated, setAccumulated] = useState({ importKwh:0, exportKwh:0, selfKwh:0 });
  const [rawDebug, setRawDebug] = useState(null);
  const intervalRef = useRef(null);
  const lastPollRef = useRef(null);

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/sems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, pwd }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Login failed');
      setToken(json);
      setStep('dashboard');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fetchMonitor = useCallback(async () => {
    if (!token) return;
    try {
      setMonitorError(null);
      const authToken = JSON.stringify(token);
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': authToken },
        body: JSON.stringify({ powerStationId: STATION_ID }),
      });
      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); }
      catch(e) { throw new Error('Respuesta no JSON: ' + raw.substring(0, 100)); }

      if (parseInt(result.code) !== 0) {
        throw new Error(`Error ${result.code}: ${result.msg}`);
      }

      const d = result.data;
      setRawDebug(d);

      const { ppv, pload, pgrid, pbat, soc } = extractFields(d);
      console.log('Extracted:', { ppv, pload, pgrid, pbat, soc });

      setData({ ppv, pload, pgrid, pbat, soc });

      const now = Date.now();
      if (lastPollRef.current) {
        const dtH = (now - lastPollRef.current) / 3600000;
        setAccumulated(prev => ({
          importKwh: prev.importKwh + (pgrid > 0 ? pgrid*dtH/1000 : 0),
          exportKwh: prev.exportKwh + (pgrid < 0 ? Math.abs(pgrid)*dtH/1000 : 0),
          selfKwh:   prev.selfKwh   + (Math.max(0, ppv - Math.max(0, -pgrid))*dtH/1000),
        }));
      }
      lastPollRef.current = now;
      setLastUpdate(new Date());
    } catch(e) {
      setMonitorError(e.message);
    }
  }, [token]);

  useEffect(() => {
    if (step === 'dashboard') {
      fetchMonitor();
      intervalRef.current = setInterval(fetchMonitor, 30000);
    }
    return () => clearInterval(intervalRef.current);
  }, [step, fetchMonitor]);

  const balance = data ? (() => {
    const t = getTarifaImportacion();
    const ie = accumulated.exportKwh * TARIFA_EXPORTACION;
    const aa = accumulated.selfKwh * t;
    const gi = accumulated.importKwh * t;
    return { ie, aa, gi, neto: ie+aa-gi };
  })() : null;

  return (
    <>
      <Head>
        <title>Solar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
      </Head>
      <div className="app">

        {step === 'login' && (
          <div className="login-wrap">
            <div style={{fontSize:52}}>☀️</div>
            <h1 className="login-title">GoodWe<br /><span>Dashboard</span></h1>
            <p style={{color:'#888',fontSize:13}}>Accede con tu cuenta SEMS+</p>
            <input className="input" type="email" placeholder="Email" value={account} onChange={e=>setAccount(e.target.value)} />
            <input className="input" type="password" placeholder="Contraseña" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} />
            {error && <div className="error">{error}</div>}
            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? 'Conectando...' : 'Entrar'}
            </button>
          </div>
        )}

        {step === 'dashboard' && (
          <div className="dashboard">
            <header className="dash-header">
              <div className="dash-title">Solar Live</div>
              <div style={{fontFamily:'Space Mono',fontSize:11,color:'#555'}}>
                {lastUpdate ? `⟳ ${lastUpdate.toLocaleTimeString('es-ES')}` : 'Cargando...'}
              </div>
            </header>

            {monitorError && (
              <div style={{margin:'14px',background:'#1a0808',border:'1px solid #f87171',borderRadius:10,padding:12}}>
                <div style={{color:'#f87171',fontSize:12,fontFamily:'Space Mono',marginBottom:4}}>ERROR:</div>
                <div style={{color:'#f87171',fontSize:13}}>{monitorError}</div>
              </div>
            )}

            {!data && !monitorError && (
              <div style={{textAlign:'center',padding:'40px 20px',color:'#555',fontFamily:'Space Mono',fontSize:13}}>Obteniendo datos...</div>
            )}

            {data && (
              <>
                <section className="section">
                  <div className="section-label">FLUJOS AHORA</div>
                  <div className="cards-grid">
                    <div className="card">
                      <span className="card-icon">☀️</span>
                      <div className="card-value solar-val">{formatW(data.ppv)}</div>
                      <div className="card-label">Solar</div>
                      <div className="card-sub">{data.ppv > 0 ? 'Generando' : 'Sin sol'}</div>
                    </div>
                    <div className="card">
                      <span className="card-icon">🏠</span>
                      <div className="card-value load-val">{formatW(data.pload)}</div>
                      <div className="card-label">Carga</div>
                      <div className="card-sub">Consumo casa</div>
                    </div>
                    <div className="card">
                      <span className="card-icon">{data.pgrid>0?'⬇️':data.pgrid<0?'⬆️':'↔️'}</span>
                      <div className={`card-value ${data.pgrid>0?'import-val':data.pgrid<0?'export-val':''}`}>
                        {formatW(Math.abs(data.pgrid))}
                      </div>
                      <div className="card-label">Red</div>
                      <div className="card-sub">{data.pgrid>0?'Importando':data.pgrid<0?'Exportando':'Sin flujo'}</div>
                    </div>
                    <div className="card">
                      <span className="card-icon">🔋</span>
                      <div className="card-value bat-val">
                        {data.soc > 0 ? `${data.soc}%` : '—'}
                      </div>
                      <div className="card-label">Batería</div>
                      <div className="card-sub">{data.pbat>0?'Cargando':data.pbat<0?'Descargando':'Reposo'}</div>
                    </div>
                  </div>
                </section>

                {balance && (
                  <section className="section">
                    <div className="section-label">BALANCE ECONÓMICO (SESIÓN)</div>
                    <div className="balance-card">
                      <div className="balance-row"><span className="balance-label">💰 Exportación</span><span className="balance-value pos">+{balance.ie.toFixed(4)} €</span></div>
                      <div className="balance-row"><span className="balance-label">⚡ Autoconsumo</span><span className="balance-value pos">+{balance.aa.toFixed(4)} €</span></div>
                      <div className="balance-row"><span className="balance-label">🔌 Importación</span><span className="balance-value neg">-{balance.gi.toFixed(4)} €</span></div>
                      <div className="balance-divider" />
                      <div className="balance-neto">
                        <span>BALANCE NETO</span>
                        <span className={balance.neto>=0?'pos':'neg'}>{balance.neto>=0?'+':''}{balance.neto.toFixed(4)} €</span>
                      </div>
                    </div>
                  </section>
                )}

                <section className="section">
                  <div className="section-label">kWh SESIÓN</div>
                  <div className="kwh-row">
                    <div className="kwh-item"><div className="kwh-val solar-val">{accumulated.exportKwh.toFixed(3)}</div><div className="kwh-lbl">Exportado</div></div>
                    <div className="kwh-item"><div className="kwh-val load-val">{accumulated.selfKwh.toFixed(3)}</div><div className="kwh-lbl">Autoconsumo</div></div>
                    <div className="kwh-item"><div className="kwh-val import-val">{accumulated.importKwh.toFixed(3)}</div><div className="kwh-lbl">Importado</div></div>
                  </div>
                </section>

                {/* KPIs del día desde SEMS */}
                {rawDebug?.kpi && (
                  <section className="section">
                    <div className="section-label">KPIs HOY (SEMS)</div>
                    <div className="balance-card">
                      <div className="balance-row"><span className="balance-label">⚡ Generación hoy</span><span className="balance-value pos">{rawDebug.kpi.power ?? '—'} kWh</span></div>
                      <div className="balance-row"><span className="balance-label">💰 Ingresos hoy (SEMS)</span><span className="balance-value pos">{rawDebug.kpi.day_income ?? '—'} €</span></div>
                      <div className="balance-row"><span className="balance-label">📊 Total acumulado</span><span className="balance-value pos">{rawDebug.kpi.total_power ?? '—'} kWh</span></div>
                      <div className="balance-row"><span className="balance-label">🏦 Ingresos totales</span><span className="balance-value pos">{rawDebug.kpi.total_income ?? '—'} €</span></div>
                    </div>
                  </section>
                )}

                <div style={{padding:'16px 16px 0'}}>
                  <details>
                    <summary style={{fontSize:9,color:'#333',fontFamily:'Space Mono',cursor:'pointer'}}>Ver datos brutos API</summary>
                    <pre style={{background:'#0a0a12',border:'1px solid #1a1a2e',borderRadius:8,padding:10,fontSize:9,color:'#444',overflowX:'auto',whiteSpace:'pre-wrap',wordBreak:'break-all',marginTop:6}}>
                      {JSON.stringify(rawDebug, null, 2)?.substring(0, 4000)}
                    </pre>
                  </details>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0f;color:#e8e8f0;font-family:'Syne',sans-serif;-webkit-font-smoothing:antialiased}
        .app{min-height:100vh;max-width:480px;margin:0 auto;padding:0 0 40px}
        .login-wrap{display:flex;flex-direction:column;align-items:center;padding:60px 24px 40px;gap:16px}
        .login-title{font-size:32px;font-weight:800;text-align:center;line-height:1.1}
        .login-title span{color:#f59e0b}
        .input{width:100%;background:#13131f;border:1.5px solid #2a2a3f;border-radius:12px;padding:14px 16px;color:#e8e8f0;font-size:16px;font-family:inherit;outline:none}
        .input:focus{border-color:#f59e0b}
        .btn-primary{width:100%;background:#f59e0b;color:#0a0a0f;border:none;border-radius:12px;padding:16px;font-size:16px;font-weight:700;font-family:inherit;cursor:pointer}
        .btn-primary:disabled{opacity:.5}
        .error{background:#2a0a0a;border:1px solid #f87171;border-radius:8px;padding:10px 14px;color:#f87171;font-size:12px;width:100%;word-break:break-all}
        .dash-header{display:flex;justify-content:space-between;align-items:center;padding:20px 20px 8px;border-bottom:1px solid #1a1a2e}
        .dash-title{font-size:20px;font-weight:800}
        .section{padding:20px 16px 0}
        .section-label{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;color:#444;margin-bottom:12px}
        .cards-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .card{background:#0f0f1a;border:1px solid #1e1e30;border-radius:16px;padding:16px}
        .card-icon{font-size:20px;display:block;margin-bottom:8px}
        .card-value{font-family:'Space Mono',monospace;font-size:18px;font-weight:700}
        .solar-val{color:#fbbf24}.load-val{color:#a5b4fc}.import-val{color:#f87171}.export-val{color:#34d399}.bat-val{color:#34d399}
        .card-label{font-size:13px;font-weight:700;margin-top:4px}
        .card-sub{font-size:11px;color:#555;margin-top:3px;font-family:'Space Mono',monospace}
        .balance-card{background:#0f0f1a;border:1px solid #1e1e30;border-radius:16px;padding:18px}
        .balance-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1a1a2a;font-size:13px}
        .balance-label{color:#aaa}
        .balance-value{font-family:'Space Mono',monospace;font-size:13px;font-weight:700}
        .pos{color:#34d399}.neg{color:#f87171}
        .balance-divider{height:1px;background:#2a2a3f;margin:8px 0}
        .balance-neto{display:flex;justify-content:space-between;align-items:center;padding-top:8px;font-weight:700;font-size:14px}
        .balance-neto .pos,.balance-neto .neg{font-family:'Space Mono',monospace;font-size:16px}
        .kwh-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
        .kwh-item{background:#0f0f1a;border:1px solid #1e1e30;border-radius:12px;padding:14px 10px;text-align:center}
        .kwh-val{font-family:'Space Mono',monospace;font-size:14px;font-weight:700}
        .kwh-lbl{font-size:10px;color:#555;margin-top:4px}
      `}</style>
    </>
  );
}
