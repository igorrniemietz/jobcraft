'use strict';
const crypto = require('crypto');

const _store    = new Map(); // compositeKey → job
const _urlIndex = new Map(); // normalizedUrl → compositeKey
const _syncLog  = {};

const SOURCE_TTL = { remotar: 45, greenhouse: 30, lever: 30, vagas: 21, gupy: 30 };
const CLOSED_RETENTION_DAYS = 3;

const STRIP_PARAMS = new Set([
  'utm_source','utm_medium','utm_campaign','utm_content','utm_term',
  'ref','source','gh_src','lever_origin','rcm',
]);

function normalizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const u = new URL(raw.trim());
    u.hostname = u.hostname.toLowerCase();
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    for (const k of STRIP_PARAMS) u.searchParams.delete(k);
    u.searchParams.sort();
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function compositeKey(title, company, city) {
  const raw = [title, company, city || ''].map(s => s.toLowerCase().trim()).join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20);
}

function upsert(job) {
  const now     = Date.now();
  const normUrl = normalizeUrl(job.externalUrl);

  // 1. URL-based dedup — catches cross-source duplicates (e.g. Remotar re-posting Gupy jobs)
  if (normUrl) {
    const existingKey = _urlIndex.get(normUrl);
    if (existingKey && _store.has(existingKey)) {
      const existing = _store.get(existingKey);
      const sources  = [...new Set([...existing.sources, job.source])];
      _store.set(existingKey, { ...existing, sources, lastSeenAt: now, updatedAt: now });
      return 'existing';
    }
  }

  // 2. Composite key dedup — catches same job from same source with minor differences
  const key      = compositeKey(job.title, job.company, job.location);
  const existing = _store.get(key);
  if (existing) {
    const sources = [...new Set([...existing.sources, job.source])];
    if (normUrl && !_urlIndex.has(normUrl)) _urlIndex.set(normUrl, key);
    _store.set(key, { ...existing, sources, lastSeenAt: now, updatedAt: now });
    return 'existing';
  }

  // 3. New entry
  _store.set(key, {
    ...job,
    _key: key,
    sources: [job.source],
    collectedAt: now, lastSeenAt: now, createdAt: now, updatedAt: now,
  });
  if (normUrl) _urlIndex.set(normUrl, key);
  return 'new';
}

function isExpired(job) {
  if (job.expiredBySource) return true;
  if (job.expiresAt && new Date(job.expiresAt) < new Date()) return true;
  const ttlDays = SOURCE_TTL[job.source] || 30;
  if (job.postedAt) {
    const ageDays = (Date.now() - new Date(job.postedAt)) / 86400000;
    if (ageDays > ttlDays) return true;
  }
  return false;
}

function purge() {
  const cutoff = Date.now() - CLOSED_RETENTION_DAYS * 86400000;
  let removed = 0;
  for (const [key, job] of _store.entries()) {
    if ((job.closedAt && new Date(job.closedAt) < new Date(cutoff)) ||
        (isExpired(job) && job.lastSeenAt < cutoff)) {
      _store.delete(key);
      const normUrl = normalizeUrl(job.externalUrl);
      if (normUrl) _urlIndex.delete(normUrl);
      removed++;
    }
  }
  return removed;
}

function getAll({ source } = {}) {
  const all = [..._store.values()];
  if (source) return all.filter(j => j.source === source || j.sources?.includes(source));
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

function count(source) {
  if (!source) return _store.size;
  return [..._store.values()].filter(j => j.source === source).length;
}

function setSyncLog(source, info) { _syncLog[source] = { ...info, ts: Date.now() }; }
function getSyncLog()             { return _syncLog; }

module.exports = { upsert, isExpired, purge, getAll, count, setSyncLog, getSyncLog };
