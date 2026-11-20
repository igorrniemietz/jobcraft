'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decodeJobId } = require('../src/jobId.js');

test('decodes normal ids', () => {
  assert.equal(decodeJobId('gh%3A123'), 'gh:123');
  assert.equal(decodeJobId('abc-1'), 'abc-1');
});

test('rejects malformed percent-escapes instead of throwing', () => {
  assert.equal(decodeJobId('%E0%A4%A'), null);
});

test('rejects empty, oversized, control-char and prototype ids', () => {
  assert.equal(decodeJobId(''), null);
  assert.equal(decodeJobId('a'.repeat(201)), null);
  assert.equal(decodeJobId('a%00b'), null);
  assert.equal(decodeJobId('__proto__'), null);
  assert.equal(decodeJobId('constructor'), null);
});
