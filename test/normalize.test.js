'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  fromGreenhouse, fromLever, fromRemotar, fromVagas, fromTrampos,
  fromGupy, fromRemotive, fromAdzuna,
} = require('../src/normalize.js');

test('fromGreenhouse: extrai remoto e nível a partir de location/title', () => {
  const raw = {
    id: 123,
    title: 'Engenheiro de Segurança Sênior',
    location: { name: 'Remote - Brazil' },
    content: '<p>Precisa de Python e AWS</p>',
    absolute_url: 'https://boards.greenhouse.io/nubank/jobs/123?gh_src=abc',
    first_published: '2026-06-01T00:00:00Z',
  };
  const job = fromGreenhouse(raw, 'Nubank');
  assert.equal(job.id, 'gh-123');
  assert.equal(job.source, 'greenhouse');
  assert.equal(job.company, 'Nubank');
  assert.equal(job.location, 'Remoto · BR');
  assert.equal(job.level, 'Sênior');
  assert.equal(job.postedAt, '2026-06-01T00:00:00Z');
  assert.ok(job.tags.includes('python'));
  assert.ok(job.tags.includes('aws'));
  assert.equal(job.externalUrl, 'https://boards.greenhouse.io/nubank/jobs/123?gh_src=abc');
});

test('fromGreenhouse: remove "Brazil" de location não-remota', () => {
  const raw = { id: 1, title: 'Analista Pleno', location: { name: 'São Paulo, Brazil' }, content: '' };
  const job = fromGreenhouse(raw, 'Empresa X');
  assert.equal(job.location, 'São Paulo');
  assert.equal(job.level, 'Pleno');
});

test('fromLever: remove prefixo de código interno [Job-1234] do título', () => {
  const raw = {
    id: 'abc',
    text: '[Job-29384] Desenvolvedor Backend Júnior',
    categories: { location: 'São Paulo', commitment: 'Full-time' },
    createdAt: 1700000000000,
    hostedUrl: 'https://jobs.lever.co/empresa/abc',
  };
  const job = fromLever(raw, 'Empresa Y');
  assert.equal(job.title, 'Desenvolvedor Backend Júnior');
  assert.equal(job.level, 'Júnior');
  assert.equal(job.contract, 'CLT');
  assert.equal(job.id, 'lv-abc');
});

test('fromLever: commitment "Contract" mapeia para PJ', () => {
  const raw = { id: 'x', text: 'Consultor', categories: { location: 'Remote', commitment: 'Contract' } };
  const job = fromLever(raw, 'Empresa Z');
  assert.equal(job.contract, 'PJ');
  assert.equal(job.location, 'Remoto · BR');
});

test('fromRemotar: deriva contrato/nível a partir de jobTags e respeita expiredBySource', () => {
  const raw = {
    id: 55,
    title: 'Analista de SOC',
    company: { name: 'RemotarCo' },
    description: 'SIEM e Splunk',
    jobTags: [{ tag: { name: 'CLT' } }, { tag: { name: 'Sênior' } }],
    type: 'remote',
    createdAt: '2026-05-01T00:00:00Z',
    expired: true,
  };
  const job = fromRemotar(raw);
  assert.equal(job.contract, 'CLT');
  assert.equal(job.level, 'Sênior');
  assert.equal(job.location, 'Remoto · BR');
  assert.equal(job.expiredBySource, true);
  assert.equal(job.externalUrl, 'https://remotar.com.br/job/55');
});

test('fromRemotar: firstUrl corta segunda URL concatenada em externalLink', () => {
  const raw = {
    id: 9, title: 'Vaga', company: {}, jobTags: [],
    isExternalLink: true,
    externalLink: 'https://empresa.com/vaga https://outro.com/tracking',
  };
  const job = fromRemotar(raw);
  assert.equal(job.externalUrl, 'https://empresa.com/vaga');
});

test('fromVagas: remove prefixo numérico de agência e converte data BR → ISO', () => {
  const raw = {
    id: 7, title: '11223 - Analista de Dados', company: 'Empresa W',
    location: 'Localização não informada', date: '15/06/2026',
    href: '/vaga/analista-dados',
  };
  const job = fromVagas(raw);
  assert.equal(job.title, 'Analista de Dados');
  assert.equal(job.location, 'Brasil');
  assert.equal(job.postedAt, '2026-06-15');
  assert.equal(job.externalUrl, 'https://www.vagas.com.br/vaga/analista-dados');
});

test('fromTrampos: aceita chaves em português como fallback', () => {
  const raw = {
    id: 3, titulo: 'Pentester', empresa: 'Empresa PT',
    descricao: 'OSCP desejável', tipo: 'clt', cidade: 'Curitiba',
  };
  const job = fromTrampos(raw);
  assert.equal(job.title, 'Pentester');
  assert.equal(job.company, 'Empresa PT');
  assert.equal(job.contract, 'CLT');
  assert.equal(job.location, 'Curitiba');
});

test('fromGupy: detecta tagline como nome de empresa e usa slug da URL', () => {
  const raw = {
    id: 1, name: 'Dev Sênior',
    careerPageName: '🚀 VEM SER TOP #1 EM TECH 🚀',
    careerPageUrl: 'https://minha-empresa.gupy.io/vaga',
    isRemoteWork: true, publishedDate: '2026-06-10T00:00:00Z',
  };
  const job = fromGupy(raw);
  assert.equal(job.company, 'Minha Empresa');
  assert.equal(job.location, 'Remoto · BR');
});

test('fromRemotive: usa tags fornecidas diretamente (máx 6)', () => {
  const raw = { id: 2, title: 'Fullstack', company_name: 'Remotivo', tags: ['a','b','c','d','e','f','g'] };
  const job = fromRemotive(raw);
  assert.equal(job.tags.length, 6);
  assert.equal(job.location, 'Remoto · Global');
});

test('fromAdzuna: converte salário anual para faixa mensal em BRL', () => {
  const raw = {
    id: 4, title: 'Suporte N2', company: { display_name: 'AdzunaCo' },
    contract_type: 'permanent', salary_min: 60000, salary_max: 84000,
    location: { display_name: 'Brasil' },
  };
  const job = fromAdzuna(raw);
  assert.equal(job.contract, 'CLT');
  assert.match(job.salary, /R\$ 5\.000/);
});

test('extractTags (via fromGreenhouse): não duplica termos e limita a 8', () => {
  const raw = {
    id: 10, title: 'Python Python Python Developer',
    location: { name: 'Remote' },
    content: 'python javascript typescript java golang rust kotlin swift php ruby',
  };
  const job = fromGreenhouse(raw, 'X');
  assert.ok(job.tags.length <= 8);
  assert.equal(new Set(job.tags).size, job.tags.length);
});
