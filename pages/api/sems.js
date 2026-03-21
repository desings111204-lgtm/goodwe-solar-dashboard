// Proxy SEMS Portal API - intenta múltiples endpoints y formatos
const ENDPOINTS = [
  'https://www.semsportal.com',
  'https://globalapi.sems.com.cn',
  'https://semsportal.com',
];

const BASE_TOKEN = { version: 'v2.1.0', client: 'ios', language: 'en' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.query;

  try {
    // LOGIN
    if (action === 'login') {
      const { account, pwd } = req.body;
      const response = await fetch(`${ENDPOINTS[0]}/api/v2/Common/CrossLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': JSON.stringify(BASE_TOKEN) },
        body: JSON.stringify({ account, pwd, is_local: false }),
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); }
      catch(e) { return res.status(500).json({ error: 'Login not JSON: ' + raw.substring(0, 200) }); }
      console.log('LOGIN:', JSON.stringify(data).substring(0, 500));
      if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });
      return res.status(200).json(data.data);
    }

    // MONITOR - prueba múltiples endpoints y formatos de body
    if (action === 'monitor') {
      const { token, powerStationId } = req.body;

      // Token con timestamp fresco
      const authToken = JSON.stringify({
        ...token,
        timestamp: Math.floor(Date.now() / 1000),
      });

      // Formatos de body que usa SEMS según distintas integraciones
      const bodyVariants = [
        JSON.stringify({ powerStationId }),
        JSON.stringify({ powerstation_id: powerStationId }),
        JSON.stringify({ stationId: powerStationId }),
        JSON.stringify({ id: powerStationId }),
      ];

      const logs = [];

      for (const base of ENDPOINTS) {
        for (const bodyStr of bodyVariants) {
          try {
            const url = `${base}/api/v2/PowerStation/GetMonitorDetailByPowerstationId`;
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Token': authToken },
              body: bodyStr,
            });
            const raw = await resp.text();
            let parsed;
            try { parsed = JSON.parse(raw); } catch(e) { continue; }
            console.log(`[${base}][${bodyStr.substring(0,40)}] code=${parsed.code}`);
            logs.push({ base, body: bodyStr.substring(0,40), code: parsed.code, msg: parsed.msg });
            if (parsed.code === 0) {
              console.log('SUCCESS! base=', base, 'body=', bodyStr.substring(0,40));
              return res.status(200).json(parsed.data || parsed);
            }
          } catch(e) {
            logs.push({ base, body: bodyStr.substring(0,40), error: e.message });
          }
        }
      }

      // Si ninguno funciona, devuelve todos los logs para diagnóstico
      return res.status(400).json({ 
        error: 'All endpoints failed',
        attempts: logs,
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
