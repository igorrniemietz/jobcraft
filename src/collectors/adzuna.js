'use strict';
const { getJSON, sleep } = require('../http');
const { fromAdzuna }     = require('../normalize');

const QUERIES = ['desenvolvedor', 'security engineer', 'devops', 'data engineer'];

async function fetchAdzuna() {
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (process.env.ADZUNA_ENABLED === 'false' || !appId || !appKey) {
    if (appId || appKey) console.warn('[adzuna] ADZUNA_APP_ID ou ADZUNA_APP_KEY ausente — desativando');
    else console.log('[adzuna] sem credenciais (ADZUNA_APP_ID / ADZUNA_APP_KEY) — desativado');
    return [];
  }

  const results = [];
  for (const q of QUERIES) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/br/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=50&what=${encodeURIComponent(q)}&sort_by=date&max_days_old=30`;
      const { status, body } = await getJSON(url);
      if (status !== 200) { console.warn(`[adzuna] HTTP ${status} para "${q}"`); continue; }
      const list = body.results || [];
      results.push(...list.map(fromAdzuna));
      console.log(`[adzuna] "${q}" → ${list.length} vagas`);
      await sleep(400);
    } catch (e) {
      console.error(`[adzuna] erro em "${q}":`, e.message);
    }
  }
  return results;
}

module.exports = { fetchAdzuna };
