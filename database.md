# database.md — Plano de Implementação do Banco de Dados

Referência técnica para integrar PostgreSQL ao JobCraft quando o projeto sair do modo arquivo local para produção com banco ativo.

---

## Stack escolhida

| Componente | Escolha | Por quê |
|---|---|---|
| Banco | **PostgreSQL 16** | Robusto, suporte a JSONB, open-source, ótimo com Docker |
| Driver Node | **`pg` (node-postgres)** | Zero dependências extras, battle-tested, sem ORM |
| Migrations | **SQL puro** (`database/schema.sql`) | Sem abstração, fácil de auditar |
| Container | **postgres:16-alpine** | Imagem leve, pronta para docker compose |

---

## Schema — Tabelas

### `users`
```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  handle     TEXT UNIQUE NOT NULL,
  role       TEXT,
  tracks     JSONB DEFAULT '[]',
  avatar     TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `user_profile` — gamificação
```sql
CREATE TABLE user_profile (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp           INTEGER NOT NULL DEFAULT 0,
  level        INTEGER NOT NULL DEFAULT 1,
  xp_next      INTEGER NOT NULL DEFAULT 500,
  coins        INTEGER NOT NULL DEFAULT 0,
  streak       INTEGER NOT NULL DEFAULT 0,
  last_activity DATE,
  activities   JSONB   DEFAULT '[]',   -- últimas 90 ações [{type,xp,ts}]
  updated_at   TIMESTAMPTZ DEFAULT now()
);
```

### `jobs` — vagas scrapeadas (cache)
```sql
CREATE TABLE jobs (
  id              TEXT PRIMARY KEY,   -- source:hash (ex: gupy:abc123)
  source          TEXT NOT NULL,
  title           TEXT NOT NULL,
  company         TEXT,
  location        TEXT,
  salary          TEXT,
  contract        TEXT,
  level           TEXT,
  tags            JSONB DEFAULT '[]',
  external_url    TEXT,
  posted_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  expired_by_source BOOLEAN DEFAULT false,
  scraped_at      TIMESTAMPTZ DEFAULT now(),
  raw             JSONB DEFAULT '{}'  -- dados extras por source
);

CREATE INDEX idx_jobs_source    ON jobs(source);
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX idx_jobs_tags      ON jobs USING GIN(tags);
```

### `applications` — candidaturas do usuário
```sql
CREATE TYPE app_stage AS ENUM ('applied','reviewing','interview','offer','rejected');

CREATE TABLE applications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE SET NULL,
  stage      app_stage NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_apps_user ON applications(user_id);
```

### `user_achievements` — conquistas desbloqueadas
```sql
CREATE TABLE user_achievements (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,   -- ex: 'a-001'
  unlocked_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
```

### `leaderboard_weekly` — ranking semanal
```sql
CREATE TABLE leaderboard_weekly (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,       -- segunda-feira da semana
  xp_earned  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, week_start)
);

CREATE INDEX idx_lb_week ON leaderboard_weekly(week_start, xp_earned DESC);
```

> **Query para ranking:**
> ```sql
> SELECT u.name, u.handle, up.level, lb.xp_earned,
>        RANK() OVER (ORDER BY lb.xp_earned DESC) AS rank
> FROM leaderboard_weekly lb
> JOIN users u ON u.id = lb.user_id
> JOIN user_profile up ON up.user_id = lb.user_id
> WHERE lb.week_start = date_trunc('week', now())::date
> ORDER BY lb.xp_earned DESC
> LIMIT 50;
> ```

---

## Estratégia de migração (arquivo → banco)

### Fase 1 — Adicionar suporte ao banco sem quebrar o que existe
O `userStore.js` já persiste em `data/user-data.json`. A mudança será feita de forma gradual:

1. Ler `DATABASE_URL` no startup
2. Se vazio → continua usando arquivo (comportamento atual)
3. Se preenchido → usa PostgreSQL

```js
// src/db.js (arquivo novo a criar)
const { Pool } = require('pg');

let _pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

module.exports = { getPool };
```

### Fase 2 — Migrar userStore.js
Substituir as funções de leitura/escrita de arquivo por queries SQL, mantendo a interface pública idêntica (os `require()` em `server.js` não mudam).

```js
// Exemplo: applyToJob com DB
async function applyToJob(userId, jobId) {
  const pool = getPool();
  if (!pool) return _fileApplyToJob(jobId); // fallback arquivo

  const { rows } = await pool.query(
    `INSERT INTO applications (user_id, job_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, job_id) DO NOTHING
     RETURNING *`,
    [userId, jobId]
  );
  return rows[0];
}
```

### Fase 3 — Script de migração única
Roda uma vez para importar `data/user-data.json` → PostgreSQL:

```bash
node database/migrate-from-file.js
```

O script:
1. Lê `data/user-data.json`
2. Cria usuário padrão se não existir
3. Insere profile, applications e achievements no banco
4. Renomeia o arquivo para `user-data.json.migrated`

---

## Mudanças no servidor quando o banco entrar

### `server.js`
- Chamar `await db.connect()` antes de `server.listen()`
- Passar `userId` nas rotas de perfil/candidaturas (hoje sem autenticação)
- Adicionar rota `GET /api/leaderboard` que consulta a view semanal

### `src/userStore.js`
- Todas as funções viram `async`
- Implementar lógica dual: arquivo (sem DB) vs postgres (com DB)
- Adicionar `getUserId()` para autenticação futura

### Leaderboard
- `buildLeaderboard()` no frontend passa a chamar `GET /api/leaderboard`
- Retorno do endpoint: `{ users: [...], week: '2026-05-19', total: 42 }`
- O frontend já está preparado — `renderLeaderboard()` só usa `store.leaderboard`

---

## Ativando o Banco — passo a passo

```bash
# 1. Preencher .env
cp .env.example .env
# Editar .env → preencher DATABASE_URL e DB_PASSWORD

# 2. Criar pasta com schema SQL
mkdir database
# Criar database/schema.sql com as tabelas acima
# Criar database/seed.sql com dados iniciais (achievements, etc.)

# 3. Descomentar serviço 'db' no docker-compose.yml

# 4. Subir tudo
docker compose up -d

# 5. Aguardar o banco inicializar (~10s)
docker compose logs db

# 6. Rodar migração (se houver dados locais)
docker compose exec jobcraft node database/migrate-from-file.js
```

---

## Variáveis de ambiente necessárias

| Variável | Exemplo | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://jobcraft:senha@db:5432/jobcraft` | Connection string completa |
| `DB_USER` | `jobcraft` | Usuário do Postgres |
| `DB_PASSWORD` | `s3cr3t` | Senha do Postgres |

---

## Ordem de implementação recomendada

- [ ] **1.** Criar `src/db.js` com pool e detecção de `DATABASE_URL`
- [ ] **2.** Criar `database/schema.sql` com todas as tabelas
- [ ] **3.** Criar `database/seed.sql` com achievements e usuário padrão
- [ ] **4.** Criar `database/migrate-from-file.js`
- [ ] **5.** Migrar `userStore.js` para dual mode (arquivo / DB)
- [ ] **6.** Migrar `jobStore.js` — jobs persistidos no banco entre restarts
- [ ] **7.** Adicionar `GET /api/leaderboard` no servidor
- [ ] **8.** Atualizar frontend — trocar localStorage por chamadas à API
- [ ] **9.** Descomentar serviço `db` no `docker-compose.yml`
- [ ] **10.** Testar migração de dados locais → banco

---

## Diagrama de dados

```
users ─────────────────┐
  │                    │
  ├── user_profile     │
  ├── applications ────┤── jobs
  ├── user_achievements│
  └── leaderboard_weekly
```
