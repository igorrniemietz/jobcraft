'use strict';
const { getJSON, sleep, jitter } = require('../http');
const { detectTrack, trackMeta } = require('../normalizeCourses');

const QUERIES = [
  'segurança da informação curso completo',
  'pentest tutorial português',
  'ethical hacking cybersecurity',
  'devops kubernetes docker curso',
  'cloud aws azure tutorial',
  'owasp appsec devsecops',
  'python programação curso gratuito',
  'javascript typescript curso completo',
];

function normalize(item) {
  const snip  = item.snippet || {};
  const vidId = item.id?.videoId;
  if (!vidId) return null;
  const title = snip.title || '';
  const text  = `${title} ${snip.description || ''} ${(snip.tags || []).join(' ')}`;
  const track = detectTrack(text);
  const meta  = trackMeta(track);
  return {
    externalId:  vidId,
    source:      'youtube',
    title,
    description: (snip.description || '').slice(0, 200),
    url:         `https://www.youtube.com/watch?v=${vidId}`,
    thumbnail:   snip.thumbnails?.medium?.url || snip.thumbnails?.default?.url || '',
    provider:    snip.channelTitle || 'YouTube',
    track,
    level:       'Variado',
    free:        true,
    certificate: false,
    language:    'pt',
    hours:       1,
    modules:     0,
    rating:      0,
    students:    0,
    tags:        (snip.tags || []).slice(0, 6),
    xp:          60,
    tier:        'bronze',
    ...meta,
    progress:    0,
    publishedAt: snip.publishedAt || '',
    fetchedAt:   new Date().toISOString(),
  };
}

async function collect() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('[youtube] YOUTUBE_API_KEY não definida — desativado');
    return [];
  }
  const seen    = new Set();
  const results = [];
  for (const q of QUERIES) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&relevanceLanguage=pt&regionCode=BR&videoCategoryId=27&q=${encodeURIComponent(q)}&key=${apiKey}`;
      const { body } = await getJSON(url);
      for (const item of (body.items || [])) {
        const vid = item.id?.videoId;
        if (!vid || seen.has(vid)) continue;
        seen.add(vid);
        const c = normalize(item);
        if (c) results.push(c);
      }
      await sleep(jitter(600));
    } catch (e) {
      console.error(`[youtube] erro em "${q}":`, e.message);
    }
  }
  return results;
}

module.exports = { collect };
