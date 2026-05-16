# Jobcraft — Frontend

> Especificação do frontend: stack, estrutura de arquivos, rotas, componentes, estados e dados mock.

---

## 1. Stack

| Camada       | Tecnologia                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| Markup       | HTML5 semântico                                                            |
| Estilo       | CSS puro com **CSS custom properties** (tokens do `design.md`)             |
| Lógica       | JavaScript ES2020 vanilla (módulos via `<script type="module">`)           |
| Roteamento   | Hash-router próprio (`#/dashboard`, `#/jobs`, …)                           |
| Ícones       | `lucide` via CDN (`lucide.createIcons()`)                                  |
| Fontes       | Google Fonts: `Inter` + `Press Start 2P`                                   |
| Servidor     | Node `http` (sem npm install) na porta **8080**                            |
| Dados        | JSON estático em `public/data/*.json`                                      |

**Decisão:** sem framework para manter o setup zero-install. Toda a app é uma SPA hash-routed renderizada por funções `render<Page>(root, state)`.

---

## 2. Estrutura de pastas

```
Jobcraft/
├── design.md
├── frontend.md
├── server.js                      # Node http estático na porta 8080
└── public/
    ├── index.html                 # shell da SPA (sidebar + header + <main id="view">)
    ├── styles.css                 # tokens + componentes
    ├── app.js                     # bootstrap, router, store, render
    ├── assets/
    │   ├── logo.svg               # logo Jobcraft pixel-art
    │   └── favicon.svg
    └── data/
        ├── user.json
        ├── jobs.json
        ├── courses.json
        ├── achievements.json
        └── leaderboard.json
```

---

## 3. Rotas

| Hash             | Página         | Descrição                                             |
| ---------------- | -------------- | ----------------------------------------------------- |
| `#/dashboard`    | Dashboard      | Boas-vindas, KPIs, quests, vagas recomendadas         |
| `#/jobs`         | Vagas          | Lista + filtros + pipeline                            |
| `#/courses`      | Cursos         | Catálogo gamificado                                   |
| `#/certifications` | Certificações | Conquistadas e disponíveis                            |
| `#/achievements` | Conquistas     | Grid de badges                                        |
| `#/leaderboard`  | Ranking        | Top usuários da semana                                |
| `#/profile`      | Perfil         | Dados, nível, histórico                               |

Default: `#/dashboard`. Rota desconhecida → 404 amigável.

---

## 4. Shell (index.html)

```html
<body>
  <aside id="sidebar">
    [logo] [nav] [xp-bar do usuário]
  </aside>

  <div id="layout">
    <header id="topbar">
      [breadcrumb] [search global] [notifs] [user-badge à direita]
    </header>
    <main id="view"></main>
  </div>

  <div id="toast-root"></div>
</body>
```

- **User badge no canto superior direito**: avatar + nome + `Lv N` + dropdown (perfil, configurações, sair).
- Sidebar é colapsável (botão no topo da sidebar). Largura controlada por classe no `<body>`: `body.sidebar-collapsed`.

---

## 5. Componentes (funções de render)

| Função                          | Retorna                                             |
| ------------------------------- | --------------------------------------------------- |
| `Sidebar(state)`                | nav + xp bar                                        |
| `Topbar(state)`                 | busca + user                                        |
| `KpiCard({label, value, hint, tone})` | card KPI primário/secundário                  |
| `JobCard(job)`                  | card de vaga com match %                            |
| `CourseCard(course)`            | card de curso com progresso pixel                   |
| `AchievementBadge(badge)`       | escudo pixel                                        |
| `Pipeline(steps, current)`      | etapas horizontais                                  |
| `XPBar({current, next, level})` | barra retrô com porcentagem                         |
| `QuestList(quests)`             | checklist com recompensas                           |
| `Leaderboard(rows)`             | pódio + tabela                                      |
| `Toast(msg, kind)`              | toast (sucesso/level-up)                            |

Cada `render<Page>()` monta uma string HTML e injeta em `#view`, depois chama `lucide.createIcons()` e fica responsável por listeners locais via delegação em `#view`.

---

## 6. Estado (store leve)

```js
const store = {
  user: null,        // { name, role, level, xp, xpNext, avatar, streak }
  jobs: [],
  courses: [],
  achievements: [],
  leaderboard: [],
  ui: { route: '#/dashboard', sidebar: 'expanded', toast: null }
};
```

- Carregado uma vez no bootstrap a partir de `data/*.json`.
- Mutações disparam `render()` da rota atual.
- Persistência simples em `localStorage` para `ui.sidebar` e `user.xp`.

---

## 7. Gamificação no frontend

- Concluir uma quest do dashboard → `+XP`, animação da `XPBar` e Toast `LEVEL UP!` se passou de nível.
- Candidatar-se a uma vaga → `+50 XP` e card recebe selo “Aplicada”.
- Concluir um curso (botão demo) → `+250 XP` + badge desbloqueada + toast retrô.

---

## 8. Dados mock (formato)

### user.json
```json
{
  "name": "Vivaldo Júnior",
  "role": "Desenvolvedor Pleno",
  "level": 12,
  "xp": 1750,
  "xpNext": 2500,
  "streak": 7,
  "avatar": "VJ"
}
```

### jobs.json (item)
```json
{
  "id": "j-001",
  "title": "Engenheiro Front-end Pleno",
  "company": "Nintendo Cloud",
  "location": "Remoto · BR",
  "salary": "R$ 9.500 – 12.000",
  "tags": ["Remoto", "Pleno", "React"],
  "match": 92,
  "stage": "Triagem",
  "logo": "NC"
}
```

### courses.json (item)
```json
{
  "id": "c-001",
  "title": "React do zero ao avançado",
  "track": "Frontend",
  "tier": "ouro",
  "progress": 65,
  "xp": 250,
  "modules": 14,
  "hours": 24
}
```

### achievements.json (item)
```json
{
  "id": "a-001",
  "name": "Primeira candidatura",
  "icon": "sword",
  "unlocked": true,
  "rarity": "bronze"
}
```

### leaderboard.json (item)
```json
{ "rank": 1, "name": "Lara Silva", "xp": 12450, "level": 28 }
```

---

## 9. Convenções de classe CSS

- Prefixo `jc-` em utilidades (`jc-card`, `jc-kpi`, `jc-pixel`).
- Estados em `data-*`: `data-state="active"`, `data-rarity="gold"`.
- Sidebar item ativo via `aria-current="page"`.

---

## 10. Critérios de aceite visual

1. Sidebar em obsidiana com item ativo em roxo SNES e barra dourada à esquerda.
2. Header sticky com usuário à direita exibindo `Lv N` em fonte pixel.
3. Dashboard tem ao menos 4 KPIs (1 sólido roxo + 3 brancos).
4. Cards de vaga mostram match % colorido.
5. Cards de curso mostram barra de progresso pixel-style.
6. Conquistas formam grid com badges desbloqueadas vs. dessaturadas.
7. Ranking tem pódio top-3 estilizado.
8. Toast de level-up aparece ao clicar em uma quest do dashboard.
9. App responde em `http://localhost:8080`.
