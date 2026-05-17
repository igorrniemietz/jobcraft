'use strict';
const { getJSON, sleep } = require('../http');
const { fromLever } = require('../normalize');

// Empresas BR tech confirmadas no Lever (validadas ao vivo 2026-05-17)
const COMPANIES = [
  { slug: 'cloudwalk', name: 'CloudWalk' },
  { slug: 'neon',      name: 'Neon'      },
  { slug: 'ciandt',    name: 'CI&T'      },
];

const BR_LOC = /brazil|brasil|são paulo|rio de janeiro|belo horizonte|brasília|florianópolis|remote|remoto/i;

async function fetchLever() {
  if (process.env.LEVER_ENABLED === 'false') {
    console.log('[lever] desativado por LEVER_ENABLED=false');
    return [];
  }

  const results = [];
  for (const co of COMPANIES) {
    try {
      const url = `https://api.lever.co/v0/postings/${co.slug}?mode=json`;
      const { status, body } = await getJSON(url);
      if (status !== 200 || !Array.isArray(body)) {
        console.warn(`[lever] HTTP ${status} para ${co.slug}`);
        continue;
      }

      const jobs = body.filter(j => BR_LOC.test(j.categories?.location || ''));
      results.push(...jobs.map(j => fromLever(j, co.name)));
      console.log(`[lever] ${co.slug} → ${jobs.length} vagas BR`);
      await sleep(400);
    } catch (e) {
      console.error(`[lever] erro em ${co.slug}:`, e.message);
    }
  }
  return results;
}

module.exports = { fetchLever };
