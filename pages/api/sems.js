// Proxy para la API de SEMS Portal - evita CORS desde el navegador

const SEMS_BASE = 'https://www.semsportal.com/api/v2';

// Token base para login (sin autenticar)
const BASE_TOKEN = {
  version: 'v2.1.0',
  client: 'ios',
  language: 'es',
};

// Construye el Token autenticado fusionando el token de login con los campos base
function buildAuthToken(loginToken) {
  return JSON.stringify({
    ...BASE_TOKEN,
    ...loginToken,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;

  try {
    if (action === 'login') {
      const { account, pwd } = req.body;
      const response = await fetch(`${SEMS_BASE}/Common/CrossLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: JSON.stringify(BASE_TOKEN) },
        body: JSON.stringify({ account, pwd, is_local: false }),
      });
      const data = await response.json();
      console.log('LOGIN RESPONSE:', JSON.stringify(data).substring(0, 500));
      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });
      return res.status(200).json(data.data);
    }

    if (action === 'plants') {
      const { token } = req.body;
      const authToken = buildAuthToken(token);
      console.log('AUTH TOKEN for plants:', authToken.substring(0, 200));
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetPowerStationByUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: authToken },
        body: JSON.stringify({ page_size: 20, page_index: 1 }),
      });
      const data = await response.json();
      console.log('PLANTS RESPONSE:', JSON.stringify(data).substring(0, 1000));
      return res.status(200).json(data.data || data);
    }

    if (action === 'monitor') {
      const { token, powerStationId } = req.body;
      const authToken = buildAuthToken(token);
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: authToken },
        body: JSON.stringify({ powerStationId }),
      });
      const data = await response.json();
      console.log('MONITOR RESPONSE keys:', Object.keys(data?.data || data || {}));
      return res.status(200).json(data.data || data);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('SEMS proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
