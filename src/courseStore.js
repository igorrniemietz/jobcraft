'use strict';
const crypto = require('crypto');

const _store   = new Map(); // id → course
const _byUrl   = new Map(); // normalizedUrl → id
const _syncLog = [];

function normalizeUrl(u) {
  try { return new URL(u).href.replace(/[?#].*$/, '').replace(/\/$/, ''); }
  catch { return (u || '').toLowerCase().trim(); }
}

function makeId(source, externalId) {
  return crypto.createHash('sha256')
    .update(`${source}:${externalId}`)
    .digest('hex').slice(0, 16);
}

function upsert(course) {
  if (!course.url || !course.title) return 'skip';
  const normUrl = normalizeUrl(course.url);
  if (_byUrl.has(normUrl)) return 'dup';
  const id = makeId(course.source || 'ext', course.externalId || course.url);
  course.id = id;
  _store.set(id, course);
  _byUrl.set(normUrl, id);
  return 'new';
}

function getAll(filters = {}) {
  let list = [..._store.values()];
  if (filters.source)   list = list.filter(c => c.source   === filters.source);
  if (filters.track)    list = list.filter(c => c.track    === filters.track);
  if (filters.language) list = list.filter(c => c.language === filters.language);
  if (filters.free)     list = list.filter(c => c.free     === true);
  return list;
}

function count(source) {
  if (!source) return _store.size;
  return [..._store.values()].filter(c => c.source === source).length;
}

function setSyncLog(source, data) {
  _syncLog.push({ source, ...data, ts: Date.now() });
  if (_syncLog.length > 50) _syncLog.shift();
}

function getSyncLog() { return [..._syncLog]; }

module.exports = { upsert, getAll, count, setSyncLog, getSyncLog };
