'use strict';
const { get } = require('../http');
const { detectTrack, trackMeta } = require('../normalizeCourses');

function stripCdata(s) {
  return (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
}

function parseRss(xml) {
  const items  = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const b   = m[1];
    const tag = name => stripCdata(b.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`))?.[1] || '');
    const cats = [...b.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/g)].map(r => stripCdata(r[1]));
    items.push({ title: tag('title'), link: tag('link'), description: tag('description'), cats, pubDate: tag('pubDate') });
  }
  return items;
}

function normalize(item) {
  const text  = `${item.title} ${item.cats.join(' ')}`;
  const track = detectTrack(text);
  const meta  = trackMeta(track);
  return {
    externalId:  item.link,
    source:      'freecodecamp',
    title:       item.title,
    description: item.description.slice(0, 200),
    url:         item.link,
    thumbnail:   '',
    provider:    'freeCodeCamp',
    track,
    level:       'Iniciante',
    free:        true,
    certificate: false,
    language:    'en',
    hours:       0.5,
    modules:     0,
    rating:      0,
    students:    0,
    tags:        item.cats.slice(0, 6),
    xp:          30,
    tier:        'bronze',
    ...meta,
    progress:    0,
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : '',
    fetchedAt:   new Date().toISOString(),
  };
}

async function collect() {
  try {
    const { body } = await get('https://www.freecodecamp.org/news/rss');
    const items = parseRss(body);
    return items.filter(i => i.title && i.link).map(normalize);
  } catch (e) {
    console.error('[freecodecamp] erro:', e.message);
    return [];
  }
}

module.exports = { collect };
