'use strict';
const fs   = require('fs');
const path = require('path');

const DATA_DIR  = process.env.DATA_PATH || path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'user-data.json');

const _data = { saved: {} }; // jobId → savedAt timestamp

function _load() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      Object.assign(_data, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
    }
  } catch (e) {
    console.warn('[userStore] erro ao carregar user-data.json:', e.message);
  }
}

let _flushTimer = null;
function _scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    const tmp = DATA_FILE + '.tmp';
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(_data, null, 2), 'utf8');
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
      console.error('[userStore] erro ao salvar user-data.json:', e.message);
    }
  }, 300);
}

function toggleSaved(jobId) {
  if (_data.saved[jobId]) {
    delete _data.saved[jobId];
    _scheduleFlush();
    return false;
  }
  _data.saved[jobId] = Date.now();
  _scheduleFlush();
  return true;
}

function isSaved(jobId)  { return !!_data.saved[jobId]; }
function savedIds()      { return Object.keys(_data.saved); }
function savedList()     { return _data.saved; }

_load();

module.exports = { toggleSaved, isSaved, savedIds, savedList };
