#!/usr/bin/env node
// sync-hml.js — exporta vagas/cursos do container e deploya no Vercel HML
'use strict';
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const BASE = process.env.JOBCRAFT_URL || 'http://localhost:8080';

const VERCEL_PROJECT  = path.join(__dirname, '.vercel', 'project.json');
const ORG_ID          = 'team_SWdeWVznSwFRbWCJ6KWYZWlc';
const HML_PROJECT_ID  = 'prj_iJdpjWFQqThaqy6rvM3nUAIiOE9m';
const PROD_PROJECT_ID = 'prj_1cwyzzoudogAQHcW55B88yw3Hxsd';

// Pasta sem .git usada para deploy — evita erro "Not authorized" do Vercel
// ao tentar validar o commit do git contra o GitHub.
const DEPLOY_DIR = path.join(path.dirname(__dirname), 'jobcraft-deploy');

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

function setVercelProject(projectId, projectName) {
  fs.writeFileSync(VERCEL_PROJECT, JSON.stringify({ projectId, orgId: ORG_ID, projectName }), 'utf8');
}

async function main() {
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');

  // 1. Exportar vagas
  console.log('[sync-hml] buscando vagas...');
  const jobsData = await get(`${BASE}/api/jobs`);
  const jobs = jobsData.jobs || [];
  writeAtomic(path.join(__dirname, 'public', 'data', 'jobs.json'), jobs);
  console.log(`[sync-hml] ${jobs.length} vagas → public/data/jobs.json`);

  // 2. Exportar cursos
  console.log('[sync-hml] buscando cursos...');
  const coursesData = await get(`${BASE}/api/courses`);
  const courses = coursesData.courses || [];
  writeAtomic(path.join(__dirname, 'public', 'data', 'courses.json'), courses);
  console.log(`[sync-hml] ${courses.length} cursos → public/data/courses.json`);

  // 3. Git commit na branch hml
  try {
    const branch = git('git rev-parse --abbrev-ref HEAD');
    if (branch !== 'hml') {
      console.warn(`[sync-hml] aviso: branch atual é '${branch}', esperado 'hml'`);
    }
    git('git add public/data/jobs.json public/data/courses.json');
    const status = git('git status --porcelain public/data/jobs.json public/data/courses.json');
    if (!status) {
      console.log('[sync-hml] nenhuma mudança nos dados — sem commit');
    } else {
      git(`git commit -m "data(hml): sync ${ts} — ${jobs.length} vagas, ${courses.length} cursos"`);
      git('git push origin hml');
      console.log('[sync-hml] commit e push concluídos (branch hml)');
    }
  } catch (e) {
    console.error('[sync-hml] aviso git:', e.message);
  }

  // 4. Deploy no Vercel HML via pasta sem .git (sem .git o Vercel não tenta
  //    validar o commit contra o GitHub e o deploy vai direto)
  console.log('[sync-hml] sincronizando pasta de deploy...');
  execSync(`robocopy "${path.join(__dirname, 'public')}" "${path.join(DEPLOY_DIR, 'public')}" /MIR /NFL /NDL /NJH /NJS`, { stdio: 'pipe' });
  fs.writeFileSync(
    path.join(DEPLOY_DIR, 'vercel.json'),
    fs.readFileSync(path.join(__dirname, 'vercel.json'))
  );
  fs.mkdirSync(path.join(DEPLOY_DIR, '.vercel'), { recursive: true });
  fs.writeFileSync(
    path.join(DEPLOY_DIR, '.vercel', 'project.json'),
    JSON.stringify({ projectId: HML_PROJECT_ID, orgId: ORG_ID, projectName: 'jobcraft-hml' })
  );

  console.log('[sync-hml] enviando para o Vercel HML...');
  try {
    const out = execSync('vercel deploy --prod --yes', { cwd: DEPLOY_DIR, stdio: 'pipe' }).toString().trim();
    const urlMatch = out.match(/https:\/\/jobcraft-hml\.vercel\.app/);
    console.log(`[sync-hml] deploy HML concluído → ${urlMatch ? urlMatch[0] : out.split('\n').pop()}`);
  } catch (e) {
    console.error('[sync-hml] erro no vercel deploy HML:', e.stderr?.toString() || e.message);
  }
}

main().catch(e => {
  console.error('[sync-hml] erro:', e.message);
  process.exit(1);
});
