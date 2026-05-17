# Jobcraft — Roadmap de Melhorias

> Plano elaborado por 4 agentes especializados em 2026-05-17.

---

## Implementado nesta sessão

- [x] Campo `postedAt` (ISO) em todos os normalizers
- [x] Campos `expiresAt` e `expiredBySource` (Remotar expõe nativo)
- [x] Filtro de data de publicação: `Todas | Hoje | 7 dias | 30 dias`
- [x] Badge **NOVA** pulsante (verde) para vagas postadas hoje
- [x] Badge **ENCERRADA** (vermelho) + dimming para vagas expiradas
- [x] Toggle "Ocultar vagas encerradas" (ativo por padrão)
- [x] TTL por fonte: Remotar 45d · Greenhouse/Lever 30d · Vagas.com 21d
- [x] `purge()` no store: remove vagas expiradas após 3 dias de retenção

---

## Fase 1 — Curto prazo (próximos passos)

### 1.1 Expandir empresas BR no Greenhouse
```
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
```
Slugs prioritários para testar: `ifood`, `ebanx`, `creditas`, `gympass`, `wellhub`,
`vtex`, `wildlifestudios`, `loft`, `pismo`, `hotmart`, `loggi`, `belvo`, `dock`.

### 1.2 Expandir empresas BR no Lever
```
GET https://api.lever.co/v0/postings/{slug}?mode=json
```
Slugs: `zup`, `neon`, `ciandt`, `corabank`, `jungledevs`, `contaazul`.

### 1.3 Persistência leve (JSON atômico)
- Separar `jobs.json` (regenerado a cada sync) de `user-data.json` (saved/applied/perfil)
- Escrita atômica: `writeFileSync(tmp) + renameSync(tmp, path)`
- Volume Docker: `./data:/app/data`

### 1.4 Toggle "Salvar vaga"
- `POST /api/jobs/:id/save` → persiste em `user-data.json`
- Badge ⚔ Guardar no card com estado gold quando salvo
- Optimistic update no frontend

---

## Fase 2 — Médio prazo

### 2.1 Notificações SSE (Server-Sent Events)
- `GET /api/events` — conexão persistente, sem lib extra
- Backend notifica clientes quando sync encontra vagas com match > 60%
- Toast temático RPG no frontend: "N novas vagas compatíveis!"
- Badge numérico no título da aba

### 2.2 Marcar como Candidatado + Kanban
- 5 colunas: `Candidatado → Em Análise → Entrevista → Oferta → Rejeitado`
- Drag-and-drop nativo (API HTML5, zero libs)
- `PATCH /api/applications/:id/stage`
- Migrar persistência para SQLite (`better-sqlite3`) quando kanban exigir queries

### 2.3 Workable (nova fonte)
- API pública sem auth: `https://apply.workable.com/{slug}/api/v3/jobs`
- Empresas BR prováveis: Semantix, Neoway, algumas consultorias

---

## Fase 3 — Gamificação

### 3.1 Sistema de XP e Níveis
| Ação | XP |
|---|---|
| Salvar vaga | 10 |
| Candidatar | 50 |
| Entrevista | 150 |
| Oferta | 500 |
| Streak diário | 25 × multiplicador |

Níveis: Novato → Aprendiz → Investigador → Analista → Especialista → Sênior → Arquiteto

### 3.2 Streak de Candidaturas
- Multiplicador cresce até 3× com dias consecutivos
- Quebra o streak se pular um dia

### 3.3 Dashboard do Agente
- Barra de XP/nível
- Progresso por trilha (AppSec, SOC, Ethical Hacking)
- Heatmap de atividade (últimos 30 dias)
- Conquistas desbloqueáveis

### 3.4 Filtros específicos de InfoSec
- Especialidade: SOC/Blue Team | Pentest/Red Team | GRC | AppSec | Cloud Security
- Certificação detectada na descrição: OSCP, CEH, CISSP, ISO 27001, CompTIA

---

## Fase 4 — Longo prazo

### 4.1 Web Push Notifications
- Service Worker + VAPID keys
- Notifica mesmo com aba fechada quando sync encontra vagas compatíveis

### 4.2 Onboarding de Perfil
- Modal na primeira visita (sem cadastro): área + senioridade + regime
- Salvo em localStorage, pré-configura filtros e score de relevância

### 4.3 Trampos.co
- Investigar: sitemap.xml, RSS feed (`/oportunidades.rss`), `__NEXT_DATA__`
- Alternativa: Puppeteer + Chromium Alpine

### 4.4 Ashby GraphQL (Nuvemshop, Merama)
- Replay de query: `POST https://jobs.ashbyhq.com/api/non-user-graphql`
- Frágil (undocumented), baixa prioridade

---

## Fontes bloqueadas (requer Puppeteer)

| Fonte | Bloqueio | Solução |
|---|---|---|
| Catho | Akamai TLS fingerprint | Puppeteer + Chromium |
| Indeed BR | Cloudflare Bot Management | Proxy residencial |
| Trampos.co | API autenticada | Puppeteer ou API key |
| LinkedIn | Cloudflare + detecção comportamental | Descartado |
