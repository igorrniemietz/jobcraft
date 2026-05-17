'use strict';

const PALETTE = ['#6C63FF','#E91E63','#00BCD4','#FF5722','#4CAF50','#FF9800','#2196F3','#9C27B0','#F7931A','#EA1D2C'];

// Extrai até 8 tags técnicas relevantes de título + descrição
const TECH_RE = /\b(python|javascript|typescript|java(?:script)?|golang?|rust|kotlin|swift|c\+\+|c#|\.net|php|ruby|scala|react|vue|angular|next\.?js|svelte|node\.?js|express|fastapi|django|flask|spring|aws|gcp|azure|kubernetes|k8s|docker|terraform|ansible|linux|git|ci\/cd|devops|devsecops|appsec|pentest|soc\b|siem|iam|owasp|burp|metasploit|kali|oscp|red.?team|blue.?team|splunk|elastic|kafka|spark|postgresql|postgres|mysql|mongodb|redis|sql|flutter|react.?native)\b/gi;

function extractTags(title, description) {
  const text  = `${title} ${description}`.replace(/<[^>]+>/g, ' ');
  const found = new Set();
  for (const m of text.matchAll(TECH_RE)) found.add(m[0].toLowerCase().trim());
  return [...found].slice(0, 8);
}

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
    id:              `gy-${raw.id}`,
    source:          'gupy',
    title:           raw.name || '',
    company,
    logo:            initials(company),
    color:           colorFor(company),
    location,
    type:            `${contract} · ${level}`,
    contract,
    level,
    companySize:     null,
    salary:          null,
    tags:            extractTags(raw.name || '', raw.description || ''),
    match:           0,
    stage:           null,
    posted:          relTime(raw.publishedDate),
    postedAt:        raw.publishedDate || null,
    expiresAt:       raw.applicationDeadline || null,
    expiredBySource: false,
    applicants:      0,
    saved:           false,
    applied:         false,
    description:     stripHtml(raw.description).slice(0, 500),
    externalUrl:     raw.jobUrl || '',
  };
}

/* ── Remotive ───────────────────────────────────────────────────── */
function fromRemotive(raw) {
  const company = raw.company_name || 'Empresa';
  const level   = extractLevel(raw.title || '') || 'Pleno';

  return {
    id:              `rm-${raw.id}`,
    source:          'remotive',
    title:           raw.title || '',
    company,
    logo:            initials(company),
    color:           colorFor(company),
    location:        'Remoto · Global',
    type:            `PJ · ${level}`,
    contract:        'PJ',
    level,
    companySize:     null,
    salary:          raw.salary || null,
    tags:            Array.isArray(raw.tags) ? raw.tags.slice(0, 6) : [],
    match:           0,
    stage:           null,
    posted:          relTime(raw.publication_date),
    postedAt:        raw.publication_date || null,
    expiresAt:       null,
    expiredBySource: false,
    applicants:      0,
    saved:           false,
    applied:         false,
    description:     stripHtml(raw.description).slice(0, 500),
    externalUrl:     raw.url || '',
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
    id:              `az-${raw.id}`,
    source:          'adzuna',
    title:           raw.title || '',
    company,
    logo:            initials(company),
    color:           colorFor(company),
    location:        city,
    type:            `${contract} · ${level}`,
    contract,
    level,
    companySize:     null,
    salary:          raw.salary_min ? `R$ ${Math.round(raw.salary_min / 12).toLocaleString('pt-BR')} – ${Math.round(raw.salary_max / 12).toLocaleString('pt-BR')}` : null,
    tags:            [],
    match:           0,
    stage:           null,
    posted:          relTime(raw.created),
    postedAt:        raw.created || null,
    expiresAt:       null,
    expiredBySource: false,
    applicants:      0,
    saved:           false,
    applied:         false,
    description:     stripHtml(raw.description).slice(0, 500),
    externalUrl:     raw.redirect_url || '',
  };
}

/* ── Vagas.com ──────────────────────────────────────────────────── */
function parseBrDate(str) {
  const m = (str || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function fromVagas(raw) {
  const company  = raw.company || 'Empresa';
  const title    = raw.title   || '';
  const level    = raw.level   ? raw.level.trim() : (extractLevel(title) || null);

  const locRaw   = raw.location || '';
  const remote   = /remot/i.test(locRaw);
  const location = remote ? 'Remoto · BR'
    : locRaw === 'Localização não informada' || !locRaw ? 'Brasil'
    : locRaw;

  const contract = extractLevel(title) ? null : null; // vagas.com não expõe CLT/PJ na listagem

  return {
    id:              `vg-${raw.id}`,
    source:          'vagas',
    title,
    company,
    logo:            initials(company),
    color:           colorFor(company),
    location,
    type:            level || 'CLT',
    contract:        null,
    level,
    companySize:     null,
    salary:          null,
    tags:            extractTags(title, raw.desc || ''),
    match:           0,
    stage:           null,
    posted:          relTime(parseBrDate(raw.date)),
    postedAt:        parseBrDate(raw.date) || null,
    expiresAt:       null,
    expiredBySource: false,
    applicants:      0,
    saved:           false,
    applied:         false,
    description:     String(raw.desc || '').slice(0, 500),
    externalUrl:     raw.href ? `https://www.vagas.com.br${raw.href}` : '',
  };
}

/* ── Trampos ────────────────────────────────────────────────────── */
function fromTrampos(raw) {
  const company = raw.company?.name || raw.empresa || raw.companyName || 'Empresa';
  const title   = raw.title    || raw.titulo   || raw.nome || '';
  const desc    = raw.description || raw.descricao || raw.body || '';

  const contractRaw = (raw.contractType || raw.tipo || '').toLowerCase();
  const contract = contractRaw.includes('clt')    ? 'CLT'
                 : contractRaw.includes('estágio') ? 'Estágio'
                 : 'PJ'; // trampos é majoritariamente PJ/freelance

  const remote   = /remot/i.test(contractRaw) || raw.remote || raw.remoto || false;
  const city     = raw.city || raw.cidade || raw.location || '';
  const location = remote ? 'Remoto · BR' : city || 'Brasil';
  const level    = extractLevel(title) || 'Pleno';

  const tramposPostedAt = raw.publishedAt || raw.createdAt || raw.created_at || null;
  return {
    id:              `tr-${raw.id || raw.slug}`,
    source:          'trampos',
    title,
    company,
    logo:            initials(company),
    color:           colorFor(company),
    location,
    type:            `${contract} · ${level}`,
    contract,
    level,
    companySize:     null,
    salary:          raw.salary || raw.salario || null,
    tags:            extractTags(title, desc),
    match:           0,
    stage:           null,
    posted:          relTime(tramposPostedAt),
    postedAt:        tramposPostedAt,
    expiresAt:       null,
    expiredBySource: false,
    applicants:      0,
    saved:           false,
    applied:         false,
    description:     stripHtml(desc).slice(0, 500),
    externalUrl:     `https://trampos.co/oportunidades/${raw.slug || raw.id}`,
  };
}

/* ── Greenhouse ─────────────────────────────────────────────────── */
function fromGreenhouse(raw, companyName) {
  const company = companyName || raw.company_name || 'Empresa';
  const title   = raw.title || '';
  const loc     = raw.location?.name || '';

  const remote  = /remote|remoto/i.test(loc);
  const locClean = remote ? 'Remoto · BR'
    : loc.replace(/,\s*(brazil|brasil)/i, '').replace(/brazil|brasil/i, '').trim() || 'Brasil';

  const level    = extractLevel(title) || 'Pleno';
  const dept     = (raw.departments || []).map(d => d.name).join(', ');
  const desc     = raw.content || '';
  const tags     = extractTags(title, stripHtml(desc));

  return {
    id:              `gh-${raw.id}`,
    source:          'greenhouse',
    title,
    company,
    logo:            initials(company),
    color:           colorFor(company),
    location:        locClean,
    type:            `CLT · ${level}`,
    contract:        'CLT',
    level,
    companySize:     'Grande empresa',
    salary:          null,
    tags,
    match:           0,
    stage:           null,
    posted:          relTime(raw.first_published || raw.updated_at),
    postedAt:        raw.first_published || raw.updated_at || null,
    expiresAt:       null,
    expiredBySource: false,
    applicants:      0,
    saved:           false,
    applied:         false,
    description:     stripHtml(desc).slice(0, 500),
    externalUrl:     raw.absolute_url || '',
  };
}

/* ── Lever ──────────────────────────────────────────────────────── */
function fromLever(raw, companyName) {
  const company  = companyName || raw.company || 'Empresa';
  const title    = raw.text || '';
  const loc      = raw.categories?.location || '';
  const remote   = /remote|remoto/i.test(loc);
  const location = remote ? 'Remoto · BR' : loc || 'Brasil';
  const level    = extractLevel(title) || 'Pleno';

  const commitRaw = (raw.categories?.commitment || '').toLowerCase();
  const contract  = commitRaw.includes('contract') ? 'PJ' : 'CLT';

  const desc = raw.descriptionPlain || stripHtml(raw.description || '');

  const leverPostedAt = raw.createdAt ? new Date(raw.createdAt).toISOString() : null;
  return {
    id:              `lv-${raw.id}`,
    source:          'lever',
    title,
    company,
    logo:            initials(company),
    color:           colorFor(company),
    location,
    type:            `${contract} · ${level}`,
    contract,
    level,
    companySize:     'Startup',
    salary:          null,
    tags:            extractTags(title, desc),
    match:           0,
    stage:           null,
    posted:          relTime(leverPostedAt),
    postedAt:        leverPostedAt,
    expiresAt:       null,
    expiredBySource: false,
    applicants:      0,
    saved:           false,
    applied:         false,
    description:     String(desc).slice(0, 500),
    externalUrl:     raw.hostedUrl || '',
  };
}

/* ── Remotar ────────────────────────────────────────────────────── */
function fromRemotar(raw) {
  const company = raw.company?.name || 'Empresa';
  const title   = raw.title || '';
  const desc    = raw.description || '';

  const tagNames = (raw.jobTags || []).map(t => t.tag?.name || '');
  const contract = tagNames.some(n => /CLT/.test(n))        ? 'CLT'
                 : tagNames.some(n => /Estágio/.test(n))    ? 'Estágio'
                 : tagNames.some(n => /Freelancer/.test(n)) ? 'PJ'
                 : 'PJ'; // remotar é majoritariamente PJ/remote

  const level = tagNames.some(n => /Júnior/.test(n))  ? 'Júnior'
              : tagNames.some(n => /Sênior/.test(n))   ? 'Sênior'
              : tagNames.some(n => /Pleno/.test(n))    ? 'Pleno'
              : extractLevel(title) || 'Pleno';

  const isRemote = raw.type === 'remote' || tagNames.some(n => /100% Remoto/.test(n));
  const isHybrid = raw.type === 'hybrid' || tagNames.some(n => /híbrida/.test(n));
  const city     = [raw.city, raw.state].filter(Boolean).join(' · ');
  const location = isRemote ? 'Remoto · BR'
                 : isHybrid ? `Híbrido · ${raw.city || 'BR'}`
                 : city || 'Brasil';

  const salFrom = raw.jobSalary?.from;
  const salTo   = raw.jobSalary?.to;
  const salary  = salFrom && salFrom > 0
    ? `R$ ${salFrom.toLocaleString('pt-BR')}${salTo && salTo > salFrom ? ` – ${salTo.toLocaleString('pt-BR')}` : ''}`
    : null;

  const externalUrl = raw.isExternalLink && raw.externalLink
    ? raw.externalLink
    : `https://remotar.com.br/job/${raw.id}`;

  return {
    id:              `rt-${raw.id}`,
    source:          'remotar',
    title,
    company,
    logo:            initials(company),
    color:           colorFor(company),
    location,
    type:            `${contract} · ${level}`,
    contract,
    level,
    companySize:     null,
    salary,
    tags:            extractTags(title, stripHtml(desc)),
    match:           0,
    stage:           null,
    posted:          relTime(raw.createdAt),
    postedAt:        raw.createdAt || null,
    expiresAt:       raw.expiresAt || null,
    expiredBySource: raw.expired === true,
    applicants:      0,
    saved:           false,
    applied:         false,
    description:     stripHtml(desc).slice(0, 500),
    externalUrl,
  };
}

module.exports = { fromGupy, fromRemotive, fromAdzuna, fromVagas, fromTrampos, fromGreenhouse, fromLever, fromRemotar };
