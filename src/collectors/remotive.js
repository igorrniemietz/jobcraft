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
      const list = body.jobs || [];
      results.push(...list.map(fromRemotive));
      console.log(`[remotive] "${cat}" → ${list.length} vagas`);
    } catch (e) {
      console.error(`[remotive] erro em "${cat}":`, e.message);
    }
  }
  return results;
}

module.exports = { fetchRemotive };
