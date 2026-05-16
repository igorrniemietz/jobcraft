'use strict';

// Trampos.co — BLOQUEADO
// - API (/api/opportunities) exige api_key + api_secret — não pública
// - Site é Ember.js SPA; noscript tem apenas ~10 destaques sem IDs ou links
// - Solução futura: Puppeteer (Fase 4) ou obter credenciais de API
async function fetchTrampos() {
  if (process.env.TRAMPOS_ENABLED === 'false') return [];
  console.log('[trampos] desativado — API requer autenticação (ver SCRAPER_PLAN.md Fase 4)');
  return [];
}

module.exports = { fetchTrampos };
