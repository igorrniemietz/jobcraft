'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COMPANIES } = require('../src/collectors/greenhouse.js');

test('COMPANIES: inclui as novas empresas BR validadas ao vivo em 2026-07-01', () => {
  const slugs = COMPANIES.map(c => c.slug);
  assert.ok(slugs.includes('ifoodcarreiras'), 'esperava iFood (ifoodcarreiras)');
  assert.ok(slugs.includes('hotmartcareersbr'), 'esperava Hotmart (hotmartcareersbr)');
  assert.ok(slugs.includes('zupinnovation'), 'esperava Zup Innovation (zupinnovation)');
});

test('COMPANIES: não tem slugs duplicados', () => {
  const slugs = COMPANIES.map(c => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('COMPANIES: cada entrada tem slug e name não vazios', () => {
  for (const co of COMPANIES) {
    assert.ok(co.slug && co.slug.length > 0);
    assert.ok(co.name && co.name.length > 0);
  }
});
