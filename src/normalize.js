'use strict';

const PALETTE = ['#6C63FF','#E91E63','#00BCD4','#FF5722','#4CAF50','#FF9800','#2196F3','#9C27B0','#F7931A','#EA1D2C'];

function colorFor(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return PALETTE[h % PALETTE.length];
}

function initials(name) {
  return String(name).split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '??';
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function relTime(iso) {
  if (!iso) return 'recente';
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'há 1 dia';
  if (d < 7)  return `há ${d} dias`;
  if (d < 14) return 'há 1 semana';
  return `há ${Math.floor(d / 7)} semanas`;
}

function extractLevel(title) {
  const t = title.toLowerCase();
  if (/j[uú]nior|jr\.?\b|entry.?level|i\b/.test(t)) return 'Júnior';
  if (/s[eê]nior|sr\.?\b/.test(t))                   return 'Sênior';
  if (/pleno|mid.?level|ii\b/.test(t))                return 'Pleno';
  return null;
}

/* ── Gupy ───────────────────────────────────────────────────────── */
const GUPY_CONTRACT = {
  effective: 'CLT', 'clt': 'CLT',
  temporary: 'PJ',  'pj': 'PJ', freelancer: 'PJ',
  internship: 'Estágio', apprentice: 'Estágio', trainee: 'Estágio',
};

function cleanGupyCompany(raw) {
  const name = raw.careerPageName || '';
  // taglines tem emoji, #, maiúsculas excessivas ou são muito longas
  const isTagline = /[#🚀🧡💚🔥✨]/.test(name) || name.length > 40 || name === name.toUpperCase();
  if (!isTagline) return name;
  // fallback: extrair subdomínio da careerPageUrl (ex: fcamara.gupy.io → FCamara)
  const m = (raw.careerPageUrl || '').match(/https?:\/\/([^.]+)\.gupy\.io/);
  if (m) return m[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return 'Empresa';
}

function fromGupy(raw) {
  const company  = cleanGupyCompany(raw);
  const contract = GUPY_CONTRACT[(raw.type || '').toLowerCase()] || 'CLT';
  const level    = extractLevel(raw.name || '') || 'Pleno';
  const remote   = raw.isRemoteWork || raw.workplaceType === 'remote';
  const hybrid   = raw.workplaceType === 'hybrid';
  const city     = [raw.city, raw.state].filter(Boolean).join(' · ');
  const location = remote ? 'Remoto · BR' : hybrid ? `Híbrido · ${raw.city || 'BR'}` : city || 'Brasil';

  return {
    id:          `gy-${raw.id}`,
    source:      'gupy',
    title:       raw.name || '',
    company,
    logo:        initials(company),
    color:       colorFor(company),
    location,
    type:        `${contract} · ${level}`,
    contract,
    level,
    companySize: null,
    salary:      null,
    tags:        [],
    match:       0,
    stage:       null,
    posted:      relTime(raw.publishedDate),
    applicants:  0,
    saved:       false,
    applied:     false,
    description: stripHtml(raw.description).slice(0, 500),
    externalUrl: raw.jobUrl || raw.careerPageUrl || '',
  };
}

/* ── Remotive ───────────────────────────────────────────────────── */
function fromRemotive(raw) {
  const company = raw.company_name || 'Empresa';
  const level   = extractLevel(raw.title || '') || 'Pleno';

  return {
    id:          `rm-${raw.id}`,
    source:      'remotive',
    title:       raw.title || '',
    company,
    logo:        initials(company),
    color:       colorFor(company),
    location:    'Remoto · Global',
    type:        `PJ · ${level}`,
    contract:    'PJ',
    level,
    companySize: null,
    salary:      raw.salary || null,
    tags:        Array.isArray(raw.tags) ? raw.tags.slice(0, 6) : [],
    match:       0,
    stage:       null,
    posted:      relTime(raw.publication_date),
    applicants:  0,
    saved:       false,
    applied:     false,
    description: stripHtml(raw.description).slice(0, 500),
    externalUrl: raw.url || '',
  };
}

/* ── Adzuna ─────────────────────────────────────────────────────── */
const ADZUNA_CONTRACT = { permanent: 'CLT', contract: 'PJ', part_time: 'PJ' };

function fromAdzuna(raw) {
  const company  = raw.company?.display_name || 'Empresa';
  const contract = ADZUNA_CONTRACT[raw.contract_type] || 'CLT';
  const level    = extractLevel(raw.title || '') || 'Pleno';
  const city     = raw.location?.area?.[2] || raw.location?.display_name || 'Brasil';

  return {
    id:          `az-${raw.id}`,
    source:      'adzuna',
    title:       raw.title || '',
    company,
    logo:        initials(company),
    color:       colorFor(company),
    location:    city,
    type:        `${contract} · ${level}`,
    contract,
    level,
    companySize: null,
    salary:      raw.salary_min ? `R$ ${Math.round(raw.salary_min / 12).toLocaleString('pt-BR')} – ${Math.round(raw.salary_max / 12).toLocaleString('pt-BR')}` : null,
    tags:        [],
    match:       0,
    stage:       null,
    posted:      relTime(raw.created),
    applicants:  0,
    saved:       false,
    applied:     false,
    description: stripHtml(raw.description).slice(0, 500),
    externalUrl: raw.redirect_url || '',
  };
}

module.exports = { fromGupy, fromRemotive, fromAdzuna };
