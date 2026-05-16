'use strict';
const crypto = require('crypto');

const _store   = new Map(); // compositeKey → job
const _syncLog = {};        // source → { lastRun, count }

function compositeKey(title, company, city) {
  const raw = [title, company, city || ''].map(s => s.toLowerCase().trim()).join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20);
}

function upsert(job) {
  const key = compositeKey(job.title, job.company, job.location);
  const existing = _store.get(key);
  if (existing) {
    const sources = [...new Set([...existing.sources, job.source])];
    _store.set(key, { ...existing, sources, updatedAt: Date.now() });
    return 'dup';
  }
  _store.set(key, { ...job, _key: key, sources: [job.source], createdAt: Date.now(), updatedAt: Date.now() });
  return 'new';
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

module.exports = { upsert, getAll, count, setSyncLog, getSyncLog };
