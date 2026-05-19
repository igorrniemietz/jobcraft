'use strict';
const { getJSON, sleep, jitter } = require('../http');
const { detectTrack, trackMeta } = require('../normalizeCourses');

const QUERIES = [
  'cybersecurity','cloud security','ethical hacking',
  'devops','python','web security','network security',
];

function normalize(item) {
  const title = item.name || '';
  const text  = `${title} ${item.description || ''}`;
  const track = detectTrack(text);
  const meta  = trackMeta(track);
  const isPT  = (item.primaryLanguages || []).includes('pt');
  return {
    externalId:  item.id,
    source:      'coursera',
    title,
    description: (item.description || '').slice(0, 200),
    url:         `https://www.coursera.org/learn/${item.slug}`,
    thumbnail:   item.photoUrl || '',
    provider:    'Coursera',
    track,
    level:       'Variado',
    free:        true,
    certificate: true,
    language:    isPT ? 'pt' : 'en',
    hours:       20,
    modules:     0,
    rating:      0,
    students:    0,
    tags:        [],
    xp:          200,
    tier:        'prata',
    ...meta,
    progress:    0,
    fetchedAt:   new Date().toISOString(),
  };
}

async function collect() {
  const seen    = new Set();
  const results = [];
  for (const q of QUERIES) {
    try {
      const url = `https://api.coursera.org/api/courses.v1?fields=name,slug,description,photoUrl,primaryLanguages&q=search&query=${encodeURIComponent(q)}&limit=20`;
      const { body } = await getJSON(url);
      for (const item of (body.elements || [])) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        const c = normalize(item);
        if (c) results.push(c);
      }
      await sleep(jitter(400));
    } catch (e) {
      console.error(`[coursera] erro em "${q}":`, e.message);
    }
  }
  return results;
}

module.exports = { collect };
