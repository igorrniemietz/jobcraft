'use strict';
const https = require('https');
const http  = require('http');

const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'identity',
  'Cache-Control':   'no-cache',
};

function get(urlStr, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    const req = mod.get(urlStr, {
      headers: { ...BROWSER_HEADERS, 'Accept': 'text/html,*/*', ...opts.headers },
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return get(res.headers.location, opts).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
  });
}

async function getJSON(urlStr, opts = {}) {
  const merged = { ...opts, headers: { 'Accept': 'application/json', ...opts.headers } };
  const { status, body } = await get(urlStr, merged);
  try { return { status, body: JSON.parse(body) }; }
  catch { throw new Error(`JSON parse error (HTTP ${status}): ${body.slice(0, 200)}`); }
}

async function getWithRetry(urlStr, opts = {}, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    const res = await get(urlStr, opts);
    if (res.status === 429) {
      const wait = (parseInt(res.headers?.['retry-after'] || '60') * 1000);
      console.warn(`[http] 429 em ${urlStr} — aguardando ${wait}ms (tentativa ${i}/${retries})`);
      await sleep(wait);
      continue;
    }
    if (res.status >= 500 && i < retries) { await sleep(jitter(2000) * i); continue; }
    return res;
  }
  throw new Error(`${urlStr} falhou após ${retries} tentativas`);
}

const sleep  = ms => new Promise(r => setTimeout(r, ms));
const jitter = ms => ms + Math.floor(Math.random() * ms);

module.exports = { get, getJSON, getWithRetry, sleep, jitter };
