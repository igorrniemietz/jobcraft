'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const jobStore = require('../src/jobStore.js');

function baseJob(overrides) {
  return {
    source: 'testsrc', title: 'Vaga Teste', company: 'Empresa Teste',
    location: 'Remoto', externalUrl: '', postedAt: null, expiresAt: null,
    expiredBySource: false,
    ...overrides,
  };
}

test('upsert: dedup por URL normalizada ignora utm/gh_src e ordem de query params', () => {
  const r1 = jobStore.upsert(baseJob({
    title: 'Dedup URL A', company: 'CompanyA',
    externalUrl: 'https://boards.greenhouse.io/x/jobs/1?gh_src=abc&utm_source=linkedin',
  }));
  const r2 = jobStore.upsert(baseJob({
    title: 'Dedup URL A (variante)', company: 'CompanyA', source: 'remotar',
    externalUrl: 'https://boards.greenhouse.io/x/jobs/1?utm_source=twitter&gh_src=xyz',
  }));
  assert.equal(r1, 'new');
  assert.equal(r2, 'existing');

  const all = jobStore.getAll({ source: 'testsrc' }).filter(j => j.company === 'CompanyA');
  assert.equal(all.length, 1);
  assert.deepEqual(new Set(all[0].sources), new Set(['testsrc', 'remotar']));
});

test('upsert: dedup por composite key (title+company+location) sem URL', () => {
  const r1 = jobStore.upsert(baseJob({ title: 'Vaga Composite', company: 'CompanyB', location: 'São Paulo' }));
  const r2 = jobStore.upsert(baseJob({ title: 'Vaga Composite', company: 'CompanyB', location: 'São Paulo' }));
  assert.equal(r1, 'new');
  assert.equal(r2, 'existing');
});

test('upsert: mesmo title+company em location diferente é uma vaga distinta', () => {
  const r1 = jobStore.upsert(baseJob({ title: 'Vaga Multi Local', company: 'CompanyC', location: 'Recife' }));
  const r2 = jobStore.upsert(baseJob({ title: 'Vaga Multi Local', company: 'CompanyC', location: 'Salvador' }));
  assert.equal(r1, 'new');
  assert.equal(r2, 'new');
});

test('isExpired: respeita TTL por fonte (remotar 45d, vagas 21d, default 30d)', () => {
  const days = (n) => new Date(Date.now() - n * 86400000).toISOString();
  assert.equal(jobStore.isExpired({ source: 'remotar', postedAt: days(40) }), false);
  assert.equal(jobStore.isExpired({ source: 'remotar', postedAt: days(46) }), true);
  assert.equal(jobStore.isExpired({ source: 'vagas', postedAt: days(22) }), true);
  assert.equal(jobStore.isExpired({ source: 'vagas', postedAt: days(20) }), false);
  assert.equal(jobStore.isExpired({ source: 'fonte-desconhecida', postedAt: days(31) }), true);
});

test('isExpired: expiresAt no passado expira independente do TTL', () => {
  const job = { source: 'remotar', postedAt: new Date().toISOString(), expiresAt: '2020-01-01T00:00:00Z' };
  assert.equal(jobStore.isExpired(job), true);
});

test('isExpired: expiredBySource true expira imediatamente', () => {
  assert.equal(jobStore.isExpired({ source: 'remotar', expiredBySource: true, postedAt: new Date().toISOString() }), true);
});

test('purge: remove vagas expiradas e paradas há mais de 3 dias, preserva as recentes', async (t) => {
  mock.timers.enable({ apis: ['Date'] });
  t.after(() => mock.timers.reset());

  // t=0: cria vaga já expirada por TTL (postedAt bem antigo) e uma vaga válida
  const oldPostedAt = new Date(Date.now() - 100 * 86400000).toISOString();
  jobStore.upsert(baseJob({ title: 'Vaga Antiga Purge', company: 'CompanyPurge', source: 'vagas', postedAt: oldPostedAt }));
  jobStore.upsert(baseJob({ title: 'Vaga Recente Purge', company: 'CompanyPurge2', source: 'vagas', postedAt: new Date().toISOString() }));

  // Ainda dentro da retenção de 3 dias — nenhuma remoção (lastSeenAt recente)
  let removed = jobStore.purge();
  assert.equal(removed, 0);

  // Avança 4 dias — lastSeenAt da vaga antiga agora está fora da janela de retenção
  mock.timers.tick(4 * 86400000);
  removed = jobStore.purge();
  assert.equal(removed, 1);

  const remaining = jobStore.getAll().filter(j => j.company === 'CompanyPurge' || j.company === 'CompanyPurge2');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].company, 'CompanyPurge2');
});

test('count/getAll: filtram por source e getAll ordena por updatedAt desc', () => {
  jobStore.upsert(baseJob({ title: 'Contagem 1', company: 'CountCo', source: 'countsrc' }));
  jobStore.upsert(baseJob({ title: 'Contagem 2', company: 'CountCo2', source: 'countsrc' }));
  assert.equal(jobStore.count('countsrc'), 2);

  const filtered = jobStore.getAll({ source: 'countsrc' });
  assert.equal(filtered.length, 2);
  assert.ok(filtered[0].updatedAt >= filtered[1].updatedAt);
});
