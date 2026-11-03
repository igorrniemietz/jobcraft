'use strict';
const path = require('path');

function safeJoin(root, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); }
  catch { return null; } // malformed %-escape must not throw (would crash the server)
  if (decoded.includes('\0')) return null;
  const target  = path.normalize(path.join(root, decoded));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

module.exports = { safeJoin };
