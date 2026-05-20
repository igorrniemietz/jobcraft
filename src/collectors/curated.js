'use strict';
const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../data/curated_courses.json');

async function collect() {
  try {
    const raw  = fs.readFileSync(FILE, 'utf8');
    const list = JSON.parse(raw);
    const now  = new Date().toISOString();
    return list.map(c => ({ ...c, fetchedAt: now, progress: c.progress ?? 0 }));
  } catch (e) {
    console.error('[curated] erro ao carregar cursos:', e.message);
    return [];
  }
}

module.exports = { collect };
