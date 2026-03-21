// Proxy SEMS Portal API
const SEMS_BASE = 'https://www.semsportal.com/api/v2';
const BASE_TOKEN = { version: 'v2.1.0', client: 'ios', language: 'en' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.query;

  try {
    if (action === 'login') {
      const { account, pwd } = req.body;
      const response = await fetch(`${SEMS_BASE}/Common/CrossLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': JSON.stringify(BASE_TOKEN) },
        body: JSON.stringify({ account, pwd, is_local: false }),
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); }
      catch(e) { return res.status(500).json({ error: 'Login not JSON: ' + raw.substring(0, 200) }); }
      console.log('LOGIN RESPONSE:', JSON.stringify(data).substring(0, 600));
      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });
      return res.status(200).json(data.data);
    }

    if (action === 'monitor') {
      const { token, powerStationId } = req.body;

      // SEMS requiere timestamp actualizado en cada petición
      const nowTimestamp = Math.floor(Date.now() / 1000);

      const authToken = JSON.stringify({
        version: 'v2.1.0',
        client:  'ios',
        language: 'en',
        uid:       token.uid       || '',
        timestamp: nowTimestamp,
        token:     token.token     || '',
      });

      const baseUrl = token.api_domain ? `${token.api_domain}/api/v2` : SEMS_BASE;
      console.log('MONITOR authToken:', authToken.substring(0, 300));
      console.log('MONITOR url:', `${baseUrl}/PowerStation/GetMonitorDetailByPowerstationId`);
      console.log('MONITOR stationId:', powerStationId);

      const response = await fetch(`${baseUrl}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': authToken },
        body: JSON.stringify({ powerStationId }),
      });
      const raw = await response.text();
      console.log('MONITOR RAW:', raw.substring(0, 600));
      let data;
      try { data = JSON.parse(raw); }
      catch(e) { return res.status(500).json({ error: 'Monitor not JSON: ' + raw.substring(0, 200) }); }
      if (data.code !== 0) return res.status(400).json({ error: data.msg, code: data.code, raw: data });
      return res.status(200).json(data.data || data);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
