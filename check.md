# check.md — Smoke Tests JobCraft

## Antes de todo merge dev → main

### Servidor
- [ ] `node server.js` sobe sem erros
- [ ] `http://localhost:8080` responde 200

### Navegação
- [ ] `#/dashboard` carrega KPIs e quests
- [ ] `#/jobs` carrega lista de vagas
- [ ] `#/courses` carrega catálogo de cursos
- [ ] `#/certifications` carrega seções
- [ ] `#/achievements` carrega grid de badges
- [ ] `#/leaderboard` carrega pódio + tabela
- [ ] `#/profile` carrega perfil do usuário
- [ ] Sidebar colapsa e expande sem erro

### Aba Vagas
- [ ] Vagas aparecem ao abrir sem filtro
- [ ] Filtro de modo (Todos / Remoto / Híbrido / Presencial) filtra resultados
- [ ] Campo cargo filtra ao digitar + Enter
- [ ] Adicionar skill tag com Enter e com botão `+`
- [ ] Remover skill tag com `×`
- [ ] Backspace remove a última tag quando input está vazio
- [ ] Botão "Limpar" reseta todos os campos e reexibe todas as vagas
- [ ] Box de mercado (salário mín/med/máx) aparece ao buscar

### Gamificação
- [ ] Clicar em quest no Dashboard concede XP e exibe toast
- [ ] Toast de LEVEL UP aparece ao ultrapassar `xpNext`
- [ ] XP bar na sidebar atualiza após ganhar XP

### Docker
- [ ] `docker compose up -d` sobe sem erros
- [ ] `https://localhost` responde via Traefik
- [ ] Porta 8080 não está exposta diretamente
