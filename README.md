# ☀️ GoodWe Solar Dashboard

Dashboard web en tiempo real para instalaciones GoodWe con balance económico completo.

## Lo que muestra (y SEMS+ no te da)

- ⚡ Flujos en tiempo real: Solar, Carga, Red, Batería
- 💰 **Balance económico neto** = ingresos exportación + ahorro autoconsumo − **gasto importación**
- 📊 kWh acumulados por sesión: exportado, autoconsumo, importado
- 🔄 Actualización automática cada 30s

## Despliegue en Vercel (5 min)

```bash
npm install
npm i -g vercel
vercel
```

Conecta tu cuenta GitHub en Vercel → selecciona este repo → deploy automático.

## Tarifas configuradas

Edita `pages/index.js` líneas 4-6:

```js
const TARIFA_EXPORTACION = 0.06;        // €/kWh fija
const TARIFA_IMPORTACION_PUNTA = 0.1102; // 08:00-24:00
const TARIFA_IMPORTACION_VALLE = 0.033;  // 00:00-08:00
```

## Uso

1. Abre la URL de Vercel en el móvil
2. Introduce tu email y contraseña de SEMS Portal
3. El dashboard se actualiza solo cada 30s
