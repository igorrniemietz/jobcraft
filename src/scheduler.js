'use strict';
// Gupy e fontes internacionais (remotive, adzuna) desativados neste branch.
// Fontes ativas: scrapers BR
const { fetchTrampos }    = require('./collectors/trampos');
const { fetchVagas }      = require('./collectors/vagas');
const { fetchGreenhouse } = require('./collectors/greenhouse');
const { fetchLever }      = require('./collectors/lever');
const { fetchRemotar }    = require('./collectors/remotar');
const store               = require('./jobStore');

const courseStore              = require('./courseStore');
const { collect: ytCollect }   = require('./collectors/youtube');
const { collect: coCollect }   = require('./collectors/coursera');
const { collect: fccCollect }  = require('./collectors/freecodecamp');

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

async function syncCourseSource(name, collectFn) {
  const t0 = Date.now();
  try {
    const courses = await collectFn();
    let added = 0;
    for (const c of courses) {
      if (courseStore.upsert(c) === 'new') added++;
    }
    const ms = Date.now() - t0;
    courseStore.setSyncLog(name, { added, total: courses.length, ms, ok: true });
    console.log(`[courses:${name}] ${added} novos / ${courseStore.count(name)} total (${ms}ms)`);
  } catch (e) {
    courseStore.setSyncLog(name, { ok: false, error: e.message });
    console.error(`[courses:${name}] falhou:`, e.message);
  }
}

async function syncCourses() {
  await Promise.allSettled([
    syncCourseSource('youtube',      ytCollect),
    syncCourseSource('coursera',     coCollect),
    syncCourseSource('freecodecamp', fccCollect),
  ]);
  console.log(`[courses] total: ${courseStore.count()} cursos únicos`);
}

async function syncAll() {
  console.log('[sync] iniciando sincronização de todas as fontes…');
  await Promise.allSettled([
    syncSource('trampos',    fetchTrampos),
    syncSource('vagas',      fetchVagas),
    syncSource('greenhouse', fetchGreenhouse),
    syncSource('lever',      fetchLever),
    syncSource('remotar',    fetchRemotar),
    // syncSource('catho',   fetchCatho),   // bloqueado por Akamai TLS — Fase 4
  ]);
  const purged = store.purge();
  if (purged > 0) console.log(`[sync] purge — ${purged} vagas expiradas removidas`);
  console.log(`[sync] concluído — ${store.count()} vagas únicas no store`);
  syncCourses().catch(e => console.error('[courses] sync falhou:', e.message));
}

function start() {
  syncAll();
  setInterval(syncAll, INTERVAL_MS);
  console.log(`[sync] scheduler ativo — intervalo ${INTERVAL_MS / 60000} min`);
}

module.exports = { start, syncAll };
