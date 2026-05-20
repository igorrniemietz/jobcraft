#!/usr/bin/env node
// sync-push.js — exporta vagas/cursos do container e faz git push para o Vercel redeployar
'use strict';
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const BASE = process.env.JOBCRAFT_URL || 'http://localhost:8080';

function get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON inválido em ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function writeAtomic(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function git(cmd) {
  return execSync(cmd, { cwd: __dirname, stdio: 'pipe' }).toString().trim();
}

async function main() {
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');

  // 1. Exportar vagas
  console.log('[sync-push] buscando vagas...');
  const jobsData = await get(`${BASE}/api/jobs`);
  const jobs = jobsData.jobs || [];
  writeAtomic(path.join(__dirname, 'public', 'data', 'jobs.json'), jobs);
  console.log(`[sync-push] ${jobs.length} vagas → public/data/jobs.json`);

  // 2. Exportar cursos
  console.log('[sync-push] buscando cursos...');
  const coursesData = await get(`${BASE}/api/courses`);
  const courses = coursesData.courses || [];
  writeAtomic(path.join(__dirname, 'public', 'data', 'courses.json'), courses);
  console.log(`[sync-push] ${courses.length} cursos → public/data/courses.json`);

  // 3. Git commit + push
  try {
    git('git add public/data/jobs.json public/data/courses.json');
    const status = git('git status --porcelain public/data/jobs.json public/data/courses.json');
    if (!status) {
      console.log('[sync-push] nenhuma mudança nos dados — sem commit');
      return;
    }
    git(`git commit -m "data: sync ${ts} — ${jobs.length} vagas, ${courses.length} cursos"`);
    git('git push origin dev');
    console.log('[sync-push] push concluído — Vercel redeploya em ~1 min');
  } catch (e) {
    console.error('[sync-push] erro no git:', e.message);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('[sync-push] erro:', e.message);
  process.exit(1);
});
