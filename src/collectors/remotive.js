'use strict';
const { getJSON }      = require('../http');
const { fromRemotive } = require('../normalize');

const CATEGORIES = ['software-dev', 'devops-sysadmin', 'cybersecurity'];

async function fetchRemotive() {
  if (process.env.REMOTIVE_ENABLED === 'false') {
    console.log('[remotive] desativado por REMOTIVE_ENABLED=false');
    return [];
  }

  const results = [];
  for (const cat of CATEGORIES) {
    try {
      const url = `https://remotive.com/api/remote-jobs?category=${cat}&limit=50`;
      const { status, body } = await getJSON(url);
      if (status !== 200) { console.warn(`[remotive] HTTP ${status} para "${cat}"`); continue; }
      const now = Date.now();
      const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
      const list = (body.jobs || []).filter(j => {
        if (!j.publication_date) return true;
        return (now - new Date(j.publication_date).getTime()) <= MAX_AGE_MS;
      });
      results.push(...list.map(fromRemotive));
      console.log(`[remotive] "${cat}" → ${list.length} vagas`);
    } catch (e) {
      console.error(`[remotive] erro em "${cat}":`, e.message);
    }
  }
  return results;
}

module.exports = { fetchRemotive };
