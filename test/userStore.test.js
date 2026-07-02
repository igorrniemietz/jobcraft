'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MODULE_PATH = require.resolve('../src/userStore.js');

// userStore.js é um singleton com estado em módulo e leitura/escrita em disco
// no require(). Cada teste precisa de uma instância isolada apontando para
// um DATA_PATH próprio, senão o estado (xp, streak, activities) vaza entre testes.
function freshUserStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobcraft-userstore-test-'));
  process.env.DATA_PATH = dir;
  delete require.cache[MODULE_PATH];
  return require('../src/userStore.js');
}

test('addXP: ação "save" concede 10 XP, 1 coin e inicia streak em 1', () => {
  const userStore = freshUserStore();
  const result = userStore.addXP('save');
  assert.equal(result.earned, 10);
  assert.equal(result.xp, 10);
  assert.equal(result.coins, 1);
  assert.equal(result.streak, 1);
  assert.equal(result.leveledUp, false);
});

test('addXP: ação "quest" usa o amount informado pelo chamador', () => {
  const userStore = freshUserStore();
  const result = userStore.addXP('quest', 25);
  assert.equal(result.earned, 25);
  assert.equal(result.xp, 25);
});

test('addXP: mesma ação no mesmo dia não incrementa o streak de novo', () => {
  const userStore = freshUserStore();
  userStore.addXP('save');
  const second = userStore.addXP('apply');
  assert.equal(second.streak, 1);
});

test('addXP: streak incrementa quando a última atividade foi ontem, reseta se pular um dia', async (t) => {
  mock.timers.enable({ apis: ['Date'] });
  t.after(() => mock.timers.reset());

  const userStore = freshUserStore();
  userStore.addXP('save'); // dia 0 → streak 1

  mock.timers.tick(86400000); // +1 dia
  const dia1 = userStore.addXP('save');
  assert.equal(dia1.streak, 2);

  mock.timers.tick(2 * 86400000); // pula 1 dia (gap de 2 dias)
  const dia3 = userStore.addXP('save');
  assert.equal(dia3.streak, 1);
});

test('addXP: level-up em cascata acumula XP restante, aumenta xpNext em 1.25x e soma 100 coins por nível', () => {
  const userStore = freshUserStore();
  // xpNext inicial = 500; "offer" dá 500 xp -> exatamente 1 level up, xp restante = 0
  const result = userStore.addXP('offer');
  assert.equal(result.leveledUp, true);
  assert.equal(result.level, 2);
  assert.equal(result.xp, 0);
  assert.equal(result.xpNext, 625); // round(500 * 1.25)
  assert.equal(result.coins, 100 + Math.floor(500 / 10)); // 100 do level-up + 50 da ação
  assert.deepEqual(result.newLevels, [2]);
});

test('addXP: um único ganho de XP pode cruzar múltiplos níveis de uma vez', () => {
  const userStore = freshUserStore();
  const result = userStore.addXP('quest', 2000);
  assert.equal(result.leveledUp, true);
  assert.ok(result.level > 2, `esperava level > 2, obteve ${result.level}`);
  assert.ok(result.newLevels.length >= 2);
});

test('addXP: activities fica limitado às últimas 90 entradas', () => {
  const userStore = freshUserStore();
  for (let i = 0; i < 95; i++) userStore.addXP('quest', 1);
  const profile = userStore.getProfile();
  assert.equal(profile.activities.length, 90);
});

test('addXP: earned <= 0 não altera XP nem streak', () => {
  const userStore = freshUserStore();
  const result = userStore.addXP('quest', 0);
  assert.equal(result.earned, 0);
  assert.equal(result.leveledUp, false);
  assert.equal(userStore.getProfile().xp, 0);
});

test('updateStage: rejeita stage inválido e retorna null sem candidatura existente', () => {
  const userStore = freshUserStore();
  userStore.applyToJob('job-1');
  assert.equal(userStore.updateStage('job-1', 'estagio-invalido'), null);
  assert.equal(userStore.updateStage('job-inexistente', 'interview'), null);

  const updated = userStore.updateStage('job-1', 'interview');
  assert.equal(updated.stage, 'interview');
});

test('applyToJob: é idempotente — segunda chamada não sobrescreve appliedAt', () => {
  const userStore = freshUserStore();
  const first = userStore.applyToJob('job-2');
  const second = userStore.applyToJob('job-2');
  assert.equal(first.appliedAt, second.appliedAt);
});

test('toggleSaved: alterna entre salvo e não salvo', () => {
  const userStore = freshUserStore();
  assert.equal(userStore.isSaved('job-3'), false);
  assert.equal(userStore.toggleSaved('job-3'), true);
  assert.equal(userStore.isSaved('job-3'), true);
  assert.equal(userStore.toggleSaved('job-3'), false);
  assert.equal(userStore.isSaved('job-3'), false);
});

test('removeApplication: retorna false se não existe, true e remove se existe', () => {
  const userStore = freshUserStore();
  assert.equal(userStore.removeApplication('job-4'), false);
  userStore.applyToJob('job-4');
  assert.equal(userStore.removeApplication('job-4'), true);
  assert.deepEqual(userStore.listApplications(), {});
});
