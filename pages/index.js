import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

const TARIFA_EXPORTACION = 0.06;
const TARIFA_IMPORTACION_PUNTA = 0.1102;
const TARIFA_IMPORTACION_VALLE = 0.033;

function getTarifaImportacion() {
  const h = new Date().getHours();
  return (h >= 8) ? TARIFA_IMPORTACION_PUNTA : TARIFA_IMPORTACION_VALLE;
}

function formatW(w) {
  if (w === null || w === undefined) return '—';
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

export default function Dashboard() {
  const [step, setStep] = useState('login');
  const [account, setAccount] = useState('');
  const [pwd, setPwd] = useState('');
  const [token, setToken] = useState(null);
  const [plants, setPlants] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [accumulated, setAccumulated] = useState({ importKwh: 0, exportKwh: 0, selfKwh: 0 });
  const intervalRef = useRef(null);
  const lastPollRef = useRef(null);

  const api = async (action, body) => {
    const r = await fetch(`/api/sems?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json()).error);
    return r.json();
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const tokenData = await api('login', { account, pwd });
      setToken(tokenData);
      const plantData = await api('plants', { token: tokenData });
      const list = plantData?.list || plantData?.powerStationList || [];
      if (list.length === 1) {
        setSelectedPlant(list[0].id || list[0].stationId);
        setStep('dashboard');
      } else {
        setPlants(list);
        setStep('plants');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonitor = useCallback(async () => {
    if (!token || !selectedPlant) return;
    try {
      const result = await api('monitor', { token, powerStationId: selectedPlant });
      const inv = result?.inverter?.[0] || result?.solarList?.[0] || {};
      const d = result?.powerflow || inv?.d || result;
      const ppv   = parseFloat(d?.ppv   ?? inv?.ppv   ?? 0);
      const pload = parseFloat(d?.pload ?? inv?.pload ?? 0);
      const pgrid = parseFloat(d?.pgrid ?? inv?.pgrid ?? 0);
      const pbat  = parseFloat(d?.pbat  ?? inv?.pbat  ?? 0);
      const soc   = parseFloat(result?.soc ?? inv?.soc ?? d?.soc ?? 0);
      setData({ ppv, pload, pgrid, pbat, soc, raw: result });
      setLastUpdate(new Date());
      const now = Date.now();
      const last = lastPollRef.current;
      if (last) {
        const dtH = (now - last) / 3600000;
        setAccumulated(prev => ({
          importKwh: prev.importKwh + (pgrid > 0 ? pgrid * dtH / 1000 : 0),
          exportKwh: prev.exportKwh + (pgrid < 0 ? Math.abs(pgrid) * dtH / 1000 : 0),
          selfKwh: prev.selfKwh + (Math.max(0, ppv - Math.max(0, -pgrid)) * dtH / 1000),
        }));
      }
      lastPollRef.current = now;
    } catch (e) {
      console.error('Monitor error:', e);
    }
  }, [token, selectedPlant]);

  useEffect(() => {
    if (step === 'dashboard') {
      fetchMonitor();
      intervalRef.current = setInterval(fetchMonitor, 30000);
    }
    return () => clearInterval(intervalRef.current);
  }, [step, fetchMonitor]);

  const balance = data ? (() => {
    const tarifa = getTarifaImportacion();
    const ingresoExportacion = accumulated.exportKwh * TARIFA_EXPORTACION;
    const ahorroAutoconsumo = accumulated.selfKwh * tarifa;
    const gastoImportacion = accumulated.importKwh * tarifa;
    return {
      ingresoExportacion,
      ahorroAutoconsumo,
      gastoImportacion,
      neto: ingresoExportacion + ahorroAutoconsumo - gastoImportacion,
    };
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
            <div className="login-logo">☀️</div>
            <h1 className="login-title">GoodWe<br /><span>Dashboard</span></h1>
            <p className="login-sub">Accede con tu cuenta SEMS Portal</p>
            <input className="input" type="email" placeholder="Email SEMS" value={account} onChange={e => setAccount(e.target.value)} />
            <input className="input" type="password" placeholder="Contraseña" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            {error && <div className="error">{error}</div>}
            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? 'Conectando...' : 'Entrar'}
            </button>
          </div>
        )}
        {step === 'plants' && (
          <div className="login-wrap">
            <h2 className="section-title">Selecciona instalación</h2>
            {plants.map(p => (
              <button key={p.id || p.stationId} className="btn-plant" onClick={() => { setSelectedPlant(p.id || p.stationId); setStep('dashboard'); }}>
                {p.stationName || p.name || p.id}
              </button>
            ))}
          </div>
        )}
        {step === 'dashboard' && (
          <div className="dashboard">
            <header className="dash-header">
              <div className="dash-title">Solar Live</div>
              <div className="dash-update">
                {lastUpdate ? `⟳ ${lastUpdate.toLocaleTimeString('es-ES')}` : 'Cargando...'}
              </div>
            </header>
            {!data ? (
              <div className="loading-msg">Obteniendo datos...</div>
            ) : (
              <>
                <section className="section">
                  <div className="section-label">FLUJOS AHORA</div>
                  <div className="cards-grid">
                    <div className="card solar">
                      <span className="card-icon">☀️</span>
                      <div className="card-value solar-val">{formatW(data.ppv)}</div>
                      <div className="card-label">Solar</div>
                      <div className="card-sub">Generando</div>
                    </div>
                    <div className="card">
                      <span className="card-icon">🏠</span>
                      <div className="card-value load-val">{formatW(data.pload)}</div>
                      <div className="card-label">Carga</div>
                      <div className="card-sub">Consumo casa</div>
                    </div>
                    <div className={`card ${data.pgrid > 0 ? 'import' : data.pgrid < 0 ? 'export' : ''}`}>
                      <span className="card-icon">{data.pgrid > 0 ? '⬇️' : data.pgrid < 0 ? '⬆️' : '↔️'}</span>
                      <div className={`card-value ${data.pgrid > 0 ? 'import-val' : data.pgrid < 0 ? 'export-val' : ''}`}>{formatW(Math.abs(data.pgrid))}</div>
                      <div className="card-label">Red</div>
                      <div className="card-sub">{data.pgrid > 0 ? 'Importando' : data.pgrid < 0 ? 'Exportando' : 'Sin flujo'}</div>
                    </div>
                    <div className="card">
                      <span className="card-icon">🔋</span>
                      <div className="card-value bat-val">{data.soc}%</div>
                      <div className="card-label">Batería</div>
                      <div className="card-sub">{formatW(Math.abs(data.pbat))} · {data.pbat > 0 ? 'Cargando' : data.pbat < 0 ? 'Descargando' : 'Reposo'}</div>
                    </div>
                  </div>
                </section>
                {balance && (
                  <section className="section">
                    <div className="section-label">BALANCE ECONÓMICO (SESIÓN)</div>
                    <div className="balance-card">
                      <div className="balance-row">
                        <span className="balance-label">💰 Ingresos exportación</span>
                        <span className="balance-value pos">+{balance.ingresoExportacion.toFixed(4)} €</span>
                      </div>
                      <div className="balance-row">
                        <span className="balance-label">⚡ Ahorro autoconsumo</span>
                        <span className="balance-value pos">+{balance.ahorroAutoconsumo.toFixed(4)} €</span>
                      </div>
                      <div className="balance-row">
                        <span className="balance-label">🔌 Gasto importación</span>
                        <span className="balance-value neg">-{balance.gastoImportacion.toFixed(4)} €</span>
                      </div>
                      <div className="balance-divider" />
                      <div className="balance-neto">
                        <span>BALANCE NETO</span>
                        <span className={balance.neto >= 0 ? 'pos' : 'neg'}>
                          {balance.neto >= 0 ? '+' : ''}{balance.neto.toFixed(4)} €
                        </span>
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
              </>
            )}
          </div>
        )}
      </div>
      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; color: #e8e8f0; font-family: 'Syne', sans-serif; -webkit-font-smoothing: antialiased; }
        .app { min-height: 100vh; max-width: 480px; margin: 0 auto; padding: 0 0 40px; }
        .login-wrap { display: flex; flex-direction: column; align-items: center; padding: 60px 24px 40px; gap: 16px; }
        .login-logo { font-size: 56px; }
        .login-title { font-size: 32px; font-weight: 800; text-align: center; line-height: 1.1; }
        .login-title span { color: #f59e0b; }
        .login-sub { color: #888; font-size: 14px; }
        .input { width: 100%; background: #13131f; border: 1.5px solid #2a2a3f; border-radius: 12px; padding: 14px 16px; color: #e8e8f0; font-size: 16px; font-family: inherit; outline: none; }
        .input:focus { border-color: #f59e0b; }
        .btn-primary { width: 100%; background: #f59e0b; color: #0a0a0f; border: none; border-radius: 12px; padding: 16px; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer; }
        .btn-primary:disabled { opacity: .5; }
        .btn-plant { width: 100%; background: #13131f; border: 1.5px solid #2a2a3f; border-radius: 12px; padding: 16px; color: #e8e8f0; font-size: 15px; font-family: inherit; cursor: pointer; text-align: left; }
        .error { background: #2a0a0a; border: 1px solid #f87171; border-radius: 8px; padding: 10px 14px; color: #f87171; font-size: 13px; width: 100%; }
        .dash-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 8px; border-bottom: 1px solid #1a1a2e; }
        .dash-title { font-size: 20px; font-weight: 800; }
        .dash-update { font-family: 'Space Mono', monospace; font-size: 11px; color: #555; }
        .loading-msg { text-align: center; padding: 60px 20px; color: #555; font-family: 'Space Mono', monospace; font-size: 13px; }
        .section { padding: 20px 16px 0; }
        .section-label { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 2px; color: #444; margin-bottom: 12px; }
        .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .card { background: #0f0f1a; border: 1px solid #1e1e30; border-radius: 16px; padding: 16px; }
        .card-icon { font-size: 20px; display: block; margin-bottom: 8px; }
        .card-value { font-family: 'Space Mono', monospace; font-size: 18px; font-weight: 700; }
        .solar-val { color: #fbbf24; }
        .load-val { color: #a5b4fc; }
        .import-val { color: #f87171; }
        .export-val { color: #34d399; }
        .bat-val { color: #34d399; }
        .card-label { font-size: 13px; font-weight: 700; margin-top: 4px; }
        .card-sub { font-size: 11px; color: #555; margin-top: 3px; font-family: 'Space Mono', monospace; }
        .balance-card { background: #0f0f1a; border: 1px solid #1e1e30; border-radius: 16px; padding: 18px; }
        .balance-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #1a1a2a; font-size: 13px; }
        .balance-label { color: #aaa; }
        .balance-value { font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 700; }
        .pos { color: #34d399; }
        .neg { color: #f87171; }
        .balance-divider { height: 1px; background: #2a2a3f; margin: 8px 0; }
        .balance-neto { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; font-weight: 700; font-size: 14px; }
        .balance-neto .pos, .balance-neto .neg { font-family: 'Space Mono', monospace; font-size: 16px; }
        .kwh-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .kwh-item { background: #0f0f1a; border: 1px solid #1e1e30; border-radius: 12px; padding: 14px 10px; text-align: center; }
        .kwh-val { font-family: 'Space Mono', monospace; font-size: 14px; font-weight: 700; }
        .kwh-lbl { font-size: 10px; color: #555; margin-top: 4px; }
      `}</style>
    </>
  );
}
