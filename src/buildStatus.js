'use strict';
// Fontes realmente sincronizadas pelo scheduler (ver src/scheduler.js → syncAll).
// gupy/remotive/adzuna ficaram desativadas neste branch e não são chamadas.
const ACTIVE_SOURCES = ['trampos', 'vagas', 'greenhouse', 'lever', 'remotar'];

function buildJobsStatus(store) {
  const sources = {};
  for (const name of ACTIVE_SOURCES) {
    sources[name] = { enabled: true, count: store.count(name) };
  }
  return { ok: true, total: store.count(), sources, syncLog: store.getSyncLog() };
}

module.exports = { buildJobsStatus, ACTIVE_SOURCES };
