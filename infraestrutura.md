# infraestrutura.md

Referência de infraestrutura, versionamento e deploy para projetos estáticos e futuros projetos com backend.

---

## ARQUIVOS DE REFERÊNCIA

| Arquivo | Descrição |
|---|---|
| `check.md` | Testes da aplicação; identifica onde quebra durante o desenvolvimento |
| `engine.md` | Motor principal do app; descreve o crawling e scraping |
| `design.md` | Paleta de cores e inspirações visuais do projeto |

---

## GIT & GITHUB

### Fluxo de branches

- Trabalhar sempre na branch `dev`
- Após validar, merge na `main` (produção)
- Fazer commits e push com frequência

```bash
git checkout -b dev          # cria e entra na branch dev
git add .                    # prepara os arquivos
git commit -m "descrição"    # registra localmente
git push origin dev          # envia para o GitHub

# Quando validado, merge na main:
git checkout main
git merge dev
git push origin main
```

### Conceitos

| Comando | O que faz |
|---|---|
| `commit` | Registra as alterações localmente |
| `push` | Envia os commits para o GitHub |
| `merge` | Integra a dev na main (sobe para produção) |

### .gitignore

Não bloqueia nada por padrão — precisa ser configurado manualmente. Deve incluir:

```
.env
node_modules/
dist/
*.pem
*.key
*.sqlite
*.db
```

### Criar repositório privado

```bash
gh repo create nome-do-repo --private --source=. --remote=origin --push
```

> Repositório público: troque `--private` por `--public`. **Nunca suba credenciais, .env ou certificados em repositório público.**

---

## VERCEL

### Pré-requisitos

```bash
npm install -g vercel   # instala o CLI
vercel login            # autentica com a conta Vercel
```

### Primeiro deploy

```bash
cd pasta-do-projeto-sem-git    # obrigatório — veja seção "Problema com credenciais"
vercel --prod --yes
```

### Deploy de atualizações

```bash
cd pasta-do-projeto-sem-git
vercel --prod --yes
```

### Comandos úteis

```bash
# Renomear projeto
vercel project rename nome-antigo nome-novo

# Remover alias antigo
vercel alias rm nome-antigo.vercel.app

# Deixar o site público (desativa SSO)
vercel project protection disable PROJETO --sso

# Desativar proteção de fork do Git
vercel project protection disable PROJETO --git-fork-protection

# Ver deployments recentes
vercel list PROJETO

# Remover deploy travado
vercel remove URL-DO-DEPLOY --yes

# Ver limites de uso
# Acessar: vercel.com → Settings → Usage
```

### Problema com credenciais (LEIA ANTES DE DEPLOYAR)

**O erro:**
> "The deployment was blocked because the commit email could not be matched to a GitHub account."

**Por que acontece:**
Quando a pasta tem `.git` com commits, o Vercel lê o email do autor e tenta verificar se ele está vinculado à conta GitHub conectada. Se não encontrar, bloqueia o deploy.

**Como evitar — Opção 1: pasta sem `.git` (recomendada)**

Mantenha duas pastas separadas:

```
meu-projeto/           ← versionamento (tem .git, vai pro GitHub)
meu-projeto-deploy/    ← deploy Vercel (sem .git, só os arquivos do site)
```

Sempre copie as alterações para a pasta de deploy antes de rodar `vercel --prod --yes`.

**Como evitar — Opção 2: desativar a proteção**

```bash
vercel project protection disable PROJETO --git-fork-protection
```

**Como evitar — Opção 3: alinhar o email**

Adicionar o email do commit como email verificado na conta GitHub:
`github.com → Settings → Emails → Add email address`

**Configurar o project.json corretamente:**

O arquivo `.vercel/project.json` precisa ter o nome atual do projeto. Se renomear, atualize:

```json
{
  "projectId": "prj_xxxxx",
  "orgId": "team_xxxxx",
  "projectName": "nome-atual-do-projeto"
}
```

---

## DOCKER & REDES

- Todas as portas ficam internas no container
- Expor somente a porta `443` (HTTPS)
- Usar Traefik para gerenciar e direcionar as rotas

```yaml
# Exemplo básico com Traefik
services:
  traefik:
    image: traefik:v2.10
    ports:
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  app:
    build: .
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`meudominio.com`)"
      - "traefik.http.routers.app.tls=true"
    # Porta interna — não exposta diretamente
```

---

## GITHUB CLI

Instalar o `gh` para integrar o GitHub diretamente no terminal.

**Windows:**
```bash
winget install GitHub.cli
```

**Após instalar:**
```bash
gh auth login           # autentica com a conta GitHub

gh repo create nome --private --source=. --remote=origin --push
gh repo list            # lista repositórios
gh issue list           # lista issues
gh pr list              # lista pull requests
```

---

## CHECKLIST PARA NOVO PROJETO

- [ ] Criar pasta do projeto + pasta de deploy separada (sem `.git` na de deploy)
- [ ] Iniciar git na pasta principal: `git init`
- [ ] Criar `.gitignore` com `.env`, certificados, banco e `node_modules`
- [ ] Criar repositório privado no GitHub: `gh repo create ... --private`
- [ ] Fazer primeiro commit e push
- [ ] Fazer deploy Vercel a partir da pasta sem `.git`
- [ ] Desativar SSO: `vercel project protection disable PROJETO --sso`
- [ ] Desativar git-fork-protection: `vercel project protection disable PROJETO --git-fork-protection`
- [ ] Verificar se o site está público e acessível
