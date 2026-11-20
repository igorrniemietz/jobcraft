// Jobcraft — SPA server + job aggregator (zero external deps), port 8080
'use strict';
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const url       = require('url');
const store       = require('./src/jobStore');
const userStore   = require('./src/userStore');
const courseStore = require('./src/courseStore');
const scheduler   = require('./src/scheduler');
const { buildJobsStatus } = require('./src/buildStatus');
const { safeJoin }        = require('./src/safeJoin');
const { decodeJobId }     = require('./src/jobId');

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
function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}

function sendJSON(res, data) {
  send(res, 200, JSON.stringify(data), { 'Content-Type': 'application/json' });
}

/* ── request handler ──────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url);
  const pathname = parsed.pathname || '/';

  if (pathname === '/health') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });

  /* GET /api/jobs — aggregated jobs from all enabled sources */
  if (pathname === '/api/jobs') {
    const qs  = new URLSearchParams(parsed.query || '');
    const src = qs.get('source') || null;
    const jobs = store.getAll(src ? { source: src } : {});
    return sendJSON(res, { ok: true, count: jobs.length, jobs });
  }

  /* GET /api/jobs/status — sync log */
  if (pathname === '/api/jobs/status') {
    return sendJSON(res, buildJobsStatus(store));
  }

  /* POST /api/jobs/sync — manual sync trigger (admin) */
  if (pathname === '/api/jobs/sync' && req.method === 'POST') {
    scheduler.syncAll().catch(console.error);
    return sendJSON(res, { ok: true, message: 'sync iniciado em background' });
  }

  /* GET /api/courses — cursos agregados de todas as fontes */
  if (pathname === '/api/courses') {
    const qs = new URLSearchParams(parsed.query || '');
    const filters = {};
    if (qs.get('source'))   filters.source   = qs.get('source');
    if (qs.get('track'))    filters.track    = qs.get('track');
    if (qs.get('language')) filters.language = qs.get('language');
    const courses = courseStore.getAll(filters);
    return sendJSON(res, { ok: true, count: courses.length, courses });
  }

  /* GET /api/saved — IDs das vagas salvas */
  if (pathname === '/api/saved' && req.method === 'GET') {
    return sendJSON(res, { ok: true, saved: userStore.savedList() });
  }

  /* POST /api/saved/:id — toggle salvar/remover */
  const saveMatch = pathname.match(/^\/api\/saved\/(.+)$/);
  if (saveMatch && req.method === 'POST') {
    const jobId = decodeJobId(saveMatch[1]);
    if (!jobId) return send(res, 400, JSON.stringify({ ok: false, error: 'id inválido' }), { 'Content-Type': 'application/json' });
    const nowSaved = userStore.toggleSaved(jobId);
    return sendJSON(res, { ok: true, id: jobId, saved: nowSaved, savedAt: nowSaved ? userStore.savedList()[jobId] : null });
  }

  /* GET /api/profile — estado de gamificação */
  if (pathname === '/api/profile' && req.method === 'GET') {
    return sendJSON(res, { ok: true, profile: userStore.getProfile() });
  }

  /* POST /api/profile/xp — registrar ação e ganhar XP */
  if (pathname === '/api/profile/xp' && req.method === 'POST') {
    const { action, amount } = await readBody(req);
    const result = userStore.addXP(action || 'misc', amount || 0);
    return sendJSON(res, { ok: true, ...result });
  }

  /* GET /api/applications — listar candidaturas */
  if (pathname === '/api/applications' && req.method === 'GET') {
    return sendJSON(res, { ok: true, applications: userStore.listApplications() });
  }

  /* POST /api/applications/:id — candidatar */
  /* PATCH /api/applications/:id — atualizar stage */
  /* DELETE /api/applications/:id — remover */
  const appMatch = pathname.match(/^\/api\/applications\/(.+)$/);
  if (appMatch) {
    const jobId = decodeJobId(appMatch[1]);
    if (!jobId) return send(res, 400, JSON.stringify({ ok: false, error: 'id inválido' }), { 'Content-Type': 'application/json' });
    if (req.method === 'POST') {
      const entry = userStore.applyToJob(jobId);
      return sendJSON(res, { ok: true, id: jobId, ...entry });
    }
    if (req.method === 'PATCH') {
      const { stage } = await readBody(req);
      const entry = userStore.updateStage(jobId, stage);
      if (!entry) return sendJSON(res, { ok: false, error: 'stage inválido ou candidatura não encontrada' });
      return sendJSON(res, { ok: true, id: jobId, ...entry });
    }
    if (req.method === 'DELETE') {
      userStore.removeApplication(jobId);
      return sendJSON(res, { ok: true, id: jobId, removed: true });
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
  scheduler.start();
});
