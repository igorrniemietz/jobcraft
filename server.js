// Jobcraft — SPA server + job aggregator (zero external deps), port 8080
'use strict';
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const url       = require('url');
const store     = require('./src/jobStore');
const userStore = require('./src/userStore');
const scheduler = require('./src/scheduler');

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
    return sendJSON(res, {
      ok:    true,
      total: store.count(),
      sources: {
        gupy:     { enabled: process.env.GUPY_ENABLED !== 'false',     count: store.count('gupy') },
        remotive: { enabled: process.env.REMOTIVE_ENABLED !== 'false', count: store.count('remotive') },
        adzuna:   { enabled: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY && process.env.ADZUNA_ENABLED !== 'false'), count: store.count('adzuna') },
      },
      syncLog: store.getSyncLog(),
    });
  }

  /* POST /api/jobs/sync — manual sync trigger (admin) */
  if (pathname === '/api/jobs/sync' && req.method === 'POST') {
    scheduler.syncAll().catch(console.error);
    return sendJSON(res, { ok: true, message: 'sync iniciado em background' });
  }

  /* GET /api/saved — IDs das vagas salvas */
  if (pathname === '/api/saved' && req.method === 'GET') {
    return sendJSON(res, { ok: true, saved: userStore.savedList() });
  }

  /* POST /api/saved/:id — toggle salvar/remover */
  const saveMatch = pathname.match(/^\/api\/saved\/(.+)$/);
  if (saveMatch && req.method === 'POST') {
    const jobId = decodeURIComponent(saveMatch[1]);
    const nowSaved = userStore.toggleSaved(jobId);
    return sendJSON(res, { ok: true, id: jobId, saved: nowSaved, savedAt: nowSaved ? userStore.savedList()[jobId] : null });
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
