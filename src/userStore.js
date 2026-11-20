'use strict';
const fs   = require('fs');
const path = require('path');

const DATA_DIR  = process.env.DATA_PATH || path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'user-data.json');

const STAGES = ['applied', 'reviewing', 'interview', 'offer', 'rejected'];

const _data = {
  saved:        {},
  applications: {},
  profile: {
    xp: 0, level: 1, xpNext: 500, coins: 0,
    streak: 0, lastActivity: null,
    activities: [],  // [{ type, xp, ts }] — last 90 entries
  },
};

function _load() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // Deep merge profile so new fields get defaults
      if (saved.profile) Object.assign(_data.profile, saved.profile);
      if (saved.saved) _data.saved = saved.saved;
      if (saved.applications) _data.applications = saved.applications;
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

/* ── Candidaturas ──────────────────────────────────────────────── */
function applyToJob(jobId) {
  const now = Date.now();
  if (_data.applications[jobId]) return _data.applications[jobId];
  _data.applications[jobId] = { stage: 'applied', appliedAt: now, updatedAt: now };
  _scheduleFlush();
  return _data.applications[jobId];
}

function updateStage(jobId, stage) {
  if (!STAGES.includes(stage)) return null;
  if (!_data.applications[jobId]) return null;
  _data.applications[jobId] = { ..._data.applications[jobId], stage, updatedAt: Date.now() };
  _scheduleFlush();
  return _data.applications[jobId];
}

function removeApplication(jobId) {
  if (!_data.applications[jobId]) return false;
  delete _data.applications[jobId];
  _scheduleFlush();
  return true;
}

function listApplications() { return _data.applications; }

/* ── Gamificação: XP, Nível, Streak ───────────────────────────── */
const XP_REWARDS = {
  save:      10,
  apply:     50,
  interview: 150,
  offer:     500,
  quest:     null,  // amount provided by caller
};

const MAX_XP_PER_ACTION = 10000;

function getProfile() {
  return { ..._data.profile };
}

function addXP(action, amount) {
  const p = _data.profile;
  const raw    = (action === 'quest' || !XP_REWARDS[action]) ? amount : XP_REWARDS[action];
  // amount comes from the request body: a string/NaN would corrupt p.xp (string concat)
  const earned = Number.isFinite(raw) ? Math.min(Math.floor(raw), MAX_XP_PER_ACTION) : 0;
  if (earned <= 0) return { ...p, earned: 0, leveledUp: false };

  // Streak: check if last activity was today or yesterday
  const todayStr = new Date().toISOString().slice(0, 10);
  if (p.lastActivity) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (p.lastActivity === todayStr) {
      // same day — streak unchanged
    } else if (p.lastActivity === yesterday) {
      p.streak = (p.streak || 0) + 1;
    } else {
      p.streak = 1;
    }
  } else {
    p.streak = 1;
  }
  p.lastActivity = todayStr;

  p.xp += earned;
  p.coins += Math.floor(earned / 10);

  let leveledUp = false;
  const newLevels = [];
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = Math.round(p.xpNext * 1.25);
    p.coins += 100;
    newLevels.push(p.level);
    leveledUp = true;
  }

  p.activities.unshift({ type: action, xp: earned, ts: Date.now() });
  if (p.activities.length > 90) p.activities = p.activities.slice(0, 90);

  _scheduleFlush();
  return { ...p, earned, leveledUp, newLevels };
}

_load();

module.exports = {
  toggleSaved, isSaved, savedIds, savedList,
  applyToJob, updateStage, removeApplication, listApplications,
  getProfile, addXP,
  STAGES,
};
