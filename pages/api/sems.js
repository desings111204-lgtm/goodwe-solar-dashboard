// Proxy para SEMS Portal API
// API: www.semsportal.com (no semsplus que devuelve HTML)

const SEMS_BASE = 'https://www.semsportal.com/api/v2';

const BASE_TOKEN = {
  version: 'v2.1.0',
  client: 'ios',
  language: 'en',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;

  try {
    // LOGIN - devuelve el objeto data completo para que el frontend lo almacene
    if (action === 'login') {
      const { account, pwd } = req.body;
      const response = await fetch(`${SEMS_BASE}/Common/CrossLogin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': JSON.stringify(BASE_TOKEN),
        },
        body: JSON.stringify({ account, pwd, is_local: false }),
      });
      const raw = await response.text();
      console.log('LOGIN RAW:', raw.substring(0, 500));
      let data;
      try { data = JSON.parse(raw); } catch(e) { return res.status(500).json({ error: 'Login response not JSON: ' + raw.substring(0, 200) }); }
      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });
      // Devolvemos data.data completo + logueamos su estructura
      console.log('LOGIN DATA keys:', Object.keys(data.data || {}));
      return res.status(200).json(data.data);
    }

    // MONITOR - construimos el token autenticado a partir del objeto guardado en el cliente
    if (action === 'monitor') {
      const { token, powerStationId } = req.body;

      // El token autenticado fusiona los campos base con los del login
      // uid puede estar en token.uid o token.user.uid
      const uid = token.uid || token.user?.uid || token.userId || '';
      const timestamp = token.timestamp || token.expires || 0;
      const tok = token.token || token.access_token || '';
      const api_domain = token.api_domain || SEMS_BASE.replace('/api/v2', '');

      const authToken = JSON.stringify({
        ...BASE_TOKEN,
        uid,
        timestamp,
        token: tok,
      });

      console.log('MONITOR authToken:', authToken.substring(0, 300));
      console.log('MONITOR stationId:', powerStationId);

      // Usar api_domain si viene en el login (algunas cuentas tienen dominio propio)
      const baseUrl = token.api_domain
        ? `${token.api_domain}/api/v2`
        : SEMS_BASE;

      const response = await fetch(`${baseUrl}/PowerStation/GetMonitorDetailByPowerstationId`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': authToken,
        },
        body: JSON.stringify({ powerStationId }),
      });

      const raw = await response.text();
      console.log('MONITOR RAW:', raw.substring(0, 600));
      let data;
      try { data = JSON.parse(raw); } catch(e) { return res.status(500).json({ error: 'Monitor response not JSON: ' + raw.substring(0, 200) }); }
      if (data.code !== 0) return res.status(400).json({ error: data.msg, raw: data });
      return res.status(200).json(data.data || data);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('SEMS proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
