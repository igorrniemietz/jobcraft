# JobCraft

Plataforma **gamificada de carreira** em Tech & Segurança: o usuário evolui skills, ganha XP, completa quests, desbloqueia conquistas e recebe recomendações de vagas e cursos — como um RPG da própria trajetória profissional.

**🔗 Demo ao vivo:** https://jobcraft-three.vercel.app

## O que é

SPA (single-page app) com HUD de personagem, busca de vagas, trilhas de cursos/certificações, conquistas, quests e leaderboard. Toda a lógica de jogo (XP, níveis, progressão) roda no browser.

## Stack

- **JavaScript vanilla (SPA)** com hash-router próprio e store central — **zero dependência de runtime** (Node.js só serve os estáticos).
- **Docker** + **Docker Compose** (dev e prod) com **secrets nativos** (`/run/secrets`).
- Backend/scraper de vagas em Python (planejado/parcial — ver `SCRAPER_PLAN.md`).
- Testes com o runner nativo do Node (`node --test`).
- Deploy na **Vercel**; branches `dev` → `hml` → `prod`.

## Destaques técnicos

- **Boot paralelo**: `Promise.all` de 7 `fetchJSON` popula o store uma vez; mutações re-renderizam só a rota atual.
- **Docker secrets** montados em `/run/secrets` (sem senha no ambiente) — padrão de segurança reaproveitado em outros projetos.
- Arquitetura documentada em `engine.md`, `design.md`, `frontend.md`, `database.md`.

## Como rodar

```bash
# estático (dev rápido)
npm start            # node server.js

# com Docker
docker compose -f docker-compose.dev.yml up
```

Testes:

```bash
npm test             # node --test test/*.test.js
```

## Documentação

`engine.md` (motor), `design.md` / `frontend.md` (UI), `database.md` / `PLANO_DB.md` (dados), `ROADMAP.md`, `check.md` (validação manual).
