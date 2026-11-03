# Revisão — JobCraft (2026-11-03)

Escopo: `public/app.js`, `public/index.html`, `server.js`, `src/`, `public/data/*.json`.
`npm test`: 51 testes passando (50 + 1 novo, `safeJoin`).

## (a) Bugs / coisas erradas

### Corrigidos nesta branch (baixo risco)
| # | Onde | Problema | Correção |
|---|------|----------|----------|
| 1 | `src/safeJoin.js:5` (chamado em `server.js` rota estática) | `decodeURIComponent` lançava em URL malformada (`GET /%E0%A4%A`) → exceção não tratada **derrubava o processo Node inteiro** (DoS com uma requisição). Reproduzido. | try/catch → `null` (403); rejeita `\0`. Teste adicionado. |
| 2 | `public/app.js:2248` (Perfil → Linha do tempo) | `activities` é gravado com `unshift` (mais novo primeiro), mas a timeline usava `.slice(-5).reverse()` → mostrava as 5 atividades **mais antigas**. | `.slice(0, 5)` |
| 3 | `public/app.js:760` (`renderDashboard`) | `view.addEventListener('click', …)` a cada render do dashboard empilhava listeners em `#view` (persistente). | `view.onclick = …` |
| 4 | `src/jobStore.js:99` `getAll` | Com `?source=` o resultado vinha sem ordenar (só o caminho sem filtro ordenava por `updatedAt`). | ordena sempre |

### Encontrados, NÃO corrigidos
- `server.js:74` — `POST /api/jobs/sync` está sem autenticação (comentário diz "admin"); qualquer um dispara scraping em todas as fontes. Idem `POST /api/profile/xp`, `/api/saved`, `/api/applications` (estado global único, sem usuário).
- `src/userStore.js:~100` `addXP` — aceita `amount` arbitrário do cliente para qualquer ação desconhecida/`quest` (XP infinito). `server.js:36` `readBody` sem limite de tamanho.
- `server.js:98` e `:125` — mesmo problema do item 1: `decodeURIComponent(jobId)` em `POST /api/saved/%E0%A4%A` lança e derruba o servidor (não corrigido).
- `server.js` — handler sem try/catch global nem `process.on('uncaughtException')`; qualquer erro futuro derruba o servidor. Rotas `/api/*` desconhecidas caem no fallback SPA e devolvem `index.html` (200) em vez de 404 JSON.
- Estado duplicado: o frontend guarda tudo (XP, candidaturas, salvos, progresso) em **localStorage** (`app.js:4`), enquanto `userStore.js` + rotas `/api/profile|saved|applications` existem no servidor mas **o frontend não usa nenhuma** (`app.js` só chama `/api/jobs` e `/api/courses`). Código morto do lado do servidor / dados nunca sincronizam.
- `public/app.js:70` e `:176` (`refreshQuests`/`boot`): toast usa `q.done && !q.claimed`, mas o campo `claimed` nunca existe no objeto da quest → condição sempre verdadeira para quests já resgatadas (`done`); o `Set` evita repetição só dentro da sessão, então ao recarregar a página os toasts de "quest pronta" reaparecem para quests já resgatadas.
- `public/app.js:2542` `openUploadCertModal`: cert enviado só vive em memória (`store.certs.unshift`), some ao recarregar, e dá +100 XP ilimitado a cada envio (farm de XP).
- `public/app.js` (clique no curso, ~2370): cada clique soma +10% de progresso e XP — sem prova de estudo; também farmável. Progresso é persistido, mas vira conquista (`a-003`, `a-004`…).
- `public/app.js:2462` regra `a-008` depende de `cert-004` com `status === 'earned'`, mas ele é `in_progress` no JSON e nada no app muda isso → conquista impossível de desbloquear.
- Streak (`u.streak`, `app.js` `addXP` / `userStore.js`) só é recalculado quando ganha XP; se o usuário some 3 dias, o painel continua mostrando o streak antigo até a próxima ação.
- `localStorage` `jc-profile` guarda `name` (`app.js:195`). Quem já abriu o site antes pode continuar vendo o nome antigo salvo no navegador (não é do código; limpar `jc-profile`).
- Duplicação: `SOURCE_TTL` existe em `src/jobStore.js:7` e `public/app.js:1040`; lógica de XP/nível/streak duplicada em `app.js` e `userStore.js`.
- `public/app.js:678` texto fixo no hero: "fechar mais um módulo de OWASP?" (assume trilha AppSec para todo usuário).
- `public/app.js:2190` Leaderboard diz "reinicia toda segunda-feira" — não existe reset nem semana; é só lista fixa.
- `src/jobStore.js` `count(source)` ignora `job.sources` (dedup cross-source), contagem por fonte diverge do `getAll({source})`.

### Resultado do scan de hoje (passo 2)
- Vagas: 2536 (trampos 0, vagas 258, greenhouse 198, lever 115, remotar 1965 novas no store). Cursos: 32 (curated 22, freecodecamp 10).
- `trampos`: **desativado** no código — API exige autenticação (`src/collectors/trampos.js`).
- `lever`: `cloudwalk` deu **timeout** (15s, `src/http.js`); as demais empresas ok.
- `youtube`: **não rodou** — `secrets/youtube_api_key` está vazio (0 bytes), então `scheduler.js` pula a fonte sem logar nada (sugestão: logar "YOUTUBE_API_KEY ausente").
- Os stores são em memória; `public/data/jobs.json` e `courses.json` foram regravados a partir de `/api/jobs` e `/api/courses` (mesmo formato do `sync-push.js`, sem git/deploy).

## (b) O que é mockado / hardcoded e poderia virar dado real

| Item | Onde | Hoje | Sugestão |
|------|------|------|----------|
| Perfil | `public/data/user.json` | "Usuário 1", cargo e trilhas fixos | Cadastro/login (e-mail ou OAuth) + tabela `users`; editar perfil já existe na UI, só falta persistir no servidor (ver `PLANO_DB.md`). |
| Quests diárias | `app.js:7` `QUEST_DEFS` (+ `data/quests.json` órfão, nunca lido) | 5 quests fixas; "login" sempre pronta; progresso calculado de `activities` locais | Mover definição p/ servidor, rotacionar por dia/trilha, validar resgate no backend (hoje resgate é só localStorage). Apagar `quests.json` ou usá-lo. |
| Conquistas | `data/achievements.json` + regras em `app.js:2474` | 18 conquistas, regras no cliente, estado em localStorage | Avaliar regras no servidor a partir de eventos reais (candidatura, curso, streak); `a-008` ligada a certificação real. |
| Ranking | `data/leaderboard.json` | 10 NPCs com XP fixo + o usuário | Ranking por XP semanal de usuários reais (agregado no DB); manter NPCs só como preenchimento enquanto há poucos usuários; implementar o reset semanal prometido. |
| Certificações | `data/certifications.json` | catálogo com 2 "earned" (Security+, CEH), progresso e datas de prova inventados; KPI do dashboard conta essas | Separar **catálogo** (real: nome, emissor, custo) de **status do usuário** (começa vazio); upload de certificado persistido + validação de credencial (ex.: Credly). |
| Cursos — progresso | `app.js:84-110`, clique soma +10% | progresso manual local | Progresso real via playlist YouTube/freeCodeCamp (conclusão de vídeos) ou marcação manual com limite; XP único por curso. |
| Cursos — catálogo | `data/curated_courses.json`, curated/freecodecamp | 22 curados + 10 fCC; YouTube desligado (sem chave) | Ativar YouTube (chave), adicionar Coursera/dev.to (collectors já existem, desligados). |
| Stats do dashboard | `app.js:659` (KPIs, hero) | XP, streak e moedas vêm do localStorage; texto "OWASP" fixo | Ler de `/api/profile` (já existe no servidor) e trocar texto por trilha do usuário. |
| Heatmap de atividade | `buildActivityHeatmap` | real, mas só dos últimos 90 eventos locais | Usar histórico completo do servidor. |
| Match % das vagas | `calcDynamicMatch`, `TRACK_KWORDS` (`app.js:1138`) | heurística por palavras-chave nas skills digitadas | Usar skills do perfil + embeddings/TF-IDF contra a descrição da vaga. |
| Salário de mercado | `SALARY_REF` (`app.js:1158`) | tabela CLT 2025 fixa | Calcular a partir dos salários extraídos das vagas coletadas (há campo salário em algumas fontes) e/ou Glassdoor/Levels/Catho. |
| Notificações / Mensagens | `pushNotif`, `openMensagensModal` | só eventos locais do próprio app | Notificar vaga nova compatível com o perfil (diff entre syncs), mudança de status de candidatura. |
| Candidaturas / salvos | localStorage + `userStore` no servidor (não usado) | por navegador | Ligar o frontend às rotas `/api/saved` e `/api/applications` já existentes, por usuário. |
| Configurações / Docs | `openConfiguracoesModal`, `renderDocs` | texto/UI estáticos | Persistir preferências (tema já usa localStorage); docs ok como estático. |
