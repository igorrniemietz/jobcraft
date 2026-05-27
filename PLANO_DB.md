# JobCraft — Plano de implementação: Banco de dados + Nick Privacy

> Criado em: 2026-05-27

---

## Contexto atual

| Dado | Onde está hoje | Problema |
|---|---|---|
| XP / level / streak / quests | `localStorage` | Preso ao browser — perde ao trocar de máquina |
| Vagas salvas / candidaturas | `localStorage` + `userStore.js` (JSON local) | JSON some no Vercel (serverless é stateless) |
| Nome / função do usuário | `user.json` hardcoded | Mock — não tem como editar |
| Leaderboard | `leaderboard.json` (10 NPCs) | Sem players reais |
| Nick no ranking | Não implementado | — |

---

## Stack escolhida: Supabase

**Por quê Supabase:**
- Free tier: 500 MB storage, 2 GB banda, Auth inclusa
- Auth nativa (magic link ou Google) — resolve o `user.json` hardcoded
- REST API auto-gerada — frontend lê/escreve **sem alterar o `server.js`**
- Row Level Security — a anon key pode ficar exposta no JS
- Real-time subscriptions — leaderboard pode atualizar ao vivo
- Funciona com Vercel serverless sem mudança de infra

**Vai ter custo?** Não. O plano gratuito aguenta bem um portfólio:
| O que inclui | Limite gratuito |
|---|---|
| Banco de dados | 500 MB |
| Usuários | 50.000/mês |
| Largura de banda | 5 GB/mês |
| Auth (login) | inclusa |

> Projetos inativos por mais de 1 semana ficam "pausados" — reativa com 1 clique.

---

## Etapa 0 — Nick escondido no ranking *(~30 min, sem banco)*

Puramente frontend. Sem banco de dados. Pode ser feito agora.

**O que muda:**
- Toggle "Ocultar meu nick no ranking" na tela de Perfil
- Salva `nickHidden: true` no `localStorage` (depois no Supabase)
- No Leaderboard: se `store.user.nickHidden` → aplica máscara

**Lógica de máscara:**
```
"Igor Reis"   → "I*** R***"
"CloudStr1fe" → "C**********"
```
NPCs nunca são mascarados.

**Arquivos:** `app.js` → `renderProfile()` + `renderLeaderboard()` + `buildLeaderboard()`

---

## Etapa 1 — Login + perfil editável *(~3h)*

Elimina o nome hardcoded "Igor Reis" no `user.json`.

**Tabela Supabase:**
```sql
profiles (
  id              uuid references auth.users primary key,
  name            text not null,
  handle          text unique not null,
  role            text,
  tracks          text[],
  nick_hidden     boolean default false,
  avatar_initials text,
  created_at      timestamptz default now()
)
```

**Fluxo:**
1. Usuário acessa → `supabase.auth.getSession()`
2. Sem sessão → modal de onboarding (nome, nick, trilha)
3. Com sessão → carrega `profiles`, popula `store.user`
4. "Editar perfil" → `UPDATE profiles` pelo SDK do Supabase

---

## Etapa 2 — Progresso salvo na nuvem *(~4h)*

XP, level, streak, conquistas e quests ficam no banco. Funciona em qualquer dispositivo.

**Tabelas:**
```sql
gamification (
  user_id       uuid references profiles primary key,
  xp            int default 0,
  level         int default 1,
  xp_next       int default 500,
  coins         int default 0,
  streak        int default 0,
  last_activity date
)

activities (
  id       bigserial primary key,
  user_id  uuid references profiles,
  type     text,
  xp       int,
  ts       timestamptz default now()
  -- mantém últimas 90 por user (trigger ou cleanup)
)

claimed_quests (
  user_id   uuid references profiles,
  day       date,
  quest_ids text[],
  primary key (user_id, day)
)

unlocked_achievements (
  user_id        uuid references profiles,
  achievement_id text,
  unlocked_at    timestamptz default now(),
  primary key (user_id, achievement_id)
)
```

**Estratégia de sync:**
- Boot: carrega Supabase → popula `store.user` → salva no `localStorage` como cache offline
- Ação (XP, quest, achievement): escreve no Supabase E atualiza `localStorage`
- Se offline: `localStorage` mantém dados locais, sync no próximo boot

---

## Etapa 3 — Leaderboard real *(~2h)*

Os NPCs ficam como placeholders. Players reais entram naturalmente.

**View Supabase (calculada, não tabela):**
```sql
create view leaderboard_view as
  -- players reais
  select p.id, p.name, p.handle, p.nick_hidden, p.tracks[1] as track,
         g.xp, g.level, false as npc
  from profiles p join gamification g on g.user_id = p.id
union all
  -- NPCs (tabela seed)
  select null, name, handle, false, track, xp, level, true
  from npc_players
order by xp desc;
```

**O que muda no frontend:**
- `boot()` busca `supabase.from('leaderboard_view').select()` em vez de `fetchJSON('/data/leaderboard.json')`
- Nick oculto: se `r.nick_hidden && !r.npc` → aplica máscara
- `buildLeaderboard()` deixa de injetar o player manualmente (já vem da view)
- Opcional: live update com `supabase.channel('leaderboard').on('postgres_changes', ...)`

**NPCs:** viram rows seed na tabela `npc_players` com `npc: true`. Quando um player real ultrapassar um NPC em XP, ele cai naturalmente.

---

## Etapa 4 — Vagas salvas + Candidaturas no banco *(~2h)*

**Tabelas:**
```sql
saved_jobs (
  user_id  uuid references profiles,
  job_id   text,
  saved_at timestamptz default now(),
  primary key (user_id, job_id)
)

applications (
  user_id    uuid references profiles,
  job_id     text,
  stage      text check (stage in ('applied','reviewing','interview','offer','rejected')),
  applied_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, job_id)
)
```

Elimina o `userStore.js` inteiro (ou passa a ser um wrapper do Supabase client).

---

## Ordem de execução

| Ordem | Etapa | Esforço | Resultado |
|---|---|---|---|
| **Agora** | 0 — Nick privacy | ~30 min | Leaderboard com opção de privacidade |
| **1º** | 1 — Auth + Onboarding | ~3h | Perfil editável, sem `user.json` mock |
| **2º** | 2 — Gamificação | ~4h | Progresso real, multi-device |
| **3º** | 3 — Leaderboard real | ~2h | Ranking com players + NPCs |
| **4º** | 4 — Saved/Apps | ~2h | Candidaturas persistidas na nuvem |

---

## Arquivos principais afetados

| Arquivo | O que muda |
|---|---|
| `public/app.js` | Boot, renderProfile, renderLeaderboard, buildLeaderboard, addXP, claimQuest |
| `src/userStore.js` | Vira wrapper do Supabase client |
| `server.js` | Rotas `/api/profile`, `/api/saved`, `/api/applications` podem ser removidas |
| `public/data/leaderboard.json` | Substituído pela view do Supabase |
| `public/data/user.json` | Substituído pelo onboarding + tabela profiles |
