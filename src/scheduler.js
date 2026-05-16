'use strict';
// Gupy e fontes internacionais (remotive, adzuna) desativados neste branch.
// Fontes ativas: scrapers BR (vagas.com, indeed, catho, trampos)
const store = require('./jobStore');

const INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || String(6 * 60 * 60 * 1000)); // 6h

async function syncSource(name, fetchFn) {
  const t0 = Date.now();
  try {
    const jobs = await fetchFn();
    let added = 0;
    for (const job of jobs) {
      if (store.upsert(job) === 'new') added++;
    }
    const ms = Date.now() - t0;
    store.setSyncLog(name, { added, total: jobs.length, ms, ok: true });
    console.log(`[sync] ${name} → ${added} novas / ${jobs.length} total (${ms}ms)`);
  } catch (e) {
    store.setSyncLog(name, { ok: false, error: e.message });
    console.error(`[sync] ${name} falhou:`, e.message);
  }
}

async function syncAll() {
  console.log('[sync] iniciando sincronização de todas as fontes…');
  // Scrapers BR — serão importados aqui após implementação
  // await Promise.allSettled([
  //   syncSource('vagas',   fetchVagas),
  //   syncSource('indeed',  fetchIndeed),
  //   syncSource('catho',   fetchCatho),
  //   syncSource('trampos', fetchTrampos),
  // ]);
  console.log(`[sync] concluído — ${store.count()} vagas únicas no store`);
}

function start() {
  syncAll();
  setInterval(syncAll, INTERVAL_MS);
  console.log(`[sync] scheduler ativo — intervalo ${INTERVAL_MS / 60000} min`);
}

module.exports = { start, syncAll };
