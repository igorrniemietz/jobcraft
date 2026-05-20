'use strict';
const { getJSON, sleep, jitter } = require('../http');
const { detectTrack, trackMeta } = require('../normalizeCourses');

// Busca playlists (cursos completos) em PT-BR
const QUERIES = [
  'curso segurança da informação completo',
  'curso pentest hacking ético completo',
  'curso python completo iniciante',
  'curso javascript completo português',
  'curso linux administração completo',
  'curso docker kubernetes devops',
  'curso aws cloud português completo',
  'curso programação web completo gratuito',
  'curso ethical hacking certificação',
  'curso redes computadores completo',
];

function normalize(item) {
  const snip      = item.snippet || {};
  const listId    = item.id?.playlistId;
  if (!listId) return null;
  const title = snip.title || '';
  if (title.length < 8) return null;
  const text  = `${title} ${snip.description || ''}`;
  const track = detectTrack(text);
  const meta  = trackMeta(track);
  return {
    externalId:  listId,
    source:      'youtube',
    title,
    description: (snip.description || '').slice(0, 200),
    url:         `https://www.youtube.com/playlist?list=${listId}`,
    thumbnail:   snip.thumbnails?.medium?.url || snip.thumbnails?.default?.url || '',
    provider:    snip.channelTitle || 'YouTube',
    track,
    level:       'Variado',
    free:        true,
    certificate: false,
    language:    'pt',
    hours:       4,
    modules:     0,
    rating:      0,
    students:    0,
    tags:        [],
    xp:          100,
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
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=playlist&maxResults=10&relevanceLanguage=pt&regionCode=BR&q=${encodeURIComponent(q)}&key=${apiKey}`;
      const { body } = await getJSON(url);
      for (const item of (body.items || [])) {
        const lid = item.id?.playlistId;
        if (!lid || seen.has(lid)) continue;
        seen.add(lid);
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
