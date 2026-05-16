# Jobcraft — Plano de Scrapers BR

> Branch: `dev` | Referência: `dev2` (snapshot pré-scraper)
> Data: 2026-05-16 | Fontes desativadas: Gupy, Remotive, Adzuna

---

## Decisão executiva

| Fonte | Abordagem | Puppeteer? | Prioridade | Viabilidade |
|---|---|---|---|---|
| **Trampos.co** | `__NEXT_DATA__` JSON | Não | 1 — implementar primeiro | Alta |
| **Vagas.com** | HTML + regex `data-*` | Não | 2 — sem nova dep | Média-alta |
| **Catho** | API interna não-doc | Não | 3 — confirmar no DevTools | Média-alta |
| **Indeed BR** | API interna / proxy | Talvez | 4 — adiar | Baixa (Cloudflare agressivo) |

Sem nenhuma dependência nova para Trampos e Vagas.com.  
Catho pode exigir `cheerio` dependendo do formato da resposta.  
Indeed só avança com ScraperAPI (free tier: 1.000 req/mês) ou Puppeteer-core + Chromium Alpine (~130 MB extra).

---

## Arquitetura de arquivos

```
src/
  http.js                ← adicionar headers realistas + getWithRetry + jitter()
  scheduler.js           ← adicionar circuit breaker, descomentar scrapers
  normalize.js           ← adicionar fromTrampos, fromVagas, fromCatho
  scrapers/
    http.js              ← wrapper fetchHtml() com Cheerio (quando necessário)
    browser.js           ← instância Puppeteer compartilhada (apenas se Catho/Indeed exigirem)
  collectors/
    trampos.js           ← __NEXT_DATA__ approach
    vagas.js             ← HTML regex
    catho.js             ← API interna
    indeed.js            ← adiado
```

---

## Fase 1 — Trampos.co

### Estratégia: `__NEXT_DATA__` + `/_next/data/` endpoint

O `/oportunidades.json` histórico não existe mais. O site usa Next.js SSR que injeta
`<script id="__NEXT_DATA__">` com `buildId` em toda página. O buildId muda a cada
deploy, portanto obtê-lo antes de cada sync é obrigatório.

**Fluxo por ciclo de sync:**
1. `GET trampos.co/` → extrair `buildId` via regex no `__NEXT_DATA__`
2. `GET trampos.co/_next/data/{buildId}/oportunidades.json?page=N`
3. Navegar até `pageProps.jobs` (confirmar campo no primeiro run)
4. Filtrar por regex de títulos tech (`desenvolvedor|security|devops|...`)
5. Paginar até array vazio (máx 10 páginas, 800 ms entre páginas)

**Ponto frágil:** buildId muda a cada deploy. Tratar HTTP 404 como sinal de buildId
expirado — reobter e repetir.

**Campos disponíveis:** id (slug), title, company.name, location, contractType,
salary (às vezes), description, publishedAt  
**Sempre null:** companySize, applicants

**Rate limit:** 800 ms/página. Sem proteção anti-bot nesta rota.

**Critério de "feito":** ≥ 30 vagas tech/sync

---

## Fase 2 — Vagas.com

### Estratégia: HTML scraping com regex em atributos `data-*`

Site SSR (PHP legado), conteúdo no HTML. Cloudflare moderado — bloqueável com
headers incorretos. Usar regex em vez de Cheerio: dados ficam em atributos `data-*`
do `<article class="job">`, não em classes CSS que mudam frequentemente.

**URLs de categoria:**
```
https://www.vagas.com.br/vagas-de-desenvolvedor?page=N
https://www.vagas.com.br/vagas-de-tecnologia-da-informacao?page=N
https://www.vagas.com.br/vagas-de-seguranca-da-informacao?page=N
https://www.vagas.com.br/vagas-de-devops?page=N
```

**Headers obrigatórios:**
```js
{
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept-Encoding': 'identity',   // http.js nativo não descomprime gzip
  'Referer':         'https://www.vagas.com.br/',
}
```

> **`Accept-Encoding: identity` é crítico** — o `https` nativo do Node.js não
> descomprime gzip. Sem isso o body chegará como bytes ilegíveis.

**Parsing:** regex `/<article[^>]+class="[^"]*\bjob\b/` → extrair `data-job-id`,
`data-company-name`. Seletores semânticos (`data-*`) são muito mais estáveis que
classes CSS geradas por frameworks.

**Rate limit:** 2–3 s aleatório entre páginas, 3 s entre categorias. Nunca
paralelizar requests do mesmo site (`for` sequencial, não `Promise.all`).

**Sinais de bloqueio:** HTTP 403 ou redirect para `/cdn-cgi/challenge-platform/` →
sleep 30 s e retornar `[]`.

**Campos sempre null:** salary, description (exige GET individual), posted  
**Critério de "feito":** ≥ 50 vagas/sync

---

## Fase 3 — Catho

### Estratégia: API interna não-documentada

Catho é SPA React com Akamai Bot Manager (menos agressivo que Cloudflare).
O frontend chama uma API interna JSON sem autenticação — identificável via
DevTools → Network → XHR/Fetch ao pesquisar uma vaga.

**Endpoint provável:**
```
GET https://www.catho.com.br/api/v2/search/jobs
  ?q=segurança+da+informação&page=1&limit=40&sort=date
```

> **Confirmar a URL exata antes de implementar** — abrir catho.com.br no Chrome,
> F12 → Network → filtrar XHR → pesquisar qualquer cargo → copiar URL do request.

**Headers obrigatórios:**
```js
{
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  'Accept':          'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Referer':         'https://www.catho.com.br/',
  'Origin':          'https://www.catho.com.br',
}
```

**Rate limit:** 800 ms entre queries. Volume seguro: ~200 req/dia.

**Campos sempre null:** description (login obrigatório), salary (~80% dos cards),
company (~40% retorna "Empresa Confidencial")

**Critério de "feito":** ≥ 30 vagas/sync

---

## Fase 4 — Indeed BR (adiada)

Cloudflare alto + cookies de sessão JS obrigatórios. Inviável com `https` nativo.

**Opções para desbloquear (quando priorizar):**
- **ScraperAPI** (free tier: 1.000 req/mês) → substituir URL base, manter `http.js`
- **Puppeteer-core + Chromium Alpine** → +130 MB na imagem Docker
  ```dockerfile
  RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates
  ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
  ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
  ```
- **Adzuna** como proxy legítimo de Indeed (já implementado no projeto, só reativar)

---

## Melhorias transversais no `src/http.js`

Três adições necessárias antes de qualquer scraper:

### 1. Headers realistas padrão
```js
// substituir 'User-Agent': 'Jobcraft/1.0' por:
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
```

### 2. Jitter para delays aleatórios
```js
function jitter(ms) { return ms + Math.floor(Math.random() * ms); }
```

### 3. Retry com 429 handling
```js
async function getWithRetry(url, opts = {}, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    const res = await get(url, opts);
    if (res.status === 429) {
      const wait = parseInt(res.headers?.['retry-after'] || '60') * 1000;
      await sleep(wait);
      continue;
    }
    if (res.status >= 500 && i < retries) { await sleep(jitter(2000) * i); continue; }
    return res;
  }
  throw new Error(`${url} falhou após ${retries} tentativas`);
}
```

---

## Circuit breaker no `src/scheduler.js`

Desativa automaticamente uma fonte que falha 3× seguidas (cooldown de 4 h):

```js
const _failures = {};

async function syncSource(name, fetchFn) {
  const fb = _failures[name] || { count: 0, disabledUntil: 0 };
  if (Date.now() < fb.disabledUntil) {
    console.log(`[sync] ${name} em cooldown até ${new Date(fb.disabledUntil).toISOString()}`);
    return;
  }
  try {
    const jobs = await fetchFn();
    // Alerta de volume: se retornou < 30% do histórico, pode ter quebrado
    const prev = _syncLog[name]?.total || 0;
    if (prev > 10 && jobs.length < prev * 0.3)
      console.error(`[sync] ALERTA ${name}: ${jobs.length} vagas (era ${prev}) — checar layout`);
    _failures[name] = { count: 0, disabledUntil: 0 };
    // ... upsert normal ...
  } catch (e) {
    fb.count = (fb.count || 0) + 1;
    if (fb.count >= 3) fb.disabledUntil = Date.now() + 4 * 60 * 60 * 1000;
    _failures[name] = fb;
    store.setSyncLog(name, { ok: false, error: e.message, failures: fb.count });
  }
}
```

---

## Estratégia de qualidade das vagas

Com base na pesquisa, estes sinais aumentam a chance de entrevista real:

| Sinal | Impacto | Implementação |
|---|---|---|
| **Frescor** (< 48 h = ótimo, > 14 dias = penalizar) | Muito alto | Peso no `calcDynamicMatch` |
| **Match de keywords técnicas** | Muito alto | Já implementado via `TRACK_KWORDS` |
| **Fonte de qualidade** (Trampos > Vagas.com genérico) | Alto | Badge `source` já existe |
| **Nível explícito na vaga** (Jr/Pl/Sr compatível) | Médio | `extractLevel()` já implementado |
| **Remote-first declarado** | Médio | Campo `location` já tratado |

---

## Checklist de validação (primeiro run de cada coletor)

- [ ] Logar `JSON.stringify(rawJobs[0], null, 2)` para confirmar campos reais
- [ ] Confirmar que `externalUrl` abre a vaga correta no browser
- [ ] Confirmar que `extractTags()` retorna tags relevantes
- [ ] Confirmar que deduplicação SHA256 funciona (sync duplo não duplica vagas)
- [ ] Circuit breaker: desabilitar o site manualmente e verificar que o log aparece

---

## Dependências a adicionar (mínimas)

```json
// package.json — adicionar apenas quando necessário
{
  "cheerio": "^1.0.0"          // Fase 3 (Catho) se API retornar HTML
  "puppeteer-core": "^22.0.0"  // Fase 4 (Indeed) — opcional
}
```

Imagem Docker estimada:
- Atual (sem scraper): ~80 MB
- + Cheerio: ~85 MB
- + Puppeteer-core + Chromium Alpine: ~215 MB
