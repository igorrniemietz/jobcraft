/* Jobcraft — SPA bootstrap */

/* ============== localStorage helpers ============== */
const LS = { profile: 'jc-profile', saved: 'jc-saved', apps: 'jc-apps', quests: 'jc-quests', achievements: 'jc-achievements' };

/* ============== Daily Quests ============== */
const QUEST_DEFS = [
  { id: 'login',      title: 'Acesse o JobCraft hoje',              type: 'login',     goal: 1, xp: 30  },
  { id: 'apply3',     title: 'Candidate-se a 3 vagas hoje',         type: 'apply',     goal: 3, xp: 100 },
  { id: 'interview1', title: 'Atualize candidatura pela Aba Candidatura', type: 'interview', goal: 1, xp: 80  },
  { id: 'course1',    title: 'Conclua 1 módulo de curso',           type: 'course',    goal: 1, xp: 60  },
  { id: 'streak',     title: 'Mantenha o streak ativo',             type: 'streak',    goal: 1, xp: 50  },
];

function _today() { return new Date().toISOString().slice(0, 10); }

function buildDailyQuests() {
  const today = _today();
  const acts  = (store.user?.activities) || [];

  // Count actions of each type done today
  const countToday = type => acts.filter(a =>
    a.type === type && new Date(a.ts).toISOString().slice(0, 10) === today
  ).length;

  // Claimed quests (reset each new day)
  const saved    = lsGet(LS.quests, {});
  const claimed  = saved.day === today ? (saved.claimed || []) : [];

  return QUEST_DEFS.map(def => {
    let progress = 0;
    if (def.type === 'login') {
      progress = 1;                                                        // sempre pronto ao abrir o app
    } else if (def.type === 'streak') {
      progress = store.user?.lastActivity === today ? 1 : 0;              // precisa ter feito algo hoje
    } else {
      progress = Math.min(def.goal, countToday(def.type));
    }
    const done  = claimed.includes(def.id);
    const ready = !done && progress >= def.goal;
    return { ...def, progress, done, ready };
  });
}

function claimQuest(id) {
  const today   = _today();
  const saved   = lsGet(LS.quests, {});
  const claimed = saved.day === today ? (saved.claimed || []) : [];
  if (claimed.includes(id)) return;
  claimed.push(id);
  lsSet(LS.quests, { day: today, claimed });
  const def = QUEST_DEFS.find(d => d.id === id);
  if (def) { addXP(def.xp, 'quest'); toast(`+${def.xp} XP — ${def.title}!`); }
  refreshQuests();
}

let _shownQuestToasts = new Set();
let _questToastsEnabled = false;

function refreshQuests() {
  store.quests = buildDailyQuests();
  renderQuestsPanel();
  // Atualiza chip de pendentes no dashboard se estiver visível
  const chip = document.querySelector('#quests')?.previousElementSibling?.querySelector('.chip-royal');
  if (chip) chip.innerHTML = `<i data-lucide="target"></i>${store.quests.filter(q => !q.done).length} pendentes`;
  const qdiv = $('#quests');
  if (qdiv) { qdiv.innerHTML = store.quests.map(questRow).join(''); lucide.createIcons(); }

  if (_questToastsEnabled) {
    store.quests.filter(q => q.done && !q.claimed && !_shownQuestToasts.has(q.id)).forEach(q => {
      _shownQuestToasts.add(q.id);
      toastQuest(q);
    });
  }
}
function lsGet(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const store = {
  user: null,
  jobs: [],
  courses: [],
  certs: [],
  achievements: [],
  leaderboard: [],
  quests: [],
  notifications: [],
  savedJobs:    {},
  applications: {},
  ui: {
    route: location.hash || '#/jobs',
    jobSearch: { cargo: '', localidade: '', skills: [], mode: 'todos', region: 'todas', dateFilter: 'all', hideExpired: true, graduacao: '', contracts: [], levels: [], sizes: [], specialty: '', areaFilter: '', subAreaFilter: '' },
    realJobsStatus: 'idle',
    rpTab: 'missoes',
    rpVoucher: false,
    rpLastQuery: '',
    courseTrack: 'todos',
    courseLang: 'pt',
  }
};

const ROUTES = {
  '#/dashboard':      { title: 'Dashboard',     render: renderDashboard },
  '#/jobs':           { title: 'Vagas',         render: renderJobsPage },
  '#/kanban':         { title: 'Candidaturas',  render: renderKanban },
  '#/courses':        { title: 'Cursos',        render: renderCourses },
  '#/certifications': { title: 'Certificações', render: renderCerts },
  '#/achievements':   { title: 'Conquistas',    render: renderAchievements },
  '#/leaderboard':    { title: 'Ranking',       render: renderLeaderboard },
  '#/profile':        { title: 'Perfil',        render: renderProfile },
  '#/docs':           { title: 'Documentação',  render: renderDocs },
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
async function loadCourses() {
  try {
    const res = await fetchJSON('/api/courses');
    if (res.ok && Array.isArray(res.courses) && res.courses.length > 0) return res.courses;
  } catch {}
  return fetchJSON('/data/courses.json');
}

async function boot() {
  const [user, courses, certs, achievements, leaderboard] = await Promise.all([
    fetchJSON('/data/user.json'),
    loadCourses(),
    fetchJSON('/data/certifications.json'),
    fetchJSON('/data/achievements.json'),
    fetchJSON('/data/leaderboard.json'),
  ]);
  Object.assign(store, { user, jobs: [], courses, certs, achievements, leaderboard });
  store.quests = buildDailyQuests();

  loadProfile();
  store.leaderboard = buildLeaderboard(leaderboard);
  paintUser();
  bindShell();
  bindRightPanel();
  if (!ROUTES[location.hash]) location.hash = '#/jobs';
  route();
  window.addEventListener('hashchange', route);
  loadSavedJobs();
  loadApplications();
  loadRealJobs();
  setTimeout(() => {
    _questToastsEnabled = true;
    store.quests.filter(q => q.done && !q.claimed).forEach(q => {
      if (!_shownQuestToasts.has(q.id)) { _shownQuestToasts.add(q.id); toastQuest(q); }
    });
  }, 2500);
}

function loadProfile() {
  const p = lsGet(LS.profile, {});
  if (p.xp       !== undefined) store.user.xp       = p.xp;
  if (p.level    !== undefined) store.user.level    = p.level;
  if (p.xpNext   !== undefined) store.user.xpNext   = p.xpNext;
  if (p.coins    !== undefined) store.user.coins    = p.coins;
  if (p.streak   !== undefined) store.user.streak   = p.streak;
  if (p.lastActivity)           store.user.lastActivity = p.lastActivity;
  store.user.activities = p.activities || [];

  const savedAchs = lsGet(LS.achievements, []);
  if (savedAchs.length) {
    store.achievements.forEach(a => { if (savedAchs.includes(a.id)) a.unlocked = true; });
  }
}

function buildLeaderboard(rawRows) {
  const u      = store.user;
  const handle = '@' + u.name.toLowerCase().replace(/\s+/g, '.');
  const track  = (u.tracks && u.tracks[0]) || 'Segurança';
  const me     = { name: u.name, handle, xp: u.xp || 0, level: u.level || 1, track, country: 'BR', isMe: true };
  return [...rawRows.filter(r => !r.isMe), me]
    .sort((a, b) => b.xp - a.xp)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

async function loadRealJobs() {
  store.ui.realJobsStatus = 'loading';
  if (store.ui.route === '#/jobs') updateJobResults();
  try {
    const res = await fetch('/api/jobs');
    const ct  = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('json')) throw new Error('sem API');
    const data = await res.json();
    if (data.ok && Array.isArray(data.jobs)) {
      store.jobs = data.jobs;
      store.ui.realJobsStatus = data.jobs.length === 0 ? 'empty' : 'ok';
    } else { throw new Error('resposta inválida'); }
  } catch {
    // fallback para arquivo estático (Vercel / sem servidor)
    try {
      const data = await fetchJSON('/data/jobs.json');
      const jobs = Array.isArray(data) ? data : (data.jobs || []);
      store.jobs = jobs;
      store.ui.realJobsStatus = jobs.length === 0 ? 'empty' : 'ok';
    } catch (e) {
      console.error('[loadRealJobs]', e.message);
      store.ui.realJobsStatus = 'error';
    }
  }
  if (store.ui.route === '#/jobs') updateJobResults();
  updateJobsBadge();
}

function loadApplications() {
  store.applications = lsGet(LS.apps, {});
  updateKanbanBadge();
}

function updateKanbanBadge() {
  const count = Object.keys(store.applications).length;
  const badge = $('#kanban-nav-badge');
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? '' : 'none';
}

function _isPostedToday(posted) {
  if (!posted) return false;
  const s = posted.toLowerCase().trim();
  if (s === 'agora' || s === 'hoje') return true;
  const m = s.match(/h[áa]\s+(\d+)\s*(min|hora)/);
  return !!m;
}

function updateJobsBadge() {
  const badge = $('#jobs-nav-badge');
  if (!badge) return;
  const count = store.jobs.filter(j => _isPostedToday(j.posted)).length;
  badge.textContent = count;
  badge.style.display = count > 0 ? '' : 'none';
}

function markJobsVisited() {
  const badge = $('#jobs-nav-badge');
  if (badge) badge.style.display = 'none';
}

function applyToJob(jobId, btn) {
  if (store.applications[jobId]) { location.hash = '#/kanban'; return; }
  const now = Date.now();
  store.applications[jobId] = { stage: 'applied', appliedAt: now, updatedAt: now };
  lsSet(LS.apps, store.applications);
  updateKanbanBadge();
  if (btn) { btn.textContent = 'Candidatado ✓'; btn.disabled = true; }
  addXP(50, 'apply');
  toast('+50 XP — candidatura registrada!');
  refreshQuests();
}

function updateApplicationStage(jobId, stage) {
  if (!store.applications[jobId]) return;
  const prev = store.applications[jobId].stage;
  store.applications[jobId] = { ...store.applications[jobId], stage, updatedAt: Date.now() };
  lsSet(LS.apps, store.applications);
  renderKanban();
  const XP_BY_STAGE = { interview: 150, offer: 500 };
  if (XP_BY_STAGE[stage] && prev !== stage) {
    addXP(XP_BY_STAGE[stage], stage);
    toast(`+${XP_BY_STAGE[stage]} XP — ${stage === 'interview' ? 'entrevista marcada' : 'oferta recebida'}! 🎉`);
  }
}

function removeApplication(jobId) {
  delete store.applications[jobId];
  lsSet(LS.apps, store.applications);
  updateKanbanBadge();
  renderKanban();
}

function loadSavedJobs() {
  store.savedJobs = lsGet(LS.saved, {});
}

function toggleSaveJob(jobId, btn) {
  const wasSaved = !!store.savedJobs[jobId];
  if (wasSaved) {
    delete store.savedJobs[jobId];
  } else {
    store.savedJobs[jobId] = Date.now();
    addXP(10, 'save');
    toast('+10 XP — missão salva!');
    refreshQuests();
  }
  lsSet(LS.saved, store.savedJobs);
  if (btn) {
    btn.classList.toggle('saved', !wasSaved);
    btn.title = wasSaved ? 'Guardar missão' : 'Missão guardada';
    btn.textContent = wasSaved ? '◇' : '⚔';
  }
}

function paintUser() {
  const u = store.user;
  const pct = Math.min(100, (u.xp / u.xpNext) * 100);

  $('#user-name').textContent = u.name;
  $('#user-role').textContent = u.role;
  $('#user-avatar').textContent = initials(u.name);
  $('#user-level').textContent = u.level;
  $('#hud-level-num').textContent = u.level;
  $('#hud-xp-label').textContent = `${fmt(u.xp)}/${fmt(u.xpNext)}`;
  $('#hud-pts').textContent = fmt(u.coins);

  requestAnimationFrame(() => {
    $('#hud-xp-fill').style.width = `${pct}%`;
    $('#hud-xp-glow').style.width = `${pct}%`;
  });
}

/* ============== Notifications ============== */
function pushNotif({ type = 'info', icon = '🔔', title, desc, action }) {
  store.notifications.unshift({ id: Date.now(), type, icon, title, desc, action, time: Date.now(), read: false });
  if (store.notifications.length > 30) store.notifications.pop();
  _updateNotifBadge();
  if (document.getElementById('notif-list') && document.getElementById('notif-panel').style.display !== 'none') {
    renderNotifPanel();
  }
}

function _updateNotifBadge() {
  const unread = store.notifications.filter(n => !n.read).length;
  const dot = $('#notif-dot');
  const badge = $('#notif-unread-badge');
  if (dot)   { dot.style.display   = unread > 0 ? '' : 'none'; }
  if (badge) { badge.style.display = unread > 0 ? '' : 'none'; badge.textContent = unread; }
}

function renderNotifPanel() {
  const list = $('#notif-list');
  if (!list) return;
  if (!store.notifications.length) {
    list.innerHTML = '<div class="notif-empty">Nenhuma notificação</div>';
    return;
  }
  const timeAgo = t => {
    const m = Math.floor((Date.now()-t)/60000);
    if (m < 1) return 'agora';
    if (m < 60) return `${m}min atrás`;
    const h = Math.floor(m/60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h/24)}d atrás`;
  };
  list.innerHTML = store.notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}" ${n.action ? `data-notif-action="${n.action}"` : ''}>
      <div class="notif-item-icon">${n.icon}</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-desc">${escapeHtml(n.desc)}</div>
        <div class="notif-item-time">${timeAgo(n.time)}</div>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-notif-id]').forEach(el => {
    el.addEventListener('click', () => {
      const n = store.notifications.find(x => x.id === +el.dataset.notifId);
      if (n) n.read = true;
      if (el.dataset.notifAction) {
        const act = el.dataset.notifAction;
        if (act.startsWith('#')) location.hash = act;
        else if (act === 'missoes') { const t = document.querySelector('.rp-tab[data-rptab="missoes"]'); if (t) t.click(); }
      }
      el.classList.remove('unread');
      _updateNotifBadge();
      _closeNotifPanel();
    });
  });
}

function _closeNotifPanel() {
  const p = $('#notif-panel');
  if (p) p.style.display = 'none';
}

function toggleNotifPanel() {
  const p = $('#notif-panel');
  if (!p) return;
  if (p.style.display === 'none') {
    store.notifications.forEach(n => { n.read = true; });
    _updateNotifBadge();
    renderNotifPanel();
    p.style.display = 'flex';
  } else {
    _closeNotifPanel();
  }
}

function bindShell() {
  $$('.nav-item[data-route]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      location.hash = el.dataset.route;
      // Fecha sidebar no mobile ao navegar
      document.body.classList.remove('sb-open');
    });
  });
  $('#sidebar-toggle').addEventListener('click', () => {
    document.body.classList.toggle('sb-collapsed');
  });
  $('#sidebar-open')?.addEventListener('click', () => {
    document.body.classList.toggle('sb-open');
  });
  $('#rp-toggle')?.addEventListener('click', () => document.body.classList.add('rp-hidden'));
  $('#rp-reopen')?.addEventListener('click', () => document.body.classList.remove('rp-hidden'));
  // Fechar sidebar no mobile clicando no overlay
  document.addEventListener('click', e => {
    if (document.body.classList.contains('sb-open') && !e.target.closest('#sidebar') && !e.target.closest('#sidebar-open')) {
      document.body.classList.remove('sb-open');
    }
  });
  // Sino → painel de notificações
  $('#notif-btn')?.addEventListener('click', e => { e.stopPropagation(); toggleNotifPanel(); });
  document.addEventListener('click', e => {
    if (!e.target.closest('#notif-panel') && !e.target.closest('#notif-btn')) _closeNotifPanel();
  });
  $('#notif-mark-read')?.addEventListener('click', () => {
    store.notifications.forEach(n => { n.read = true; });
    _updateNotifBadge();
    renderNotifPanel();
  });
  const chip = $('#user-chip');
  chip.addEventListener('click', e => {
    e.stopPropagation();
    $('#user-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => $('#user-menu').classList.remove('open'));

  $('#user-menu').addEventListener('click', e => {
    e.stopPropagation();
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const action = a.dataset.action;
    if (action === 'profile')  { location.hash = '#/profile'; }
    if (action === 'theme')    { toggleDarkTheme(); }
    if (action === 'logout')   { logout(); }
    $('#user-menu').classList.remove('open');
  });

  $$('.nav-item.ghost[data-action]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const action = el.dataset.action;
      if (action === 'notificacoes')  openMensagensModal();
      if (action === 'configuracoes') openConfiguracoesModal();
      if (action === 'ajuda')         location.hash = '#/docs';
    });
  });
}

function bindRightPanel() {
  renderQuestsPanel();

  // Quest click — bound ONCE here so renderQuestsPanel() can safely replace innerHTML
  $('#rp-quests-list')?.addEventListener('click', e => {
    const item = e.target.closest('.rp-quest-item');
    if (!item) return;
    const quest = buildDailyQuests().find(q => q.id === item.dataset.id);
    if (!quest || quest.done || !quest.ready) return;
    claimQuest(quest.id);
  });

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

  const quests = buildDailyQuests();
  store.quests = quests;
  const pendingXp = quests.filter(q => !q.done).reduce((sum, q) => sum + q.xp, 0);
  if (totalEl) totalEl.textContent = `${pendingXp} XP disponível`;

  list.innerHTML = quests.map(q => {
    const pct = Math.round((q.progress / q.goal) * 100);
    const cls = q.done ? 'done' : q.ready ? 'ready' : '';
    return `
      <div class="rp-quest-item ${cls}" data-id="${q.id}" data-xp="${q.xp}">
        <div class="rp-quest-check ${q.done ? 'checked' : q.ready ? 'checked-ready' : ''}">
          ${q.done ? '✓' : q.ready ? '!' : ''}
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
  // NOTE: click listener lives in bindRightPanel() — not here — to avoid accumulation on re-render
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
  } else {
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
  }

  // Cursos — always show featured courses sorted by tier
  const coursesList = $('#rp-cursos-list');
  const coursesEmpty = $('#rp-empty-cursos');
  if (!coursesList) return;

  const tierOrder = { ouro: 0, prata: 1, bronze: 2 };
  const featured = [...store.courses].sort((a, b) => {
    const ta = tierOrder[a.tier] ?? 3, tb = tierOrder[b.tier] ?? 3;
    return ta !== tb ? ta - tb : b.xp - a.xp;
  }).slice(0, 5);

  if (featured.length === 0) {
    coursesList.innerHTML = '';
    if (coursesEmpty) coursesEmpty.style.display = 'flex';
  } else {
    if (coursesEmpty) coursesEmpty.style.display = 'none';
    coursesList.innerHTML = featured.map(c => `
      <a class="rp-course-item" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">
        <div class="rp-course-icon" style="background:${c.color}">
          <i data-lucide="${courseIcon(c.icon)}" style="width:16px;height:16px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div class="rp-course-name">${escapeHtml(c.title)}</div>
          <div class="rp-course-meta">${escapeHtml(c.provider)} · ${c.hours}h</div>
        </div>
        <span class="rp-course-tier-badge rp-tier-${c.tier}">${c.tier}</span>
      </a>
    `).join('') + `<a class="rp-ver-todos" href="#/courses">Ver todos →</a>`;
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
function buildActivityHeatmap(activities) {
  const counts = {};
  for (const a of (activities || [])) {
    const day = new Date(a.ts).toISOString().slice(0, 10);
    counts[day] = (counts[day] || 0) + 1;
  }
  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const n = counts[key] || 0;
    const intensity = n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3;
    const label = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    cells.push(`<span class="heatmap-cell lvl${intensity}" title="${label}: ${n} ação${n!==1?'ões':''}"></span>`);
  }
  return cells.join('');
}

function renderDashboard() {
  const u = store.user;
  const applied         = Object.keys(store.applications).length;
  const inInterview     = Object.values(store.applications).filter(a => a.stage === 'interview').length;
  const inProgressCourses = store.courses.filter(c => c.progress > 0 && c.progress < 100).length;
  const earnedCerts     = store.certs.filter(c => c.status === 'earned').length;
  const savedCount      = Object.keys(store.savedJobs).length;

  const topJobs = store.jobs.slice()
    .map(j => ({ j, m: calcDynamicMatch(j, store.ui.jobSearch.skills) }))
    .sort((a, b) => b.m - a.m)
    .slice(0, 3);

  const view = $('#view');
  view.innerHTML = `
    <section class="hero">
      <div>
        <div class="hi">Bem-vindo de volta,</div>
        <h1>${escapeHtml(u.name.split(' ')[0])} ⚔</h1>
        <p class="lead">Você está a <strong>${fmt(u.xpNext - u.xp)} XP</strong> do nível <strong>${u.level + 1}</strong>. Bora caçar vaga e fechar mais um módulo de OWASP?</p>
        <div class="hero-stats">
          <div class="hero-stat"><span class="v">${u.streak || 0} 🔥</span><span class="l">Streak</span></div>
          <div class="hero-stat"><span class="v">${fmt(u.xp)}</span><span class="l">XP</span></div>
          <div class="hero-stat"><span class="v">${u.coins || 0}</span><span class="l">Moedas</span></div>
          <div class="hero-stat"><span class="v">LV ${u.level}</span><span class="l">Nível</span></div>
        </div>
      </div>
      <div class="hero-art">
        <div class="pad pixel"><i data-lucide="shield"></i></div>
      </div>
    </section>

    <div class="kpi-grid">
      <div class="kpi solid">
        <div class="ic"><i data-lucide="zap"></i></div>
        <div class="label">XP Total</div>
        <div class="value">${fmt(u.xp)}</div>
        <div class="delta">Nível ${u.level} — ${fmt(u.xpNext - u.xp)} para o próximo</div>
      </div>
      <div class="kpi">
        <div class="ic"><i data-lucide="briefcase"></i></div>
        <div class="label">Candidaturas</div>
        <div class="value">${applied}</div>
        <div class="delta">${inInterview} em entrevista · <a href="#/kanban" style="color:var(--accent)">Ver kanban →</a></div>
      </div>
      <div class="kpi">
        <div class="ic"><i data-lucide="bookmark"></i></div>
        <div class="label">Vagas salvas</div>
        <div class="value">${savedCount}</div>
        <div class="delta">${inProgressCourses} cursos em andamento</div>
      </div>
      <div class="kpi">
        <div class="ic"><i data-lucide="badge-check"></i></div>
        <div class="label">Certificações</div>
        <div class="value">${earnedCerts}</div>
        <div class="delta">${store.certs.filter(c => c.status === 'in_progress').length} em andamento</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="card panel">
        <div class="section-title" style="margin-top:0">
          <h3>Vagas recomendadas para você</h3>
          <a class="btn btn-ghost btn-sm" href="#/jobs"><i data-lucide="arrow-right"></i>Ver todas</a>
        </div>
        <div class="rec-jobs">
          ${topJobs.map(({ j, m }) => jobMini(j, m)).join('') || '<p style="color:var(--text-mut);font-size:13px">Carregando vagas…</p>'}
        </div>
      </div>
      <div class="card panel">
        <div class="section-title" style="margin-top:0">
          <h3>Quests de hoje</h3>
          <span class="chip chip-royal"><i data-lucide="target"></i>${buildDailyQuests().filter(q => !q.done).length} pendentes</span>
        </div>
        <div id="quests">
          ${buildDailyQuests().map(questRow).join('')}
        </div>
      </div>
    </div>

    <div class="card panel" style="margin-top:16px">
      <div class="section-title" style="margin-top:0">
        <h3>Atividade — últimos 30 dias</h3>
        <span class="heatmap-legend">
          <span class="heatmap-cell lvl0"></span>
          <span class="heatmap-cell lvl1"></span>
          <span class="heatmap-cell lvl2"></span>
          <span class="heatmap-cell lvl3"></span>
          <span style="font-size:11px;color:var(--text-mut)">Mais ativo</span>
        </span>
      </div>
      <div class="heatmap-row">${buildActivityHeatmap(u.activities)}</div>
    </div>

    <div class="section-title"><h3>Continue de onde parou</h3><small>Cursos com progresso ativo</small></div>
    <div class="courses-grid">
      ${store.courses.filter(c => c.progress > 0 && c.progress < 100).slice(0,3).map(courseCard).join('')}
    </div>
  `;

  view.addEventListener('click', e => {
    const qEl = e.target.closest('.quest');
    if (!qEl) return;
    const quest = buildDailyQuests().find(q => q.id === qEl.dataset.id);
    if (!quest || quest.done || !quest.ready) return;
    claimQuest(quest.id);
  });
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

function jobMini(j, dynMatch) {
  const match = dynMatch !== undefined ? dynMatch : (j.match || 0);
  return `
    <div class="job-card" style="padding:14px">
      <div class="job-head">
        <div class="job-logo" style="background:${j.color}">${escapeHtml(j.logo)}</div>
        <div style="min-width:0">
          <div class="job-title">${escapeHtml(j.title)}</div>
          <div class="job-company">${escapeHtml(j.company)} · ${escapeHtml(j.location || '')}</div>
        </div>
        <div class="match ${matchClass(match)}" style="--pct:${match}"><span class="num">${match}%</span></div>
      </div>
    </div>
  `;
}

/* ============== Jobs — Nova Missão ============== */
function renderJobsPage() {
  markJobsVisited();
  const s = store.ui.jobSearch;
  const skillsHtml = s.skills.map(sk => `
    <span class="mission-skill-tag" data-skill="${escapeHtml(sk)}">
      ${escapeHtml(sk)}
      <button type="button" aria-label="Remover skill">×</button>
    </span>
  `).join('');

  const filterBtns = (filter, opts) => opts.map(([val, label]) => {
    const isSingle = filter === 'mode' || filter === 'region' || filter === 'dateFilter' || filter === 'specialty' || filter === 'areaFilter' || filter === 'subAreaFilter';
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
              placeholder="ex: São Paulo" value="${escapeHtml(s.localidade)}" />
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
          <div class="inline-filter-row">
            <span class="inline-filter-label">Publicação:</span>
            <div class="inline-filter-opts">
              ${filterBtns('dateFilter', [['all','Todas'],['1d','Hoje'],['7d','7 dias'],['30d','30 dias']])}
            </div>
          </div>
          <div class="inline-filter-row">
            <span class="inline-filter-label">Área:</span>
            <div class="inline-filter-opts filter-toggle-row">
              ${[['dev','Dev'],['mobile','Mobile'],['dados','Dados'],['ia','IA & ML'],['devopscloud','DevOps'],['produtoqa','Produto'],['suporte','Suporte']].map(([key,lbl]) => {
                const isActive = s.areaFilter === key || (s.subAreaFilter && s.subAreaFilter.startsWith(key + ':'));
                const btnLabel = (s.subAreaFilter && s.subAreaFilter.startsWith(key + ':')) ? (SUBAREA_BTN_LABELS[s.subAreaFilter] || ('+ ' + lbl)) : ('+ ' + lbl);
                return `<button class="filter-toggle-btn area-top-btn ${isActive ? 'has-active' : ''}" data-areabtn="${key}" type="button"><span class="ftb-label">${btnLabel}</span>${isActive ? `<span class="ftb-x" data-cleararea="${key}">×</span>` : ''}</button>`;
              }).join('')}
              <button class="filter-toggle-btn area-top-btn ${s.specialty ? 'has-active' : ''}"
                      id="ftb-security" data-panel="fpl-security" type="button">
                <span class="ftb-label">${s.specialty ? (SPEC_BTN_LABELS[s.specialty] || '+ Segurança') : '+ Segurança'}</span>
                ${s.specialty ? `<span class="ftb-x" data-clearfilter="specialty">×</span>` : ''}
              </button>
            </div>
          </div>
          <div class="filter-expand-panel filter-subarea-panel" id="fpl-subarea"
               style="display:${(s.areaFilter && AREA_SUBOPTIONS[s.areaFilter]) ? 'flex' : 'none'}">
            ${s.areaFilter && AREA_SUBOPTIONS[s.areaFilter] ? `
              <span class="subarea-back-label">▸ ${AREA_BTN_LABELS[s.areaFilter] || s.areaFilter}</span>
              ${buildSubPanel(s.areaFilter)}` : ''}
          </div>
          <div class="filter-expand-panel" id="fpl-security"
               style="display:${s.specialty ? 'flex' : 'none'}">
            ${filterBtns('specialty', [
              ['',        'Todas'],
              ['soc',     'SOC / Blue Team'],
              ['pentest', 'Pentest / Red Team'],
              ['grc',     'GRC'],
              ['appsec',  'AppSec'],
              ['cloudsec','Cloud Security'],
            ])}
          </div>
        </div>

        <div class="mission-footer">
          <label class="toggle-expired-label">
            <input type="checkbox" id="ms-hide-expired" ${s.hideExpired ? 'checked' : ''}>
            <span>Ocultar vagas encerradas</span>
          </label>
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
  const hasFilters = s.contracts.length || s.levels.length || s.sizes.length || s.mode !== 'todos' || s.dateFilter !== 'all';
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

  const marketQuery = s.cargo || s.skills[0] || s.levels[0] || '';
  const marketData  = calcMarket(filtered, marketQuery);
  const label = escapeHtml(marketQuery || s.contracts[0] || '');

  el.innerHTML = `
    ${hasText ? `
    <div class="market-box">
      <div class="market-title">
        <span class="market-title-dot">●</span> MERCADO
        <span class="market-query">→ ${label}</span>
      </div>
      <div class="market-grid">
        <div class="market-stat">
          <div class="market-stat-label">Mín mensal</div>
          <div class="market-stat-value">${marketData.min}</div>
          <div class="market-stat-sub">${marketData.source === 'ref' ? 'referência BR' : 'estimado'}</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">Média mensal</div>
          <div class="market-stat-value orange">${marketData.med}</div>
          <div class="market-stat-sub">mercado 2025</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">Máx mensal</div>
          <div class="market-stat-value green">${marketData.max}</div>
          <div class="market-stat-sub">${marketData.source === 'ref' ? 'referência BR' : 'estimado'}</div>
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
    const modeMap    = { todos: null, remoto: 'Remoto', híbrido: 'Híbrido' };
    const modeTarget = modeMap[s.mode];
    const loc        = j.location.toLowerCase();
    const modeMatch  = s.mode === 'todos' ? true
      : s.mode === 'presencial' ? (!loc.includes('remoto') && !loc.includes('híbrido'))
      : modeTarget ? loc.includes(modeTarget.toLowerCase())
      : true;
    const contractMatch = s.contracts.length === 0 || s.contracts.includes(j.contract);
    const levelMatch    = s.levels.length === 0    || s.levels.includes(j.level);
    const sizeMatch     = s.sizes.length === 0     || s.sizes.includes(j.companySize);
    const BR_SOURCES = ['gupy','adzuna','vagas','greenhouse','lever','remotar','trampos'];
    const regionMatch   = s.region === 'todas'
      || (s.region === 'br'            && BR_SOURCES.includes(j.source))
      || (s.region === 'internacional' && j.source === 'remotive');

    const DATE_MS = { '1d': 86400000, '7d': 7*86400000, '30d': 30*86400000 };
    const dateCutoff = DATE_MS[s.dateFilter];
    const dateMatch  = !dateCutoff || (j.postedAt && (Date.now() - new Date(j.postedAt)) < dateCutoff);

    const SOURCE_TTL = { remotar: 45, greenhouse: 30, lever: 30, vagas: 21, gupy: 30 };
    const ttlDays    = SOURCE_TTL[j.source] || 30;
    const ageDays    = j.postedAt ? (Date.now() - new Date(j.postedAt)) / 86400000 : 0;
    const jobExpired = j.expiredBySource
      || (j.expiresAt && new Date(j.expiresAt) < new Date())
      || (j.postedAt && ageDays > ttlDays);
    const expiredMatch = !s.hideExpired || !jobExpired;

    const SPEC_KW = {
      // Desenvolvimento
      backend:  ['backend','back-end','back end','api rest','node.js','nodejs','django','spring','golang','microsserviço','microservice','servidor','fastapi','laravel','ruby on rails'],
      frontend: ['frontend','front-end','front end','react','vue','angular','next.js','nuxt','svelte','css','html','javascript','typescript','interface','ui developer','desenvolvedor web'],
      fullstack:['fullstack','full stack','full-stack','front e back','back e front','stack completa','desenvolvedor full'],
      mobile:   ['mobile','android','ios','react native','flutter','kotlin','swift','xcode','jetpack','app móvel','aplicativo'],
      data:     ['machine learning','deep learning','mlops','cientista de dados','inteligência artificial','llm','nlp','databricks','data science','ai engineer','engenheiro de ia','researcher'],
      dados:    ['data engineer','engenheiro de dados','analista de dados','pipeline de dados','spark','dbt','airflow','bigquery','data analyst','etl','data warehouse','lakehouse','data platform','sql','snowflake','business intelligence','bi','tableau','power bi','qlik','looker','analytics','relatório gerencial','dashboard','dba','database administrator','postgresql','mysql','oracle database','sql server','mongodb','administrador de banco','tuning de banco'],
      // Grupos TI para o painel de filtro
      dev:          ['backend','back-end','api rest','node.js','nodejs','django','spring','golang','fastapi','laravel','ruby on rails','frontend','front-end','react','vue','angular','next.js','nuxt','svelte','css','html','javascript','typescript','fullstack','full stack','full-stack','desenvolvedor','software engineer','engenheiro de software'],
      ia:           ['machine learning','deep learning','mlops','llm','nlp','gpt','inteligência artificial','ai engineer','engenheiro de ia','data science','cientista de dados','databricks','researcher','computer vision','processamento de linguagem natural'],
      dadosai:      ['data engineer','engenheiro de dados','analista de dados','pipeline de dados','spark','dbt','airflow','bigquery','data analyst','etl','data warehouse','business intelligence','bi','tableau','power bi','analytics','dba','database administrator','postgresql','mysql'],
      devopscloud:  ['devops','sre','platform engineer','site reliability','kubernetes','k8s','docker','terraform','ansible','ci/cd','gitops','argocd','aws','azure','gcp','google cloud','cloud','nuvem','serverless','cloud architect','multicloud','helm','observabilidade'],
      produtoqa:    ['ux designer','ui designer','product designer','product manager','product owner','figma','design system','qa','quality assurance','automação de teste','selenium','cypress','playwright','jest','bdd','tdd','arquiteto','architect','tech lead','líder técnico','principal engineer','staff engineer','solution architect'],
      suporte:      ['infraestrutura','redes','sysadmin','linux admin','windows server','firewall','network engineer','vpn','active directory','administrador de redes','suporte técnico','help desk','service desk','n1','n2','n3','técnico de informática','field service','suporte de campo','assistência técnica','unity','unreal engine','game developer','game design','mobile game','jogos'],
      infraredes:   ['infraestrutura','redes','sysadmin','linux admin','windows server','firewall','network engineer','vpn','active directory','administrador de redes','dba','database administrator','postgresql','mysql','oracle database','sql server','mongodb','administrador de banco','suporte técnico','help desk','service desk','n1','n2','n3','técnico de informática','field service'],
      devops:   ['devops','sre','platform engineer','site reliability','infraestrutura','kubernetes','k8s','docker','terraform','ansible','ci/cd','observabilidade','helm','gitops','argocd'],
      cloud:    ['cloud','aws','azure','gcp','google cloud','nuvem','s3','ec2','lambda','cloud architect','serverless','multicloud'],
      arqtech:  ['arquiteto','architect','tech lead','líder técnico','principal engineer','staff engineer','engineering manager','solution architect','sistema distribuído'],
      qa:       ['qa','quality assurance','teste','tester','automação de teste','selenium','cypress','playwright','jest','pytest','bdd','tdd','controle de qualidade','sdet'],
      ux:       ['ux designer','ui designer','product designer','product manager','product owner','ux researcher','figma','design system','experiência do usuário','designer de produto','protótipo'],
      bi:       ['business intelligence','bi','tableau','power bi','qlik','looker','analytics','relatório gerencial','dashboard','dados de negócio','analista de dados de negócio'],
      infra:    ['infraestrutura','redes','sysadmin','linux admin','windows server','firewall','network engineer','vpn','active directory','administrador de redes','administrador de sistemas'],
      dba:      ['dba','database administrator','postgresql','mysql','oracle database','sql server','mongodb','banco de dados','administrador de banco','tuning de banco'],
      suporte:  ['suporte técnico','help desk','service desk','n1','n2','n3','atendimento técnico','técnico de informática','field service','suporte de campo','assistência técnica'],
      games:    ['game developer','unity','unreal engine','game design','mobile game','jogos','gameplay programmer','desenvolvedor de jogos','engine de jogo'],
      // Sub-áreas de TI (dois níveis)
      'dev:frontend':         ['frontend','front-end','react','vue','angular','next.js','nuxt','svelte','css','html','javascript','typescript','ui developer','desenvolvedor web','interface'],
      'dev:backend':          ['backend','back-end','api rest','node.js','nodejs','django','spring','golang','fastapi','laravel','ruby on rails','microsserviço','microservice','servidor'],
      'dev:fullstack':        ['fullstack','full stack','full-stack','front e back','back e front','stack completa'],
      'mobile:android':       ['android','kotlin','jetpack compose','android studio'],
      'mobile:ios':           ['ios','swift','xcode','objective-c','swiftui'],
      'mobile:flutter':       ['flutter','dart'],
      'mobile:reactnative':   ['react native','expo','react-native'],
      'dados:analytics':      ['business intelligence','bi','tableau','power bi','looker','qlik','analytics','google analytics','relatório gerencial','analista de dados','data analyst'],
      'dados:engenharia':     ['data engineer','engenheiro de dados','pipeline de dados','spark','dbt','airflow','bigquery','etl','data warehouse','lakehouse','data platform'],
      'dados:dba':            ['dba','database administrator','postgresql','mysql','oracle','sql server','mongodb','administrador de banco','tuning de banco'],
      'ia:datascience':       ['data science','cientista de dados','machine learning','deep learning','sklearn','xgboost','pytorch','tensorflow'],
      'ia:llm':               ['llm','gpt','nlp','generative ai','langchain','openai','genai','processamento de linguagem','transformer','rag','langsmith'],
      'ia:mlops':             ['mlops','ml engineer','model deployment','kubeflow','mlflow','vertex ai','sagemaker','feature store'],
      'devopscloud:devops':   ['devops','sre','site reliability','ci/cd','gitops','argocd','jenkins','terraform','ansible','pipeline','github actions'],
      'devopscloud:cloud':    ['aws','azure','gcp','google cloud','nuvem','s3','ec2','lambda','cloud architect','serverless','multicloud'],
      'devopscloud:k8s':      ['kubernetes','k8s','docker','container','helm','istio','containerd','openshift'],
      'produtoqa:ux':         ['ux designer','ui designer','product designer','figma','design system','experiência do usuário','protótipo','ux researcher','acessibilidade'],
      'produtoqa:qa':         ['qa','quality assurance','automação de teste','selenium','cypress','playwright','jest','bdd','tdd','sdet','controle de qualidade'],
      'produtoqa:pm':         ['product manager','product owner','po','scrum master','agile','roadmap','backlog','metodologia ágil'],
      'produtoqa:arquitetura':['arquiteto','architect','tech lead','líder técnico','principal engineer','staff engineer','solution architect','sistema distribuído'],
      'suporte:helpdesk':     ['suporte técnico','help desk','service desk','n1','n2','n3','técnico de informática','field service','atendimento técnico'],
      'suporte:sysadmin':     ['sysadmin','linux admin','windows server','active directory','administrador de sistemas','administrador de redes','powershell'],
      'suporte:redes':        ['redes','network engineer','firewall','vpn','cisco','ccna','infra de rede','switching','routing'],
      // Segurança
      soc:      ['soc','blue team','siem','splunk','incident response','threat hunt','dfir','forense','monitoramento de segurança'],
      pentest:  ['pentest','penetration test','red team','oscp','kali','metasploit','burp suite','exploit','ctf','ethical hack','teste de invasão'],
      grc:      ['grc','compliance','iso 27001','lgpd','gdpr','auditoria','risco','governance','nist','gestão de risco','política de segurança'],
      appsec:   ['appsec','owasp','sast','dast','devsecops','secure coding','application security','segurança de aplicação','threat modeling','bug bounty'],
      cloudsec: ['cloud security','aws security','azure security','gcp security','iam','zero trust','cspm','cwpp','postura de segurança'],
    };
    const specMatch = !s.specialty  || (SPEC_KW[s.specialty]  || []).some(kw => text.includes(kw));
    const areaKey   = s.subAreaFilter || s.areaFilter;
    const areaMatch = !areaKey || (SPEC_KW[areaKey] || []).some(kw => text.includes(kw));

    return cargoMatch && skillsMatch && localMatch && modeMatch && contractMatch && levelMatch && sizeMatch && regionMatch && dateMatch && expiredMatch && specMatch && areaMatch;
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

/* Referência de salários mensais CLT em BRL — base de mercado BR (2025) */
const SALARY_REF = {
  // Linguagens
  python:            { min: 4500,  med: 9000,  max: 18000 },
  javascript:        { min: 3500,  med: 7500,  max: 15000 },
  typescript:        { min: 4000,  med: 8500,  max: 17000 },
  react:             { min: 4000,  med: 8000,  max: 16000 },
  'vue':             { min: 3800,  med: 7800,  max: 15000 },
  'node.js':         { min: 4500,  med: 9000,  max: 18000 },
  nodejs:            { min: 4500,  med: 9000,  max: 18000 },
  java:              { min: 4500,  med: 10000, max: 20000 },
  golang:            { min: 6000,  med: 13000, max: 25000 },
  go:                { min: 6000,  med: 13000, max: 25000 },
  rust:              { min: 8000,  med: 16000, max: 30000 },
  kotlin:            { min: 5000,  med: 11000, max: 22000 },
  swift:             { min: 5000,  med: 11000, max: 22000 },
  flutter:           { min: 4000,  med: 8500,  max: 17000 },
  'c#':              { min: 4000,  med: 9000,  max: 18000 },
  dotnet:            { min: 4000,  med: 9000,  max: 18000 },
  php:               { min: 3000,  med: 6500,  max: 13000 },
  ruby:              { min: 5000,  med: 11000, max: 20000 },
  scala:             { min: 8000,  med: 15000, max: 28000 },
  // Cloud / Infra
  aws:               { min: 6000,  med: 13000, max: 25000 },
  azure:             { min: 5500,  med: 12000, max: 22000 },
  gcp:               { min: 6000,  med: 13000, max: 25000 },
  docker:            { min: 5000,  med: 10000, max: 20000 },
  kubernetes:        { min: 7000,  med: 15000, max: 28000 },
  k8s:               { min: 7000,  med: 15000, max: 28000 },
  terraform:         { min: 7000,  med: 14000, max: 26000 },
  devops:            { min: 6000,  med: 13000, max: 25000 },
  sre:               { min: 7000,  med: 14000, max: 28000 },
  // Dados
  sql:               { min: 3500,  med: 7000,  max: 14000 },
  'power bi':        { min: 3500,  med: 7000,  max: 14000 },
  tableau:           { min: 4000,  med: 8000,  max: 16000 },
  spark:             { min: 7000,  med: 14000, max: 26000 },
  dbt:               { min: 6000,  med: 12000, max: 22000 },
  airflow:           { min: 6500,  med: 13000, max: 24000 },
  // Segurança
  pentest:           { min: 4000,  med: 9000,  max: 18000 },
  soc:               { min: 3500,  med: 7000,  max: 14000 },
  appsec:            { min: 5000,  med: 11000, max: 22000 },
  owasp:             { min: 5000,  med: 10000, max: 20000 },
  // Roles
  frontend:          { min: 3500,  med: 7500,  max: 15000 },
  'front-end':       { min: 3500,  med: 7500,  max: 15000 },
  backend:           { min: 4000,  med: 9000,  max: 18000 },
  'back-end':        { min: 4000,  med: 9000,  max: 18000 },
  fullstack:         { min: 4000,  med: 8500,  max: 17000 },
  'full stack':      { min: 4000,  med: 8500,  max: 17000 },
  mobile:            { min: 4500,  med: 9500,  max: 19000 },
  'data science':    { min: 5000,  med: 12000, max: 22000 },
  'machine learning':{ min: 7000,  med: 15000, max: 28000 },
  'data engineer':   { min: 6000,  med: 13000, max: 24000 },
  'product manager': { min: 7000,  med: 14000, max: 26000 },
  'product owner':   { min: 5000,  med: 10000, max: 18000 },
  'ux designer':     { min: 3500,  med: 7500,  max: 15000 },
  qa:                { min: 3500,  med: 7000,  max: 14000 },
  'tech lead':       { min: 10000, med: 18000, max: 30000 },
  // Níveis
  'júnior':          { min: 2500,  med: 4500,  max: 7000  },
  junior:            { min: 2500,  med: 4500,  max: 7000  },
  pleno:             { min: 5000,  med: 9000,  max: 14000 },
  'sênior':          { min: 9000,  med: 16000, max: 28000 },
  senior:            { min: 9000,  med: 16000, max: 28000 },
};

function calcMarket(jobs, query) {
  const fmtBrl = n => `R$ ${fmt(n)}`;

  // 1. Referência curada por skill/cargo (fonte primária)
  if (query) {
    const q = query.toLowerCase().trim();
    const key = Object.keys(SALARY_REF).find(k => q.includes(k) || k.includes(q.split(' ')[0]));
    if (key) {
      const r = SALARY_REF[key];
      return { min: fmtBrl(r.min), med: fmtBrl(r.med), max: fmtBrl(r.max), source: 'ref' };
    }
  }

  // 2. Fallback: média dos salários mensais das vagas (descarta anuais/absurdos)
  if (!jobs.length) return { min: 'R$ —', med: 'R$ —', max: 'R$ —', source: 'empty' };
  const parseMonthly = raw => {
    const nums = (raw || '').match(/[\d.]+/g);
    if (!nums) return [];
    return nums.map(n => parseInt(n.replace(/\./g,''))).filter(n => n >= 1500 && n <= 50000);
  };
  const vals = jobs.flatMap(j => parseMonthly(j.salary)).sort((a,b) => a - b);
  if (!vals.length) return { min: 'R$ —', med: 'R$ —', max: 'R$ —', source: 'none' };
  const med = vals[Math.floor(vals.length / 2)];
  const avg = Math.round(vals.reduce((s,n) => s+n, 0) / vals.length);
  return { min: fmtBrl(Math.round(avg * 0.75)), med: fmtBrl(avg), max: fmtBrl(Math.round(avg * 1.35)), source: 'jobs' };
}

/* Retorna null se o salário da vaga parece anual ou absurdo */
function sanitizeSalary(raw) {
  if (!raw) return null;
  const nums = (raw.match(/[\d.]+/g) || []).map(n => parseInt(n.replace(/\./g,'')));
  const valid = nums.filter(n => n > 0);
  if (!valid.length) return null;
  const maxVal = Math.max(...valid);
  if (maxVal > 60000) return null;  // provável anual ou moeda estrangeira
  if (maxVal < 500)   return null;  // provavelmente erro de parse
  return raw;
}

function jobCardV2(j, dynMatch) {
  const match   = dynMatch !== undefined ? dynMatch : j.match;
  const locType = j.location?.split('·')[0]?.trim() || j.location;
  const locClass = locType.toLowerCase().includes('remoto') ? 'remote'
    : locType.toLowerCase().includes('híbrido') ? 'hybrid' : 'onsite';
  const matchCls = match >= 80 ? '' : match >= 60 ? 'mid' : 'low';

  const levelCls    = j.level === 'Júnior' ? 'junior' : j.level === 'Sênior' ? 'senior' : 'pleno';
  const contractCls = j.contract === 'PJ' ? 'pj' : j.contract === 'Estágio' ? 'estagio' : 'clt';
  const sizeCls     = j.companySize === 'Startup' ? 'startup' : j.companySize === 'Grande empresa' ? 'grande' : 'pme';

  const SOURCE_TTL = { remotar: 45, greenhouse: 30, lever: 30, vagas: 21, gupy: 30 };
  const ttlDays    = SOURCE_TTL[j.source] || 30;
  const ageDays    = j.postedAt ? (Date.now() - new Date(j.postedAt)) / 86400000 : null;
  const isExpired  = j.expiredBySource
    || (j.expiresAt && new Date(j.expiresAt) < new Date())
    || (ageDays !== null && ageDays > ttlDays);
  const isNew      = ageDays !== null && ageDays < 1;
  const dateAgeCls = ageDays === null ? '' : ageDays < 1 ? 'fresh' : ageDays < 7 ? 'recent' : ageDays < 30 ? 'old' : 'stale';

  return `
    <article class="job-card-v2 ${isExpired ? 'jcv2-expired' : ''}" data-id="${j.id}">
      <div class="jcv2-head">
        <div class="jcv2-logo" style="background:${j.color}">${escapeHtml(j.logo)}</div>
        <div style="min-width:0">
          <div class="jcv2-title">
            ${escapeHtml(j.title)}
            ${isNew ? '<span class="badge-nova">NOVA</span>' : ''}
            ${isExpired ? '<span class="badge-encerrada">ENCERRADA</span>' : ''}
          </div>
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
        ${sanitizeSalary(j.salary)
          ? `<span class="jcv2-salary-icon">💰</span>${escapeHtml(sanitizeSalary(j.salary))} <span style="font-weight:500;color:var(--text-mut);font-size:11px">/mês</span>`
          : `<span style="color:var(--text-mut);font-size:11px">Salário não divulgado</span>`}
      </div>
      <div class="jcv2-skills">
        ${j.tags.slice(0, 4).map(t => `<span class="jcv2-skill">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="jcv2-sep"></div>
      <div class="jcv2-foot">
        ${j.externalUrl
          ? `<a class="jcv2-cta" href="${escapeHtml(j.externalUrl)}" target="_blank" rel="noopener noreferrer">Ver vaga ↗</a>`
          : `<span class="jcv2-cta jcv2-cta-disabled">Indisponível</span>`}
        <span class="jcv2-date ${dateAgeCls}">${escapeHtml(j.posted || 'recente')}</span>
        ${store.applications[j.id]
          ? `<button class="btn-apply-job applied" data-job-id="${escapeHtml(j.id)}" title="Ver no kanban">
               ${STAGE_LABELS[store.applications[j.id].stage] || 'Candidatado'} ✓
             </button>`
          : `<button class="btn-apply-job" data-job-id="${escapeHtml(j.id)}" title="Candidatar-se">
               Candidatar
             </button>`}
        <span class="jcv2-match">
          Compatibilidade <span class="jcv2-match-pct ${matchCls}">${match}%</span>
        </span>
      </div>
    </article>
  `;
}

/* ============================================================
   Kanban de Candidaturas
   ============================================================ */
/* Labels curtos para os chips de filtro quando activos */
const AREA_BTN_LABELS = {
  dev:         'Dev Web',
  mobile:      'Mobile',
  dados:       'Dados',
  ia:          'IA & ML',
  devopscloud: 'DevOps / Cloud',
  produtoqa:   'Produto / QA',
  suporte:     'Suporte & Redes',
  // legado
  backend:'Backend', frontend:'Frontend', fullstack:'Full Stack',
  data:'Data / IA',  dadosai:'Dados & IA', devops:'DevOps / SRE',
  cloud:'Cloud',     arqtech:'Arquitetura', qa:'QA', ux:'UX / Produto',
  bi:'BI / Analytics', infra:'Infra', infraredes:'Infra & Redes',
  dba:'DBA', games:'Games',
};
const SPEC_BTN_LABELS = {
  soc:'SOC / Blue', pentest:'Pentest', grc:'GRC', appsec:'AppSec', cloudsec:'Cloud Sec',
};

const AREA_SUBOPTIONS = {
  dev:         [['dev:frontend','Frontend'], ['dev:backend','Backend'], ['dev:fullstack','Full Stack']],
  mobile:      [['mobile:android','Android'], ['mobile:ios','iOS'], ['mobile:flutter','Flutter / Dart'], ['mobile:reactnative','React Native']],
  dados:       [['dados:analytics','Analytics / BI'], ['dados:engenharia','Eng. de Dados'], ['dados:dba','DBA']],
  ia:          [['ia:datascience','Data Science'], ['ia:llm','LLMs / GenAI'], ['ia:mlops','MLOps']],
  devopscloud: [['devopscloud:devops','DevOps / SRE'], ['devopscloud:cloud','Cloud'], ['devopscloud:k8s','Kubernetes / Docker']],
  produtoqa:   [['produtoqa:ux','UX / UI'], ['produtoqa:qa','QA / Testes'], ['produtoqa:pm','Product Manager'], ['produtoqa:arquitetura','Arquitetura']],
  suporte:     [['suporte:helpdesk','Help Desk'], ['suporte:sysadmin','Sysadmin'], ['suporte:redes','Redes']],
};

const SUBAREA_BTN_LABELS = {
  'dev:frontend':'Dev · Frontend', 'dev:backend':'Dev · Backend', 'dev:fullstack':'Dev · Full Stack',
  'mobile:android':'Mobile · Android', 'mobile:ios':'Mobile · iOS', 'mobile:flutter':'Mobile · Flutter', 'mobile:reactnative':'Mobile · RN',
  'dados:analytics':'Dados · Analytics', 'dados:engenharia':'Dados · Eng. Dados', 'dados:dba':'Dados · DBA',
  'ia:datascience':'IA · Data Science', 'ia:llm':'IA · LLMs', 'ia:mlops':'IA · MLOps',
  'devopscloud:devops':'DevOps · SRE', 'devopscloud:cloud':'DevOps · Cloud', 'devopscloud:k8s':'DevOps · K8s',
  'produtoqa:ux':'Produto · UX/UI', 'produtoqa:qa':'Produto · QA', 'produtoqa:pm':'Produto · PM', 'produtoqa:arquitetura':'Produto · Arq.',
  'suporte:helpdesk':'Suporte · Help Desk', 'suporte:sysadmin':'Suporte · Sysadmin', 'suporte:redes':'Suporte · Redes',
};

function buildSubPanel(areaVal) {
  const s = store.ui.jobSearch;
  const opts = [['', 'Todas'], ...(AREA_SUBOPTIONS[areaVal] || [])];
  return opts.map(([v, l]) =>
    `<button class="mode-btn sub-mode-btn ${s.subAreaFilter === v ? 'active' : ''}" data-filter="subAreaFilter" data-value="${v}">${l}</button>`
  ).join('');
}

const STAGES = ['applied','reviewing','interview','offer','rejected'];
const STAGE_LABELS = {
  applied:   'Candidatado',
  reviewing: 'Em Análise',
  interview: 'Entrevista',
  offer:     'Oferta',
  rejected:  'Rejeitado',
};
const STAGE_ICONS = {
  applied:   '⚔',
  reviewing: '🔍',
  interview: '💬',
  offer:     '🏆',
  rejected:  '✕',
};
const STAGE_COLORS = {
  applied:   '#3b82f6',
  reviewing: '#f59e0b',
  interview: '#8b5cf6',
  offer:     '#22c55e',
  rejected:  '#6b7280',
};

function renderKanban() {
  const el = $('#view');
  if (!el) return;

  const apps = store.applications;
  const total = Object.keys(apps).length;

  const jobMap = {};
  for (const j of store.jobs) jobMap[j.id] = j;

  const colHTML = STAGES.map(stage => {
    const cards = Object.entries(apps)
      .filter(([, a]) => a.stage === stage)
      .map(([jobId, app]) => {
        const j = jobMap[jobId];
        const title   = j ? escapeHtml(j.title)   : 'Vaga removida';
        const company = j ? escapeHtml(j.company) : '—';
        const logo    = j ? escapeHtml(j.logo)    : '?';
        const color   = j ? j.color               : '#64748b';
        const posted  = j ? escapeHtml(j.posted || 'recente') : '—';
        const url     = j?.externalUrl ? `href="${escapeHtml(j.externalUrl)}" target="_blank" rel="noopener"` : '';
        const idx     = STAGES.indexOf(stage);
        const prevStage = idx > 0 ? STAGES[idx - 1] : null;
        const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;

        return `
          <div class="kc" data-id="${escapeHtml(jobId)}">
            <div class="kc-head">
              <div class="kc-logo" style="background:${color}">${logo}</div>
              <div class="kc-info">
                ${j ? `<a class="kc-title" ${url}>${title}</a>` : `<span class="kc-title">${title}</span>`}
                <span class="kc-company">${company}</span>
              </div>
            </div>
            <div class="kc-meta">${posted}</div>
            <div class="kc-actions">
              ${prevStage ? `<button class="kc-btn kc-btn-prev" data-id="${escapeHtml(jobId)}" data-stage="${prevStage}" title="${STAGE_LABELS[prevStage]}">← ${STAGE_LABELS[prevStage]}</button>` : '<span></span>'}
              ${nextStage ? `<button class="kc-btn kc-btn-next" data-id="${escapeHtml(jobId)}" data-stage="${nextStage}" title="${STAGE_LABELS[nextStage]}">${STAGE_LABELS[nextStage]} →</button>` : '<span></span>'}
              <button class="kc-btn kc-btn-rm" data-id="${escapeHtml(jobId)}" title="Remover">✕</button>
            </div>
          </div>`;
      }).join('');

    const count = Object.values(apps).filter(a => a.stage === stage).length;
    return `
      <div class="kanban-col">
        <div class="kanban-col-hdr" style="border-top-color:${STAGE_COLORS[stage]}">
          <span>${STAGE_ICONS[stage]} ${STAGE_LABELS[stage]}</span>
          <span class="kanban-col-count">${count}</span>
        </div>
        <div class="kanban-cards">${cards || '<p class="kc-empty">Nenhuma</p>'}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="kanban-wrap">
      <div class="kanban-hdr">
        <span class="pixel kanban-title">⚔ CANDIDATURAS</span>
        <span class="kanban-total">${total} vaga${total !== 1 ? 's' : ''} acompanhada${total !== 1 ? 's' : ''}</span>
        ${total === 0 ? `<span class="kanban-hint">Candidate-se em vagas usando o botão <strong>Candidatar</strong> nos cards.</span>` : ''}
      </div>
      <div class="kanban-board">${colHTML}</div>
    </div>`;

  el.querySelectorAll('[data-stage]').forEach(btn => {
    btn.addEventListener('click', () => updateApplicationStage(btn.dataset.id, btn.dataset.stage));
  });
  el.querySelectorAll('.kc-btn-rm').forEach(btn => {
    btn.addEventListener('click', () => removeApplication(btn.dataset.id));
  });
}

function _refreshFilterToggle(filterName, value) {
  if (filterName === 'areaFilter') return; // área agora usa _refreshAreaBtn por botão
  const btn = $('#ftb-security');
  if (!btn) return;
  const label = btn.querySelector('.ftb-label');
  const xBtn  = btn.querySelector('.ftb-x');
  const displayLabel = value ? (SPEC_BTN_LABELS[value] || '+ Segurança') : '+ Segurança';
  if (value) {
    btn.classList.add('has-active');
    if (label) label.textContent = displayLabel;
    if (!xBtn) {
      const x = document.createElement('span');
      x.className = 'ftb-x'; x.dataset.clearfilter = filterName; x.textContent = '×';
      btn.appendChild(x);
    }
  } else {
    btn.classList.remove('has-active');
    if (label) label.textContent = '+ Segurança';
    xBtn?.remove();
  }
}

let _openAreaKey = '';

function _refreshAreaBtn(key) {
  const btn = document.querySelector(`[data-areabtn="${key}"]`);
  if (!btn) return;
  const s = store.ui.jobSearch;
  const isActive = s.areaFilter === key || (s.subAreaFilter && s.subAreaFilter.startsWith(key + ':'));
  const labelEl = btn.querySelector('.ftb-label');
  const xEl = btn.querySelector('.ftb-x');
  const lbl = AREA_BTN_LABELS[key] || key;
  const subLabel = s.subAreaFilter && s.subAreaFilter.startsWith(key + ':') ? SUBAREA_BTN_LABELS[s.subAreaFilter] : null;
  if (isActive) {
    btn.classList.add('has-active');
    if (labelEl) labelEl.textContent = subLabel || ('+ ' + lbl);
    if (!xEl) {
      const x = document.createElement('span');
      x.className = 'ftb-x'; x.dataset.cleararea = key; x.textContent = '×';
      btn.appendChild(x);
    }
  } else {
    btn.classList.remove('has-active');
    if (labelEl) labelEl.textContent = '+ ' + lbl;
    xEl?.remove();
  }
}

function bindJobsPageEvents() {
  const s = store.ui.jobSearch;

  // Chip pill toggle buttons (área individual + segurança)
  $('.filter-toggle-row')?.addEventListener('click', e => {
    // × em botão de área individual
    const clearAreaX = e.target.closest('[data-cleararea]');
    if (clearAreaX) {
      const key = clearAreaX.dataset.cleararea;
      s.areaFilter = ''; s.subAreaFilter = ''; _openAreaKey = '';
      const subPanel = $('#fpl-subarea');
      if (subPanel) subPanel.style.display = 'none';
      _refreshAreaBtn(key);
      updateJobResults();
      return;
    }
    // × em botão de segurança
    const clearSecX = e.target.closest('[data-clearfilter]');
    if (clearSecX) {
      const filter = clearSecX.dataset.clearfilter;
      s[filter] = '';
      _refreshFilterToggle(filter, '');
      const secBtn = clearSecX.closest('.filter-toggle-btn');
      if (secBtn) { const p = $('#' + secBtn.dataset.panel); if (p) p.style.display = 'none'; secBtn.classList.remove('open'); }
      updateJobResults();
      return;
    }
    // Clique em botão de área individual
    const areaBtn = e.target.closest('[data-areabtn]');
    if (areaBtn) {
      const key = areaBtn.dataset.areabtn;
      const subPanel = $('#fpl-subarea');
      // Fechar painel de segurança se aberto
      const secPanel = $('#fpl-security'); const secBtn2 = $('#ftb-security');
      if (secPanel) secPanel.style.display = 'none'; if (secBtn2) secBtn2.classList.remove('open');
      if (_openAreaKey === key && subPanel?.style.display !== 'none') {
        // Fechar sub-painel ao clicar no mesmo botão
        if (subPanel) subPanel.style.display = 'none';
        areaBtn.classList.remove('open');
        _openAreaKey = '';
      } else {
        // Fechar sub-painel de outra área
        if (_openAreaKey && _openAreaKey !== key) {
          const prev = document.querySelector(`[data-areabtn="${_openAreaKey}"]`);
          if (prev) prev.classList.remove('open');
        }
        _openAreaKey = key;
        if (!s.subAreaFilter?.startsWith(key + ':')) s.subAreaFilter = '';
        s.areaFilter = key;
        if (subPanel && AREA_SUBOPTIONS[key]) {
          subPanel.innerHTML = `<span class="subarea-back-label">▸ ${AREA_BTN_LABELS[key] || key}</span>${buildSubPanel(key)}`;
          subPanel.style.display = 'flex';
        }
        areaBtn.classList.add('open');
        _refreshAreaBtn(key);
        updateJobResults();
      }
      return;
    }
    // Botão de segurança (data-panel)
    const toggleBtn = e.target.closest('[data-panel]');
    if (!toggleBtn) return;
    const panelId = toggleBtn.dataset.panel;
    const panel   = $('#' + panelId);
    if (!panel) return;
    if (panel.style.display !== 'none') {
      panel.style.display = 'none'; toggleBtn.classList.remove('open');
    } else {
      // Fechar sub-painéis de área
      const subPanel = $('#fpl-subarea');
      if (subPanel) subPanel.style.display = 'none';
      if (_openAreaKey) { const p = document.querySelector(`[data-areabtn="${_openAreaKey}"]`); if (p) p.classList.remove('open'); _openAreaKey = ''; }
      panel.style.display = 'flex'; toggleBtn.classList.add('open');
    }
  });

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
    if (filter === 'areaFilter') {
      // handler legado (sem botões fpl-area, mas mantido por segurança)
      s.areaFilter = value; s.subAreaFilter = '';
      updateJobResults();
      return;
    }
    if (filter === 'subAreaFilter') {
      s.subAreaFilter = value;
      const subPanel = $('#fpl-subarea');
      if (subPanel) subPanel.style.display = 'none';
      if (_openAreaKey) {
        document.querySelector(`[data-areabtn="${_openAreaKey}"]`)?.classList.remove('open');
        _openAreaKey = '';
      }
      if (s.areaFilter) _refreshAreaBtn(s.areaFilter);
      updateJobResults();
      return;
    }
    if (filter === 'mode' || filter === 'region' || filter === 'dateFilter' || filter === 'specialty') {
      s[filter] = value;
      $$(`[data-filter="${filter}"]`).forEach(b => b.classList.toggle('active', b.dataset.value === value));
      if (filter === 'specialty') {
        _refreshFilterToggle(filter, value);
        if (value) {
          const panel = $('#fpl-security');
          const btn   = $(`[data-panel="fpl-security"]`);
          if (panel) panel.style.display = 'none';
          if (btn)   btn.classList.remove('open');
        }
      }
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
    s.cargo = ''; s.localidade = ''; s.skills = []; s.mode = 'todos'; s.region = 'todas';
    s.dateFilter = 'all'; s.hideExpired = true; s.graduacao = ''; s.specialty = ''; s.areaFilter = ''; s.subAreaFilter = '';
    s.contracts = []; s.levels = []; s.sizes = [];
    renderJobsPage();
  });

  $('#ms-hide-expired')?.addEventListener('change', e => {
    s.hideExpired = e.target.checked;
    updateJobResults();
  });

  $('#ms-search')?.addEventListener('click', () => { renderJobsPage(); loadRealJobs(); });

  $('#ms-cargo')?.addEventListener('keydown', e => { if (e.key === 'Enter') renderJobsPage(); });
  $('#ms-local')?.addEventListener('keydown', e => { if (e.key === 'Enter') renderJobsPage(); });
  $('#ms-graduacao')?.addEventListener('keydown', e => { if (e.key === 'Enter') renderJobsPage(); });

  // Delegação de eventos para salvar e candidatar
  $('#jobs-results')?.addEventListener('click', e => {
    const applyBtn = e.target.closest('.btn-apply-job');
    if (applyBtn) applyToJob(applyBtn.dataset.jobId, applyBtn);
  });
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
  const activeTrack = store.ui.courseTrack || 'todos';
  const activeLang  = store.ui.courseLang  || 'pt';
  const tracks      = [...new Set(store.courses.map(c => c.track))];

  let all = activeLang === 'todos' ? store.courses : store.courses.filter(c => (c.language || 'pt') === activeLang);
  if (activeTrack !== 'todos') all = all.filter(c => c.track === activeTrack);

  const inProgress  = all.filter(c => c.progress > 0 && c.progress < 100);
  const catalog     = all.filter(c => c.progress === 0 || c.progress === 100);

  const langBtns = [
    { val: 'pt',    label: '🇧🇷 Português' },
    { val: 'en',    label: '🇺🇸 English' },
    { val: 'todos', label: 'Todos' },
  ].map(l => `<button class="filter-pill ${activeLang === l.val ? 'active' : ''}" data-lang="${l.val}">${l.label}</button>`).join('');

  $('#view').innerHTML = `
    <div class="section-title" style="margin-top:0">
      <div>
        <h2>Cursos Gamificados</h2>
        <small>${store.courses.length} cursos em Tech &amp; Segurança · ganhe XP, suba de nível e desbloqueie badges</small>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="btn-course-reset"><i data-lucide="list"></i>Todos</button>
        <button class="btn btn-primary" id="btn-course-recom"><i data-lucide="sparkles"></i>Recomendado para mim</button>
      </div>
    </div>

    <div class="jobs-toolbar">
      <div class="toolbar-filters" style="gap:6px">
        <span style="font-size:12px;color:var(--text-mut);margin-right:4px">Idioma:</span>
        ${langBtns}
        <span style="width:1px;background:var(--border);margin:0 6px;align-self:stretch"></span>
        <button class="filter-pill ${activeTrack === 'todos' ? 'active' : ''}" data-track="todos">Trilha: Todas</button>
        ${tracks.map(t => `<button class="filter-pill ${activeTrack === t ? 'active' : ''}" data-track="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
      </div>
    </div>

    ${inProgress.length > 0 ? `
      <div class="section-title"><h3>Em andamento</h3><small>${inProgress.length} cursos</small></div>
      <div class="courses-grid">${inProgress.map(courseCard).join('')}</div>
    ` : ''}

    ${catalog.length > 0 ? `
      <div class="section-title"><h3>Catálogo</h3><small>Tier Bronze, Prata, Ouro e Diamante</small></div>
      <div class="courses-grid">${catalog.map(courseCard).join('')}</div>
    ` : ''}

    ${all.length === 0 ? `<div class="card panel" style="text-align:center;color:var(--text-mut);padding:40px">Nenhum curso encontrado para este filtro.</div>` : ''}
  `;

  if (window.lucide) lucide.createIcons();

  $$('[data-lang]', $('#view')).forEach(btn => {
    btn.addEventListener('click', () => { store.ui.courseLang = btn.dataset.lang; renderCourses(); });
  });

  $$('[data-track]', $('#view')).forEach(btn => {
    btn.addEventListener('click', () => { store.ui.courseTrack = btn.dataset.track; renderCourses(); });
  });

  $('#btn-course-reset')?.addEventListener('click', () => { store.ui.courseTrack = 'todos'; store.ui.courseLang = 'pt'; renderCourses(); });

  $('#btn-course-recom')?.addEventListener('click', () => {
    const userTracks = (store.user.tracks || []).map(t => t.toLowerCase());
    const match = tracks.find(t => userTracks.some(u => t.toLowerCase().split(/\s+/).some(w => u.includes(w))));
    store.ui.courseTrack = match || 'todos';
    renderCourses();
  });

  $$('[data-course-id]', $('#view')).forEach(btn => {
    btn.addEventListener('click', () => {
      const course = store.courses.find(c => c.id === btn.dataset.courseId);
      if (!course) return;
      if (course.progress === 100) {
        const skills = course.skills || course.tags || [];
        openModal(`Certificado — ${course.title}`, `
          <div style="text-align:center;padding:16px 0">
            <div style="font-size:44px;margin-bottom:12px">🏆</div>
            <div style="font-weight:700;font-size:16px;margin-bottom:6px">${escapeHtml(course.title)}</div>
            <div style="color:var(--text-mut);font-size:13px;margin-bottom:14px">${escapeHtml(course.provider || '')}${course.hours ? ` · ${course.hours}h` : ''}${course.modules ? ` · ${course.modules} módulos` : ''}</div>
            <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:14px">
              ${skills.map(s => `<span class="chip">${escapeHtml(s)}</span>`).join('')}
            </div>
            <div style="color:var(--success);font-weight:600">✓ Curso concluído com sucesso!</div>
            ${course.url ? `<a href="${escapeHtml(course.url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-top:12px">Acessar curso <i data-lucide="external-link" style="width:12px;height:12px"></i></a>` : ''}
          </div>
        `, { showCancel: false });
      } else if (course.url) {
        // Real external course — open in new tab, mark as started if first access
        window.open(course.url, '_blank', 'noopener');
        if (course.progress === 0) {
          course.progress = 10;
          const xpGain = Math.round((course.xp || 60) * 0.10);
          addXP(xpGain, 'course');
          toast(`+${xpGain} XP — curso iniciado! Continue pelo link aberto.`);
          renderCourses();
        }
      } else {
        const isStart = course.progress === 0;
        course.progress = Math.min(100, course.progress + 10);
        const xpGain = course.progress === 100 ? course.xp : Math.round(course.xp * 0.10);
        addXP(xpGain, 'course');
        const verb = course.progress === 100 ? 'concluído' : isStart ? 'iniciado' : 'avançado';
        toast(`+${xpGain} XP — curso ${verb}!`);
        renderCourses();
      }
    });
  });
}

const SOURCE_BADGE = {
  youtube:      { label: 'YT',  color: '#FF0000' },
  coursera:     { label: 'CO',  color: '#0056D2' },
  devto:        { label: 'DEV', color: '#3D3D3D' },
  freecodecamp: { label: 'FCC', color: '#0A0A23' },
};

function courseCard(c) {
  const chunks  = 12;
  const filled  = Math.round((c.progress / 100) * chunks);
  const tier    = c.tier || 'bronze';
  const srcBadge = SOURCE_BADGE[c.source];
  const skills  = c.skills || c.tags || [];
  const metaParts = [
    c.provider ? escapeHtml(c.provider) : null,
    c.modules  ? `${c.modules} módulos` : null,
    c.hours    ? `${c.hours}h` : null,
    c.students ? `${fmt(c.students)} alunos` : null,
    c.rating   ? `★ ${c.rating}` : null,
  ].filter(Boolean);
  const btnLabel = c.progress === 0 ? 'Começar' : c.progress === 100 ? 'Ver certificado' : 'Continuar';
  return `
    <article class="course-card" data-id="${c.id}">
      <div class="course-cover" style="--c1:${c.color || '#5B4FB3'};--c2:${shade(c.color || '#5B4FB3', -25)}">
        <span class="tier tier-${tier}">${tier.toUpperCase()}</span>
        ${srcBadge ? `<span class="course-src-badge" style="background:${srcBadge.color}">${srcBadge.label}</span>` : ''}
        <i data-lucide="${courseIcon(c.icon)}"></i>
      </div>
      <div class="course-body">
        <div class="meta">
          <span><i data-lucide="layers" style="width:12px;height:12px"></i>${escapeHtml(c.track || 'Tech')}</span>
          <span>·</span>
          <span>${escapeHtml(c.level || 'Variado')}</span>
          ${c.certificate ? `<span>·</span><span style="color:var(--success)">🎓 Cert</span>` : ''}
          ${c.language === 'en' ? `<span>·</span><span style="color:var(--text-mut)">EN</span>` : ''}
        </div>
        <div class="title">${escapeHtml(c.title)}</div>
        ${metaParts.length ? `<div class="meta">${metaParts.join(' · ')}</div>` : ''}
        <div class="skills">
          ${skills.slice(0, 4).map(s => `<span class="chip">${escapeHtml(s)}</span>`).join('')}
        </div>
        <div class="pxbar" title="${c.progress}% concluído">
          ${Array.from({length: chunks}, (_,i) => `<span class="chunk ${i < filled ? 'on' : ''}"></span>`).join('')}
        </div>
        <div class="course-foot">
          <span class="xp-tag"><i data-lucide="zap" style="width:10px;height:10px"></i>+${c.xp || 0} XP</span>
          <button class="btn btn-primary btn-sm" data-course-id="${c.id}">${btnLabel}</button>
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
      <button class="btn btn-primary" data-action="upload-cert"><i data-lucide="upload"></i>Enviar certificado externo</button>
    </div>

    ${section('Conquistadas', earned.map(certCard).join('') || empty('Você ainda não possui certificações'))}
    ${section('Em andamento', inProg.map(certCard).join('') || empty('Nenhuma certificação em andamento'))}
    ${section('Disponíveis', avail.map(certCard).join(''))}
  `;

  if (window.lucide) lucide.createIcons();

  $('[data-action="upload-cert"]')?.addEventListener('click', openUploadCertModal);

  $$('[data-action="study-trail"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cert = store.certs.find(c => c.id === btn.dataset.certId);
      if (!cert) return;
      openModal(`Trilha: ${cert.name}`, `
        <div>
          <p style="color:var(--text-body);margin:0 0 12px">Para obter <strong>${escapeHtml(cert.name)}</strong> — <strong>${escapeHtml(cert.issuer)}</strong>:</p>
          <ol style="padding-left:20px;color:var(--text-body);line-height:2.2;margin:0 0 12px">
            <li>Estude o material oficial de <strong>${escapeHtml(cert.issuer)}</strong></li>
            <li>Pratique com laboratórios e simulados</li>
            <li>Faça questões de provas anteriores</li>
            <li>Agende o exame no portal oficial do fornecedor</li>
            <li>Após aprovação, envie o certificado nesta página</li>
          </ol>
          <p style="color:var(--text-mut);font-size:12px;margin:0">+${cert.xp} XP ao concluir · categoria: ${escapeHtml(cert.category)}</p>
        </div>
      `, { showCancel: false });
    });
  });
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
            <button class="btn btn-ghost btn-sm" style="margin-left:auto" data-action="study-trail" data-cert-id="${c.id}">Trilha de estudos</button>
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
const ACH_TIER = { bronze: 'B', prata: 'A', ouro: 'S', diamante: 'SS' };

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
      ${store.achievements.map(a => {
        const tier = ACH_TIER[a.rarity] || 'B';
        return `
        <div class="ach-card ${a.unlocked ? '' : 'locked'}" data-rarity="${a.rarity}">
          <div class="ach-badge-wrap">
            <div class="ach-hex-border">
              <div class="ach-badge"><i data-lucide="${achIcon(a.icon)}"></i></div>
            </div>
            <div class="ach-tier" data-tier="${tier}">${tier}</div>
          </div>
          <div class="ach-name">${escapeHtml(a.name)}</div>
          <div class="ach-desc">${escapeHtml(a.desc)}</div>
          <div class="ach-xp">+${a.xp} XP</div>
        </div>`;
      }).join('')}
    </div>
  `;
}
function achIcon(n) {
  const m = { sword:'swords', check:'check', shield:'shield', flame:'flame', key:'key-round', cloud:'cloud', trophy:'trophy', crown:'crown', fingerprint:'fingerprint', lock:'lock', briefcase:'briefcase', target:'target', bookmark:'bookmark', 'message-square':'message-square' };
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

  const profileSkills = [...new Set(
    store.courses.filter(c => c.progress > 0).flatMap(c => c.skills)
  )];
  const skillsHtml = profileSkills.length > 0
    ? profileSkills.map(s => `<span class="chip">${escapeHtml(s)}</span>`).join('')
    : `<span style="color:var(--text-mut);font-size:13px">Comece cursos para construir suas skills.</span>`;

  const recentActs = (store.user.activities || []).slice(-5).reverse();
  const timelineHtml = recentActs.length > 0
    ? recentActs.map(a => `
      <div class="tl"><div class="tld"><i data-lucide="${activityIcon(a.type)}"></i></div>
        <div>
          <div class="ttitle">${escapeHtml(activityLabel(a.type))}</div>
          <div class="tdate">${new Date(a.ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })} · +${a.xp} XP</div>
        </div>
      </div>`).join('')
    : `<p style="color:var(--text-mut);font-size:13px">Realize ações na plataforma para ver sua linha do tempo.</p>`;

  $('#view').innerHTML = `
    <div class="section-title" style="margin-top:0">
      <div><h2>Meu Perfil</h2><small>Como recrutadores veem você</small></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" data-action="share-profile"><i data-lucide="share-2"></i>Compartilhar</button>
        <button class="btn btn-primary" data-action="edit-profile"><i data-lucide="pencil"></i>Editar perfil</button>
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
          <div class="b"><div class="v">${Object.keys(store.applications).length}</div><div class="l">Candidaturas</div></div>
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
          <div style="display:flex;flex-wrap:wrap;gap:6px">${skillsHtml}</div>
        </div>

        <div class="card profile-section">
          <div class="section-title" style="margin-top:0"><h3>Linha do tempo</h3><small>Atividades recentes</small></div>
          <div class="timeline">${timelineHtml}</div>
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

  if (window.lucide) lucide.createIcons();

  $('[data-action="share-profile"]')?.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => toast('Link copiado para a área de transferência!'))
      .catch(() => toast('Link: ' + window.location.href));
  });

  $('[data-action="edit-profile"]')?.addEventListener('click', () => {
    openModal('Editar Perfil', `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:12px;color:var(--text-mut);display:block;margin-bottom:4px">Nome</label>
          <input id="ep-name" class="mission-field-input" value="${escapeHtml(store.user.name)}" style="width:100%">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-mut);display:block;margin-bottom:4px">Cargo</label>
          <input id="ep-role" class="mission-field-input" value="${escapeHtml(store.user.role)}" style="width:100%">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-mut);display:block;margin-bottom:4px">Trilhas (separadas por vírgula)</label>
          <input id="ep-tracks" class="mission-field-input" value="${escapeHtml((store.user.tracks || []).join(', '))}" style="width:100%">
        </div>
      </div>
    `, {
      confirmLabel: 'Salvar',
      onConfirm: () => {
        const name   = $('#ep-name')?.value.trim();
        const role   = $('#ep-role')?.value.trim();
        const tracks = $('#ep-tracks')?.value.split(',').map(t => t.trim()).filter(Boolean);
        if (name) store.user.name = name;
        if (role) store.user.role = role;
        if (tracks?.length) store.user.tracks = tracks;
        paintUser();
        renderProfile();
        toast('Perfil atualizado!');
      },
    });
  });

  $$('[data-course-id]', $('#view')).forEach(btn => {
    btn.addEventListener('click', () => {
      const course = store.courses.find(c => c.id === btn.dataset.courseId);
      if (!course) return;
      if (course.progress === 100) {
        openModal(`Certificado — ${course.title}`, `
          <div style="text-align:center;padding:16px 0">
            <div style="font-size:44px;margin-bottom:12px">🏆</div>
            <div style="font-weight:700;font-size:16px;margin-bottom:6px">${escapeHtml(course.title)}</div>
            <div style="color:var(--text-mut);font-size:13px;margin-bottom:14px">${escapeHtml(course.provider)} · ${course.hours}h</div>
            <div style="color:var(--success);font-weight:600">✓ Curso concluído!</div>
          </div>
        `, { showCancel: false });
      } else {
        const isStart = course.progress === 0;
        course.progress = Math.min(100, course.progress + 10);
        const xpGain = course.progress === 100 ? course.xp : Math.round(course.xp * 0.10);
        addXP(xpGain, 'course');
        toast(`+${xpGain} XP — curso ${course.progress === 100 ? 'concluído' : isStart ? 'iniciado' : 'avançado'}!`);
        renderProfile();
      }
    });
  });
}

/* ============== XP / Toast ============== */
function addXP(amount, action = 'misc') {
  const u = store.user;

  // streak
  const todayStr = new Date().toISOString().slice(0, 10);
  if (u.lastActivity) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (u.lastActivity !== todayStr && u.lastActivity !== yesterday) u.streak = 1;
    else if (u.lastActivity === yesterday) u.streak = (u.streak || 0) + 1;
  } else { u.streak = 1; }
  u.lastActivity = todayStr;

  u.xp += amount;
  u.coins = (u.coins || 0) + Math.floor(amount / 10);
  let leveledUp = false;
  const prevLevel = u.level;
  while (u.xp >= u.xpNext) {
    u.xp -= u.xpNext;
    u.level += 1;
    u.xpNext = Math.round(u.xpNext * 1.25);
    u.coins += 100;
    leveledUp = true;
  }

  u.activities = u.activities || [];
  u.activities.unshift({ type: action, xp: amount, ts: Date.now() });
  if (u.activities.length > 90) u.activities = u.activities.slice(0, 90);

  lsSet(LS.profile, {
    xp: u.xp, level: u.level, xpNext: u.xpNext, coins: u.coins,
    streak: u.streak, lastActivity: u.lastActivity, activities: u.activities,
  });

  paintUser();
  if (leveledUp) toast(`LEVEL UP! Lv ${prevLevel} → Lv ${u.level}`, true);
  checkAchievements();
}

function openModal(title, bodyHtml, opts = {}) {
  const { onConfirm, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', showCancel = true } = opts;
  const existing = $('#jc-modal');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'jc-modal';
  el.className = 'jc-modal-overlay';
  const footHtml = onConfirm
    ? `${showCancel ? `<button class="btn btn-ghost" data-modal-close>${escapeHtml(cancelLabel)}</button>` : ''}
       <button class="btn btn-primary" data-modal-confirm>${escapeHtml(confirmLabel)}</button>`
    : `<button class="btn btn-ghost" data-modal-close>Fechar</button>`;
  el.innerHTML = `
    <div class="jc-modal">
      <div class="jc-modal-hdr">
        <span class="jc-modal-title">${escapeHtml(title)}</span>
        <button class="jc-modal-x" data-modal-close>×</button>
      </div>
      <div class="jc-modal-body">${bodyHtml}</div>
      <div class="jc-modal-foot">${footHtml}</div>
    </div>
  `;
  document.body.appendChild(el);
  if (window.lucide) lucide.createIcons();
  const close = () => el.remove();
  el.addEventListener('click', e => { if (e.target === el) close(); });
  el.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', close));
  el.querySelector('[data-modal-confirm]')?.addEventListener('click', () => { onConfirm(); close(); });
  return el;
}

function activityLabel(type) {
  const m = { apply: 'Candidatura registrada', save: 'Vaga salva', quest: 'Quest diária concluída', interview: 'Entrevista marcada', offer: 'Oferta recebida', course: 'Módulo de curso concluído', achievement: 'Conquista desbloqueada', misc: 'Ação registrada' };
  return m[type] || type;
}
function activityIcon(type) {
  const m = { apply: 'briefcase', save: 'bookmark', quest: 'target', interview: 'message-square', offer: 'trophy', course: 'graduation-cap', achievement: 'award', misc: 'zap' };
  return m[type] || 'zap';
}

let _checkingAch = false;
function checkAchievements() {
  if (_checkingAch) return;
  _checkingAch = true;
  const u = store.user;
  const applied     = Object.keys(store.applications).length;
  const inInterview = Object.values(store.applications).filter(a => a.stage === 'interview').length;

  const courseTitle = (substr) => (c) => c.title.toLowerCase().includes(substr.toLowerCase());
  const completed   = (substr) => store.courses.some(c => c.progress === 100 && courseTitle(substr)(c));
  const started     = (substr) => store.courses.some(c => c.progress > 0    && courseTitle(substr)(c));
  const myRank      = store.leaderboard.findIndex(r => r.isMe) + 1;

  const rules = [
    { id: 'a-001', ok: () => applied >= 1 },
    { id: 'a-002', ok: () => inInterview >= 1 },
    { id: 'a-003', ok: () => completed('owasp') },
    { id: 'a-004', ok: () => completed('pentest') },
    { id: 'a-005', ok: () => (u.streak || 0) >= 7 },
    { id: 'a-006', ok: () => (u.streak || 0) >= 30 },
    { id: 'a-007', ok: () => completed('criptografi') },
    { id: 'a-008', ok: () => store.certs.some(c => c.id === 'cert-004' && c.status === 'earned') },
    { id: 'a-009', ok: () => myRank > 0 && myRank <= 10 },
    { id: 'a-010', ok: () => u.level >= 30 },
    { id: 'a-011', ok: () => started('forens') },
    { id: 'a-012', ok: () => completed('zero trust') },
    { id: 'a-013', ok: () => applied >= 10 },
    { id: 'a-014', ok: () => applied >= 25 },
    { id: 'a-015', ok: () => applied >= 50 },
    { id: 'a-016', ok: () => store.courses.some(c => c.progress === 100) },
    { id: 'a-017', ok: () => Object.keys(store.savedJobs).length >= 10 },
    { id: 'a-018', ok: () => inInterview >= 3 },
  ];

  const savedAchs = lsGet(LS.achievements, []);
  let changed = false;
  for (const r of rules) {
    const ach = store.achievements.find(a => a.id === r.id);
    if (!ach || ach.unlocked || !r.ok()) continue;
    ach.unlocked = true;
    if (!savedAchs.includes(ach.id)) { savedAchs.push(ach.id); changed = true; }
    addXP(ach.xp, 'achievement');
    toastAch(ach);
  }
  if (changed) lsSet(LS.achievements, savedAchs);
  _checkingAch = false;
}

function openUploadCertModal() {
  openModal('Enviar certificado externo', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--text-mut);display:block;margin-bottom:4px">Nome da certificação *</label>
        <input id="uc-name" class="mission-field-input" placeholder="ex: AWS Solutions Architect" style="width:100%">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-mut);display:block;margin-bottom:4px">Emissor *</label>
        <input id="uc-issuer" class="mission-field-input" placeholder="ex: Amazon Web Services" style="width:100%">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-mut);display:block;margin-bottom:4px">Data de obtenção</label>
        <input id="uc-date" class="mission-field-input" type="date" style="width:100%">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-mut);display:block;margin-bottom:4px">ID da credencial</label>
        <input id="uc-id" class="mission-field-input" placeholder="ex: ABC-123-XYZ" style="width:100%">
      </div>
    </div>
  `, {
    confirmLabel: 'Adicionar',
    onConfirm: () => {
      const name   = $('#uc-name')?.value.trim();
      const issuer = $('#uc-issuer')?.value.trim();
      const date   = $('#uc-date')?.value;
      const credId = $('#uc-id')?.value.trim();
      if (!name || !issuer) { toast('Preencha nome e emissor'); return; }
      store.certs.unshift({
        id: 'ext-' + Date.now(), name, issuer,
        credentialId: credId || '—',
        status: 'earned',
        earnedAt: date || new Date().toISOString().slice(0, 10),
        xp: 100, category: 'Externo', color: '#4CAF50',
        voucherIncluded: false, progress: 100,
      });
      addXP(100, 'cert');
      toast('+100 XP — certificação adicionada!');
      renderCerts();
    },
  });
}

function _relTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'agora';
  if (m < 60)  return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7)   return `há ${d} dias`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const _NOTIF_COLOR = {
  apply: '#8250df', save: '#5B4FB3', quest: '#FACC15',
  course: '#10B981', cert: '#F59E0B', achievement: '#EF4444',
  streak: '#F97316', login: '#3B82F6', misc: '#64748B',
};

function openMensagensModal() {
  const acts = (store.user?.activities || []).slice(0, 30);
  const rows = acts.map(a => {
    const icon  = activityIcon(a.type);
    const color = _NOTIF_COLOR[a.type] || '#64748B';
    const label = activityLabel(a.type);
    const xpTag = a.xp ? ` · <span style="color:${color};font-weight:700">+${a.xp} XP</span>` : '';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:36px;height:36px;border-radius:50%;background:${color}22;color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i data-lucide="${icon}" style="width:16px;height:16px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--text);font-weight:500">${escapeHtml(label)}${xpTag}</div>
          <div style="font-size:11px;color:var(--text-mut)">${_relTime(a.ts)}</div>
        </div>
      </div>`;
  }).join('');

  const empty = acts.length === 0
    ? `<p style="text-align:center;color:var(--text-mut);font-size:13px;padding:24px 0">Nenhuma atividade ainda. Candidate-se, salve vagas e complete cursos!</p>`
    : '';

  openModal('Notificações & Histórico', `
    <div style="display:flex;flex-direction:column;gap:2px;max-height:420px;overflow-y:auto">
      ${rows}${empty}
    </div>
  `, { showCancel: false });
}

function openConfiguracoesModal() {
  const isDark = document.body.classList.contains('dark-theme');
  openModal('Configurações', `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:600;color:var(--text)">Tema escuro</div>
          <div style="font-size:12px;color:var(--text-mut)">Alterna entre tema claro e escuro</div>
        </div>
        <label class="jc-toggle">
          <input type="checkbox" id="cfg-dark" ${isDark ? 'checked' : ''}>
          <span class="jc-toggle-track"></span>
        </label>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:16px">
        <div style="font-weight:600;color:var(--text);margin-bottom:8px">Ocultar vagas encerradas</div>
        <label class="jc-toggle">
          <input type="checkbox" id="cfg-expired" ${store.ui.jobSearch.hideExpired ? 'checked' : ''}>
          <span class="jc-toggle-track"></span>
        </label>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:16px">
        <div style="font-weight:600;color:var(--text);margin-bottom:4px">Versão</div>
        <div style="font-size:12px;color:var(--text-mut)">Jobcraft v2.0 · build ${new Date().toLocaleDateString('pt-BR')}</div>
      </div>
    </div>
  `, {
    confirmLabel: 'Salvar',
    onConfirm: () => {
      const wantDark    = $('#cfg-dark')?.checked;
      const hideExpired = $('#cfg-expired')?.checked;
      const nowDark = document.body.classList.contains('dark-theme');
      if (wantDark !== nowDark) toggleDarkTheme();
      store.ui.jobSearch.hideExpired = !!hideExpired;
      toast('Configurações salvas!');
    },
  });
}

function toggleDarkTheme() {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('jc-theme', isDark ? 'dark' : 'light');
  const item = $('#user-menu [data-action="theme"]');
  if (item) item.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}"></i> ${isDark ? 'Tema claro' : 'Tema escuro'}`;
  if (window.lucide) lucide.createIcons();
}

function logout() {
  openModal('Sair do Jobcraft', `<p style="color:var(--text-body)">Tem certeza que deseja encerrar a sessão?</p>`, {
    confirmLabel: 'Sair',
    onConfirm: () => { localStorage.removeItem('jc-theme'); location.reload(); },
  });
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

function toastQuest(quest) {
  pushNotif({ type: 'quest', icon: '⚔', title: 'Quest pronta!', desc: `${quest.title} · +${quest.xp} XP disponível`, action: 'missoes' });
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast toast-quest';
  el.innerHTML = `
    <i data-lucide="target" style="color:#FACC15;flex-shrink:0"></i>
    <div style="flex:1">
      <div class="pixel" style="color:#FACC15;font-size:9px">QUEST PRONTA!</div>
      <div class="msg" style="font-weight:700">${escapeHtml(quest.title)}</div>
      <div class="msg" style="font-size:11px;opacity:.8">+${quest.xp} XP · Clique para resgatar</div>
    </div>`;
  el.addEventListener('click', () => {
    const tab = document.querySelector('.rp-tab[data-rptab="missoes"]');
    if (tab) tab.click();
    el.remove();
  });
  root.appendChild(el);
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.style.transform = 'translateX(120%)';
    setTimeout(() => el.remove(), 400);
  }, 6000);
}

const RARITY_COLOR = { bronze: '#cd7f32', prata: '#94a3b8', ouro: '#FACC15', diamante: '#38bdf8' };
const RARITY_ICON  = { bronze: '🥉', prata: '🥈', ouro: '🥇', diamante: '💎' };
function toastAch(ach) {
  pushNotif({ type: 'achievement', icon: RARITY_ICON[ach.rarity] || '🏆', title: `Conquista: ${ach.name}`, desc: `${ach.desc} · +${ach.xp} XP` });
  const root  = $('#toast-root');
  const color = RARITY_COLOR[ach.rarity] || '#FACC15';
  const el = document.createElement('div');
  el.className = 'toast toast-ach';
  el.style.setProperty('--ach-color', color);
  el.innerHTML = `
    <i data-lucide="award" style="color:${color};flex-shrink:0"></i>
    <div>
      <div class="pixel" style="color:${color}">CONQUISTA!</div>
      <div class="msg" style="font-weight:700">${escapeHtml(ach.name)}</div>
      <div class="msg" style="font-size:11px;opacity:.8">${escapeHtml(ach.desc)} · +${ach.xp} XP</div>
    </div>`;
  root.appendChild(el);
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.style.transform = 'translateX(120%)';
    setTimeout(() => el.remove(), 400);
  }, 4500);
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

/* ============================================================
   Docs
   ============================================================ */
function renderDocs() {
  const sections = [
    {
      icon: 'layout-dashboard',
      title: 'Dashboard',
      color: '#6C63FF',
      items: [
        { label: 'Visão geral', desc: 'Apresenta seus KPIs: vagas salvas, candidaturas ativas, nível atual e XP acumulado.' },
        { label: 'Quests de hoje', desc: 'Missões diárias com XP como recompensa. Clique em uma quest concluída para receber os pontos.' },
        { label: 'Heatmap de atividade', desc: 'Grade de 30 dias mostrando sua frequência de uso. Quanto mais ações por dia, mais escura a célula.' },
        { label: 'Cursos em progresso', desc: 'Atalho para os 3 cursos com progresso ativo — para você não perder o ritmo.' },
      ],
    },
    {
      icon: 'briefcase',
      title: 'Vagas',
      color: '#00BCD4',
      items: [
        { label: 'Busca por cargo', desc: 'Digite o título desejado (ex: Analista de Segurança) e pressione Enter ou clique em Buscar.' },
        { label: 'Localidade', desc: 'Filtre por cidade (ex: São Paulo) ou deixe vazio para ver todas as regiões.' },
        { label: 'Regime de trabalho', desc: 'Todos · Remoto · Híbrido · Presencial. O filtro Presencial mostra vagas sem indicação remota ou híbrida.' },
        { label: 'Filtro TI', desc: 'Chip expansível com subcategorias: Backend, Frontend, Full Stack, Mobile, Data/IA, DevOps, Cloud, Arquitetura e QA.' },
        { label: 'Filtro Segurança', desc: 'Chip expansível com especialidades InfoSec: SOC/Blue Team, Pentest/Red Team, GRC, AppSec e Cloud Security.' },
        { label: 'Skills', desc: 'Adicione palavras-chave (ex: PYTHON, AWS) para filtrar vagas que mencionem aquelas tecnologias na descrição.' },
        { label: 'Ocultar encerradas', desc: 'Toggle que esconde vagas com data de publicação além do TTL da fonte (Remotar 45 d, Greenhouse/Lever 30 d, Vagas.com 21 d).' },
        { label: 'Salvar vaga', desc: 'Clique no ícone de marcador (+10 XP). Vagas salvas ficam disponíveis no Kanban.' },
        { label: 'Candidatar', desc: 'Clique em Candidatar (+50 XP) para registrar a candidatura e mover a vaga para o Kanban.' },
        { label: 'Ver Vaga', desc: 'Abre o link original da vaga em uma nova aba.' },
      ],
    },
    {
      icon: 'kanban-square',
      title: 'Candidaturas (Kanban)',
      color: '#FF5722',
      items: [
        { label: 'Colunas do pipeline', desc: 'Aplicado → Triagem → Entrevista RH → Entrevista Técnica → Proposta → Oferta / Rejeitado.' },
        { label: 'Mover entre colunas', desc: 'Use o menu de ações em cada card para avançar o estágio. Entrevista concede +150 XP, Oferta +500 XP.' },
        { label: 'Remover candidatura', desc: 'Clique no "×" para excluir do pipeline. A vaga volta a aparecer em Vagas disponível para nova candidatura.' },
        { label: 'Badge no menu', desc: 'O número ao lado de "Candidaturas" no menu lateral é atualizado em tempo real com o total de cards ativos.' },
      ],
    },
    {
      icon: 'graduation-cap',
      title: 'Cursos',
      color: '#4CAF50',
      items: [
        { label: 'Catálogo', desc: 'Lista de cursos curados para profissionais de TI e InfoSec. Inclui plataforma, duração estimada e nível.' },
        { label: 'Progresso', desc: 'Barra de progresso individual por curso — atualizada manualmente pelo painel lateral direito.' },
        { label: 'Painel lateral', desc: 'Na aba CURSOS do painel direito, veja sugestões contextuais baseadas na vaga que você está visualizando.' },
      ],
    },
    {
      icon: 'badge-check',
      title: 'Certificações',
      color: '#FF9800',
      items: [
        { label: 'Lista de certs', desc: 'Certificações relevantes para o mercado de TI/InfoSec com status: pendente, em andamento ou conquistada.' },
        { label: 'Filtro de voucher', desc: 'O botão "Só com voucher" filtra certificações que incluem voucher de exame gratuito ou subsidiado.' },
        { label: 'Sugestões contextuais', desc: 'O painel direito sugere certificações relacionadas à vaga pesquisada (ex: buscar "AWS" traz AWS Solutions Architect).' },
      ],
    },
    {
      icon: 'award',
      title: 'Conquistas',
      color: '#9C27B0',
      items: [
        { label: 'Conquistas desbloqueadas', desc: 'Exibidas em destaque com badge dourado. Cada conquista tem critério e data de obtenção.' },
        { label: 'Conquistas bloqueadas', desc: 'Mostradas em cinza com a condição necessária para desbloquear — use como metas.' },
        { label: 'Como ganhar', desc: 'Salvar vagas, candidatar, avançar estágios, manter streak, completar quests e atingir novos níveis.' },
      ],
    },
    {
      icon: 'trophy',
      title: 'Ranking',
      color: '#F7931A',
      items: [
        { label: 'Top 3', desc: 'Os três primeiros colocados aparecem em destaque com pódio visual (ouro, prata, bronze).' },
        { label: 'Sua posição', desc: 'Sua linha fica destacada na tabela para fácil identificação.' },
        { label: 'Pontuação', desc: 'Baseada em XP total acumulado. XP é ganho via ações: salvar, candidatar, entrevistas, ofertas e quests.' },
      ],
    },
    {
      icon: 'zap',
      title: 'Sistema de XP e Nível',
      color: '#5B4FB3',
      items: [
        { label: 'Candidatar', desc: '+50 XP ao registrar candidatura.' },
        { label: 'Entrevista', desc: '+150 XP ao avançar para estágio de entrevista.' },
        { label: 'Oferta recebida', desc: '+500 XP ao registrar uma proposta/oferta.' },
        { label: 'Quest diária', desc: 'XP variável conforme a quest (30–100 XP cada).' },
        { label: 'Nível seguinte', desc: 'Cada nível exige 25% mais XP que o anterior. A barra no topo mostra seu progresso atual.' },
        { label: 'Streak', desc: 'Use o app por dias consecutivos para manter sua sequência. O streak é exibido no seu perfil.' },
        { label: 'Coins (pts)', desc: 'Ganho proporcional ao XP obtido. Exibido no topbar. Futuro: moeda de troca por vouchers e benefícios.' },
      ],
    },
    {
      icon: 'target',
      title: 'Quests Diárias',
      color: '#EA1D2C',
      items: [
        { label: 'Missões diárias', desc: 'Aparecem no painel direito (aba MISSÕES) e no Dashboard. São tarefas simples com XP como recompensa.' },
        { label: 'Como completar', desc: 'Clique na quest quando concluir a ação correspondente. O XP é creditado imediatamente.' },
        { label: 'Barra de progresso', desc: 'Cada quest tem meta (ex: 1/1 aplicações) que reflete seu progresso real na plataforma.' },
        { label: 'Reset diário', desc: 'As quests renovam todo dia — volte diariamente para manter o streak e acumular XP.' },
      ],
    },
    {
      icon: 'user',
      title: 'Perfil',
      color: '#2196F3',
      items: [
        { label: 'Dados do perfil', desc: 'Nome, cargo atual, nível e total de XP. Reflete os dados do seu user.json.' },
        { label: 'Certificações conquistadas', desc: 'Lista de certs com status "earned" no seu histórico.' },
        { label: 'Estatísticas', desc: 'Total de candidaturas, vagas salvas e XP acumulado — tudo sincronizado em tempo real.' },
      ],
    },
    {
      icon: 'info',
      title: 'Fontes de Vagas',
      color: '#607D8B',
      items: [
        { label: 'Remotar', desc: 'Vagas 100% remotas para o Brasil. Atualização a cada 6h. TTL: 45 dias.' },
        { label: 'Greenhouse', desc: 'Vagas de empresas tech como Nubank, QuintoAndar, RD Station e Stone. TTL: 30 dias.' },
        { label: 'Lever', desc: 'Vagas de startups como CloudWalk, Neon e outras fintechs. TTL: 30 dias.' },
        { label: 'Vagas.com', desc: 'Maior job board BR. Inclui vagas CLT, PJ e estágio. TTL: 21 dias.' },
        { label: 'Deduplicação', desc: 'O sistema detecta e mescla duplicatas pela URL normalizada e por chave composta (título+empresa+cidade), evitando que a mesma vaga apareça múltiplas vezes.' },
      ],
    },
  ];

  $('#view').innerHTML = `
    <div class="docs-wrap">
      <div class="docs-hero">
        <div class="docs-hero-icon"><i data-lucide="book-open"></i></div>
        <div>
          <h1 class="docs-title pixel">DOCUMENTAÇÃO</h1>
          <p class="docs-subtitle">Guia completo do Jobcraft — plataforma gamificada de carreira em Tech &amp; InfoSec</p>
        </div>
      </div>

      <div class="docs-toc">
        <span class="docs-toc-label pixel">ÍNDICE</span>
        <div class="docs-toc-links">
          ${sections.map(s => `<a class="docs-toc-link" href="#doc-${s.icon}">${s.title}</a>`).join('')}
        </div>
      </div>

      ${sections.map(s => `
        <section class="docs-section" id="doc-${s.icon}">
          <div class="docs-section-header" style="border-left-color:${s.color}">
            <div class="docs-section-icon" style="background:${s.color}20;color:${s.color}">
              <i data-lucide="${s.icon}"></i>
            </div>
            <h2 class="docs-section-title">${escapeHtml(s.title)}</h2>
          </div>
          <div class="docs-items">
            ${s.items.map(item => `
              <div class="docs-item">
                <div class="docs-item-label">${escapeHtml(item.label)}</div>
                <div class="docs-item-desc">${escapeHtml(item.desc)}</div>
              </div>
            `).join('')}
          </div>
        </section>
      `).join('')}

      <div class="docs-footer">
        <span class="pixel" style="color:var(--snes-royal)">JOBCRAFT</span>
        <span style="color:var(--text-mut)">— Plataforma de carreira gamificada para Tech &amp; InfoSec · versão 2.0</span>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

/* ============== go ============== */
if (localStorage.getItem('jc-theme') === 'dark') document.body.classList.add('dark-theme');

boot().catch(err => {
  $('#view').innerHTML = `<div class="card panel" style="margin:40px auto;text-align:center"><h3>Erro ao carregar Jobcraft</h3><p>${escapeHtml(err.message)}</p></div>`;
  console.error(err);
});
