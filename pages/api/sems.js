// Solo login via servidor (proxy para CORS del login)
const SEMS_BASE = 'https://www.semsportal.com/api/v2';
const BASE_TOKEN = { version: 'v2.1.0', client: 'ios', language: 'en' };

export default async function handler(req, res) {
  // Permitir CORS para que el browser pueda llamar directamente
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
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
    console.log('LOGIN:', JSON.stringify(data).substring(0, 500));
    if (data.code !== 0) return res.status(401).json({ error: data.msg || 'Login failed' });
    return res.status(200).json(data.data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
