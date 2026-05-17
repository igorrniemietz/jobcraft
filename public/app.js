/* Jobcraft — SPA bootstrap */

const store = {
  user: null,
  jobs: [],
  courses: [],
  certs: [],
  achievements: [],
  leaderboard: [],
  quests: [],
  ui: {
    route: location.hash || '#/jobs',
    jobSearch: { cargo: '', localidade: '', skills: [], mode: 'todos', region: 'todas', graduacao: '', contracts: [], levels: [], sizes: [] },
    realJobsStatus: 'idle', // idle | loading | ok | error
    rpTab: 'missoes',
    rpVoucher: false,
    rpLastQuery: '',
  }
};

const ROUTES = {
  '#/dashboard':      { title: 'Dashboard',     render: renderDashboard },
  '#/jobs':           { title: 'Vagas',         render: renderJobsPage },
  '#/courses':        { title: 'Cursos',        render: renderCourses },
  '#/certifications': { title: 'Certificações', render: renderCerts },
  '#/achievements':   { title: 'Conquistas',    render: renderAchievements },
  '#/leaderboard':    { title: 'Ranking',       render: renderLeaderboard },
  '#/profile':        { title: 'Perfil',        render: renderProfile },
};

/* ============== utils ============== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const fmt = n => n.toLocaleString('pt-BR');
const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const initials = name => name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();

async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error('failed ' + path);
  return r.json();
}

/* ============== bootstrap ============== */
async function boot() {
  const [user, courses, certs, achievements, leaderboard, quests] = await Promise.all([
    fetchJSON('/data/user.json'),
    fetchJSON('/data/courses.json'),
    fetchJSON('/data/certifications.json'),
    fetchJSON('/data/achievements.json'),
    fetchJSON('/data/leaderboard.json'),
    fetchJSON('/data/quests.json'),
  ]);
  Object.assign(store, { user, jobs: [], courses, certs, achievements, leaderboard, quests });

  paintUser();
  bindShell();
  bindRightPanel();
  if (!ROUTES[location.hash]) location.hash = '#/jobs';
  route();
  window.addEventListener('hashchange', route);
  loadRealJobs();
}

async function loadRealJobs() {
  store.ui.realJobsStatus = 'loading';
  if (store.ui.route === '#/jobs') updateJobResults();
  try {
    const res  = await fetch('/api/jobs');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.jobs)) {
      store.jobs = data.jobs;
      store.ui.realJobsStatus = data.jobs.length === 0 ? 'empty' : 'ok';
    } else {
      throw new Error('resposta inválida');
    }
  } catch (e) {
    console.error('[loadRealJobs]', e.message);
    store.ui.realJobsStatus = 'error';
  }
  if (store.ui.route === '#/jobs') updateJobResults();
}

function paintUser() {
  const u = store.user;
  const pct = Math.min(100, (u.xp / u.xpNext) * 100);

  $('#user-name').textContent = u.name;
  $('#user-role').textContent = u.role;
  $('#user-avatar').textContent = initials(u.name);
  $('#user-level').textContent = u.level;
  $('#sb-level').textContent = u.level;
  $('#sb-xp-num').textContent = `${fmt(u.xp)} / ${fmt(u.xpNext)} XP`;

  $('#hud-level-num').textContent = u.level;
  $('#hud-xp-label').textContent = `${fmt(u.xp)}/${fmt(u.xpNext)}`;
  $('#hud-pts').textContent = `${fmt(u.coins)} pts`;

  requestAnimationFrame(() => {
    $('#sb-xp-fill').style.width = `${pct}%`;
    $('#hud-xp-fill').style.width = `${pct}%`;
  });
}

function bindShell() {
  $$('.nav-item[data-route]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      location.hash = el.dataset.route;
    });
  });
  $('#sidebar-toggle').addEventListener('click', () => {
    document.body.classList.toggle('sb-collapsed');
  });
  $('#sidebar-open')?.addEventListener('click', () => {
    document.body.classList.toggle('sb-open');
  });
  const chip = $('#user-chip');
  chip.addEventListener('click', e => {
    e.stopPropagation();
    $('#user-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => $('#user-menu').classList.remove('open'));
}

function bindRightPanel() {
  renderQuestsPanel();

  $$('.rp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.rp-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.rptab;
      store.ui.rpTab = tab;
      $('#rp-pane-missoes').style.display = tab === 'missoes' ? 'flex' : 'none';
      $('#rp-pane-certs').style.display   = tab === 'certs'   ? 'flex' : 'none';
      $('#rp-pane-cursos').style.display  = tab === 'cursos'  ? 'flex' : 'none';
    });
  });

  $('#rp-voucher-btn').addEventListener('click', () => {
    store.ui.rpVoucher = !store.ui.rpVoucher;
    $('#rp-voucher-btn').classList.toggle('active', store.ui.rpVoucher);
    renderRightPanel(store.ui.rpLastQuery);
  });

  $('#rp-filter-input').addEventListener('input', () => renderRightPanel(store.ui.rpLastQuery));
}

function renderQuestsPanel() {
  const list = $('#rp-quests-list');
  const totalEl = $('#rp-quest-total');
  if (!list) return;

  const pendingXp = store.quests.filter(q => !q.done).reduce((sum, q) => sum + q.xp, 0);
  if (totalEl) totalEl.textContent = `${pendingXp} XP disponível`;

  list.innerHTML = store.quests.map(q => {
    const pct = Math.round((q.progress / q.goal) * 100);
    return `
      <div class="rp-quest-item ${q.done ? 'done' : ''}" data-id="${q.id}" data-xp="${q.xp}">
        <div class="rp-quest-check ${q.done ? 'checked' : ''}">
          ${q.done ? '✓' : ''}
        </div>
        <div class="rp-quest-body">
          <div class="rp-quest-title">${escapeHtml(q.title)}</div>
          <div class="rp-quest-prog-wrap">
            <div class="rp-quest-bar-outer">
              <div class="rp-quest-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="rp-quest-count">${q.progress}/${q.goal}</span>
          </div>
        </div>
        <div class="rp-quest-xp">+${q.xp}<br><span>XP</span></div>
      </div>
    `;
  }).join('');

  list.addEventListener('click', e => {
    const item = e.target.closest('.rp-quest-item');
    if (!item || item.classList.contains('done')) return;
    const id = item.dataset.id;
    const xp = parseInt(item.dataset.xp, 10);
    const quest = store.quests.find(q => q.id === id);
    if (quest) {
      quest.done = true;
      quest.progress = quest.goal;
      renderQuestsPanel();
      addXP(xp);
      toast(`+${xp} XP — quest concluída!`);
    }
  });
}

function renderRightPanel(searchQuery = '') {
  if (searchQuery) store.ui.rpLastQuery = searchQuery;
  const certs = store.certs;
  const filter = $('#rp-filter-input')?.value?.toLowerCase() || '';
  const onlyVoucher = store.ui.rpVoucher;

  let filtered = certs.filter(c => {
    if (filter && !c.name.toLowerCase().includes(filter) && !c.issuer.toLowerCase().includes(filter)) return false;
    if (onlyVoucher && !c.voucherIncluded) return false;
    return true;
  });

  const count = `${filtered.length} de ${certs.length}`;
  const countEl = $('#rp-cert-count');
  if (countEl) countEl.textContent = count;

  const list = $('#rp-certs-list');
  const empty = $('#rp-empty-certs');
  if (!list) return;

  if (!searchQuery && !filter) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (empty) empty.style.display = 'none';
  list.innerHTML = filtered.slice(0, 8).map(c => `
    <div class="rp-cert-item">
      <div class="rp-cert-dot" style="background:${c.color}"></div>
      <div style="flex:1;min-width:0">
        <div class="rp-cert-name">${escapeHtml(c.name)}</div>
        <div class="rp-cert-issuer">${escapeHtml(c.issuer)}</div>
      </div>
      <div class="rp-cert-xp">+${c.xp} XP</div>
    </div>
  `).join('');

  const coursesList = $('#rp-cursos-list');
  const coursesEmpty = $('#rp-empty-cursos');
  if (!coursesList) return;

  const relatedCourses = store.courses.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) ||
           c.track.toLowerCase().includes(q) ||
           c.skills.some(s => s.toLowerCase().includes(q));
  }).slice(0, 6);

  if (relatedCourses.length === 0) {
    coursesList.innerHTML = '';
    if (coursesEmpty) coursesEmpty.style.display = 'flex';
  } else {
    if (coursesEmpty) coursesEmpty.style.display = 'none';
    coursesList.innerHTML = relatedCourses.map(c => `
      <div class="rp-course-item">
        <div class="rp-course-icon" style="background:${c.color}">
          <i data-lucide="${courseIcon(c.icon)}" style="width:16px;height:16px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div class="rp-course-name">${escapeHtml(c.title)}</div>
          <div class="rp-course-meta">${escapeHtml(c.track)} · ${c.hours}h</div>
        </div>
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
  }
}

/* ============== router ============== */
function route() {
  const hash = location.hash || '#/jobs';
  const r = ROUTES[hash] || ROUTES['#/jobs'];
  $$('.nav-item[data-route]').forEach(el => {
    if (el.dataset.route === hash) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  store.ui.route = hash;
  r.render();
  if (window.lucide) lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============== Dashboard ============== */
function renderDashboard() {
  const u = store.user;
  const applied = store.jobs.filter(j => j.applied).length;
  const inProgressCourses = store.courses.filter(c => c.progress > 0 && c.progress < 100).length;
  const earnedCerts = store.certs.filter(c => c.status === 'earned').length;

  const view = $('#view');
  view.innerHTML = `
    <section class="hero">
      <div>
        <div class="hi">Bem-vindo de volta,</div>
        <h1>${escapeHtml(u.name.split(' ')[0])} 🎮</h1>
        <p class="lead">Você está a <strong>${fmt(u.xpNext - u.xp)} XP</strong> do nível <strong>${u.level + 1}</strong>. Bora caçar vaga e fechar mais um módulo de OWASP?</p>
        <div class="hero-stats">
          <div class="hero-stat"><span class="v">${u.streak} 🔥</span><span class="l">Streak</span></div>
          <div class="hero-stat"><span class="v">${fmt(u.xp)}</span><span class="l">XP</span></div>
          <div class="hero-stat"><span class="v">${u.coins}</span><span class="l">Moedas</span></div>
          <div class="hero-stat"><span class="v">LV ${u.level}</span><span class="l">Nível</span></div>
        </div>
      </div>
      <div class="hero-art">
        <div class="pad pixel"><i data-lucide="gamepad-2"></i></div>
      </div>
    </section>

    <div class="kpi-grid">
      <div class="kpi solid">
        <div class="ic"><i data-lucide="zap"></i></div>
        <div class="label">XP Total</div>
        <div class="value">${fmt(u.xp)}</div>
        <div class="delta">+250 essa semana</div>
      </div>
      <div class="kpi">
        <div class="ic"><i data-lucide="briefcase"></i></div>
        <div class="label">Candidaturas</div>
        <div class="value">${applied}</div>
        <div class="delta">+2 esta semana</div>
      </div>
      <div class="kpi">
        <div class="ic"><i data-lucide="graduation-cap"></i></div>
        <div class="label">Cursos em andamento</div>
        <div class="value">${inProgressCourses}</div>
        <div class="delta">${store.courses.filter(c => c.progress === 100).length} concluídos</div>
      </div>
      <div class="kpi">
        <div class="ic"><i data-lucide="badge-check"></i></div>
        <div class="label">Certificações</div>
        <div class="value">${earnedCerts}</div>
        <div class="delta">+1 este mês</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="card panel">
        <div class="section-title" style="margin-top:0">
          <h3>Vagas recomendadas para você</h3>
          <a class="btn btn-ghost btn-sm" href="#/jobs"><i data-lucide="arrow-right"></i>Ver todas</a>
        </div>
        <div class="rec-jobs">
          ${store.jobs.slice().sort((a,b) => b.match - a.match).slice(0,3).map(jobMini).join('')}
        </div>
      </div>
      <div class="card panel">
        <div class="section-title" style="margin-top:0">
          <h3>Quests de hoje</h3>
          <span class="chip chip-royal"><i data-lucide="target"></i>5</span>
        </div>
        <div id="quests">
          ${store.quests.map(questRow).join('')}
        </div>
      </div>
    </div>

    <div class="section-title"><h3>Continue de onde parou</h3><small>Cursos com progresso ativo</small></div>
    <div class="courses-grid">
      ${store.courses.filter(c => c.progress > 0 && c.progress < 100).slice(0,3).map(courseCard).join('')}
    </div>
  `;

  view.addEventListener('click', e => {
    const q = e.target.closest('.quest');
    if (q && !q.classList.contains('done')) {
      q.classList.add('done');
      const xp = parseInt(q.dataset.xp, 10);
      addXP(xp);
      toast(`+${xp} XP — quest concluída!`);
    }
  }, { once: true });
}

function questRow(q) {
  return `
    <div class="quest ${q.done ? 'done' : ''}" data-id="${q.id}" data-xp="${q.xp}">
      <div class="qcheck">${q.done ? '<i data-lucide="check"></i>' : ''}</div>
      <div>
        <div class="qtitle">${escapeHtml(q.title)}</div>
        <div class="qprog">${q.progress}/${q.goal}</div>
      </div>
      <div class="qxp">+${q.xp} XP</div>
    </div>
  `;
}

function jobMini(j) {
  return `
    <div class="job-card" style="padding:14px">
      <div class="job-head">
        <div class="job-logo" style="background:${j.color}">${j.logo}</div>
        <div style="min-width:0">
          <div class="job-title">${escapeHtml(j.title)}</div>
          <div class="job-company">${escapeHtml(j.company)} · ${escapeHtml(j.location)}</div>
        </div>
        <div class="match ${matchClass(j.match)}" style="--pct:${j.match}"><span class="num">${j.match}%</span></div>
      </div>
    </div>
  `;
}

/* ============== Jobs — Nova Missão ============== */
function renderJobsPage() {
  const s = store.ui.jobSearch;
  const skillsHtml = s.skills.map(sk => `
    <span class="mission-skill-tag" data-skill="${escapeHtml(sk)}">
      ${escapeHtml(sk)}
      <button type="button" aria-label="Remover skill">×</button>
    </span>
  `).join('');

  const filterBtns = (filter, opts) => opts.map(([val, label]) => {
    const isSingle = filter === 'mode' || filter === 'region';
    const active   = isSingle ? s[filter] === val : s[filter + 's'].includes(val);
    return `<button class="mode-btn ${active ? 'active' : ''}" data-filter="${filter}" data-value="${val}">${label}</button>`;
  }).join('');

  $('#view').innerHTML = `
    <div class="mission-wrap">
      <div class="mission-box">
        <div class="mission-title">
          <span class="mission-title-arrow">▶</span> NOVA MISSÃO
        </div>

        <div class="mission-fields">
          <div class="mission-field-group">
            <label class="mission-field-label">Cargo pretendido</label>
            <input id="ms-cargo" class="mission-field-input" type="text"
              placeholder="ex: analista, engenheiro..." value="${escapeHtml(s.cargo)}" />
          </div>
          <div class="mission-field-group">
            <label class="mission-field-label">Localidade</label>
            <input id="ms-local" class="mission-field-input" type="text"
              placeholder="ex: São Paulo, Remoto..." value="${escapeHtml(s.localidade)}" />
          </div>
        </div>

        <div class="mission-row2">
          <div class="mission-skills-wrap">
            <label class="mission-field-label">
              Habilidades
              <span class="mission-field-hint">Digite a skill — Enter</span>
            </label>
            <div class="mission-skills-row">
              <div class="mission-skills-tags" id="skills-tags">
                ${skillsHtml}
                <input id="ms-skill-input" class="mission-skills-input"
                  type="text" placeholder="${s.skills.length ? 'mais skills...' : 'python, docker, aws...'}" />
              </div>
              <button class="mission-skills-add" id="ms-skill-add" type="button">+</button>
            </div>
          </div>
          <div class="mission-field-group">
            <label class="mission-field-label">Graduação</label>
            <input id="ms-graduacao" class="mission-field-input" type="text"
              placeholder="ex: Ciência da Computação..." value="${escapeHtml(s.graduacao)}" />
          </div>
        </div>

        <div class="mission-filters">
          <div class="inline-filter-row">
            <span class="inline-filter-label">Contrato:</span>
            <div class="inline-filter-opts">
              ${filterBtns('contract', [['CLT','CLT'],['PJ','PJ'],['Estágio','Estágio']])}
            </div>
          </div>
          <div class="inline-filter-row">
            <span class="inline-filter-label">Nível:</span>
            <div class="inline-filter-opts">
              ${filterBtns('level', [['Júnior','Júnior'],['Pleno','Pleno'],['Sênior','Sênior']])}
            </div>
          </div>
          <div class="inline-filter-row">
            <span class="inline-filter-label">Regime:</span>
            <div class="inline-filter-opts">
              ${filterBtns('mode', [['todos','Todos'],['remoto','Remoto'],['híbrido','Híbrido'],['presencial','Presencial']])}
            </div>
          </div>
          <div class="inline-filter-row">
            <span class="inline-filter-label">Região:</span>
            <div class="inline-filter-opts">
              ${filterBtns('region', [['todas','Todas'],['br','Brasil 🇧🇷'],['internacional','Internacional 🌎']])}
            </div>
          </div>
        </div>

        <div class="mission-footer">
          <div class="mission-actions" style="margin-left:auto">
            <button class="btn-clear" id="ms-clear" type="button">Limpar</button>
            <button class="btn-search" id="ms-search" type="button">
              <span class="btn-search-arrow">▶</span> Buscar Vagas
            </button>
          </div>
        </div>
      </div>

      <div id="jobs-results"></div>
    </div>
  `;

  bindJobsPageEvents();
  updateJobResults();
  renderRightPanel(s.cargo || s.skills.join(' '));
}

function updateJobResults() {
  const el = $('#jobs-results');
  if (!el) return;
  const s      = store.ui.jobSearch;
  const status = store.ui.realJobsStatus;

  const statusBanner = status === 'loading'
    ? `<div class="real-jobs-banner loading">Buscando vagas reais…</div>`
    : status === 'error'
    ? `<div class="real-jobs-banner error">Erro ao carregar vagas — tente recarregar a página.</div>`
    : status === 'empty'
    ? `<div class="real-jobs-banner empty">Nenhuma vaga encontrada no momento.</div>`
    : '';

  const realJobs   = store.jobs.filter(j => ['gupy','remotive','adzuna'].includes(j.source));
  const bySrc      = realJobs.reduce((a, j) => { a[j.source] = (a[j.source] || 0) + 1; return a; }, {});
  const srcLabel   = Object.entries(bySrc).map(([s, n]) => `${n} ${s}`).join(' · ');
  const countLabel = realJobs.length
    ? `${store.jobs.length} vagas (${srcLabel})`
    : `${store.jobs.length} vagas disponíveis`;

  const filtered   = filterJobs();
  const hasFilters = s.contracts.length || s.levels.length || s.sizes.length || s.mode !== 'todos';
  const hasText    = !!(s.cargo || s.skills.length || s.localidade || s.graduacao);
  const ranked     = filtered
    .map(j => ({ j, m: calcDynamicMatch(j, s.skills) }))
    .sort((a, b) => b.m - a.m);

  if (!hasText && !hasFilters) {
    el.innerHTML = `
      ${statusBanner}
      <div class="jobs-count" style="padding-top:0">${countLabel}</div>
      <div class="jobs-grid-v2">
        ${ranked.map(({ j, m }) => jobCardV2(j, m)).join('')}
      </div>`;
    return;
  }

  const marketData = calcMarket(filtered);
  const label = escapeHtml(s.cargo || s.skills[0] || s.contracts[0] || s.levels[0] || '');

  el.innerHTML = `
    ${hasText ? `
    <div class="market-box">
      <div class="market-title">
        <span class="market-title-dot">●</span> MERCADO
        <span class="market-query">→ ${label}</span>
      </div>
      <div class="market-grid">
        <div class="market-stat">
          <div class="market-stat-label">Salário mín</div>
          <div class="market-stat-value">${marketData.min}</div>
          <div class="market-stat-sub">estimado</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">Mediana</div>
          <div class="market-stat-value orange">${marketData.med}</div>
          <div class="market-stat-sub">referência</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">Salário máx</div>
          <div class="market-stat-value green">${marketData.max}</div>
          <div class="market-stat-sub">estimado</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">Tendência BR</div>
          <div class="market-stat-value green market-trend-up">↑ Crescente</div>
          <div class="market-stat-sub">Google Trends BR</div>
        </div>
      </div>
    </div>` : ''}
    <div class="jobs-count" style="padding-top:0">
      <strong>${filtered.length}</strong> ${filtered.length === 1 ? 'vaga encontrada' : 'vagas encontradas'}
    </div>
    <div class="jobs-grid-v2">
      ${ranked.map(({ j, m }) => jobCardV2(j, m)).join('')}
    </div>`;

  if (window.lucide) lucide.createIcons();
}

function filterJobs() {
  const s = store.ui.jobSearch;
  return store.jobs.filter(j => {
    const text = (j.title + ' ' + j.company + ' ' + j.tags.join(' ')).toLowerCase();
    const cargoMatch    = !s.cargo || text.includes(s.cargo.toLowerCase());
    const skillsMatch   = s.skills.length === 0 || s.skills.some(sk => text.includes(sk.toLowerCase()));
    const localMatch    = !s.localidade || j.location.toLowerCase().includes(s.localidade.toLowerCase());
    const modeMap       = { todos: null, remoto: 'Remoto', híbrido: 'Híbrido', presencial: 'Presencial' };
    const modeTarget    = modeMap[s.mode];
    const modeMatch     = !modeTarget || j.location.toLowerCase().includes(modeTarget.toLowerCase());
    const contractMatch = s.contracts.length === 0 || s.contracts.includes(j.contract);
    const levelMatch    = s.levels.length === 0    || s.levels.includes(j.level);
    const sizeMatch     = s.sizes.length === 0     || s.sizes.includes(j.companySize);
    const BR_SOURCES = ['gupy','adzuna','vagas','greenhouse','lever','remotar','trampos'];
    const regionMatch   = s.region === 'todas'
      || (s.region === 'br'            && BR_SOURCES.includes(j.source))
      || (s.region === 'internacional' && j.source === 'remotive');
    return cargoMatch && skillsMatch && localMatch && modeMatch && contractMatch && levelMatch && sizeMatch && regionMatch;
  });
}

const TRACK_KWORDS = {
  'application security': ['appsec','owasp','security','pentest','sast','vulnerability','segurança'],
  'soc / blue team':      ['soc','siem','splunk','elastic','blueteam','blue','incident','threat'],
  'ethical hacking':      ['pentest','kali','oscp','redteam','metasploit','burp','exploit'],
};

function calcDynamicMatch(j, skills) {
  const jobText = (j.title + ' ' + (j.description || '') + ' ' + j.tags.join(' ')).toLowerCase();
  if (skills.length > 0) {
    const matched = skills.filter(sk => jobText.includes(sk.toLowerCase())).length;
    return Math.round((matched / skills.length) * 100);
  }
  const tracks = store.user?.tracks || [];
  if (!tracks.length || !j.tags.length) return j.match;
  const kwords = [...new Set(tracks.flatMap(t => TRACK_KWORDS[t.toLowerCase()] || t.toLowerCase().split(/\W+/).filter(Boolean)))];
  const matched = kwords.filter(k => jobText.includes(k)).length;
  return kwords.length ? Math.round((matched / kwords.length) * 100) : j.match;
}

function calcMarket(jobs) {
  if (!jobs.length) return { min: 'R$ —', med: 'R$ —', max: 'R$ —' };
  const parseRange = s => {
    const nums = (s || '').match(/[\d.]+/g);
    if (!nums || nums.length < 2) return [0, 0];
    return [parseInt(nums[0].replace(/\./g,'')), parseInt(nums[1].replace(/\./g,''))];
  };
  const mins = jobs.map(j => parseRange(j.salary)[0]).filter(n => n > 0);
  const maxs = jobs.map(j => parseRange(j.salary)[1]).filter(n => n > 0);
  const fmtBrl = n => n ? `R$ ${fmt(n)}` : 'R$ —';
  const min = mins.length ? Math.min(...mins) : 0;
  const max = maxs.length ? Math.max(...maxs) : 0;
  const med = mins.length && maxs.length ? Math.round((min + max) / 2) : 0;
  return { min: fmtBrl(min), med: fmtBrl(med), max: fmtBrl(max) };
}

function jobCardV2(j, dynMatch) {
  const match   = dynMatch !== undefined ? dynMatch : j.match;
  const locType = j.location?.split('·')[0]?.trim() || j.location;
  const locClass = locType.toLowerCase().includes('remoto') ? 'remote'
    : locType.toLowerCase().includes('híbrido') ? 'hybrid' : 'onsite';
  const matchCls = match >= 80 ? '' : match >= 60 ? 'mid' : 'low';

  const levelCls = j.level === 'Júnior' ? 'junior' : j.level === 'Sênior' ? 'senior' : 'pleno';
  const contractCls = j.contract === 'PJ' ? 'pj' : j.contract === 'Estágio' ? 'estagio' : 'clt';
  const sizeCls = j.companySize === 'Startup' ? 'startup' : j.companySize === 'Grande empresa' ? 'grande' : 'pme';

  return `
    <article class="job-card-v2" data-id="${j.id}">
      <div class="jcv2-head">
        <div class="jcv2-logo" style="background:${j.color}">${escapeHtml(j.logo)}</div>
        <div style="min-width:0">
          <div class="jcv2-title">${escapeHtml(j.title)}</div>
          <div class="jcv2-company">${escapeHtml(j.company)}</div>
        </div>
      </div>
      <div class="jcv2-tags">
        ${locType ? `<span class="jcv2-tag ${locClass}">${escapeHtml(locType)}</span>` : ''}
        ${j.level    ? `<span class="jcv2-badge jcv2-badge-${levelCls}">${escapeHtml(j.level)}</span>` : ''}
        ${j.contract ? `<span class="jcv2-badge jcv2-badge-${contractCls}">${escapeHtml(j.contract)}</span>` : ''}
        ${j.companySize ? `<span class="jcv2-badge jcv2-badge-${sizeCls}">${escapeHtml(j.companySize)}</span>` : ''}
        ${{ gupy: '<span class="jcv2-badge jcv2-badge-source">GY</span>', remotive: '<span class="jcv2-badge jcv2-badge-source">RM</span>', adzuna: '<span class="jcv2-badge jcv2-badge-source">AZ</span>' }[j.source] || ''}
      </div>
      <div class="jcv2-salary">
        ${j.salary
          ? `<span class="jcv2-salary-icon">🔥</span>${escapeHtml(j.salary)} <span style="font-weight:500;color:var(--text-mut);font-size:11px">/mês</span>`
          : `<span style="color:var(--text-mut);font-size:11px">Salário não informado</span>`}
      </div>
      <div class="jcv2-skills">
        ${j.tags.slice(0, 4).map(t => `<span class="jcv2-skill">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="jcv2-sep"></div>
      <div class="jcv2-foot">
        ${j.externalUrl
          ? `<a class="jcv2-link" href="${escapeHtml(j.externalUrl)}" target="_blank" rel="noopener noreferrer">Ver vaga →</a>`
          : `<span class="jcv2-link jcv2-link-disabled">Indisponível</span>`}
        <span class="jcv2-match">
          Compatibilidade <span class="jcv2-match-pct ${matchCls}">${match}%</span>
        </span>
      </div>
    </article>
  `;
}

function bindJobsPageEvents() {
  const s = store.ui.jobSearch;

  $('#ms-cargo')?.addEventListener('input', e => { s.cargo = e.target.value; updateJobResults(); });
  $('#ms-local')?.addEventListener('input', e => { s.localidade = e.target.value; updateJobResults(); });
  $('#ms-graduacao')?.addEventListener('input', e => { s.graduacao = e.target.value; updateJobResults(); });

  const skillInput = $('#ms-skill-input');

  const insertSkillTag = (val) => {
    const tagsWrap = $('#skills-tags');
    if (!tagsWrap || !val) return;
    const tag = document.createElement('span');
    tag.className = 'mission-skill-tag';
    tag.dataset.skill = val;
    tag.innerHTML = `${escapeHtml(val)}<button type="button" aria-label="Remover skill">×</button>`;
    tag.querySelector('button').addEventListener('click', () => {
      s.skills = s.skills.filter(sk => sk !== val);
      tag.remove();
      if (skillInput) skillInput.placeholder = s.skills.length ? 'mais skills...' : 'python, docker, aws...';
      updateJobResults();
      renderRightPanel(s.cargo || s.skills.join(' '));
    });
    tagsWrap.insertBefore(tag, skillInput);
    if (skillInput) skillInput.placeholder = 'mais skills...';
  };

  const addSkill = () => {
    if (!skillInput) return;
    const val = skillInput.value.trim().toUpperCase();
    if (val && !s.skills.includes(val)) {
      s.skills.push(val);
      insertSkillTag(val);
    }
    skillInput.value = '';
    skillInput.focus();
    updateJobResults();
    renderRightPanel(s.cargo || s.skills.join(' '));
  };

  skillInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addSkill(); }
    if (e.key === 'Backspace' && skillInput.value === '' && s.skills.length > 0) {
      const lastSkill = s.skills[s.skills.length - 1];
      s.skills = s.skills.slice(0, -1);
      const tags = $$('.mission-skill-tag');
      tags[tags.length - 1]?.remove();
      if (skillInput) skillInput.placeholder = s.skills.length ? 'mais skills...' : 'python, docker, aws...';
    }
  });
  $('#ms-skill-add')?.addEventListener('click', () => addSkill());

  $('#skills-tags')?.addEventListener('click', e => {
    const btn = e.target.closest('button[aria-label="Remover skill"]');
    if (!btn) return;
    const tag = btn.closest('.mission-skill-tag');
    if (!tag) return;
    const skill = tag.dataset.skill;
    s.skills = s.skills.filter(sk => sk !== skill);
    tag.remove();
    if (skillInput) skillInput.placeholder = s.skills.length ? 'mais skills...' : 'python, docker, aws...';
    updateJobResults();
    renderRightPanel(s.cargo || s.skills.join(' '));
  });

  $('.mission-filters')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    const filter = btn.dataset.filter;
    const value  = btn.dataset.value;
    if (filter === 'mode' || filter === 'region') {
      s[filter] = value;
      $$(`[data-filter="${filter}"]`).forEach(b => b.classList.toggle('active', b.dataset.value === value));
    } else {
      const key = filter + 's';
      if (s[key].includes(value)) {
        s[key] = s[key].filter(v => v !== value);
        btn.classList.remove('active');
      } else {
        s[key].push(value);
        btn.classList.add('active');
      }
    }
    updateJobResults();
  });

  $('#ms-clear')?.addEventListener('click', () => {
    s.cargo = ''; s.localidade = ''; s.skills = []; s.mode = 'todos'; s.region = 'todas'; s.graduacao = '';
    s.contracts = []; s.levels = []; s.sizes = [];
    renderJobsPage();
  });

  $('#ms-search')?.addEventListener('click', () => { renderJobsPage(); loadRealJobs(); });

  $('#ms-cargo')?.addEventListener('keydown', e => { if (e.key === 'Enter') renderJobsPage(); });
  $('#ms-local')?.addEventListener('keydown', e => { if (e.key === 'Enter') renderJobsPage(); });
  $('#ms-graduacao')?.addEventListener('keydown', e => { if (e.key === 'Enter') renderJobsPage(); });
}

/* ============== Jobs (legacy, manter para compatibilidade) ============== */
function renderJobs(q = '') {
  renderJobsPage();
}

function jobCard(j) {
  return `
    <article class="job-card" data-id="${j.id}">
      <div class="job-head">
        <div class="job-logo" style="background:${j.color}">${j.logo}</div>
        <div style="min-width:0;flex:1">
          <div class="job-title">${escapeHtml(j.title)}</div>
          <div class="job-company">${escapeHtml(j.company)} · ${escapeHtml(j.posted)} · ${j.applicants} candidatos</div>
        </div>
        <button class="job-fav ${j.saved ? 'saved' : ''}" title="Salvar"><i data-lucide="${j.saved ? 'bookmark-check' : 'bookmark'}"></i></button>
      </div>
      <div class="job-meta">
        <span><i data-lucide="map-pin"></i>${escapeHtml(j.location)}</span>
        <span><i data-lucide="briefcase"></i>${escapeHtml(j.type)}</span>
        <span><i data-lucide="banknote"></i>${escapeHtml(j.salary)}</span>
      </div>
      <p style="margin:0;color:var(--text-mut);font-size:12px">${escapeHtml(j.description)}</p>
      <div class="job-tags">
        ${j.tags.map(t => `<span class="chip chip-royal">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="job-foot">
        <div class="match ${matchClass(j.match)}" style="--pct:${j.match}"><span class="num">${j.match}%</span></div>
        <div>
          <div class="match-label">Compatibilidade</div>
          ${j.stage ? `<span class="chip chip-info" style="margin-top:4px"><i data-lucide="flag"></i>Etapa: ${escapeHtml(j.stage)}</span>` : ''}
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm"><i data-lucide="external-link"></i>Detalhes</button>
          <button class="btn ${j.applied ? '' : 'btn-primary'} btn-sm">${j.applied ? '<i data-lucide="check"></i>Aplicada' : '<i data-lucide="send"></i>Candidatar'}</button>
        </div>
      </div>
    </article>
  `;
}

function matchClass(m) {
  if (m >= 80) return 'match-high';
  if (m >= 60) return 'match-mid';
  return 'match-low';
}

/* ============== Courses ============== */
function renderCourses() {
  const tracks = [...new Set(store.courses.map(c => c.track))];
  $('#view').innerHTML = `
    <div class="section-title" style="margin-top:0">
      <div>
        <h2>Cursos Gamificados</h2>
        <small>${store.courses.length} cursos em Tech & Segurança · ganhe XP, suba de nível e desbloqueie badges</small>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost"><i data-lucide="filter"></i>Filtrar</button>
        <button class="btn btn-primary"><i data-lucide="sparkles"></i>Recomendado para mim</button>
      </div>
    </div>

    <div class="jobs-toolbar">
      <div class="toolbar-filters">
        <button class="filter-pill active">Todos</button>
        ${tracks.map(t => `<button class="filter-pill">${escapeHtml(t)}</button>`).join('')}
      </div>
    </div>

    <div class="section-title"><h3>Em andamento</h3><small>${store.courses.filter(c => c.progress > 0 && c.progress < 100).length} cursos</small></div>
    <div class="courses-grid">
      ${store.courses.filter(c => c.progress > 0 && c.progress < 100).map(courseCard).join('')}
    </div>

    <div class="section-title"><h3>Catálogo</h3><small>Tier Bronze, Prata, Ouro e Diamante</small></div>
    <div class="courses-grid">
      ${store.courses.filter(c => c.progress === 0 || c.progress === 100).map(courseCard).join('')}
    </div>
  `;
}

function courseCard(c) {
  const chunks = 12;
  const filled = Math.round((c.progress / 100) * chunks);
  return `
    <article class="course-card" data-id="${c.id}">
      <div class="course-cover" style="--c1:${c.color};--c2:${shade(c.color, -25)}">
        <span class="tier tier-${c.tier}">${c.tier.toUpperCase()}</span>
        <i data-lucide="${courseIcon(c.icon)}"></i>
      </div>
      <div class="course-body">
        <div class="meta">
          <span><i data-lucide="layers" style="width:12px;height:12px"></i>${escapeHtml(c.track)}</span>
          <span>·</span>
          <span>${escapeHtml(c.level)}</span>
          <span>·</span>
          <span>★ ${c.rating}</span>
        </div>
        <div class="title">${escapeHtml(c.title)}</div>
        <div class="meta">${escapeHtml(c.provider)} · ${c.modules} módulos · ${c.hours}h · ${fmt(c.students)} alunos</div>
        <div class="skills">
          ${c.skills.map(s => `<span class="chip">${escapeHtml(s)}</span>`).join('')}
        </div>
        <div class="pxbar" title="${c.progress}% concluído">
          ${Array.from({length: chunks}, (_,i) => `<span class="chunk ${i < filled ? 'on' : ''}"></span>`).join('')}
        </div>
        <div class="course-foot">
          <span class="xp-tag"><i data-lucide="zap" style="width:10px;height:10px"></i>+${c.xp} XP</span>
          <button class="btn btn-primary btn-sm">${c.progress === 0 ? 'Começar' : c.progress === 100 ? 'Ver certificado' : 'Continuar'}</button>
        </div>
      </div>
    </article>
  `;
}

function courseIcon(name) {
  const map = {
    shield:'shield', server:'server', bug:'bug', sword:'swords', code:'code',
    key:'key-round', cloud:'cloud', search:'search', terminal:'terminal',
    lock:'lock', 'git-branch':'git-branch', fingerprint:'fingerprint'
  };
  return map[name] || 'book-open';
}

/* ============== Certifications ============== */
function renderCerts() {
  const earned = store.certs.filter(c => c.status === 'earned');
  const inProg = store.certs.filter(c => c.status === 'in_progress');
  const avail  = store.certs.filter(c => c.status === 'available');

  $('#view').innerHTML = `
    <div class="section-title" style="margin-top:0">
      <div>
        <h2>Certificações</h2>
        <small>${earned.length} conquistadas · ${inProg.length} em andamento · ${avail.length} disponíveis</small>
      </div>
      <button class="btn btn-primary"><i data-lucide="upload"></i>Enviar certificado externo</button>
    </div>

    ${section('Conquistadas', earned.map(certCard).join('') || empty('Você ainda não possui certificações'))}
    ${section('Em andamento', inProg.map(certCard).join('') || empty('Nenhuma certificação em andamento'))}
    ${section('Disponíveis', avail.map(certCard).join(''))}
  `;
}
function section(title, html) {
  return `<div class="section-title"><h3>${title}</h3></div><div class="cert-grid">${html}</div>`;
}
function empty(msg) {
  return `<div class="card panel" style="grid-column:1/-1;text-align:center;color:var(--text-mut)">${msg}</div>`;
}
function certCard(c) {
  return `
    <article class="cert-card ${c.status === 'available' ? 'locked' : ''}">
      <div class="cert-shield" style="--c:${c.color}">
        <i data-lucide="${c.status === 'earned' ? 'badge-check' : c.status === 'in_progress' ? 'hourglass' : 'lock'}"></i>
      </div>
      <div class="cert-info">
        <div class="cert-name">${escapeHtml(c.name)}</div>
        <div class="cert-iss">${escapeHtml(c.issuer)} · ${escapeHtml(c.category)}</div>
        ${c.status === 'earned' ? `<div class="cert-foot">
            <span class="chip chip-success"><i data-lucide="check"></i>Obtida em ${fmtDate(c.earnedAt)}</span>
            <span class="chip">${escapeHtml(c.credentialId)}</span>
          </div>` : ''}
        ${c.status === 'in_progress' ? `<div class="cert-foot" style="flex-direction:column;align-items:stretch;gap:6px">
            <div class="pxbar">${pxbar(c.progress)}</div>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="chip chip-warning"><i data-lucide="hourglass"></i>${c.progress}% — exame em ${fmtDate(c.examAt)}</span>
              <span class="xp-tag" style="margin-left:auto">+${c.xp} XP</span>
            </div>
          </div>` : ''}
        ${c.status === 'available' ? `<div class="cert-foot">
            <span class="chip"><i data-lucide="zap"></i>+${c.xp} XP ao concluir</span>
            <button class="btn btn-ghost btn-sm" style="margin-left:auto">Trilha de estudos</button>
          </div>` : ''}
      </div>
    </article>
  `;
}
function pxbar(pct) {
  const n = 14; const filled = Math.round(pct/100*n);
  return Array.from({length:n},(_,i)=>`<span class="chunk ${i<filled?'on':''}"></span>`).join('');
}
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}

/* ============== Achievements ============== */
function renderAchievements() {
  const unlocked = store.achievements.filter(a => a.unlocked).length;
  $('#view').innerHTML = `
    <div class="section-title" style="margin-top:0">
      <div>
        <h2>Conquistas</h2>
        <small>${unlocked} de ${store.achievements.length} desbloqueadas</small>
      </div>
      <div class="chip chip-royal"><i data-lucide="trophy"></i> ${Math.round(unlocked / store.achievements.length * 100)}%</div>
    </div>
    <div class="ach-grid">
      ${store.achievements.map(a => `
        <div class="ach-card ${a.unlocked ? '' : 'locked'}" data-rarity="${a.rarity}">
          <div class="ach-badge"><i data-lucide="${achIcon(a.icon)}"></i></div>
          <div class="ach-name">${escapeHtml(a.name)}</div>
          <div class="ach-desc">${escapeHtml(a.desc)}</div>
          <div class="ach-xp">+${a.xp} XP</div>
        </div>
      `).join('')}
    </div>
  `;
}
function achIcon(n) {
  const m = { sword:'swords', check:'check', shield:'shield', flame:'flame', key:'key-round', cloud:'cloud', trophy:'trophy', crown:'crown', fingerprint:'fingerprint', lock:'lock' };
  return m[n] || 'star';
}

/* ============== Leaderboard ============== */
function renderLeaderboard() {
  const rows = store.leaderboard.slice().sort((a,b)=>a.rank-b.rank);
  const [r1, r2, r3, ...rest] = rows;
  $('#view').innerHTML = `
    <div class="section-title" style="margin-top:0">
      <div>
        <h2>Ranking semanal</h2>
        <small>Top da semana em Tech & Segurança · reinicia toda segunda-feira</small>
      </div>
      <span class="chip chip-warning"><i data-lucide="flame"></i>Você está em #${rows.find(r=>r.isMe)?.rank ?? '—'}</span>
    </div>
    <div class="podium">
      ${[r2, r1, r3].map((r, i) => {
        const cls = r === r1 ? 'podium-1' : r === r2 ? 'podium-2' : 'podium-3';
        const label = r === r1 ? '🥇 #1' : r === r2 ? '🥈 #2' : '🥉 #3';
        return `
          <div class="podium-item ${cls}">
            <span class="crown pixel">${label}</span>
            <div class="avatar" style="margin-top:8px">${initials(r.name)}</div>
            <div class="pname">${escapeHtml(r.name)}</div>
            <div class="pxp">${fmt(r.xp)} XP · LV ${r.level}</div>
            <div class="chip chip-royal" style="margin-top:8px">${escapeHtml(r.track)}</div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="card panel">
      <table class="lb-table">
        <thead><tr><th>#</th><th>Caçador</th><th>Trilha</th><th>Nível</th><th style="text-align:right">XP</th></tr></thead>
        <tbody>
          ${rest.map(r => `
            <tr class="${r.isMe?'me':''}">
              <td>#${r.rank}</td>
              <td style="display:flex;align-items:center;gap:10px">
                <div class="avatar" style="width:32px;height:32px;font-size:11px">${initials(r.name)}</div>
                <div>
                  <div style="font-weight:700;color:var(--text)">${escapeHtml(r.name)}</div>
                  <div style="font-size:11px;color:var(--text-mut)">${escapeHtml(r.handle)}</div>
                </div>
              </td>
              <td><span class="chip chip-royal">${escapeHtml(r.track)}</span></td>
              <td><span class="pixel level-tag">LV ${r.level}</span></td>
              <td style="text-align:right;font-variant-numeric:tabular-nums">${fmt(r.xp)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ============== Profile ============== */
function renderProfile() {
  const u = store.user;
  const earned = store.certs.filter(c => c.status === 'earned');
  const lastCourses = store.courses.slice().sort((a,b) => b.progress - a.progress).slice(0,4);

  $('#view').innerHTML = `
    <div class="section-title" style="margin-top:0">
      <div><h2>Meu Perfil</h2><small>Como recrutadores veem você</small></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost"><i data-lucide="share-2"></i>Compartilhar</button>
        <button class="btn btn-primary"><i data-lucide="pencil"></i>Editar perfil</button>
      </div>
    </div>

    <div class="profile-grid">
      <aside class="card profile-side">
        <div class="avatar">${initials(u.name)}</div>
        <h2>${escapeHtml(u.name)}</h2>
        <div class="muted">${escapeHtml(u.role)}</div>
        <div style="display:flex;justify-content:center;gap:6px;margin-top:10px">
          <span class="pixel level-tag">LV ${u.level}</span>
          <span class="chip chip-warning"><i data-lucide="flame"></i>${u.streak} dias</span>
        </div>
        <div class="xpbar" style="margin-top:14px"><div class="xpbar-fill" style="width:${Math.round(u.xp/u.xpNext*100)}%"></div></div>
        <div style="margin-top:6px;font-size:11px;color:var(--text-mut)">${fmt(u.xp)} / ${fmt(u.xpNext)} XP</div>

        <div class="profile-stats">
          <div class="b"><div class="v">${earned.length}</div><div class="l">Certificações</div></div>
          <div class="b"><div class="v">${store.achievements.filter(a=>a.unlocked).length}</div><div class="l">Conquistas</div></div>
          <div class="b"><div class="v">${store.jobs.filter(j=>j.applied).length}</div><div class="l">Candidaturas</div></div>
          <div class="b"><div class="v">${store.courses.filter(c=>c.progress===100).length}</div><div class="l">Cursos concl.</div></div>
        </div>

        <div style="margin-top:14px;text-align:left">
          <h3 style="font-size:13px;margin-bottom:8px">Trilhas favoritas</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${u.tracks.map(t=>`<span class="chip chip-royal">${escapeHtml(t)}</span>`).join('')}</div>
        </div>
      </aside>

      <div class="profile-main">
        <div class="card profile-section">
          <div class="section-title" style="margin-top:0"><h3>Skills em destaque</h3><small>Construídas a partir dos seus cursos</small></div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${['OWASP Top 10','Threat Modeling','Burp Suite','AWS IAM','Kubernetes','JWT','TLS 1.3','React','TypeScript','Python','Bash','Splunk','Terraform','GitHub Actions']
              .map(s => `<span class="chip">${s}</span>`).join('')}
          </div>
        </div>

        <div class="card profile-section">
          <div class="section-title" style="margin-top:0"><h3>Linha do tempo</h3><small>Atividades recentes</small></div>
          <div class="timeline">
            <div class="tl"><div class="tld"><i data-lucide="badge-check"></i></div>
              <div><div class="ttitle">Conquistou CKS (Kubernetes Security)</div><div class="tdate">18 de fev de 2026 · +950 XP</div></div></div>
            <div class="tl"><div class="tld"><i data-lucide="trophy"></i></div>
              <div><div class="ttitle">Entrou no Top 10 semanal</div><div class="tdate">10 de fev de 2026 · +200 XP</div></div></div>
            <div class="tl"><div class="tld"><i data-lucide="briefcase"></i></div>
              <div><div class="ttitle">Candidatou-se a "Security Engineer Pleno" na Nubank</div><div class="tdate">28 de jan de 2026 · +50 XP</div></div></div>
            <div class="tl"><div class="tld"><i data-lucide="graduation-cap"></i></div>
              <div><div class="ttitle">Concluiu "Pentest Web Moderno"</div><div class="tdate">20 de jan de 2026 · +380 XP</div></div></div>
            <div class="tl"><div class="tld"><i data-lucide="zap"></i></div>
              <div><div class="ttitle">Subiu para o nível 12</div><div class="tdate">12 de jan de 2026</div></div></div>
          </div>
        </div>

        <div class="card profile-section">
          <div class="section-title" style="margin-top:0"><h3>Cursos em destaque</h3></div>
          <div class="courses-grid" style="grid-template-columns:repeat(2,1fr)">
            ${lastCourses.map(courseCard).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ============== XP / Toast ============== */
function addXP(amount) {
  const u = store.user;
  u.xp += amount;
  let leveledUp = false;
  while (u.xp >= u.xpNext) {
    u.xp -= u.xpNext;
    u.level += 1;
    u.xpNext = Math.round(u.xpNext * 1.25);
    leveledUp = true;
  }
  paintUser();
  if (leveledUp) toast(`LEVEL UP! Lv ${u.level - 1} → Lv ${u.level}`, true);
}

function toast(msg, levelUp = false) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = levelUp
    ? `<i data-lucide="trophy" style="color:var(--xp-gold)"></i><div><div class="pixel">LEVEL UP!</div><div class="msg">${escapeHtml(msg)}</div></div>`
    : `<i data-lucide="zap" style="color:var(--xp-gold)"></i><div><div class="pixel">+XP</div><div class="msg">${escapeHtml(msg)}</div></div>`;
  root.appendChild(el);
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.style.transform = 'translateX(120%)';
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

/* ============== util cor ============== */
function shade(hex, pct) {
  const h = hex.replace('#','');
  const num = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
  let r = (num >> 16) + Math.round(255 * pct / 100);
  let g = ((num >> 8) & 0xff) + Math.round(255 * pct / 100);
  let b = (num & 0xff) + Math.round(255 * pct / 100);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}

/* ============== go ============== */
boot().catch(err => {
  $('#view').innerHTML = `<div class="card panel" style="margin:40px auto;text-align:center"><h3>Erro ao carregar Jobcraft</h3><p>${escapeHtml(err.message)}</p></div>`;
  console.error(err);
});
