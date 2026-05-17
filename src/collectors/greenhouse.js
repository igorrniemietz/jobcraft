'use strict';
const { getJSON, sleep } = require('../http');
const { fromGreenhouse } = require('../normalize');

// Empresas BR tech confirmadas no Greenhouse (validadas ao vivo 2026-05-17)
const COMPANIES = [
  { slug: 'nubank',          name: 'Nubank'           },
  { slug: 'quintoandar',     name: 'QuintoAndar'      },
  { slug: 'rdstation',       name: 'RD Station'       },
  { slug: 'stone',           name: 'Stone'            },
  { slug: 'ebanx',           name: 'EBANX'            },
  { slug: 'gympass',         name: 'Gympass'          },
  { slug: 'vtex',            name: 'VTEX'             },
  { slug: 'wildlifestudios', name: 'Wildlife Studios' },
];

// Filtra vagas em localização BR
const BR_LOC = /brazil|brasil|são paulo|rio de janeiro|belo horizonte|brasília|florianópolis|campinas|curitiba|porto alegre|remoto|remote/i;

// Só departamentos técnicos (Stone tem muitos cargos de campo/vendas)
const TECH_DEPT = /engineer|tech|software|security|data|platform|infra|devops|product|design|mobile|backend|frontend|fullstack|analista|desenvolvimento|ciência/i;

async function fetchGreenhouse() {
  if (process.env.GREENHOUSE_ENABLED === 'false') {
    console.log('[greenhouse] desativado por GREENHOUSE_ENABLED=false');
    return [];
  }

  const results = [];
  for (const co of COMPANIES) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${co.slug}/jobs?content=true`;
      const { status, body } = await getJSON(url);
      if (status !== 200) { console.warn(`[greenhouse] HTTP ${status} para ${co.slug}`); continue; }

      const jobs = (body.jobs || []).filter(j => {
        const loc   = j.location?.name || '';
        const depts = (j.departments || []).map(d => d.name).join(' ');
        const title = j.title || '';
        const isBR   = BR_LOC.test(loc);
        const isTech = TECH_DEPT.test(depts) || TECH_DEPT.test(title);
        return isBR && isTech;
      });

      results.push(...jobs.map(j => fromGreenhouse(j, co.name)));
      console.log(`[greenhouse] ${co.slug} → ${jobs.length} vagas tech BR`);
      await sleep(500);
    } catch (e) {
      console.error(`[greenhouse] erro em ${co.slug}:`, e.message);
    }
  }
  return results;
}

module.exports = { fetchGreenhouse };
