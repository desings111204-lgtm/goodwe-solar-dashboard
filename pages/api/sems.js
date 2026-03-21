// Proxy SEMS Portal API
const SEMS_BASE = 'https://www.semsportal.com/api/v2';

const BASE_TOKEN = { version: 'v2.1.0', client: 'ios', language: 'en' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.query;

  try {
    // LOGIN
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
      catch(e) { return res.status(500).json({ error: 'Login not JSON: ' + raw.substring(0, 300) }); }

      // Log estructura completa para diagnosticar
      console.log('LOGIN FULL RESPONSE:', JSON.stringify(data));

      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });

      // Devolvemos data.data completo — el cliente lo guardará y lo enviará de vuelta tal cual
      return res.status(200).json(data.data);
    }

    // MONITOR — recibe el objeto token tal como lo guardó el cliente tras el login
    if (action === 'monitor') {
      const { token, powerStationId } = req.body;

      // Estrategia: intentar con el token tal cual del login (sin reconstruir nada)
      // El objeto login suele tener la forma: { uid, timestamp, token, api_domain, ... }
      // Lo pasamos tal cual como header Token
      const authToken = JSON.stringify(token);
      console.log('MONITOR authToken (raw):', authToken.substring(0, 400));

      const baseUrl = token.api_domain ? `${token.api_domain}/api/v2` : SEMS_BASE;
      console.log('MONITOR baseUrl:', baseUrl);
      console.log('MONITOR powerStationId:', powerStationId);

      const response = await fetch(`${baseUrl}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': authToken },
        body: JSON.stringify({ powerStationId }),
      });
      const raw = await response.text();
      console.log('MONITOR RAW (500chars):', raw.substring(0, 500));

      let data;
      try { data = JSON.parse(raw); }
      catch(e) { return res.status(500).json({ error: 'Monitor not JSON: ' + raw.substring(0, 300) }); }

      if (data.code !== 0) return res.status(400).json({ error: data.msg, code: data.code, raw: data });
      return res.status(200).json(data.data || data);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
