// Proxy para la API de SEMS Portal
// Basado en integraciones conocidas que funcionan: Home Assistant GoodWe, sems-portal-api

const SEMS_BASE = 'https://www.semsportal.com/api/v2';

// Token base para login - version vacía es lo que acepta SEMS
const BASE_TOKEN = {
  version: '',
  client: 'ios',
  language: 'en',
};

function buildAuthToken(loginToken) {
  return JSON.stringify({
    version:   '',
    client:    'ios',
    language:  'en',
    uid:       loginToken.uid       || loginToken.user?.uid       || '',
    timestamp: loginToken.timestamp || 0,
    token:     loginToken.token     || '',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;

  try {
    // LOGIN
    if (action === 'login') {
      const { account, pwd } = req.body;
      const response = await fetch(`${SEMS_BASE}/Common/CrossLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: JSON.stringify(BASE_TOKEN) },
        body: JSON.stringify({ account, pwd, is_local: false }),
      });
      const data = await response.json();
      console.log('LOGIN:', JSON.stringify(data).substring(0, 400));
      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });
      return res.status(200).json(data.data);
    }

    // PLANTAS
    if (action === 'plants') {
      const { token } = req.body;
      const authToken = buildAuthToken(token);
      console.log('AUTH TOKEN plants:', authToken.substring(0, 300));
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetPowerStationByUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: authToken },
        body: JSON.stringify({ page_size: 20, page_index: 1 }),
      });
      const data = await response.json();
      console.log('PLANTS:', JSON.stringify(data).substring(0, 800));
      if (data.code !== 0) return res.status(400).json({ error: data.msg, raw: data });
      return res.status(200).json(data.data || data);
    }

    // MONITOR
    if (action === 'monitor') {
      const { token, powerStationId } = req.body;
      const authToken = buildAuthToken(token);
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: authToken },
        body: JSON.stringify({ powerStationId }),
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
