'use strict';

const MAX_ID_LEN = 200;
const RESERVED   = new Set(['__proto__', 'constructor', 'prototype']);

// Decodes a job id taken from a URL path. Returns null when it is malformed
// (bad %-escape, empty, too long, control chars) or would hit Object.prototype keys.
function decodeJobId(raw) {
  let id;
  try { id = decodeURIComponent(raw); }
  catch { return null; }
  if (!id || id.length > MAX_ID_LEN) return null;
  if (/[\u0000-\u001f]/.test(id)) return null;
  if (RESERVED.has(id)) return null;
  return id;
}

module.exports = { decodeJobId };
