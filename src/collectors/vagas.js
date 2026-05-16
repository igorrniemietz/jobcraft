'use strict';
const { get, sleep, jitter } = require('../http');
const { fromVagas }          = require('../normalize');

const BASE = 'https://www.vagas.com.br';

// Slugs de categoria tech confirmados no site
const CATEGORIES = [
  'desenvolvedor',
  'tecnologia-da-informacao',
  'seguranca-da-informacao',
  'devops',
  'engenheiro-de-software',
];

const MAX_PAGES = 5;

// Extrai todos os blocos <li class="vaga ..."> do HTML
const VAGA_BLOCK_RE = /<li class="vaga[^"]*"[\s\S]*?<\/li>\s*(?=<li class="vaga|<!-- Fim)/g;

// Seletores dentro de cada bloco
const ID_RE       = /data-id-vaga="(\d+)"/;
const TITLE_RE    = /class="link-detalhes-vaga"[^>]+title="([^"]+)"/;
const HREF_RE     = /class="link-detalhes-vaga"[^>]+href="([^"]+)"/;
const COMPANY_RE  = /class="emprVaga">\s*([\s\S]*?)\s*<\/span>/;
const LEVEL_RE    = /class="nivelVaga">\s*([^<]+?)\s*<\/span>/;
const DESC_RE     = /class="detalhes">\s*<p>([\s\S]*?)<\/p>/;
const LOCATION_RE = /class="vaga-local"[^>]*>(?:<[^>]+>)*\s*([^<\n]+)/;
const DATE_RE     = /class="data-publicacao"[^>]*>(?:<[^>]+>)*\s*(\d{2}\/\d{2}\/\d{4})/;

function parseBlock(block) {
  const id      = (block.match(ID_RE)      || [])[1];
  if (!id) return null;

  const title   = (block.match(TITLE_RE)   || [])[1]?.trim() || '';
  const href    = (block.match(HREF_RE)    || [])[1] || '';
  const company = (block.match(COMPANY_RE) || [])[1]?.replace(/<[^>]+>/g, '').trim() || 'Empresa';
  const level   = (block.match(LEVEL_RE)   || [])[1]?.trim() || null;
  const desc    = (block.match(DESC_RE)    || [])[1]?.replace(/<[^>]+>/g, '').trim() || '';
  const loc     = (block.match(LOCATION_RE)|| [])[1]?.trim() || '';
  const date    = (block.match(DATE_RE)    || [])[1] || null;

  return { id, title, href, company, level, desc, location: loc, date };
}

function parseBrDate(str) {
  const m = (str || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

async function fetchCategory(slug, page) {
  const url = `${BASE}/vagas-de-${slug}?pagina=${page}`;
  const { status, body } = await get(url, {
    headers: { Referer: `${BASE}/` },
  });

  if (status === 403 || status === 429) {
    console.warn(`[vagas] bloqueado HTTP ${status} em ${slug} p${page} — aguardando 30s`);
    await sleep(30000);
    return [];
  }
  if (status !== 200) {
    console.warn(`[vagas] HTTP ${status} em ${slug} p${page}`);
    return [];
  }

  const jobs = [];
  for (const m of body.matchAll(VAGA_BLOCK_RE)) {
    const parsed = parseBlock(m[0]);
    if (parsed) jobs.push(parsed);
  }
  return jobs;
}

async function fetchVagas() {
  if (process.env.VAGAS_ENABLED === 'false') {
    console.log('[vagas] desativado por VAGAS_ENABLED=false');
    return [];
  }

  const results = [];
  for (const slug of CATEGORIES) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        const jobs = await fetchCategory(slug, page);
        if (!jobs.length) break;

        if (page === 1 && jobs.length > 0) {
          console.log(`[vagas] ${slug} — campos: ${Object.keys(jobs[0]).join(', ')}`);
        }

        results.push(...jobs.map(raw => fromVagas(raw)));
        console.log(`[vagas] ${slug} p${page} → ${jobs.length} vagas`);

        if (jobs.length < 10) break;
        await sleep(jitter(2000));
      } catch (e) {
        console.error(`[vagas] erro em ${slug} p${page}:`, e.message);
        break;
      }
    }
    await sleep(3000);
  }

  return results;
}

module.exports = { fetchVagas };
