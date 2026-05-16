// Jobcraft — static SPA server (zero deps), port 8080
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, 'public');

/* ── MIME ─────────────────────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
};

/* ── helpers ──────────────────────────────────────────────────── */
function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target  = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) return null;
  return target;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}

function sendJSON(res, data) {
  send(res, 200, JSON.stringify(data), { 'Content-Type': 'application/json' });
}

/* ── in-memory job cache (10 min TTL) ────────────────────────── */
const jobCache  = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function cacheGet(key) {
  const e = jobCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiry) { jobCache.delete(key); return null; }
  return e.data;
}
function cacheSet(key, data) {
  jobCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

/* ── HTTPS GET helper ─────────────────────────────────────────── */
function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    const req = https.get(urlStr, {
      headers: { 'User-Agent': 'Jobcraft/1.0', 'Accept': 'application/json' },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { reject(new Error(`JSON parse error (HTTP ${res.statusCode}): ${body.slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
  });
}

/* ── GeekHunter normalizer ────────────────────────────────────── */
const PALETTE = ['#6C63FF','#E91E63','#00BCD4','#FF5722','#4CAF50','#FF9800','#2196F3','#9C27B0'];
function colorFromStr(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return PALETTE[h % PALETTE.length];
}

function relTime(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'há 1 dia';
  if (d < 7)  return `há ${d} dias`;
  if (d < 14) return 'há 1 semana';
  return `há ${Math.floor(d / 7)} semanas`;
}

const CONTRACT_MAP = {
  clt: 'CLT', pj: 'PJ', freelance: 'PJ', freela: 'PJ',
  estagio: 'Estágio', estágio: 'Estágio', internship: 'Estágio',
};
const LEVEL_MAP = {
  junior: 'Júnior', júnior: 'Júnior', jr: 'Júnior',
  pleno: 'Pleno', mid: 'Pleno',
  senior: 'Sênior', sênior: 'Sênior', sr: 'Sênior',
};

function normalizeGH(raw) {
  const company  = (typeof raw.company === 'object' ? raw.company?.name : raw.company) || 'Empresa';
  const contract = CONTRACT_MAP[(raw.contract_type || '').toLowerCase()] || raw.contract_type || 'CLT';
  const level    = LEVEL_MAP[(raw.seniority || '').toLowerCase()] || raw.seniority || 'Pleno';
  const logo     = company.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const remote   = raw.remote === true || String(raw.remote).toLowerCase() === 'true';
  const city     = raw.location?.city || raw.city || '';

  return {
    id:          `gh-${raw.id || Math.random().toString(36).slice(2)}`,
    source:      'geekhunter',
    title:       raw.title       || '',
    company,
    logo,
    color:       colorFromStr(company),
    location:    remote ? 'Remoto · BR' : (city ? `${city} · BR` : 'Brasil'),
    type:        `${contract} · ${level}`,
    contract,
    level,
    companySize: null,
    salary:      raw.salary_range || null,
    tags:        Array.isArray(raw.skills) ? raw.skills.slice(0, 6) : [],
    match:       0,
    stage:       null,
    posted:      raw.created_at ? relTime(raw.created_at) : 'recente',
    applicants:  0,
    saved:       false,
    applied:     false,
    description: raw.description || '',
  };
}

/* ── GeekHunter API fetch ─────────────────────────────────────── */
async function fetchGeekHunter({ q = 'segurança', skills = [], page = 1 }) {
  const params = new URLSearchParams();
  if (q)             params.set('search',   q);
  if (skills.length) params.set('skills',   skills.join(','));
  params.set('page',     String(page));
  params.set('per_page', '20');

  const apiUrl = `https://www.geekhunter.com.br/api/v1/jobs?${params}`;
  const cached = cacheGet(apiUrl);
  if (cached) return { jobs: cached, source: 'cache' };

  const { status, body } = await httpsGet(apiUrl);
  if (status !== 200) throw new Error(`GeekHunter HTTP ${status}`);

  const list = body.jobs || body.data || (Array.isArray(body) ? body : []);
  const jobs = list.map(normalizeGH);
  cacheSet(apiUrl, jobs);
  return { jobs, source: 'live' };
}

/* ── request handler ──────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url);
  const pathname = parsed.pathname || '/';

  if (pathname === '/health') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });

  /* GeekHunter proxy */
  if (pathname === '/api/jobs') {
    const qs     = new URLSearchParams(parsed.query || '');
    const q      = qs.get('q')      || 'segurança';
    const skills = (qs.get('skills') || '').split(',').filter(Boolean);
    const page   = Math.max(1, parseInt(qs.get('page') || '1', 10));
    try {
      const result = await fetchGeekHunter({ q, skills, page });
      return sendJSON(res, { ok: true, ...result });
    } catch (err) {
      console.error('[GeekHunter]', err.message);
      return sendJSON(res, { ok: false, jobs: [], error: err.message });
    }
  }

  /* static files */
  let filePath = safeJoin(ROOT, pathname === '/' ? '/index.html' : pathname);
  if (!filePath) return send(res, 403, 'Forbidden');

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) filePath = path.join(ROOT, 'index.html');
    fs.readFile(filePath, (e2, data) => {
      if (e2) return send(res, 500, 'Internal error');
      const ext  = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      send(res, 200, data, { 'Content-Type': mime });
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n  Jobcraft rodando em  http://localhost:${PORT}\n`);
});
