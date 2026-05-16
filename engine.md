# engine.md — Motor do JobCraft

## O que é
SPA gamificada de carreira em Tech & Segurança. Zero dependências de runtime: Node.js serve arquivos estáticos, toda a lógica roda no browser via JS vanilla.

## Fluxo de boot
1. `boot()` dispara `Promise.all` com 7 `fetchJSON` em paralelo
2. `store` é populado: `user`, `jobs`, `courses`, `certs`, `achievements`, `leaderboard`, `quests`
3. `paintUser()` preenche sidebar e HUD com dados do usuário
4. Hash-router despacha para `render<Page>()` conforme `location.hash`
5. Cada página injeta HTML em `#view` e vincula listeners via delegação

## Store
```js
store = { user, jobs, courses, certs, achievements, leaderboard, quests, ui }
```
- Carregado uma vez no boot a partir de `public/data/*.json`
- Mutações disparam re-render da rota atual
- `store.ui.jobSearch` persiste filtros enquanto o usuário navega

## Gamificação
| Ação | XP |
|---|---|
| Completar quest | valor da quest |
| Candidatar-se a vaga | +50 XP |
| Concluir curso | XP do curso |
- Level up: `while (xp >= xpNext)`, `xpNext` cresce 25% por nível
- Toast animado em toda ação de XP

## Servidor estático (`server.js`)
- Node `http` nativo — zero npm install
- Porta: `process.env.PORT || 8080`
- MIME types mapeados manualmente
- Path traversal bloqueado via `safeJoin`
- SPA fallback: qualquer rota desconhecida → `index.html`

## Docker
- `node:22-alpine` → WORKDIR /app → COPY → EXPOSE 8080 → `node server.js`
- Porta 8080 **não exposta** ao host — tráfego passa pelo Traefik
- Traefik recebe 443 e faz proxy para `jobcraft:8080` na rede interna

## Dados mock
- `public/data/user.json` — perfil do usuário logado
- `public/data/jobs.json` — lista de vagas com match %
- `public/data/courses.json` — catálogo com progresso
- `public/data/certifications.json` — conquistadas / em andamento / disponíveis
- `public/data/achievements.json` — badges
- `public/data/leaderboard.json` — ranking semanal
- `public/data/quests.json` — missões com progresso

## Arquivos de referência
- `design.md` — tokens de cor, tipografia, visual
- `frontend.md` — stack, rotas, componentes, critérios de aceite
- `check.md` — smoke tests antes de merge dev → main
