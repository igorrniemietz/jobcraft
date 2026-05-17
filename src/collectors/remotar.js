'use strict';
const { getJSON, sleep, jitter } = require('../http');
const { fromRemotar } = require('../normalize');

// Tech categories only
const TECH_CATEGORIES = [4, 7, 8, 9, 13, 14];
const PER_PAGE = 50;

async function fetchCategory(categoryId) {
  const results = [];
  let page = 1;

  while (true) {
    const url = `https://api.remotar.com.br/jobs?categoryId=${categoryId}&page=${page}&limit=${PER_PAGE}`;
    const { status, body } = await getJSON(url);

    if (status !== 200 || !body?.data) {
      console.warn(`[remotar] HTTP ${status} categoria=${categoryId} página=${page}`);
      break;
    }

    const fresh = (body.data || []).filter(j => !j.expired);
    results.push(...fresh.map(j => fromRemotar(j)));

    if (page >= body.meta.last_page) break;
    page++;
    await sleep(jitter(300));
  }

  return results;
}

async function fetchRemotar() {
  if (process.env.REMOTAR_ENABLED === 'false') {
    console.log('[remotar] desativado por REMOTAR_ENABLED=false');
    return [];
  }

  const seen = new Set();
  const results = [];

  for (const catId of TECH_CATEGORIES) {
    try {
      const jobs = await fetchCategory(catId);
      for (const j of jobs) {
        if (!seen.has(j.id)) { seen.add(j.id); results.push(j); }
      }
      console.log(`[remotar] categoria=${catId} → ${jobs.length} vagas`);
      await sleep(jitter(500));
    } catch (e) {
      console.error(`[remotar] erro categoria=${catId}:`, e.message);
    }
  }

  console.log(`[remotar] total único: ${results.length}`);
  return results;
}

module.exports = { fetchRemotar };
