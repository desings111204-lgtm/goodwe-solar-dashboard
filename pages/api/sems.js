// Proxy para la API de SEMS Portal - evita CORS desde el navegador

const SEMS_BASE = 'https://www.semsportal.com/api/v2';

const defaultToken = JSON.stringify({
  version: 'v2.1.0',
  client: 'ios',
  language: 'es',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;

  try {
    if (action === 'login') {
      const { account, pwd } = req.body;
      const response = await fetch(`${SEMS_BASE}/Common/CrossLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: defaultToken },
        body: JSON.stringify({ account, pwd, is_local: false }),
      });
      const data = await response.json();
      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });
      return res.status(200).json(data.data);
    }

    if (action === 'plants') {
      const { token } = req.body;
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetPowerStationByUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: JSON.stringify(token) },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      return res.status(200).json(data.data);
    }

    if (action === 'monitor') {
      const { token, powerStationId } = req.body;
      const response = await fetch(`${SEMS_BASE}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Token: JSON.stringify(token) },
        body: JSON.stringify({ powerStationId }),
      });
      const data = await response.json();
      return res.status(200).json(data.data);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
