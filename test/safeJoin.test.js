'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { safeJoin } = require('../src/safeJoin.js');

function makeRootWithEvilSibling() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'jobcraft-safejoin-test-'));
  const root = path.join(base, 'public');
  const evil = path.join(base, 'public-evil');
  fs.mkdirSync(root);
  fs.mkdirSync(evil);
  fs.writeFileSync(path.join(evil, 'secret.txt'), 'segredo');
  fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
  return { root, evil };
}

test('safeJoin: serve arquivo normal dentro da raiz', () => {
  const { root } = makeRootWithEvilSibling();
  const result = safeJoin(root, '/index.html');
  assert.equal(result, path.join(root, 'index.html'));
});

test('safeJoin: bloqueia traversal direto com ../../', () => {
  const { root } = makeRootWithEvilSibling();
  assert.equal(safeJoin(root, '/../../server.js'), null);
});

test('safeJoin: bloqueia traversal com %2e%2e%2f (URL-encoded)', () => {
  const { root } = makeRootWithEvilSibling();
  assert.equal(safeJoin(root, '/%2e%2e%2f%2e%2e%2fserver.js'), null);
});

test('safeJoin: bloqueia bypass via diretório irmão que compartilha prefixo (CWE-22)', () => {
  // root = ".../public", evil = ".../public-evil" — "public-evil" começa com a
  // string "public", então uma checagem ingênua com target.startsWith(root)
  // deixaria passar "../public-evil/secret.txt" como se estivesse dentro da raiz.
  const { root, evil } = makeRootWithEvilSibling();
  const result = safeJoin(root, '/../public-evil/secret.txt');
  assert.equal(result, null, `esperava null, mas vazou para fora da raiz: ${result}`);
  assert.ok(fs.existsSync(path.join(evil, 'secret.txt')), 'sanity check: o arquivo irmão realmente existe');
});

test('safeJoin: aceita a própria raiz (edge case do path.sep)', () => {
  const { root } = makeRootWithEvilSibling();
  assert.equal(path.normalize(safeJoin(root, '/')), path.normalize(root + path.sep));
});
