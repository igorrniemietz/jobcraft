'use strict';
const { getJSON, sleep } = require('../http');
const { fromGupy }       = require('../normalize');

const QUERIES = [
  'analista segurança', 'security engineer', 'pentest', 'devsecops', 'soc analyst',
  'desenvolvedor', 'engenheiro software', 'devops', 'data engineer',
  'frontend', 'backend', 'fullstack',
];

async function fetchGupy() {
  if (process.env.GUPY_ENABLED === 'false') {
    console.log('[gupy] desativado por GUPY_ENABLED=false');
    return [];
  }

  const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
  const results = [];
  for (const q of QUERIES) {
    try {
      const url = `https://portal.api.gupy.io/api/v1/jobs?jobName=${encodeURIComponent(q)}&limit=50`;
      const { status, body } = await getJSON(url);
      if (status !== 200) { console.warn(`[gupy] HTTP ${status} para "${q}"`); continue; }
      const now  = Date.now();
      const list = (body.data || []).filter(j => {
        const deadline = j.applicationDeadline ? new Date(j.applicationDeadline).getTime() : null;
        if (deadline && deadline <= now) return false;           // prazo expirado
        if (deadline && deadline > now)  return true;            // prazo futuro → sempre manter
        if (j.publishedDate) {
          return (now - new Date(j.publishedDate).getTime()) <= MAX_AGE_MS; // sem prazo: até 90 dias
        }
        return true;
      });
      results.push(...list.map(fromGupy));
      console.log(`[gupy] "${q}" → ${list.length} vagas`);
      await sleep(400);
    } catch (e) {
      console.error(`[gupy] erro em "${q}":`, e.message);
    }
  }
  return results;
}

module.exports = { fetchGupy };
