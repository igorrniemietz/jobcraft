'use strict';
const crypto = require('crypto');

const _store   = new Map(); // compositeKey → job
const _syncLog = {};        // source → { lastRun, count }

// TTL em dias por fonte (sem expiresAt explícito)
const SOURCE_TTL = { remotar: 45, greenhouse: 30, lever: 30, vagas: 21, gupy: 30 };
const CLOSED_RETENTION_DAYS = 3;

function compositeKey(title, company, city) {
  const raw = [title, company, city || ''].map(s => s.toLowerCase().trim()).join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20);
}

function upsert(job) {
  const key = compositeKey(job.title, job.company, job.location);
  const now  = Date.now();
  const existing = _store.get(key);
  if (existing) {
    const sources = [...new Set([...existing.sources, job.source])];
    _store.set(key, { ...existing, sources, lastSeenAt: now, updatedAt: now });
    return 'existing';
  }
  _store.set(key, { ...job, _key: key, sources: [job.source], collectedAt: now, lastSeenAt: now, createdAt: now, updatedAt: now });
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
  const retentionMs = CLOSED_RETENTION_DAYS * 86400000;
  const cutoff      = Date.now() - retentionMs;
  let removed = 0;
  for (const [key, job] of _store.entries()) {
    if ((job.closedAt && new Date(job.closedAt) < new Date(cutoff)) ||
        (isExpired(job) && job.lastSeenAt < cutoff)) {
      _store.delete(key);
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
