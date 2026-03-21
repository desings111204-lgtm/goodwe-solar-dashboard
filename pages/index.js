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
    return { ppv:parseFloat(pf.pv??pf.ppv??0), pload:parseFloat(pf.load??pf.pload??0),
      pgrid:parseFloat(pf.grid??pf.pgrid??0), pbat:raw,
      batCharging:raw<0, batDischarging:raw>0, soc:parseFloat(pf.soc??d.soc??0) };
  }
  const kpi=d.kpi||{}; const inv=d.inverter?.[0]||{}; const invD=inv.d||inv;
  const raw=parseFloat(invD.pbat??0);
  return { ppv:parseFloat(kpi.pac??invD.ppv??0), pload:parseFloat(kpi.load??invD.pload??0),
    pgrid:parseFloat(invD.pgrid??0), pbat:raw,
    batCharging:raw<0, batDischarging:raw>0, soc:parseFloat(d.soc??inv.soc??invD.soc??0) };
}

// ===== DATA CHIP =====
function Chip({ v, sub, color, style }) {
  return (
    <div style={{
      position:'absolute', background:'rgba(255,255,255,0.93)',
      backdropFilter:'blur(6px)', border:`1.5px solid ${color}`,
      borderRadius:10, padding:'5px 10px', textAlign:'center',
      boxShadow:`0 2px 10px rgba(0,0,0,0.15)`, minWidth:70, ...style
    }}>
      <div style={{fontFamily:'Space Mono,monospace',fontSize:12,fontWeight:700,color,lineHeight:1.2}}>{v}</div>
      <div style={{fontFamily:'Space Mono,monospace',fontSize:8,color:'#777',marginTop:1}}>{sub}</div>
    </div>
  );
}

// ===== GOODWE SCENE SVG (light theme matching the render) =====
function GoodWeScene({ ppv, pload, pgrid, pbat, soc, batCharging, batDischarging }) {
  const importing = pgrid > 0;
  const exporting = pgrid < 0;
  const hasSolar = ppv > 0;
  const hasBat = Math.abs(pbat) > 2;

  return (
    <div style={{position:'relative', background:'linear-gradient(180deg,#d4e8f5 0%,#eef4f8 35%,#f0f0ea 100%)', borderRadius:16, overflow:'hidden'}}>
      <svg viewBox="0 0 420 460" width="100%" style={{display:'block'}}>
        <defs>
          <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c5ddf0"/><stop offset="100%" stopColor="#e8f2f8"/>
          </linearGradient>
          <linearGradient id="gndG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e5e5de"/><stop offset="100%" stopColor="#d8d8d0"/>
          </linearGradient>
          <linearGradient id="panG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8bbfe0"/><stop offset="100%" stopColor="#5a9fc8"/>
          </linearGradient>
          <radialGradient id="winG" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2"/>
          </radialGradient>
          <linearGradient id="invG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f9f9f9"/><stop offset="100%" stopColor="#e8e8e8"/>
          </linearGradient>
        </defs>

        {/* Sky & Ground */}
        <rect x="0" y="0" width="420" height="270" fill="url(#skyG)"/>
        <rect x="0" y="270" width="420" height="190" fill="url(#gndG)"/>
        <ellipse cx="225" cy="282" rx="145" ry="11" fill="rgba(0,0,0,0.07)"/>

        {/* === UTILITY POLE === */}
        <rect x="58" y="75" width="7" height="195" rx="2" fill="#8b8b8b"/>
        <rect x="34" y="84" width="55" height="6" rx="2" fill="#6b6b6b"/>
        <circle cx="38" cy="87" r="4" fill="#999" stroke="#777" strokeWidth="0.5"/>
        <circle cx="85" cy="87" r="4" fill="#999" stroke="#777" strokeWidth="0.5"/>
        <rect x="59" y="268" width="11" height="9" rx="1" fill="#777"/>
        {/* Meter box */}
        <rect x="44" y="148" width="29" height="37" rx="3" fill="#f3f4f6" stroke="#ccc" strokeWidth="1"/>
        <rect x="47" y="151" width="23" height="27" rx="2" fill="#e5e7eb"/>
        <circle cx="58" cy="164" r="5" fill="#f9fafb" stroke="#aaa" strokeWidth="1"/>
        <circle cx="58" cy="164" r="2" fill={importing?'#dc2626':exporting?'#16a34a':'#9ca3af'}/>

        {/* === HOUSE === */}
        <rect x="100" y="170" width="220" height="110" rx="3" fill="#f9f9f7" stroke="#e0e0d8" strokeWidth="1"/>
        <polygon points="93,173 210,93 317,173" fill="#f0f0ec" stroke="#ddd" strokeWidth="1"/>
        {/* Chimney */}
        <rect x="255" y="108" width="17" height="30" fill="#eee" stroke="#ddd" strokeWidth="0.8"/>
        {/* Door */}
        <rect x="186" y="247" width="28" height="33" rx="2" fill="#e8e8e0" stroke="#ccc" strokeWidth="1"/>
        <circle cx="211" cy="265" r="2" fill="#9ca3af"/>
        {/* Window warm light */}
        <rect x="278" y="198" width="38" height="30" rx="3" fill="url(#winG)" stroke="rgba(251,191,36,0.5)" strokeWidth="1"/>
        <line x1="297" y1="198" x2="297" y2="228" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
        <line x1="278" y1="213" x2="316" y2="213" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
        <circle cx="297" cy="208" r="4" fill="rgba(253,230,138,0.9)"/>
        {/* Left window */}
        <rect x="109" y="200" width="34" height="25" rx="2" fill="#dce8f5" stroke="#ccc" strokeWidth="0.8"/>
        <line x1="126" y1="200" x2="126" y2="225" stroke="#ccc" strokeWidth="0.8"/>
        <line x1="109" y1="212" x2="143" y2="212" stroke="#ccc" strokeWidth="0.8"/>

        {/* === SOLAR PANELS on roof === */}
        <g transform="translate(148,112) rotate(-26)">
          {[0,26,52].map(ox => (
            [0,17].map(oy => (
              <g key={`${ox}-${oy}`}>
                <rect x={ox} y={oy} width={22} height={13} rx="1"
                  fill={hasSolar?'url(#panG)':'#b8c8d8'}
                  stroke={hasSolar?'#5a9fc8':'#aab8c8'} strokeWidth="0.8"/>
                <line x1={ox+7} y1={oy} x2={ox+7} y2={oy+13} stroke="rgba(255,255,255,0.3)" strokeWidth="0.4"/>
                <line x1={ox+14} y1={oy} x2={ox+14} y2={oy+13} stroke="rgba(255,255,255,0.3)" strokeWidth="0.4"/>
                <line x1={ox} y1={oy+5} x2={ox+22} y2={oy+5} stroke="rgba(255,255,255,0.3)" strokeWidth="0.4"/>
                <line x1={ox} y1={oy+9} x2={ox+22} y2={oy+9} stroke="rgba(255,255,255,0.3)" strokeWidth="0.4"/>
              </g>
            ))
          ))}
        </g>

        {/* === 2 INVERTERS === */}
        {[148, 198].map((x, idx) => (
          <g key={idx}>
            <rect x={x} y="193" width="44" height="55" rx="4" fill="url(#invG)" stroke="#d1d5db" strokeWidth="1"/>
            <rect x={x+3} y="196" width="38" height="45" rx="3" fill="rgba(255,255,255,0.5)"/>
            <text x={x+22} y="210" textAnchor="middle" fill="#374151" fontSize="5.5" fontFamily="sans-serif" fontWeight="600">GoodWe</text>
            <circle cx={x+22} cy="222" r="3.5" fill="none" stroke="#d1d5db" strokeWidth="0.8"/>
            <circle cx={x+22} cy="222" r="2" fill={hasSolar||hasBat?'#22c55e':'#9ca3af'}/>
            <rect x={x+5} y="236" width="5" height="4" rx="1" fill="#3b82f6"/>
            <rect x={x+12} y="236" width="5" height="4" rx="1" fill="#ef4444"/>
            <rect x={x+19} y="236" width="5" height="4" rx="1" fill="#eab308"/>
            <rect x={x+26} y="236" width="5" height="4" rx="1" fill="#22c55e"/>
            <text x={x+22} y="248" textAnchor="middle" fill="#9ca3af" fontSize="5" fontFamily="monospace">INV {idx+1}</text>
          </g>
        ))}

        {/* === BATTERY === */}
        <rect x="145" y="318" width="130" height="50" rx="6" fill="#f2f2f0" stroke="#d1d5db" strokeWidth="1"
          style={{filter:'drop-shadow(0 3px 8px rgba(0,0,0,0.1))'}}/>
        <rect x="150" y="322" width="120" height="38" rx="4" fill="rgba(255,255,255,0.5)"/>
        {/* Battery fill bar */}
        <rect x="154" y="326" width="106" height="12" rx="3" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="0.8"/>
        {soc > 0 && (
          <rect x="155" y="327" width={Math.max(2,soc*1.04)} height="10" rx="2"
            fill={soc>50?(batCharging?'#3b82f6':'#22c55e'):soc>20?'#eab308':'#ef4444'}/>
        )}
        <text x="210" y="350" textAnchor="middle" fill="#374151" fontSize="7" fontFamily="sans-serif" fontWeight="600">GOODWE LXD5.0-10</text>
        <circle cx="252" cy="333" r="3" fill={hasBat?(batCharging?'#3b82f6':'#22c55e'):'#9ca3af'}/>

        {/* === CABLES ANIMADOS === */}
        {/* Grid cable: pole → house */}
        {pgrid !== 0 && (
          <line x1="76" y1="168" x2="100" y2="250" stroke={importing?'#ef4444':'#22c55e'} strokeWidth="2" strokeDasharray="7 5">
            <animate attributeName="stroke-dashoffset" from={importing?"0":"24"} to={importing?"24":"0"} dur="1.2s" repeatCount="indefinite"/>
          </line>
        )}
        {pgrid === 0 && <line x1="76" y1="168" x2="100" y2="250" stroke="#e0e0e0" strokeWidth="1.5"/>}
        {/* Solar → inverters */}
        {hasSolar && (
          <line x1="195" y1="162" x2="195" y2="193" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 4">
            <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1s" repeatCount="indefinite"/>
          </line>
        )}
        {!hasSolar && <line x1="195" y1="162" x2="195" y2="193" stroke="#e0e0e0" strokeWidth="1.5"/>}
        {/* Inverters → battery */}
        {hasBat && (
          <line x1="192" y1="248" x2="192" y2="318" stroke={batCharging?'#3b82f6':'#eab308'} strokeWidth="2" strokeDasharray="6 4">
            <animate attributeName="stroke-dashoffset" from={batCharging?"0":"20"} to={batCharging?"20":"0"} dur="1.2s" repeatCount="indefinite"/>
          </line>
        )}
        {!hasBat && <line x1="192" y1="248" x2="192" y2="318" stroke="#e0e0e0" strokeWidth="1.5"/>}
        {/* Inverters → house load (right side) */}
        {pload > 0 && (
          <line x1="242" y1="220" x2="278" y2="220" stroke="#22c55e" strokeWidth="2" strokeDasharray="6 4">
            <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1.2s" repeatCount="indefinite"/>
          </line>
        )}

        {/* === FV BADGE (circle top) === */}
        <circle cx="210" cy="65" r="28" fill="white" stroke={hasSolar?'#22c55e':'#e5e7eb'} strokeWidth="2"
          style={{filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.1))'}}/>
        {hasSolar && <circle cx="210" cy="65" r="25" fill="none" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.3"/>}
        <text x="210" y="61" textAnchor="middle" fill={hasSolar?'#15803d':'#9ca3af'} fontSize="11" fontFamily="Space Mono" fontWeight="700">{fW(ppv)}</text>
        <text x="210" y="73" textAnchor="middle" fill={hasSolar?'#22c55e':'#9ca3af'} fontSize="7" fontFamily="Space Mono">FV {hasSolar?'›':''}</text>
        {hasSolar && (
          <line x1="210" y1="93" x2="210" y2="113" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 3">
            <animate attributeName="stroke-dashoffset" from="0" to="14" dur="0.8s" repeatCount="indefinite"/>
          </line>
        )}

        {/* === GRID BADGE === */}
        <g transform="translate(5,138)">
          <rect x="0" y="0" width="66" height="34" rx="7" fill="white"
            stroke={pgrid!==0?(importing?'#dc2626':'#16a34a'):'#e5e7eb'} strokeWidth="1.2"
            style={{filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.1))'}}/>
          <text x="33" y="14" textAnchor="middle" fill={importing?'#dc2626':exporting?'#15803d':'#9ca3af'} fontSize="10" fontFamily="Space Mono" fontWeight="700">{fW(pgrid)}</text>
          <text x="33" y="26" textAnchor="middle" fill="#9ca3af" fontSize="7" fontFamily="Space Mono">{importing?'Red ↓':exporting?'Red ↑':'Red'}</text>
        </g>

        {/* === BATTERY BADGE === */}
        <g transform="translate(145,375)">
          <rect x="0" y="0" width="130" height="34" rx="7" fill="white"
            stroke={hasBat?(batCharging?'#2563eb':'#9333ea'):'#e5e7eb'} strokeWidth="1.2"
            style={{filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.1))'}}/>
          <text x="65" y="14" textAnchor="middle"
            fill={batCharging?'#2563eb':batDischarging?'#9333ea':'#9ca3af'} fontSize="10" fontFamily="Space Mono" fontWeight="700">
            {soc>0?`${soc}%  ${fW(pbat)}`:fW(pbat)}
          </text>
          <text x="65" y="26" textAnchor="middle" fill="#9ca3af" fontSize="7" fontFamily="Space Mono">
            {batCharging?'Batería ↓ Cargando':batDischarging?'Batería ↑ Descargando':'Batería • Reposo'}
          </text>
        </g>

        {/* === LOAD BADGE === */}
        <g transform="translate(322,198)">
          <rect x="0" y="0" width="72" height="34" rx="7" fill="white"
            stroke={pload>0?'#4f46e5':'#e5e7eb'} strokeWidth="1.2"
            style={{filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.1))'}}/>
          <text x="36" y="14" textAnchor="middle" fill={pload>0?'#4f46e5':'#9ca3af'} fontSize="10" fontFamily="Space Mono" fontWeight="700">{fW(pload)}</text>
          <text x="36" y="26" textAnchor="middle" fill="#9ca3af" fontSize="7" fontFamily="Space Mono">Consumo</text>
        </g>
      </svg>
    </div>
  );
}

// ===== DONUT =====
function Donut({ pct, color, label, value }) {
  const r=34; const circ=2*Math.PI*r;
  const dash=Math.max(0,Math.min(pct,1))*circ;
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

function LineChart({ points, color }) {
  if (!points||points.length<2) return <div style={{height:90,display:'flex',alignItems:'center',justifyContent:'center',color:'#222',fontFamily:'Space Mono',fontSize:10}}>Sin datos</div>;
  const vals=points.map(p=>p.v);
  const max=Math.max(...vals,0.01);
  const W=100,H=90;
  const pts=points.map((p,i)=>{
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
  const tokenRef=useRef(null);
  useEffect(()=>{tokenRef.current=token;},[token]);

  const doLogin=async()=>{
    setLoading(true);setErr('');
    try{
      const r=await fetch('/api/sems',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:acct,pwd})});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error||'Login failed');
      setToken(j);setStep('dashboard');
    }catch(e){setErr(e.message);}finally{setLoading(false);}
  };

  // fetchLive recibe token como param para evitar closure stale
  const doFetchLive=async(tk)=>{
    if(!tk) return;
    try{
      setMonErr(null);
      const r=await fetch(`${SEMS}/PowerStation/GetMonitorDetailByPowerstationId`,{
        method:'POST',headers:{'Content-Type':'application/json','Token':JSON.stringify(tk)},
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
          imp:p.imp+(f.pgrid>0?f.pgrid*dtH/1000:0),
          exp:p.exp+(f.pgrid<0?Math.abs(f.pgrid)*dtH/1000:0),
          self:p.self+(Math.max(0,f.ppv-Math.max(0,-f.pgrid))*dtH/1000),
        }));
      }
      lastRef.current=now;
    }catch(e){setMonErr(e.message);}
  };

  // fetchHistory usa tokenRef
  const fetchHistory=useCallback(async(p,d)=>{
    const tk=tokenRef.current;
    if(!tk) return;
    setHistLoading(true);setChartPts([]);
    try{
      const today=new Date();
      const ds=d||today.toISOString().split('T')[0];
      let endpoint,body;
      if(p==='day'){endpoint='/PowerStation/GetPowerStationPowerChart';body={powerStationId:STATION_ID,date:ds};}
      else if(p==='week'){const mon=new Date(today);mon.setDate(today.getDate()-((today.getDay()+6)%7));endpoint='/PowerStation/GetPowerStationChart';body={powerStationId:STATION_ID,date:mon.toISOString().split('T')[0],chartType:2};}
      else if(p==='month'){endpoint='/PowerStation/GetPowerStationChart';body={powerStationId:STATION_ID,date:`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`,chartType:3};}
      else{endpoint='/PowerStation/GetPowerStationChart';body={powerStationId:STATION_ID,date:`${today.getFullYear()}-01-01`,chartType:4};}
      const r=await fetch(`${SEMS}${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','Token':JSON.stringify(tk)},body:JSON.stringify(body)});
      const raw=await r.text();
      let res;try{res=JSON.parse(raw);}catch(e){return;}
      if(parseInt(res.code)!==0) return;
      const data=res.data;
      const arr=data?.lines?.[0]?.xy||data?.power||data?.pac||data?.list||data?.datas||(Array.isArray(data)?data:null)||(data&&Object.values(data).find(v=>Array.isArray(v)&&v.length>0));
      if(Array.isArray(arr)&&arr.length>0){
        setChartPts(arr.map((pt,i)=>({t:pt.x||pt.time||i,v:Math.max(0,parseFloat(pt.y??pt.value??pt.power??pt.pac??pt.e??0))})).filter(p=>!isNaN(p.v)));
      }
    }catch(e){console.log('History err:',e);}finally{setHistLoading(false);}
  },[]);

  useEffect(()=>{
    if(step==='dashboard'){
      doFetchLive(token);
      intRef.current=setInterval(()=>doFetchLive(tokenRef.current),30000);
      fetchHistory('day','');
    }
    return()=>clearInterval(intRef.current);
  },[step,token]);

  useEffect(()=>{
    if(step!=='dashboard') return;
    const t=setTimeout(()=>fetchHistory(period,date),100);
    return()=>clearTimeout(t);
  },[period,date,step]);

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

          {kpi&&(
            <div className="kstrip">
              <div className="ks"><div className="ksv yellow">{kpi.power??0}<span className="ksu">kWh</span></div><div className="ksl">Hoy</div></div>
              <div className="ksdiv"/>
              <div className="ks"><div className="ksv green">{kpi.day_income??'0'}<span className="ksu">€</span></div><div className="ksl">Ingresos</div></div>
              <div className="ksdiv"/>
              <div className="ks"><div className="ksv red">{gi>0?gi.toFixed(3):'0.000'}<span className="ksu">€</span></div><div className="ksl">Gasto red</div></div>
              <div className="ksdiv"/>
              <div className="ks"><div className={`ksv ${neto>=0?'green':'red'}`}>{neto>=0?'+':''}{neto.toFixed(3)}<span className="ksu">€</span></div><div className="ksl">Balance</div></div>
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
                {live?<GoodWeScene {...live}/>:<div className="ldtxt">Cargando datos...</div>}
              </div>
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
                    <Donut pct={1} color="#fbbf24" label="Generado" value={(kpi.power??0).toFixed?.(1)||0}/>
                    <Donut pct={0.18} color="#818cf8" label="Autoconsumo" value={(parseFloat(kpi.power||0)*0.18).toFixed(1)}/>
                    <Donut pct={0.82} color="#34d399" label="Inyectado" value={(parseFloat(kpi.power||0)*0.82).toFixed(1)}/>
                  </div>
                </div>
              )}
              <div className="sec">
                <div className="sl">CURVA — {period==='day'?'HOY':period==='week'?'SEMANA':period==='month'?'MES':'AÑO'}</div>
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
                      const mx=Math.max(...chartPts.map(p=>p.v),0.01);
                      const pct=pt.v/mx;
                      return(
                        <div key={d} className="wbc">
                          <div className="wbv" style={{height:`${Math.max(4,pct*80)}px`,background:i===tod?'linear-gradient(to top,#f59e0b,#fbbf24)':'linear-gradient(to top,#1a1a28,#252535)',opacity:i===tod?1:0.6}}>
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
                  <div className="br"><span className="bl">Punta (08-24h)</span><span className="bv" style={{color:'#fb923c'}}>{TARIFA_PUNTA} €/kWh</span></div>
                  <div className="br"><span className="bl">Valle (00-08h)</span><span className="bv" style={{color:'#60a5fa'}}>{TARIFA_VALLE} €/kWh</span></div>
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
        .inp{width:100%;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 16px;color:#e8e8f4;font-size:15px;font-family:'Outfit',sans-serif;outline:none}
        .inp:focus{border-color:rgba(251,191,36,.4)}
        .btnl{width:100%;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#000;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer}
        .btnl:disabled{opacity:.5}
        .err{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:8px;padding:10px 14px;color:#f87171;font-size:12px;width:100%}
        .dash{padding-bottom:48px}
        .hdr{display:flex;justify-content:space-between;align-items:center;padding:16px 14px 10px;border-bottom:1px solid rgba(255,255,255,.04)}
        .eyebrow{font-family:'Space Mono',monospace;font-size:8px;letter-spacing:2.5px;color:#252535;margin-bottom:3px}
        .htitle{font-size:19px;font-weight:700;letter-spacing:-.5px}
        .clock{display:flex;align-items:center;gap:5px;font-family:'Space Mono',monospace;font-size:11px;color:#3a3a4a}
        .dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;animation:pd 2s infinite}
        @keyframes pd{0%,100%{opacity:1}50%{opacity:.3}}
        .kstrip{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.04);gap:4px}
        .ksdiv{width:1px;height:26px;background:rgba(255,255,255,.06)}
        .ks{display:flex;flex-direction:column;align-items:center;gap:2px}
        .ksv{font-family:'Space Mono',monospace;font-size:12px;font-weight:700;text-align:center}
        .ksu{font-size:8px;opacity:.6;margin-left:1px}
        .ksl{font-size:8px;color:#2a2a3a;text-align:center}
        .yellow{color:#fbbf24}
        .green{color:#34d399}
        .red{color:#f87171}
        .tabs{display:flex;gap:4px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.03)}
        .tb{flex:1;background:transparent;border:1px solid transparent;border-radius:10px;padding:9px 4px;font-size:12px;font-weight:500;font-family:'Outfit',sans-serif;color:#3a3a4a;cursor:pointer;transition:all .2s;white-space:nowrap}
        .tb.on{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08);color:#e8e8f4}
        .tc{padding-bottom:20px}
        .merr{margin:10px 12px;background:rgba(248,113,113,.07);border:1px solid rgba(248,113,113,.15);border-radius:10px;padding:10px 12px;color:#f87171;font-size:12px}
        .sec{padding:14px 12px 0}
        .sl{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#1e1e2e;margin-bottom:10px}
        .ldtxt{text-align:center;padding:30px;color:#2a2a3a;font-family:'Space Mono',monospace;font-size:11px}
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
