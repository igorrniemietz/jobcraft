# Jobcraft — Design System

> Plataforma gamificada de busca de empregos com cursos e certificações. A identidade visual mistura o **clima retrô do Super Nintendo** (paleta lavanda/roxo profundo) com a sobriedade de um SaaS moderno (cards limpos, tipografia legível, dados em destaque).

---

## 1. Princípios

1. **Retrô, mas leve.** Pixel-art e detalhes 8-bit aparecem em momentos pontuais (logo, conquistas, XP, level-up). O dia-a-dia é limpo.
2. **Conteúdo em primeiro lugar.** Vagas, cursos e progresso ocupam o palco principal. Decoração não compete com dado.
3. **Recompensa visível.** Toda ação relevante (candidatura, módulo concluído, certificado) gera feedback gamificado: XP, badges, sons sutis, animação.
4. **Hierarquia em três níveis.** Sidebar (navegação) → Header (contexto + usuário) → Conteúdo (cards + listas).

---

## 2. Paleta de cores

Extraída diretamente do print de referência (5 faixas SNES) e expandida com tokens semânticos.

### 2.1 Cores primárias (da paleta original)

| Token              | Hex       | Uso                                          |
| ------------------ | --------- | -------------------------------------------- |
| `--snes-lavender`  | `#B8B5E1` | Acento claro, hovers, fundos suaves          |
| `--snes-royal`     | `#5B4FB3` | **Cor de marca.** Sidebar ativa, CTAs, KPIs  |
| `--snes-mauve`     | `#8E8A99` | Textos secundários, ícones inativos          |
| `--snes-pearl`     | `#D0CDD1` | Fundos de card, divisórias                   |
| `--snes-obsidian`  | `#1F1B25` | Sidebar, texto principal sobre claro         |

### 2.2 Cores derivadas

| Token                   | Hex       | Uso                                |
| ----------------------- | --------- | ---------------------------------- |
| `--snes-royal-deep`     | `#3F348A` | Sombra/hover do roxo principal     |
| `--snes-royal-light`    | `#7A6FE0` | Gradiente de KPI, brilho de botão  |
| `--bg`                  | `#F5F4FA` | Fundo da página                    |
| `--surface`             | `#FFFFFF` | Cards                              |
| `--surface-2`           | `#ECEAF3` | Cards alternados, inputs           |
| `--border`              | `#E2DFEC` | Bordas finas                       |

### 2.3 Cores semânticas (status)

| Token        | Hex       | Uso                              |
| ------------ | --------- | -------------------------------- |
| `--success`  | `#4ADE80` | Ativo, aprovado, online          |
| `--warning`  | `#F59E0B` | Pendente, em análise             |
| `--danger`   | `#EF4444` | Rejeitado, erro                  |
| `--info`     | `#38BDF8` | Dicas, tutoriais                 |
| `--xp-gold`  | `#FACC15` | XP, moedas, conquistas raras     |

### 2.4 Regras de uso

- **Sidebar:** sempre `--snes-obsidian` com item ativo em `--snes-royal`.
- **CTAs primários:** gradiente `--snes-royal → --snes-royal-light`.
- **KPIs/badges principais:** card com `--snes-royal` sólido e número em branco.
- **Cards normais:** `--surface` com borda `--border`.
- **Textos:** título `--snes-obsidian`, corpo `#3B3744`, secundário `--snes-mauve`.

---

## 3. Tipografia

| Papel        | Família                  | Peso        | Observação                            |
| ------------ | ------------------------ | ----------- | ------------------------------------- |
| UI / corpo   | `Inter`                  | 400 / 500   | Legibilidade em dashboards            |
| Títulos      | `Inter`                  | 600 / 700   |                                       |
| Wordmark / pixel-art | `"Press Start 2P"` | 400 | **Só em logo, XP, conquistas, level** |
| Numérico KPI | `Inter`                  | 700         | tabular-nums                          |

Escala:

```
xs   12px / 16
sm   14px / 20
base 16px / 24
lg   18px / 26
xl   22px / 28
2xl  28px / 34
3xl  36px / 42
pixel-sm  10px (Press Start 2P)
pixel-md  14px
pixel-lg  22px
```

---

## 4. Espaçamento e raio

Escala base 4px. Raios:
- `--radius-sm` 6px (chips, badges)
- `--radius-md` 12px (cards, botões)
- `--radius-lg` 18px (KPI cards, modais)
- `--radius-pixel` 0px (containers retrô / barra de XP)

Sombras:
- `--shadow-sm` `0 1px 2px rgba(31,27,37,.06)`
- `--shadow-md` `0 6px 24px rgba(63,52,138,.10)`
- `--shadow-pixel` `4px 4px 0 #1F1B25` (cards de conquista retrô)

---

## 5. Layout global

```
┌─────────┬──────────────────────────────────────────────┐
│         │  HEADER (busca · ações · usuário à direita)  │
│ SIDEBAR ├──────────────────────────────────────────────┤
│         │                                              │
│  72/240 │           CONTEÚDO (cards + listas)          │
│   px    │                                              │
└─────────┴──────────────────────────────────────────────┘
```

- **Sidebar fixa**, 240px expandida / 72px colapsada, fundo `--snes-obsidian`.
- **Header sticky** 72px de altura, fundo `--bg` com borda inferior `--border`.
- **Usuário no canto superior direito**: avatar (40px) + nome + nível + dropdown.
- **Grid de conteúdo**: 12 colunas, gap 24px, max-width 1440px.

---

## 6. Componentes-chave

### 6.1 Sidebar
- Logo Jobcraft no topo (com wordmark em pixel quando expandida).
- Itens: ícone + label. Item ativo recebe pílula `--snes-royal` com borda lateral esquerda em `--xp-gold`.
- Hover: fundo `rgba(255,255,255,.06)`.
- Rodapé da sidebar mostra **barra de XP do usuário** (faixa fina, gradiente lavanda → dourado).

### 6.2 Header
- Esquerda: breadcrumb / título da página.
- Centro: campo de busca global (placeholder “Procurar vagas, cursos, empresas…”).
- Direita: botão de notificações, botão de loja de XP, **bloco do usuário** (avatar + nome + nível `Lv 12`).

### 6.3 Card KPI
- Versão sólida (roxo) para destaque principal: número grande branco, label em caixa-alta, ícone pixel-art no canto.
- Versão clara (branco) para métricas secundárias, número em `--snes-royal`.

### 6.4 Card de Vaga
- Avatar/logo da empresa, título da vaga, empresa, localização, salário, tags (remoto, sênior…), botão “Candidatar” + botão favoritar.
- Barra fina inferior com **match %** (cor varia: 0–40 vermelho, 41–70 amarelo, 71–100 verde).

### 6.5 Card de Curso (gamificado)
- Capa colorida com badge de dificuldade (Bronze / Prata / Ouro / Diamante).
- Barra de progresso pixel-style com chunks de 8px.
- XP que o curso concede, ex.: `+ 250 XP`.
- Selo de “Certificado emitido” quando concluído.

### 6.6 Pipeline de candidaturas (referência do print 2)
- Etapas horizontais: Inscrito → Triagem → Entrevista → Teste técnico → Oferta → Contratado.
- Indicador de etapa atual em `--snes-royal`, etapas concluídas em `--success`, futuras em `--snes-mauve`.

### 6.7 Conquistas (Achievements)
- Grid de badges 8-bit. Cada badge é um ícone pixel num escudo lavanda/roxo. Bloqueadas ficam dessaturadas.

### 6.8 Toast / Level-up
- Toast roxo escuro com borda pixel dourada, mensagem em `Press Start 2P`, ex.: `LEVEL UP! Lv 12 → Lv 13`.

---

## 7. Iconografia

- **Linha (Lucide)** para UI normal: home, briefcase, graduation-cap, award, trophy, bell, search, settings.
- **Pixel-art SVG custom** para gamificação: moeda XP, espada, escudo, baú, coroa.
- Tamanho padrão 20px na sidebar / 16px em chips.

---

## 8. Movimento

- Transições suaves de 150ms (`cubic-bezier(.2,.7,.3,1)`) em hover, foco e expandir.
- Barra de XP cresce com `transition: width 800ms ease-out`.
- Level-up dispara confetes pixelados + leve shake do badge.
- Hover de card: elevação `--shadow-md` + translação `-2px` no eixo Y.

---

## 9. Acessibilidade

- Contraste mínimo 4.5:1 para texto. Roxo `--snes-royal` em fundo claro ✓.
- Foco visível com anel `--snes-royal-light` 2px.
- Press Start 2P **nunca** em texto longo (apenas etiquetas curtas).
- Estados não dependem só de cor — usar ícone + texto.

---

## 10. Gamificação — regras visuais

| Elemento     | Visual                                                       |
| ------------ | ------------------------------------------------------------ |
| **XP**       | Moeda dourada pixel + número `+250 XP`                       |
| **Níveis**   | Badge circular com numeral, borda gradiente por tier         |
| **Streak**   | Chama pixel-art ao lado do número de dias                    |
| **Quests**   | Card com check-list pixel; recompensa em XP e/ou badge       |
| **Ranking**  | Top-3 com molduras ouro/prata/bronze; pixel-shadow nos cards |

---

## 11. Telas (escopo do MVP visual)

1. **Dashboard** — boas-vindas, KPIs (XP, vagas aplicadas, cursos em andamento, streak), próximas quests, vagas recomendadas.
2. **Vagas** — busca, filtros, lista de cards, painel lateral de pipeline.
3. **Cursos** — catálogo gamificado por trilha.
4. **Certificações** — concluídas + disponíveis.
5. **Conquistas** — grid de badges + progresso para próxima.
6. **Ranking** — leaderboard semanal.
7. **Perfil** — dados, currículo, histórico, nível.
