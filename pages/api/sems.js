// Proxy para la API de SEMS Portal - evita CORS desde el navegador
// Base URL y versión según proyectos comunidad GoodWe

const SEMS_LOGIN_URL = 'https://www.semsportal.com/api/v1/Common/CrossLogin';
const SEMS_BASE     = 'https://www.semsportal.com/api/v2';

// Token base para llamadas sin autenticar
const BASE_TOKEN = {
  version: 'v2.0.4',
  client:  'ios',
  language: 'en',
};

// Fusiona el token de login con los campos de versión requeridos
function buildAuthToken(loginToken) {
  return JSON.stringify({
    ...BASE_TOKEN,
    uid:       loginToken.uid       || loginToken.user?.uid || '',
    timestamp: loginToken.timestamp || '',
    token:     loginToken.token     || '',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;

  try {
    // ── LOGIN ──────────────────────────────────────────────────────────
    if (action === 'login') {
      const { account, pwd } = req.body;
      const response = await fetch(SEMS_LOGIN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Token: JSON.stringify(BASE_TOKEN) },
        body:    JSON.stringify({ account, pwd, is_local: false }),
      });
      const data = await response.json();
      console.log('LOGIN:', JSON.stringify(data).substring(0, 400));
      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });
      return res.status(200).json(data.data);
    }

    // ── PLANTAS ────────────────────────────────────────────────────────
    if (action === 'plants') {
      const { token } = req.body;
      const authToken = buildAuthToken(token);
      console.log('AUTH TOKEN:', authToken.substring(0, 200));
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetPowerStationByUser`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Token: authToken },
        body:    JSON.stringify({ page_size: 20, page_index: 1 }),
      });
      const data = await response.json();
      console.log('PLANTS:', JSON.stringify(data).substring(0, 800));
      if (data.code !== 0) return res.status(400).json({ error: data.msg, raw: data });
      return res.status(200).json(data.data || data);
    }

    // ── MONITOR ────────────────────────────────────────────────────────
    if (action === 'monitor') {
      const { token, powerStationId } = req.body;
      const authToken = buildAuthToken(token);
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Token: authToken },
        body:    JSON.stringify({ powerStationId }),
      });
      const data = await response.json();
      console.log('MONITOR keys:', Object.keys(data?.data || data || {}));
      if (data.code !== 0) return res.status(400).json({ error: data.msg, raw: data });
      return res.status(200).json(data.data || data);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('SEMS proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
