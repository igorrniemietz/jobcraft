'use strict';
const https = require('https');
const http  = require('http');

function get(urlStr, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    const req = mod.get(urlStr, {
      headers: { 'User-Agent': 'Jobcraft/1.0', 'Accept': '*/*', ...opts.headers },
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return get(res.headers.location, opts).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
  });
}

async function getJSON(urlStr, opts = {}) {
  const { status, body } = await get(urlStr, opts);
  try { return { status, body: JSON.parse(body) }; }
  catch { throw new Error(`JSON parse error (HTTP ${status}): ${body.slice(0, 200)}`); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = { get, getJSON, sleep };
