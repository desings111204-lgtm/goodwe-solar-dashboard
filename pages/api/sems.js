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
      catch(e) { return res.status(500).json({ error: 'Not JSON: ' + raw.substring(0, 200) }); }
      console.log('LOGIN FULL:', JSON.stringify(data));
      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });
      // Devolver data.data completo para diagnóstico
      return res.status(200).json(data.data);
    }

    if (action === 'monitor') {
      const { token, powerStationId } = req.body;
      // Usar api_domain si existe, si no el base
      const apiDomain = token.api_domain || '';
      const baseUrl = apiDomain.includes('/api') ? apiDomain.replace(/\/api.*$/, '') : apiDomain;
      const monitorUrl = (baseUrl || 'https://www.semsportal.com') + '/api/v2/PowerStation/GetMonitorDetailByPowerstationId';
      // Token autenticado = el objeto data.data del login tal cual
      const authToken = JSON.stringify(token);
      console.log('MONITOR url:', monitorUrl);
      console.log('MONITOR token keys:', Object.keys(token));
      console.log('MONITOR token:', authToken.substring(0, 400));
      const response = await fetch(monitorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': authToken },
        body: JSON.stringify({ powerStationId }),
      });
      const raw = await response.text();
      console.log('MONITOR RAW:', raw.substring(0, 600));
      let data;
      try { data = JSON.parse(raw); }
      catch(e) { return res.status(500).json({ error: 'Monitor not JSON: ' + raw.substring(0, 200) }); }
      if (data.code !== 0) return res.status(400).json({ error: data.msg, code: data.code, monitorUrl, tokenKeys: Object.keys(token) });
      return res.status(200).json(data.data || data);
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
