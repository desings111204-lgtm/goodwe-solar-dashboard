// Proxy para SEMS+ API (semsplus.goodwe.com)

const SEMS_BASE = 'https://semsplus.goodwe.com/api/v2';

const BASE_TOKEN = {
  version: '',
  client: 'ios',
  language: 'en',
};

function buildAuthToken(loginToken) {
  return JSON.stringify({
    ...BASE_TOKEN,
    uid:       loginToken.uid       || loginToken.user?.uid || '',
    timestamp: loginToken.timestamp || 0,
    token:     loginToken.token     || '',
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
      console.log('LOGIN:', JSON.stringify(data).substring(0, 500));
      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed', raw: data });
      // Devolvemos el token + el stationId conocido directamente
      return res.status(200).json({
        ...data.data,
        knownStationId: '8445d981-4fbe-414b-9d12-60bac0b7eeb1',
      });
    }

    if (action === 'monitor') {
      const { token, powerStationId } = req.body;
      const authToken = buildAuthToken(token);
      console.log('MONITOR token:', authToken.substring(0, 200));
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: authToken },
        body: JSON.stringify({ powerStationId }),
      });
      const data = await response.json();
      console.log('MONITOR:', JSON.stringify(data).substring(0, 800));
      if (data.code !== 0) return res.status(400).json({ error: data.msg, raw: data });
      return res.status(200).json(data.data || data);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('SEMS proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
