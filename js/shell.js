(function () {
  'use strict';
  const G = window.G, h = G.h, S = G.S, F = G.F;
  S.pending = {}; S.recent = []; S.read = {};
  const NAV = [
    { id: 'home', l: 'Home', i: '⌂' },
    { g: 'Growth' }, { id: 'campaigns', l: 'Campaigns', i: '◎' }, { id: 'channels', l: 'Channels & Ads', i: '≋' }, { id: 'creators', l: 'Creators', i: '✦' }, { id: 'content', l: 'Content', i: '▣' },
    { g: 'Revenue' }, { id: 'leads', l: 'Leads', i: '◉' }, { id: 'pipeline', l: 'Pipeline', i: '▥' }, { id: 'attribution', l: 'Attribution', i: '⇄' },
    { g: 'Optimize' }, { id: 'radar', l: 'GTM Radar', i: '◌' }, { id: 'experiments', l: 'Experiments', i: '◇' }, { id: 'forecast', l: 'Forecast', i: '↗' }, { id: 'decisions', l: 'Decision Log', i: '☰' },
    { g: 'Reporting' }, { id: 'reports', l: 'Reports', i: '▤' }, { id: 'activity', l: 'Activity', i: '◷' },
    { g: 'Setup' }, { id: 'datasources', l: 'Data Sources', i: '⛁' },
  ];
  G.NAV = NAV;
  const TITLES = {}; NAV.forEach((n) => { if (n.id) TITLES[n.id] = n.l; }); TITLES.ask = 'Ask Growth OS'; TITLES.settings = 'Settings';

  /* ---------- layout ---------- */
  const shell = h('div', { class: 'g-shell' });
  const side = h('aside', { class: 'g-side', 'aria-label': 'Primary' });
  const mainCol = h('div', { class: 'g-main' });
  const top = h('header', { class: 'g-top' });
  const pageEl = h('main', { class: 'g-canvas', id: 'g-page' });
  mainCol.append(top, pageEl);
  shell.append(side, mainCol);
  G.app.append(shell);

  function navEl(inDrawer) {
    const box = h('div', { style: 'display:flex;flex-direction:column;min-height:100%' });
    box.append(h('div', { class: 'g-logo' }, h('div', { class: 'g-logo-mark', text: 'G' }), h('b', { text: 'Growth OS' })), h('div', { class: 'g-tag', text: 'From attention to revenue.' }));
    const nav = h('nav', { class: 'g-nav', 'aria-label': 'Sections' });
    NAV.forEach((n) => {
      if (n.g) return nav.append(h('div', { class: 'g-nav-grp', text: n.g }));
      nav.append(h('a', { href: '#' + n.id, 'data-nav': n.id, class: S.page === n.id ? 'on' : '', onclick: (e) => { e.preventDefault(); if (inDrawer) G.closeAll(); G.go(n.id); } }, h('span', { class: 'g-nav-ic', text: n.i }), n.l,
        n.id === 'activity' ? h('span', { class: 'g-badge-n', 'data-live-n': '1', style: 'display:none' }) : null));
    });
    const foot = h('div', { class: 'g-side-foot g-nav' }, ...[['ask', 'Ask Growth OS', '◖'], ['settings', 'Settings', '⚙']].map(([id, l, i]) => h('a', { href: '#' + id, 'data-nav': id, class: S.page === id ? 'on' : '', onclick: (e) => { e.preventDefault(); if (inDrawer) G.closeAll(); G.go(id); } }, h('span', { class: 'g-nav-ic', text: i }), l)));
    box.append(nav, foot);
    return box;
  }
  side.append(navEl(false));
  function markNav() { document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === S.page)); }

  /* ---------- top bar ---------- */
  const menuBtn = h('button', { class: 'g-btn g-icon-btn', 'aria-label': 'Open navigation', text: '☰', style: 'display:none', onclick: () => G.drawer({ side: 'left', title: 'Navigation', body: navEl(true) }) });
  const searchBtn = h('button', { class: 'g-search', type: 'button', 'aria-label': 'Search or ask Growth OS', onclick: () => G.askPanel() }, h('span', { text: '⌕' }), h('span', { text: 'Ask Growth OS anything…' }), h('span', { class: 'g-kbd', text: /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘ K' : 'Ctrl K' }));
  const gsChip = h('button', { class: 'g-gs', type: 'button', title: 'Growth status, based on the highest-impact GTM Radar signals', onclick: () => G.go('radar') }, h('span', { class: 'g-dot' }), h('span', { class: 'lbl' }));
  const dsChip = h('button', { class: 'g-ds', type: 'button', onclick: () => G.go('datasources') }, h('span', { class: 'g-dot pulse' }), h('b', { class: 'lbl' }));
  const demoTog = h('button', { class: 'g-demo', type: 'button', role: 'switch', onclick: () => {
    const w = G.WS.active();
    if (G.WS.mode() === 'demo') { G.WS.setDemo(false); G.toast('Demo Data off — showing only your connected data'); }
    else { if (!w.base) { G.demoChooser(); return; } G.WS.setDemo(true); G.toast('Demo Data on'); }
    G.refreshAll();
  } }, h('span', { class: 'lab', text: 'Demo Data' }), h('span', { class: 'sw' }, h('i')), h('b', { class: 'st' }));
  const themeBtn = h('button', { class: 'g-btn g-icon-btn', type: 'button', onclick: () => { G.WS.setTheme((G.WS.st().theme || 'dark') === 'dark' ? 'light' : 'dark'); updateChrome(); } });
  const wsLbl = h('span', { style: 'font-weight:600' }), wsSub = h('span', { class: 'xs muted', style: 'margin-left:6px' });
  const wsWrap = h('div', { class: 'g-rel' });
  const wsAv = h('span', { class: 'g-av', style: 'border-radius:5px' });
  const wsBtn = h('button', { class: 'g-btn', type: 'button', 'aria-haspopup': 'menu' }, wsAv, wsLbl, wsSub, h('span', { class: 'muted', text: '▾' }));
  wsWrap.append(wsBtn);
  const wsPop = G.popover(wsWrap, (close) => [h('div', { class: 'hd', text: 'Workspace' })].concat(G.WS.list().map((w) => { const m = G.WS.mode(w), on = w.id === G.WS.st().active; return h('button', { class: 'it', onclick: () => { close(); if (on) return; G.WS.set(w.id); G.toast('Switched to ' + w.name + (w.sub ? ' — ' + w.sub : '')); G.refreshAll(); } }, h('span', { class: 'g-av', text: w.name[0].toUpperCase(), style: 'border-radius:5px' }), h('div', { style: 'min-width:0' }, h('b', { text: w.name + (w.sub ? ' — ' + w.sub : '') }), h('div', { class: 'xs muted', text: m === 'demo' ? 'Demo data · ' + G.srcCount(w) + ' sources' : m === 'live' ? 'Live · ' + w.imports.length + ' source' + (w.imports.length === 1 ? '' : 's') : 'Not connected' })), on ? h('span', { class: 'g-dot', style: 'margin-left:auto;margin-top:6px' }) : null); }),
    [h('button', { class: 'it', onclick: () => { close(); G.onboarding(); } }, h('span', { text: '+' }), h('b', { text: 'Add workspace' }))]));
  wsBtn.addEventListener('click', () => wsPop.toggle());
  const bellWrap = h('div', { class: 'g-rel' });
  const pip = h('span', { class: 'g-pip', style: 'display:none' });
  const bell = h('button', { class: 'g-btn g-icon-btn', type: 'button', 'aria-label': 'Notifications', 'aria-haspopup': 'menu' }, h('span', { text: '🔔︎' }), pip);
  bellWrap.append(bell);
  const bellPop = G.popover(bellWrap, (close) => {
    const items = (G.rows('notifications') || []).map((n) => ({ id: n.id, ts: S.t0 - n.mins_ago * 60000, tone: n.tone, title: n.title, page: n.page, unread: n.unread && !S.read[n.id] }));
    S.liveEvents.slice().reverse().forEach((e) => items.unshift({ id: e.id, ts: e.ts, tone: e.severity === 'bad' ? 'bad' : 'good', title: e.title, page: e.page, unread: !S.read[e.id] }));
    const out = [h('div', { class: 'hd', style: 'display:flex;justify-content:space-between' }, h('span', { text: 'Notifications' }), h('button', { class: 'g-btn ghost sm', text: 'Mark all read', onclick: () => { items.forEach((i) => (S.read[i.id] = true)); updateChrome(); close(); } }))];
    items.slice(0, 8).forEach((n) => out.push(h('button', { class: 'it', onclick: () => { S.read[n.id] = true; close(); updateChrome(); G.go(n.page); } }, h('span', { class: 'g-dot ' + (n.tone === 'bad' ? 'red' : ''), style: 'margin-top:6px' }), h('div', null, h('div', { style: n.unread ? 'font-weight:600' : '', text: n.title }), h('div', { class: 'xs muted', text: F.ago((Date.now() - n.ts) / 60000) })))));
    if (!items.length) out.push(G.empty('✓', 'You’re all caught up', 'New alerts will appear here.'));
    return out;
  });
  bell.addEventListener('click', () => bellPop.toggle());
  const meWrap = h('div', { class: 'g-rel' });
  const meBtn = h('button', { class: 'g-btn g-icon-btn', type: 'button', 'aria-label': 'Profile', 'aria-haspopup': 'menu' }, h('span', { class: 'g-av', text: 'AM' }));
  meWrap.append(meBtn);
  const mePop = G.popover(meWrap, (close) => [h('div', { style: 'padding:8px' }, G.mk(h('b', { text: 'Aarav Mehta' }), 'workspace', 'name', { kind: 'user' }), h('div', { class: 'xs muted', text: 'Head of Growth · aarav@wisprflow.example' })),
    h('button', { class: 'it', onclick: () => { close(); G.go('settings', { sec: 'workspace' }); } }, 'Account & workspace'),
    h('button', { class: 'it', onclick: () => { close(); G.askPanel(); } }, 'Command menu'),
    h('button', { class: 'it', onclick: () => { close(); G.toast('This is a demo workspace — sign-out is disabled'); } }, 'Sign out')]);
  meBtn.addEventListener('click', () => mePop.toggle());
  const rangeSel = G.rangeSel();
  top.append(menuBtn, searchBtn, h('div', { class: 'g-top-r' }, gsChip, demoTog, dsChip, rangeSel, wsWrap, themeBtn, bellWrap, meWrap));

  function updateChrome() {
    const lay = G.app;
    menuBtn.style.display = lay.classList.contains('g-narrow') ? '' : 'none';
    if (G.growthStatus) { const gs = G.growthStatus(); gsChip.querySelector('.lbl').textContent = 'Growth status: ' + gs.label; gsChip.querySelector('.g-dot').className = 'g-dot ' + (gs.tone === 'amber' ? 'amber' : gs.tone === '' ? 'gray' : ''); gsChip.classList.toggle('warn', gs.tone === 'amber'); }
    const ds = G.dataStatus(); dsChip.querySelector('.lbl').textContent = ds.label; dsChip.querySelector('.g-dot').className = 'g-dot ' + (ds.tone === 'amber' ? 'amber' : ds.tone === 'gray' ? 'gray' : 'pulse'); dsChip.title = ds.tip; dsChip.classList.toggle('warn', ds.tone === 'amber');
    const dm = G.WS.mode() === 'demo'; demoTog.classList.toggle('on', dm); demoTog.setAttribute('aria-checked', String(dm)); demoTog.querySelector('.st').textContent = dm ? 'ON' : 'OFF'; demoTog.title = dm ? 'Showing simulated demo data. Click to turn off.' : 'Demo data is off. Click to load a demo workspace.';
    const aw = G.WS.active(); wsLbl.textContent = aw.name; wsSub.textContent = aw.sub || ''; wsAv.textContent = aw.name[0].toUpperCase();
    const th = G.WS.st().theme || 'dark'; themeBtn.textContent = th === 'dark' ? '☀' : '☾'; themeBtn.title = th === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'; themeBtn.setAttribute('aria-label', themeBtn.title);
    const nots = G.rows('notifications') || [];
    const n = nots.filter((x) => x.unread && !S.read[x.id]).length + S.liveEvents.filter((e) => !S.read[e.id]).length;
    pip.style.display = n ? '' : 'none';
    const b = document.querySelector('[data-live-n]');
    document.querySelectorAll('[data-live-n]').forEach((x) => { x.style.display = S.liveEvents.length ? '' : 'none'; x.textContent = S.liveEvents.length; });
    document.querySelectorAll('select[aria-label="Date range"]').forEach((s) => (s.value = S.range));
    if (b) b.title = 'New events since you opened Growth OS';
  }
  G.updateChrome = updateChrome;

  /* ---------- live ticker ---------- */
  function liveEvent() {
    if (G.WS.mode() !== 'demo') return;
    const leads = G.rows('leads'), camps = G.rows('campaigns');
    const picks = [];
    if (leads) { const l = leads.filter((x) => x.waiting)[Math.floor(Math.random() * 6)] || leads[0]; if (l) picks.push({ kind: 'Leads', title: 'New high-intent lead detected.', detail: `${l.name} · ${l.company} scored ${l.score}/100 (${l.signals[0]}).`, page: 'leads', severity: 'good' }); }
    if (camps) { const c = camps.filter((x) => x.range === '30d')[Math.floor(Math.random() * 6)]; if (c) picks.push({ kind: 'Campaigns', title: `${c.name} signups are tracking ${c.d_signups >= 0 ? 'above' : 'below'} plan.`, detail: `${F.n(Math.round(c.signups / 30 / 24 * (1 + Math.random())))} signups in the last hour · ${F.d(c.d_signups)} vs previous period.`, page: 'campaigns', severity: c.d_signups >= 0 ? 'good' : 'bad' }); }
    const srcs = G.sourceList().slice(0, 3).map((d) => d.name); if (srcs.length) picks.push({ kind: 'Ads', title: 'Sync completed: ' + srcs.join(', ') + '.', detail: 'All connected sources are up to date.', page: 'datasources', severity: 'info' });
    const e = picks[Math.floor(Math.random() * picks.length)];
    S.liveEvents.push(Object.assign({ id: 'live' + Date.now(), ts: Date.now() }, e));
    updateChrome();
    if (S.page === 'activity' && G.cur && G.cur.api) G.cur.api.update();
  }
  setTimeout(function loop() { try { liveEvent(); } catch (e) { /* data not ready */ } setTimeout(loop, 55000 + Math.random() * 30000); }, 28000);

  /* ---------- router ---------- */
  G.cur = null;
  function loadingView() {
    return h('div', { class: 'g-fade', 'aria-busy': 'true', 'aria-label': 'Loading' }, h('div', { class: 'g-skel', style: 'height:34px;width:min(420px,70%);margin-bottom:16px' }), h('div', { class: 'g-skel', style: 'height:16px;width:min(320px,50%);margin-bottom:24px' }),
      h('div', { class: 'g-grid' }, [3, 3, 3, 3, 8, 4].map((s, i) => h('div', { class: 's' + s }, h('div', { class: 'g-skel', style: `height:${i < 4 ? 112 : 260}px` })))));
  }
  function render() {
    const def = G.pages[S.page]; const cur = G.cur;
    if (!def || !cur) return;
    const st = G.st(def.ds || []);
    if (st === 'loading') { if (!cur.built) pageEl.replaceChildren(loadingView()); return; }
    if (st === 'error') { pageEl.replaceChildren(G.errBox(def.ds)); cur.built = false; return; }
    const gate = G.gate && G.gate(S.page);
    if (gate) { pageEl.replaceChildren(gate); cur.built = false; cur.api = { update: render }; return; }
    try {
      if (!cur.built) { pageEl.replaceChildren(); cur.api = def.build(pageEl, S.pending[S.page] || {}); S.pending[S.page] = null; cur.built = true; if (S.answer && G.answerBanner) pageEl.prepend(G.answerBanner(S.answer)); }
      cur.api.update();
    } catch (err) {
      console.error('[growth-os] render failed on ' + S.page, err);
      cur.built = false;
      pageEl.replaceChildren(h('div', { class: 'g-card g-err' }, h('h3', { text: 'This view hit an error' }), h('p', { class: 'muted', text: 'Something went wrong while drawing ' + (TITLES[S.page] || S.page) + '. Reload the view to try again.' }), G.btn('Reload view', () => G.go(S.page), 'pri')));
    }
  }
  G.go = (id, opts) => {
    if (!G.pages[id]) id = 'home';
    G.closeAll(); G.tip.hide();
    S.answer = S.answerPending || null; S.answerPending = null;
    S.pending[id] = opts || null; S.page = id;
    try { dash.setLink(id); } catch (e) { /* ignore */ }
    G.cur = { id, built: false, api: null };
    markNav(); render();
    try { top.scrollIntoView({ block: 'start' }); } catch (e) { /* ignore */ }
    document.title = (TITLES[id] || 'Growth OS') + ' · Growth OS';
  };
  G.rerender = () => { updateChrome(); if (G.cur && G.cur.api) { try { G.cur.api.update(); } catch (e) { console.error(e); render(); } } };
  function layoutClass() {
    const w = G.app.clientWidth || 1000;
    G.app.classList.toggle('g-narrow', w < 760);
    G.app.classList.toggle('g-mid', w >= 760 && w < 1180);
  }
  dash.onData(() => { layoutClass(); render(); updateChrome(); });

  /* ---------- command palette ---------- */
  G.parseCmd = (q) => {
    q = q.trim(); let m;
    if ((m = q.match(/cac\s*(?:above|over|>)\s*₹?\s*([\d,]+)/i))) { const v = +m[1].replace(/,/g, ''); return { label: `Show campaigns with CAC above ₹${F.n(v)}`, run: () => G.go('campaigns', { cacMin: v, q: '' }) }; }
    if ((m = q.match(/top creators|best creators/i))) return { label: 'Find top creators this month', run: () => G.go('creators', { sortScore: true }) };
    if ((m = q.match(/create (?:a )?report|new report|generate report/i))) return { label: 'Create a report', run: () => G.go('reports', { create: true }) };
    if ((m = q.match(/leads? from ([\w ]+)/i))) { const s = m[1].trim(); return { label: `Show leads from ${s}`, run: () => G.go('leads', { source: s }) }; }
    if ((m = q.match(/compare (\w[\w ]*?) (?:vs\.?|versus|and) (\w[\w ]*)/i))) { const a = m[1].trim(), b = m[2].trim(); return { label: `Compare ${a} vs ${b}`, run: () => G.go('channels', { compare: [a, b] }) }; }
    if (/^(why|how|which|what|who|where|when|show|find|create)\b|\?$/i.test(q)) return { label: `Ask Growth OS: “${q}”`, run: () => G.go('ask', { q }) };
    return null;
  };
  G.palette = () => {
    let sel = 0, items = [];
    const inp = h('input', { type: 'text', placeholder: 'Ask Growth OS anything…', 'aria-label': 'Command or search', autocomplete: 'off' });
    const res = h('div', { class: 'res' });
    const node = h('div', { class: 'g-modal g-pal', role: 'dialog', 'aria-label': 'Command menu' }, inp, res, h('div', { class: 'g-dr-f xs muted' }, '↑↓ to navigate · Enter to run · Esc to close'));
    let it;
    const index = () => {
      const out = [];
      NAV.filter((n) => n.id).concat([{ id: 'ask', l: 'Ask Growth OS' }, { id: 'settings', l: 'Settings' }]).forEach((n) => out.push({ t: 'Page', l: n.l, s: 'Go to page', run: () => G.go(n.id) }));
      (G.rows('campaigns') || []).filter((r) => r.range === '30d').forEach((r) => out.push({ t: 'Campaign', l: r.name, s: r.channel, run: () => G.go('campaigns', { open: r.cid }) }));
      (G.rows('creators') || []).filter((r) => r.range === '30d').forEach((r) => out.push({ t: 'Creator', l: r.handle, s: r.name + ' · ' + r.platform, run: () => G.go('creators', { open: r.key }) }));
      (G.rows('leads') || []).forEach((r) => out.push({ t: 'Lead', l: r.name, s: r.company, run: () => G.go('leads', { open: r.id }) }));
      const seen = {}; (G.rows('deals') || []).forEach((r) => { if (!seen[r.company]) { seen[r.company] = 1; out.push({ t: 'Company', l: r.company, s: r.stage + ' · ' + F.inr(r.value), run: () => G.go('pipeline', { open: r.id }) }); } });
      (G.rows('experiments') || []).forEach((r) => out.push({ t: 'Experiment', l: r.name, s: r.status, run: () => G.go('experiments', { open: r.id }) }));
      (G.rows('reports') || []).forEach((r) => out.push({ t: 'Report', l: r.type, s: r.period, run: () => G.go('reports', { sel: r.id }) }));
      return out;
    };
    // load indexes in the background (reading a dataset loads it)
    ['campaigns', 'creators', 'leads', 'deals', 'experiments', 'reports', 'suggestions'].forEach((i) => dash.data(i));
    function draw() {
      const q = inp.value.trim(); items = []; res.replaceChildren();
      const add = (hd, arr) => { if (!arr.length) return; res.append(h('div', { class: 'hd', text: hd })); arr.forEach((a) => { const i = items.length; items.push(a); res.append(h('div', { class: 'it' + (i === sel ? ' on' : ''), 'data-i': i, role: 'option', onmouseenter: () => { sel = i; paint(); }, onclick: () => run(a) }, h('span', { text: a.icon || '›' }), h('div', null, h('div', { text: a.l }), a.s && h('div', { class: 'xs muted', text: a.s })), h('span', { class: 'ty', text: a.t }))); }); };
      const sugg = G.rows('suggestions') || [];
      if (!q) {
        add('Suggested commands', sugg.filter((s) => s.kind === 'command').map((s) => ({ t: s.hint, l: s.text, icon: '⌘', run: () => { const c = G.parseCmd(s.text); c ? c.run() : G.go('ask', { q: s.text }); } })));
        add('Recent searches', S.recent.map((r) => ({ t: 'Recent', l: r, icon: '↺', run: () => { const c = G.parseCmd(r); c ? c.run() : G.go('ask', { q: r }); } })).concat(sugg.filter((s) => s.kind === 'recent').map((s) => ({ t: s.hint, l: s.text, icon: '↺', run: () => { const c = G.parseCmd(s.text); c ? c.run() : (S.recent.unshift(s.text), G.palette()); } }))));
      } else {
        const c = G.parseCmd(q);
        if (c) add('Command', [{ t: 'Run', l: c.label, icon: '⌘', run: c.run }]);
        const ql = q.toLowerCase();
        const hits = index().filter((x) => (x.l + ' ' + (x.s || '')).toLowerCase().includes(ql)).slice(0, 8);
        add('Results', hits);
        if (!c) add('Ask Growth OS', [{ t: 'Ask', l: `Ask Growth OS: “${q}”`, icon: '◖', run: () => G.go('ask', { q }) }]);
      }
      if (!items.length) res.append(G.empty('∅', 'No matches', 'Try a campaign, creator, company or a command like “Compare Meta vs creators”.'));
    }
    function paint() { res.querySelectorAll('.it').forEach((e) => e.classList.toggle('on', +e.dataset.i === sel)); const on = res.querySelector('.it.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' }); }
    function run(a) { if (inp.value.trim()) { S.recent = [inp.value.trim()].concat(S.recent.filter((x) => x !== inp.value.trim())).slice(0, 4); } it.close(); a.run(); }
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[sel]) run(items[sel]); }
    });
    G.closeAll();
    it = G.modal({ title: 'Command menu', body: h('div') });
    it.wrap.replaceChildren(h('div', { class: 'g-backdrop', onclick: () => it.close() }), node);
    setTimeout(() => { inp.focus(); draw(); }, 20);
    // keep redrawing as datasets finish loading
    const t = setInterval(() => { if (!node.isConnected) clearInterval(t); else if (!inp.value) { const keep = sel; draw(); sel = keep; paint(); } }, 1500);
  };
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); G.askPanel(); } });

  /* ---------- boot ---------- */
  ['workspace', 'notifications'].forEach((i) => dash.data(i));
  const start = (location.hash || '').slice(1);
  S.page = G.pages[start] ? start : 'home';
  layoutClass();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { const n = G.app.classList.contains('g-narrow'), m = G.app.classList.contains('g-mid'); layoutClass(); if (n !== G.app.classList.contains('g-narrow') || m !== G.app.classList.contains('g-mid')) { updateChrome(); G.rerender(); } }).observe(G.app);
  G.cur = { id: S.page, built: false, api: null };
  markNav(); render();
})();
