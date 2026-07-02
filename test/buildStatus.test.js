'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildJobsStatus, ACTIVE_SOURCES } = require('../src/buildStatus.js');

function fakeStore(counts, syncLog = {}) {
  return {
    count: (source) => (source ? (counts[source] || 0) : Object.values(counts).reduce((a, b) => a + b, 0)),
    getSyncLog: () => syncLog,
  };
}

test('buildJobsStatus: reporta as 5 fontes realmente ativas no scheduler', () => {
  assert.deepEqual(ACTIVE_SOURCES, ['trampos', 'vagas', 'greenhouse', 'lever', 'remotar']);
});

test('buildJobsStatus: não reporta fontes desativadas (gupy/remotive/adzuna)', () => {
  const store = fakeStore({ trampos: 10, vagas: 5, greenhouse: 3, lever: 2, remotar: 7 });
  const status = buildJobsStatus(store);
  assert.equal('gupy' in status.sources, false);
  assert.equal('remotive' in status.sources, false);
  assert.equal('adzuna' in status.sources, false);
});

test('buildJobsStatus: cada fonte ativa reflete o count real do store', () => {
  const store = fakeStore({ trampos: 10, vagas: 5, greenhouse: 3, lever: 2, remotar: 7 });
  const status = buildJobsStatus(store);
  assert.equal(status.sources.trampos.count, 10);
  assert.equal(status.sources.vagas.count, 5);
  assert.equal(status.sources.greenhouse.count, 3);
  assert.equal(status.sources.lever.count, 2);
  assert.equal(status.sources.remotar.count, 7);
  assert.equal(status.sources.trampos.enabled, true);
  assert.equal(status.total, 27);
  assert.equal(status.ok, true);
});

test('buildJobsStatus: expõe o syncLog do store sem alterá-lo', () => {
  const log = { trampos: { ok: true, added: 3 } };
  const store = fakeStore({}, log);
  const status = buildJobsStatus(store);
  assert.deepEqual(status.syncLog, log);
});
