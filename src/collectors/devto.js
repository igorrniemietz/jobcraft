'use strict';
const { getJSON, sleep, jitter } = require('../http');
const { detectTrack, trackMeta } = require('../normalizeCourses');

const TAGS = ['security','cybersecurity','infosec','devops','cloud','python','javascript','appsec','devsecops','tutorial'];

function normalize(a) {
  const title = a.title || '';
  const text  = `${title} ${a.description || ''} ${(a.tag_list || []).join(' ')}`;
  const track = detectTrack(text);
  const meta  = trackMeta(track);
  const mins  = a.reading_time_minutes || 5;
  return {
    externalId:  String(a.id),
    source:      'devto',
    title,
    description: (a.description || '').slice(0, 200),
    url:         a.url || '',
    thumbnail:   a.cover_image || a.social_image || '',
    provider:    `Dev.to — ${a.user?.name || 'Community'}`,
    track,
    level:       'Iniciante',
    free:        true,
    certificate: false,
    language:    a.language === 'pt' ? 'pt' : 'en',
    hours:       Math.max(0.1, Math.round(mins / 60 * 10) / 10),
    modules:     0,
    rating:      0,
    students:    a.public_reactions_count || 0,
    tags:        (a.tag_list || []).slice(0, 6),
    xp:          Math.max(20, Math.round(mins / 5) * 10),
    tier:        'bronze',
    ...meta,
    progress:    0,
    publishedAt: a.published_at || '',
    fetchedAt:   new Date().toISOString(),
  };
}

async function collect() {
  const seen    = new Set();
  const results = [];
  for (const tag of TAGS) {
    try {
      const url = `https://dev.to/api/articles?tag=${tag}&per_page=20`;
      const { body } = await getJSON(url);
      for (const a of (Array.isArray(body) ? body : [])) {
        if (!a.id || seen.has(a.id) || !a.url) continue;
        seen.add(a.id);
        results.push(normalize(a));
      }
      await sleep(jitter(300));
    } catch (e) {
      console.error(`[devto] erro em tag "${tag}":`, e.message);
    }
  }
  return results;
}

module.exports = { collect };
