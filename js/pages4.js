(function () {
  'use strict';
  const G = window.G, h = G.h, S = G.S, F = G.F;
  const ago = (m) => (m < 1 ? 'just now' : m < 60 ? Math.round(m) + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago');
  const SUG = () => (G.rows('ask') || []).slice().sort((a, b) => (a.feat == null ? 99 : a.feat) - (b.feat == null ? 99 : b.feat));
  G.askMatch = (q) => { const w = (q || '').toLowerCase(); let best = null, bs = 0; (G.rows('ask') || []).forEach((a) => { const s = G.J(a.keys).filter((k) => w.includes(k)).length + (w === a.q.toLowerCase() ? 5 : 0); if (s > bs) { bs = s; best = a; } }); return best; };
  const toneBd = (t) => G.badge({ bad: 'Needs action', good: 'Positive', warn: 'Watch' }[t] || 'Update', { bad: 'red', good: 'green', warn: 'amber' }[t] || '');

  /* =========================== RADAR =========================== */
  G.page('radar', {
    ds: ['signals'],
    build(root, opts) {
      const f = G.pf('radar', { cat: '', sel: null, show: 'open' });
      if (opts && opts.cat) { f.cat = opts.cat; f.sel = null; f.show = 'open'; }
      const chips = h('div', { class: 'g-pill-row g-mb8' }), listBox = h('div', { class: 'g-card pad0' }), detBox = h('div');
      root.append(G.head('Optimize', 'GTM Radar', 'Data → signal → explanation → action. Only what matters is surfaced.', [G.rangeSel(), G.seg([{ v: 'open', l: 'Open' }, { v: 'done', l: 'Handled' }], f.show, (v) => { f.show = v; f.sel = null; fill(); })]), chips, h('div', { class: 'g-radar-grid' }, listBox, detBox));
      const state = (r) => (S.done[r.id] ? 'done' : S.dismissed[r.id] ? 'dismissed' : 'open');
      function fill() {
        const all = G.byRange('signals').sort((a, b) => a.order - b.order), inShow = (r) => (f.show === 'open' ? state(r) === 'open' : state(r) !== 'open');
        chips.replaceChildren(...[['', 'All']].concat(Object.keys(G.CAT).map((k) => [k, G.CAT[k][0]])).map(([k, l]) => h('button', { class: 'g-chip' + (f.cat === k ? ' on' : ''), type: 'button', onclick: () => { f.cat = k; f.sel = null; fill(); } }, l + ' · ' + all.filter((r) => inShow(r) && (!k || r.cat === k)).length)));
        const rows = all.filter((r) => inShow(r) && (!f.cat || r.cat === f.cat));
        if (!rows.some((r) => r.id === f.sel)) f.sel = rows[0] ? rows[0].id : null;
        listBox.replaceChildren(...(rows.length ? rows.map((r) => h('button', { class: 'g-rli' + (r.id === f.sel ? ' on' : ''), type: 'button', onclick: () => { f.sel = r.id; fill(); } }, h('div', { class: 'g-row', style: 'gap:6px' }, G.badge(G.CAT[r.cat][0], G.CAT[r.cat][1]), state(r) !== 'open' ? G.badge(state(r) === 'done' ? 'Actioned' : 'Dismissed') : null), h('div', { style: 'font-weight:600;margin-top:6px;text-align:left', text: r.what }))) : [G.empty('✓', f.show === 'open' ? 'All clear' : 'Nothing handled yet', f.show === 'open' ? 'No open signals in this category.' : 'Actioned and dismissed signals appear here.')]));
        const r = all.find((x) => x.id === f.sel);
        if (!r) return detBox.replaceChildren(G.card(null, null, G.empty('◎', 'Select a signal', 'Pick a signal to see the evidence and what to do.')));
        const st = state(r), blk = (t, body) => h('div', { class: 'g-sig-blk' }, h('div', { class: 'g-sig-k', text: t }), body), cause = G.J(r.cause) || [], sim = G.J(r.sim);
        detBox.replaceChildren(h('div', { class: 'g-card g-sig ' + r.cat, style: 'padding:20px' },
          h('div', { class: 'g-row', style: 'justify-content:space-between' }, G.badge(G.CAT[r.cat][0], G.CAT[r.cat][1]), h('span', { class: 'g-row', style: 'gap:6px' }, r.conf != null ? G.badge('Confidence ' + r.conf + '%', r.conf >= 80 ? 'green' : 'amber') : null, st !== 'open' ? G.badge(st === 'done' ? 'Actioned' : 'Dismissed', st === 'done' ? 'green' : '') : null)),
          blk('Signal', G.mk(h('div', { style: 'font-size:18px;font-weight:600', text: r.what }), 'signals', 'what', { id: r.id })),
          blk('Impact', G.mk(h('div', { text: r.impact }), 'signals', 'impact', { id: r.id })),
          blk('Cause', h('div', null, G.mk(h('div', { class: 'sm muted', text: r.evidence }), 'signals', 'evidence', { id: r.id }), cause.length ? h('ul', { class: 'g-ul g-mt8' }, cause.map((c) => h('li', { text: c }))) : null)),
          h('div', { class: 'g-sig-a' }, h('div', { class: 'g-sig-k', text: 'Recommendation' }), G.mk(h('div', { style: 'font-weight:600;font-size:15px', text: r.action }), 'signals', 'action', { id: r.id }), r.expected ? h('div', { class: 'sm g-mt8' }, h('b', { text: 'Expected result: ' }), r.expected) : null),
          st === 'open' ? h('div', { class: 'g-row g-mt16' }, G.btn('Apply recommendation', () => G.signalAct(r, fill), 'pri'), G.btn('Simulate', () => G.signalSim(r)), G.btn('Investigate', () => G.investigate(r)), G.btn('Create experiment', () => G.signalExp(r)), G.btn('Dismiss', () => { S.dismissed[r.id] = true; G.afterAction && G.afterAction(); G.toast('Signal dismissed', { action: { label: 'Undo', fn: () => { delete S.dismissed[r.id]; G.afterAction && G.afterAction(); fill(); } } }); fill(); }, 'ghost'), h('button', { class: 'g-link', type: 'button', onclick: () => G.evidenceDrawer(G.J(r.ev)), text: 'Why this recommendation?' }))
            : h('div', { class: 'g-row g-mt16' }, G.btn('Reopen', () => { S.done[r.id] = false; delete S.dismissed[r.id]; G.afterAction && G.afterAction(); fill(); }), G.btn('Open view', () => G.go(r.go, G.J(r.go_opts || '{}'))))));
      }
      function update() { fill(); }
      return { update };
    },
  });

  /* =========================== EXPERIMENTS =========================== */
  G.page('experiments', {
    ds: ['experiments', 'insights', 'campaigns'],
    build(root, opts) {
      const f = G.pf('experiments', { status: '', scope: '' });
      const sBox = h('div', { class: 'g-tools' }), grid = h('div', { class: 'g-two' }), nextBox = h('div');
      root.append(G.head('Optimize', 'Experiments', 'Test ideas against real outcomes. Ship winners, stop losers early.', [G.btn('Create experiment', () => G.expModal({}), 'pri')]), nextBox, G.sec('All experiments'), sBox, grid);
      const all = () => (S.local.exps || []).concat(G.rows('experiments') || []).map((e) => Object.assign({}, e, (S.local.expRes || {})[e.id] || {}));
      function card(e) {
        const v = G.J(e.variants); const best = v.length ? v.slice().sort((a, b) => b.value - a.value)[0] : null;
        return h('div', { class: 'g-card click', tabindex: '0', onclick: () => open(e), onkeydown: (ev) => { if (ev.key === 'Enter') open(e); } },
          h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('b', { text: e.name }), G.statusBd(e.status)),
          h('p', { class: 'sm muted', style: 'margin:6px 0', text: e.hypothesis }),
          h('div', { class: 'g-row' }, G.badge(e.scope === 'creative' ? 'Creative' : 'Growth'), h('span', { class: 'xs muted', text: e.metric }), e.lift != null ? G.dl(e.lift, true) : null),
          h('div', { class: 'g-meter g-mt8' }, h('span', { class: 'xs', text: e.confidence + '% confidence' }), G.pbar(e.confidence, e.confidence >= 90 ? '' : e.confidence >= 60 ? 'amber' : 'red')),
          h('div', { class: 'g-mt8' }, lifecycle(e)), h('div', { class: 'xs muted g-mt8', text: (best && e.confidence >= 50 ? 'Leading: ' + best.name + ' · ' : '') + e.impact + ' · ends ' + e.ends }));
      }
      const LIFE = ['Running', 'Results', 'Winner', 'Recommendation'];
      function lifeAt(e) { return e.status === 'Running' ? 0 : e.status === 'Inconclusive' ? 1 : e.status === 'Winning' ? 3 : e.status === 'Losing' ? 2 : 0; }
      function lifecycle(e) { const at = lifeAt(e); return h('div', { class: 'g-life' }, LIFE.map((l, i) => h('div', { class: 'g-life-s' + (i < at ? ' done' : i === at ? ' on' : '') }, h('i', { text: i < at ? '✓' : String(i + 1) }), h('span', { text: l })))); }
      function open(e) {
        let tab = 'Setup'; const v = G.J(e.variants);
        const body = h('div');
        const tabs = G.tabs(['Setup', 'Audience', 'Variants', 'Results', 'Decision'].map((x) => ({ v: x, l: x })), tab, (t) => { tab = t; draw(); });
        function draw() {
          const fm = (x) => F.val(e.unit, x);
          const t = {
            Setup: () => h('div', { class: 'g-gap8' }, lifecycle(e), h('div', { class: 'sm muted', text: 'Hypothesis' }), h('p', { text: e.hypothesis }), h('div', { class: 'sm muted', text: 'Test design' }), h('p', { text: e.setup }), h('div', { class: 'sm', text: 'Owner: ' + e.owner + ' · ' + e.started + ' → ' + e.ends })),
            Audience: () => h('div', { class: 'g-gap8' }, h('p', { text: e.audience }), v.length ? h('div', { class: 'g-gap8' }, v.map((x) => h('div', null, h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('span', { text: x.name }), h('span', { class: 'sm', text: x.traffic + '% of traffic' })), G.pbar(x.traffic)))) : h('p', { class: 'muted sm', text: 'Traffic split will appear once configured.' })),
            Variants: () => v.length ? h('div', { class: 'g-gap8' }, v.map((x, i) => h('div', { class: 'g-card' }, h('b', { text: x.name }), h('div', { class: 'sm muted', text: (i === 0 ? 'Baseline' : 'Variation') + ' · ' + x.traffic + '% traffic · n = ' + F.n(x.n) })))) : h('p', { class: 'muted', text: 'No variants configured yet.' }),
            Results: () => v.length ? h('div', { class: 'g-gap8' }, v.map((x) => { const mx = d3.max(v, (y) => y.value) || 1; return h('div', null, h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('span', { text: x.name }), h('b', { class: 'num', text: fm(x.value) })), G.pbar(x.value / mx * 100, x === v[0] ? 'amber' : '')); }), h('div', { class: 'sm muted', text: 'Target ' + (e.target == null ? '—' : fm(e.target)) + ' · confidence ' + e.confidence + '%' }), e.lift != null ? h('div', null, 'Lift vs control ', G.dl(e.lift, true)) : null) : G.empty('…', 'Collecting data', 'Results appear after the first full day.'),
            Decision: () => h('div', { class: 'g-gap8' }, h('div', { class: 'g-ai' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'Recommended decision'), h('p', { text: e.decision }))),
          }[tab]();
          body.replaceChildren(t);
        }
        draw();
        G.drawer({ title: e.name, sub: e.status + ' · ' + e.metric, body: h('div', null, tabs, h('div', { class: 'g-mt16' }, body)), footer: (c) => e.status === 'Running' || e.status === 'Winning' ? [G.btn('Ship winner', () => G.confirm({ title: 'Ship the winning variation?', text: e.decision, confirm: 'Ship', onConfirm: () => { c(); G.toast('Winner queued for rollout'); } }), 'pri'), G.btn('Stop test', () => G.confirm({ title: 'Stop “' + e.name + '”?', text: 'Traffic returns to control. Collected results are kept.', confirm: 'Stop test', danger: true, onConfirm: () => { c(); G.toast('Test stopped'); } }))] : [G.btn('Duplicate as new test', () => { c(); G.expModal({ name: e.name + ' (rerun)', scope: e.scope }); }, 'pri')] });
      }
      function fill() {
        const rows = all().filter((e) => (!f.status || e.status === f.status) && (!f.scope || e.scope === f.scope));
        grid.replaceChildren(...(rows.length ? rows.map(card) : [h('div', { style: 'grid-column:1/-1' }, G.empty('◇', 'No experiments match', 'Clear the filters or create one.', G.btn('Create experiment', () => G.expModal({}), 'pri')))]));
      }
      function update() {
        const statuses = ['', 'Running', 'Winning', 'Losing', 'Inconclusive'];
        sBox.replaceChildren(G.seg(statuses.map((s) => ({ v: s, l: s || 'All' })), f.status, (v) => { f.status = v; fill(); }), G.sel([{ v: '', l: 'All types' }, { v: 'growth', l: 'Growth' }, { v: 'creative', l: 'Creative' }], f.scope, (v) => { f.scope = v; fill(); }, 'Type'));
        const ins = (G.rows('insights') || []).find((i) => i.id === 'next-experiment');
        if (ins) nextBox.replaceChildren(G.insight(ins, h('div', { class: 'g-row g-mt8' }, G.btn(ins.cta, () => G.expModal({ name: '₹750 creator referral bonus', scope: 'growth' }), 'pri'))));
        fill();
        if (opts && opts.open) { const e = all().find((x) => x.id === opts.open); if (e) open(e); opts.open = null; }
        if (opts && (opts.create || opts.prefill)) { const pf = opts.prefill || {}; opts.create = false; opts.prefill = null; G.expModal(pf); }
      }
      return { update };
    },
  });

  /* =========================== FORECAST =========================== */
  G.page('forecast', {
    ds: ['forecast_actual', 'scenarios', 'forecast_kpis'],
    build(root, opts) {
      const f = G.pf('forecast', { group: 'base', level: 0, metric: 'signups' });
      if (opts && opts.pick) { const sc = (G.rows('scenarios') || []).find((s) => s.id === opts.pick); if (sc) { f.group = sc.group; f.level = sc.level; } }
      const kBox = h('div', { class: 'g-kpis', style: '--min:170px' }), ctl = h('div', { class: 'g-tools' }), ch = h('div', { class: 'g-chart', style: 'min-height:320px' }), res = h('div'), note = h('div');
      root.append(G.head('Optimize', 'Forecast', 'See where the next eight weeks are heading, and what a decision would change.', [G.btn('Apply scenario', apply, 'pri'), G.btn('Create campaign', mkCamp)]), kBox, G.sec('Scenario planner', 'Pick a lever. The projection and the comparison update instantly.'), ctl, note, G.card('Projection', 'Weekly · actuals to date, then base, best and worst case with your scenario overlaid', h('div', null, ch, h('div', { class: 'g-legend g-mt8' }, [['var(--g-ink)', 'Actual'], ['var(--g-ink-3)', 'Current trajectory'], ['var(--g-em)', 'Selected scenario'], ['var(--g-em-l)', 'Best–worst range']].map(([c, l]) => h('span', null, h('i', { style: 'background:' + c }), l))))), G.sec('Scenario comparison'), h('div', { class: 'g-card pad0' }, res));
      const scs = () => G.rows('scenarios') || [];
      const cur = () => scs().find((s) => s.group === f.group && s.level === f.level) || scs()[0];
      const GROUPS = { base: 'Current trajectory', spend: 'Increase spend', cut: 'Decrease spend', creators: 'Increase creator allocation', conv: 'Improve conversion rate', referral: 'Increase referral allocation' };
      function apply() {
        const s = cur();
        if (s.id === 'base') return G.toast('Current trajectory is already in effect', { tone: 'bad' });
        G.confirm({ title: 'Apply “' + s.label + ' ' + (s.level > 0 ? '+' : '') + s.level + '%”?', text: 'Updates planned budgets and targets: ' + F.n(s.signups) + ' signups, ' + F.n(s.customers) + ' customers, ' + F.inr(s.revenue) + ' revenue.', detail: s.note, confirm: 'Apply scenario', onConfirm: () => { S.applied['scn-' + s.id] = true; G.logDecision({ title: 'Applied scenario: ' + s.label + ' ' + (s.level > 0 ? '+' : '') + s.level + '%', reason: 'Forecast scenario', expected: '+' + F.n(s.signups - (G.rows('scenarios')[0] || {}).signups) + ' signups, +' + F.inr(s.revenue - (G.rows('scenarios')[0] || {}).revenue) + ' revenue', kind: 'budget' }); } });
      }
      function mkCamp() { const s = cur(); const form = G.form([{ k: 'name', label: 'Campaign name', val: s.id === 'base' ? 'New growth campaign' : s.label + ' ' + (s.level > 0 ? '+' : '') + s.level + '%' }, { k: 'budget', label: 'Monthly budget (₹)', type: 'number', val: s.spend }]); G.modal({ title: 'Create campaign from scenario', body: form.el, actions: (c) => [G.btn('Cancel', c), G.btn('Create draft', () => { const v = form.get(); G.addDraft({ name: v.name, channel: 'Mixed', budget: v.budget }); c(); G.toast('Draft campaign created', { action: { label: 'View', fn: () => G.go('campaigns') } }); }, 'pri')] }); }
      function controls() {
        const lv = scs().filter((s) => s.group === f.group).map((s) => ({ v: String(s.level), l: s.level === 0 ? 'Base' : (s.level > 0 ? '+' : '') + s.level + '%' }));
        ctl.replaceChildren(G.sel(Object.keys(GROUPS).map((k) => ({ v: k, l: GROUPS[k] })), f.group, (v) => { f.group = v; f.level = v === 'base' ? 0 : (scs().find((s) => s.group === v) || {}).level; update(); }, 'Scenario'), f.group === 'base' ? null : G.seg(lv, String(f.level), (v) => { f.level = +v; update(); }), G.seg([{ v: 'signups', l: 'Signups' }, { v: 'customers', l: 'Customers' }, { v: 'revenue', l: 'Revenue' }], f.metric, (v) => { f.metric = v; chart(); }));
      }
      function chart() {
        const act = G.rows('forecast_actual') || [], s = cur(), b = scs()[0], key = { signups: 'proj_signups', customers: 'proj_customers', revenue: 'proj_revenue' }[f.metric], P = G.J(s[key]), B = G.J(b[key]);
        const fm = (v) => (f.metric === 'revenue' ? F.inr(v) : F.n(v));
        ch.replaceChildren();
        const W = ch.clientWidth || 640, H = 320, m = { t: 14, r: 16, b: 34, l: 58 }, n = act.length, np = P.scenario.length;
        const x = d3.scaleLinear([0, n + np - 1], [m.l, W - m.r]);
        const all = act.map((a) => a[f.metric]).concat(P.best, P.worst, P.scenario, B.scenario);
        const y = d3.scaleLinear([d3.min(all) * 0.85, d3.max(all) * 1.05], [H - m.b, m.t]).nice();
        const svg = d3.select(ch).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H).attr('role', 'img').attr('aria-label', 'Forecast projection chart');
        y.ticks(5).forEach((t) => { svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).style('stroke', 'var(--g-line-2)'); svg.append('text').attr('x', m.l - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 11).style('fill', 'var(--g-ink-3)').text(f.metric === 'revenue' ? F.inr(t) : F.c(t)); });
        const t0 = new Date(act[0].week).getTime(), lab = (i) => new Date(t0 + i * 7 * 864e5).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        d3.range(0, n + np, 3).forEach((i) => svg.append('text').attr('x', x(i)).attr('y', H - 12).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--g-ink-3)').text(lab(i)));
        svg.append('line').attr('x1', x(n - 0.5)).attr('x2', x(n - 0.5)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--g-line)').attr('stroke-dasharray', '4 4');
        svg.append('text').attr('x', x(n - 0.5) + 6).attr('y', m.t + 10).attr('font-size', 10.5).style('fill', 'var(--g-ink-3)').text('FORECAST →');
        const xi = (i) => x(n + i);
        svg.append('path').attr('d', d3.area().x((d, i) => xi(i)).y0((d, i) => y(P.worst[i])).y1((d) => y(d))(P.best)).style('fill', 'var(--g-em-l)').style('fill-opacity', 0.6);
        const L = d3.line();
        svg.append('path').attr('d', L(act.map((a, i) => [x(i), y(a[f.metric])]))).style('fill', 'none').style('stroke', 'var(--g-ink)').attr('stroke-width', 2);
        svg.append('path').attr('d', L([[x(n - 1), y(act[n - 1][f.metric])]].concat(B.scenario.map((v, i) => [xi(i), y(v)])))).style('fill', 'none').style('stroke', 'var(--g-ink-3)').attr('stroke-width', 1.8).attr('stroke-dasharray', '5 4');
        svg.append('path').attr('d', L([[x(n - 1), y(act[n - 1][f.metric])]].concat(P.scenario.map((v, i) => [xi(i), y(v)])))).style('fill', 'none').style('stroke', 'var(--g-em)').attr('stroke-width', 2.4);
        const hit = svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).style('fill', 'transparent');
        hit.on('mousemove', (e) => { const px = d3.pointer(e)[0]; const i = Math.max(0, Math.min(n + np - 1, Math.round(x.invert(px)))); const isA = i < n; G.tip.show(e, h('div', null, h('b', { text: 'Week of ' + lab(i) }), isA ? h('div', { class: 'r' }, h('span', { text: 'Actual' }), h('b', { text: fm(act[i][f.metric]) })) : [h('div', { class: 'r' }, h('span', { text: 'Scenario' }), h('b', { text: fm(P.scenario[i - n]) })), h('div', { class: 'r' }, h('span', { text: 'Current trajectory' }), h('b', { text: fm(B.scenario[i - n]) })), h('div', { class: 'r' }, h('span', { text: 'Best / worst' }), h('b', { text: fm(P.best[i - n]) + ' / ' + fm(P.worst[i - n]) }))])); }).on('mouseleave', G.tip.hide);
      }
      function results() {
        const base = scs()[0], s = cur();
        const t = G.table({ source: 'scenarios', key: ['id'], id: (r) => r.id, onRow: (r) => { f.group = r.group; f.level = r.level; update(); }, rowCls: (r) => (r.id === s.id ? 'sel' : ''),
          cols: [{ k: 'label', label: 'Scenario', first: 1, nofield: true, f: (r) => G.nm(r.label + (r.level ? ' ' + (r.level > 0 ? '+' : '') + r.level + '%' : ''), r.note) }, { k: 'signups', label: 'Signups', cls: 'r num', f: (r) => h('div', null, F.n(r.signups), r.id !== 'base' ? G.dl((r.signups / base.signups - 1) * 100, true) : null) }, { k: 'customers', label: 'Customers', cls: 'r num', f: (r) => F.n(r.customers) }, { k: 'revenue', label: 'Revenue', cls: 'r num', f: (r) => h('div', null, F.inr(r.revenue), r.id !== 'base' ? G.dl((r.revenue / base.revenue - 1) * 100, true) : null) }, { k: 'spend', label: 'Spend', cls: 'r num', hide: 'm', f: (r) => F.inr(r.spend) }, { k: 'cac', label: 'CAC', cls: 'r num', f: (r) => F.inrF(r.cac) }, { k: 'roas', label: 'ROAS', cls: 'r num', nofield: true, f: (r) => F.x(r.revenue / r.spend) }] });
        const ra = (r) => { const P = G.J(r.proj_revenue); const sc = d3.sum(P.scenario) || 1; return r.revenue * (d3.sum(P.worst) / sc); };
        const bestE = scs().slice().sort((a, b) => b.revenue - a.revenue)[0], bestR = scs().slice().sort((a, b) => ra(b) - ra(a))[0];
        t.set(scs().map((r) => Object.assign({}, r, { roas: r.revenue / r.spend }))); res.replaceChildren(h('div', { class: 'g-row', style: 'padding:12px 16px;gap:10px' }, h('span', { class: 'sm' }, G.badge('Best expected outcome', 'green'), ' ', h('b', { text: bestE.label + (bestE.level ? ' ' + (bestE.level > 0 ? '+' : '') + bestE.level + '%' : '') }), ' · ' + F.inr(bestE.revenue)), h('span', { class: 'sm' }, G.badge('Best risk-adjusted outcome', 'dark'), ' ', h('b', { text: bestR.label + (bestR.level ? ' ' + (bestR.level > 0 ? '+' : '') + bestR.level + '%' : '') }), ' · ' + F.inr(Math.round(ra(bestR))) + ' (worst-case weighted)')), t.el);
        const dS = s.signups - base.signups, dR = s.revenue - base.revenue;
        note.replaceChildren(h('div', { class: 'g-ai g-mb16' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'What this scenario means'), h('p', { text: s.id === 'base' ? 'No changes. ' + s.note : `${s.label} ${s.level > 0 ? '+' : ''}${s.level}%: ${dS >= 0 ? '+' : ''}${F.n(dS)} signups and ${dR >= 0 ? '+' : ''}${F.inr(dR)} revenue over the base case, at a CAC of ${F.inrF(s.cac)} (base ${F.inrF(base.cac)}). ${s.note}` })));
      }
      function update() {
        kBox.replaceChildren(...(G.rows('forecast_kpis') || []).map((k) => G.kpiCard({ label: k.label, value: k.value, unit: k.unit, prev: k.current, delta: k.delta, good_up: true, f: { value: 'value', delta: 'delta', prev: 'current' } }, { src: 'forecast_kpis', where: { id: k.id } })));
        controls(); chart(); results();
      }
      return { update };
    },
  });

  /* =========================== REPORTS =========================== */
  G.page('reports', {
    ds: ['reports'],
    build(root, opts) {
      const f = G.pf('reports', { sel: 'daily' });
      if (opts && opts.sel) f.sel = opts.sel;
      const list = h('div', { class: 'g-card pad0' }), doc = h('div');
      root.append(G.head('Reporting', 'Reports', 'Narrative GTM reports, ready to read, share and schedule.', [G.btn('Create report', create, 'pri')]), h('div', { class: 'g-rep-grid' }, list, doc));
      S.local.reps = S.local.reps || {};
      const auto = () => { const base = G.rows('reports') || []; return base.length || G.WS.mode() === 'empty' ? base : [G.makeReport('Daily GTM report', 'Last 7 days', 'auto')]; };
      const all = () => (S.local.newReps || []).concat(auto());
      function create() {
        const form = G.form([{ k: 'type', label: 'Report type', type: 'select', opts: ['Daily GTM report', 'Weekly growth report', 'Creator performance report', 'Board summary'] }, { k: 'period', label: 'Period', type: 'select', opts: ['Yesterday', 'Last 7 days', 'Last 30 days'] }]);
        G.modal({ title: 'Create report', body: form.el, actions: (c) => [G.btn('Cancel', c), G.btn('Generate', () => { const v = form.get(); c(); gen(v); }, 'pri')] });
      }
      function gen(v) {
        const raw = (G.rows('reports') || [])[0], base = raw && G.WS.mode() === 'demo' && G.WS.active().base === 'wispr' ? raw : G.makeReport(v.type, v.period);
        doc.replaceChildren(G.card('Generating ' + v.type + '…', 'Pulling data from ' + G.sourceList().length + ' sources', G.skel(6, 18)));
        setTimeout(() => { const r = Object.assign({}, base, { id: 'gen' + Date.now(), type: v.type, period: v.period, minutes_ago: 0, schedule: 'Not scheduled' }); S.local.newReps = [r].concat(S.local.newReps || []); f.sel = r.id; fill(); G.toast('Report generated'); }, 1200);
      }
      function text(r) { const sec = (t, a) => (a && a.length ? '\n## ' + t + '\n' + a.map((x) => '- ' + x).join('\n') + '\n' : ''); return '# ' + r.type + ' — ' + r.period + '\n\n' + r.summary + '\n' + sec('Performance', r.performance) + sec('What changed', r.changes) + sec('Wins', r.wins) + sec('Problems', r.problems) + sec('Opportunities', r.opportunities) + sec('Recommended actions', r.actions); }
      function schedule(r) {
        const form = G.form([{ k: 'freq', label: 'Frequency', type: 'select', opts: ['Every day at 8:00 AM IST', 'Every Monday at 9:00 AM IST', 'First of the month, 9:00 AM IST'], val: r.schedule }, { k: 'to', label: 'Recipients', val: r.recipients || '#growth' }]);
        G.modal({ title: 'Schedule report', sub: r.type, body: form.el, actions: (c) => [G.btn('Cancel', c), G.btn('Save schedule', () => { const v = form.get(); S.local.reps[r.id] = { schedule: v.freq, recipients: v.to }; c(); G.toast('Scheduled: ' + v.freq); fill(); }, 'pri')] });
      }
      function fill() {
        const rs = all().map((r) => Object.assign({}, r, S.local.reps[r.id] || {}));
        if (!rs.length) { list.replaceChildren(); doc.replaceChildren(G.empty('▤', 'No reports yet', 'Create a report to summarize your growth data.')); return; }
        if (!rs.some((r) => r.id === f.sel)) f.sel = rs[0].id;
        list.replaceChildren(...rs.map((r) => h('button', { class: 'g-rli' + (r.id === f.sel ? ' on' : ''), type: 'button', onclick: () => { f.sel = r.id; fill(); } }, G.mk(h('b', { style: 'text-align:left;display:block', text: r.type }), 'reports', 'type', { id: r.id }), h('div', { class: 'xs muted', style: 'text-align:left', text: r.period + ' · ' + ago(r.minutes_ago) }), h('div', { class: 'xs', style: 'text-align:left', text: '⏱ ' + r.schedule }))));
        const r = rs.find((x) => x.id === f.sel);
        const sec = (t, a, tone) => a && a.length ? h('div', { class: 'g-mt16' }, h('h3', { class: 'g-rep-h', text: t }), h('ul', { class: 'g-ul' }, a.map((x) => h('li', { text: x })))) : null;
        doc.replaceChildren(h('div', { class: 'g-card g-rep' }, h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('div', null, h('div', { class: 'g-eyebrow', text: G.WS.active().name + (G.WS.active().sub ? ' · ' + G.WS.active().sub : '') }), h('h2', { style: 'margin:2px 0', text: r.type }), h('div', { class: 'sm muted', text: r.period + ' · generated ' + ago(r.minutes_ago) })), h('div', { class: 'g-row' }, G.btn('Copy summary', () => G.copy(r.summary, 'Summary copied')), G.btn('Share', () => G.copy('https://growth-os.example/reports/' + r.id, 'Share link copied')), G.btn('Schedule', () => schedule(r)), G.btn('Export', () => G.download(r.type.toLowerCase().replace(/\W+/g, '-') + '.md', text(r), 'text/markdown'), 'pri'))),
          h('div', { class: 'g-ai g-mt16' }, h('div', { class: 'tag' }, 'Executive summary'), G.mk(h('p', { style: 'margin:0', text: r.summary }), 'reports', 'summary', { id: r.id })),
          sec('Performance', r.performance), sec('What changed', r.changes), sec('Wins', r.wins), sec('Problems', r.problems), sec('Opportunities', r.opportunities), sec('Recommended actions', r.actions),
          h('div', { class: 'xs muted g-mt16', text: 'Sent to ' + r.recipients + ' · ' + r.schedule })));
      }
      function update() { fill(); if (opts && opts.create) { opts.create = false; create(); } }
      return { update };
    },
  });

  /* =========================== ACTIVITY =========================== */
  G.page('activity', {
    ds: ['activity'],
    build(rootEl) {
      const f = G.pf('activity', { kind: '', sev: '' });
      const fb = h('div', { class: 'g-tools' }), feed = h('div', { class: 'g-card pad0' });
      rootEl.append(G.head('Reporting', 'Activity', 'Everything that happened in your growth system, newest first.', [G.btn('Mark all read', () => { (G.rows('activity') || []).forEach((a) => (S.read[a.id] = true)); S.liveEvents.forEach((e) => (S.read[e.id] = true)); G.toast('All activity marked as read'); fill(); })]), fb, feed);
      const KIND_IC = { Campaigns: '◧', Creators: '✦', Leads: '◎', Ads: '▣', Experiments: '◇', Sales: '₹', Alerts: '!' };
      function all() { const live = S.liveEvents.map((e) => ({ id: e.id, mins_ago: (Date.now() - e.ts) / 60000, kind: e.kind || 'Alerts', title: e.title, detail: e.detail || 'Live event from a connected source.', page: e.page, severity: e.severity || 'good' })); return live.concat(G.rows('activity') || []).sort((a, b) => a.mins_ago - b.mins_ago); }
      function fill() {
        const rows = all().filter((a) => (!f.kind || a.kind === f.kind) && (!f.sev || a.severity === f.sev));
        feed.replaceChildren(...(rows.length ? rows.map((a) => h('button', { class: 'g-feed-i', type: 'button', onclick: () => { S.read[a.id] = true; G.drawer({ title: a.title, sub: a.kind + ' · ' + ago(a.mins_ago), body: h('div', { class: 'g-gap8' }, h('p', { text: a.detail }), G.badge(a.severity === 'bad' ? 'Needs attention' : a.severity === 'warn' ? 'Watch' : 'Positive', a.severity === 'bad' ? 'red' : a.severity === 'warn' ? 'amber' : 'green')), footer: (c) => [a.page ? G.btn('Open ' + a.page, () => { c(); G.go(a.page); }, 'pri') : null, G.btn('Close', c)] }); fill(); } }, h('span', { class: 'g-feed-ic ' + (a.severity || ''), text: KIND_IC[a.kind] || '•' }), h('div', { style: 'flex:1;min-width:0;text-align:left' }, h('div', { style: 'font-weight:' + (S.read[a.id] ? 400 : 600), text: a.title }), h('div', { class: 'xs muted', text: a.detail })), h('div', { class: 'xs muted', style: 'white-space:nowrap', text: ago(a.mins_ago) }))) : [G.empty('∅', 'No activity matches', 'Try a different filter.', G.btn('Clear filters', () => { f.kind = ''; f.sev = ''; update(); }))]));
      }
      function update() {
        const kinds = [...new Set((G.rows('activity') || []).map((a) => a.kind))].sort();
        fb.replaceChildren(G.seg([{ v: '', l: 'All' }].concat(kinds.map((k) => ({ v: k, l: k }))), f.kind, (v) => { f.kind = v; fill(); }), G.sel([{ v: '', l: 'Any severity' }, { v: 'bad', l: 'Needs attention' }, { v: 'warn', l: 'Watch' }, { v: 'good', l: 'Positive' }], f.sev, (v) => { f.sev = v; fill(); }, 'Severity'));
        fill();
      }
      return { update };
    },
  });

  /* =========================== SETTINGS =========================== */
  G.page('settings', {
    ds: ['datasources', 'settings', 'team', 'goals', 'alert_rules'],
    build(root, opts) {
      const f = G.pf('settings', { sec: 'company' });
      if (opts && opts.sec) f.sec = opts.sec;
      const SECS = [['company', 'Company'], ['sources', 'Data sources'], ['workspace', 'Workspace'], ['team', 'Team'], ['integrations', 'Integrations'], ['goals', 'Goals'], ['alerts', 'Alerts'], ['attribution', 'Attribution'], ['ai', 'AI'], ['billing', 'Billing']];
      S.local.ds = S.local.ds || {}; S.local.alert = S.local.alert || {}; S.local.set = S.local.set || {};
      const nav = h('div', { class: 'g-card pad0 g-setnav' }), body = h('div');
      root.append(G.head('Settings', 'Settings', 'Connect sources, set goals and tune how Growth OS works for your team.'), h('div', { class: 'g-set-grid' }, nav, body));
      const sv = (section) => (G.rows('settings') || []).filter((s) => s.section === section);
      function fill() {
        nav.replaceChildren(...SECS.map(([k, l]) => h('button', { class: 'g-rli' + (k === f.sec ? ' on' : ''), type: 'button', onclick: () => { f.sec = k; fill(); }, text: l })));
        body.replaceChildren(({ company: G.companyPanel, sources, workspace: () => kv('Workspace'), team, integrations, goals, alerts, attribution: () => kv('Attribution'), ai: () => kv('AI'), billing: () => kv('Billing') }[f.sec] || sources)());
      }
      function kv(section) {
        const rows = sv(section);
        return h('div', { class: 'g-card pad0' }, rows.map((s) => { const cur = S.local.set[s.id] != null ? S.local.set[s.id] : s.value; const isTog = /^(On|Off|Enabled|Disabled)$/i.test(cur) || /Auto-apply|Voice|View-through/.test(s.key);
          return h('div', { class: 'g-setrow' }, h('div', null, h('b', { text: s.key })), isTog ? toggle(/^(on|enabled)$/i.test(cur), (v) => { S.local.set[s.id] = v ? 'On' : 'Off'; G.toast(s.key + ': ' + (v ? 'on' : 'off')); }) : h('div', { class: 'g-row' }, h('span', { class: 'sm', text: cur }), G.btn('Edit', () => { const form = G.form([{ k: 'v', label: s.key, val: cur }]); G.modal({ title: 'Edit ' + s.key.toLowerCase(), body: form.el, actions: (c) => [G.btn('Cancel', c), G.btn('Save', () => { S.local.set[s.id] = form.get().v; c(); G.toast('Saved'); fill(); }, 'pri')] }); }, 'sm'))); }));
      }
      function toggle(on, fn) { const b = h('button', { class: 'g-tog' + (on ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': String(!!on), onclick: () => { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); fn(on); } }, h('i')); return b; }
      function sources() {
        const list = G.sourceList(), st = G.dataStatus();
        return h('div', { class: 'g-card' }, h('div', { class: 'g-card-h' }, h('div', null, h('h3', { text: 'Data sources' }), h('div', { class: 'g-sub', text: st.label })), h('div', { class: 'r' }, G.btn('+ Add data', () => G.addDataModal(), 'pri'))),
          list.length ? h('div', null, list.slice(0, 6).map((d) => h('div', { class: 'g-setrow' }, h('div', null, h('b', { text: d.name }), h('div', { class: 'xs muted', text: d.kind + ' · ' + F.n(d.records) + ' records' })), G.statusBd(d.status)))) : G.empty('⛁', 'No sources yet', 'Connect a source or upload a CSV.'),
          h('div', { class: 'g-row g-mt16' }, G.btn('Open Data Sources', () => G.go('datasources'), 'pri')));
      }
      function connect() {
        const form = G.form([{ k: 'src', label: 'Source', type: 'select', opts: ['HubSpot', 'Salesforce', 'LinkedIn Ads', 'Razorpay', 'Segment', 'Mixpanel', 'WhatsApp Business'] }, { k: 'acc', label: 'Account / workspace ID', ph: 'e.g. wisprflow-in' }]);
        G.modal({ title: 'Connect a data source', sub: 'You’ll be asked to authorise read-only access.', body: form.el, actions: (c) => [G.btn('Cancel', c), G.btn('Authorise', () => { const v = form.get(); if (!v.acc.trim()) return G.toast('Enter an account ID', { tone: 'bad' }); S.local.ds['new-' + v.src] = { id: 'new-' + v.src }; c(); G.toast(v.src + ' connection started — first sync in a few minutes'); }, 'pri')] });
      }
      function configure(d) { const form = G.form([{ k: 'freq', label: 'Sync frequency', type: 'select', opts: ['Every 5 min', 'Every 15 min', 'Hourly', 'Daily'], val: 'Every 15 min' }, { k: 'lb', label: 'Backfill', type: 'select', opts: ['30 days', '90 days', '12 months'], val: '90 days' }]); G.modal({ title: 'Configure ' + d.name, body: form.el, actions: (c) => [G.btn('Disconnect', () => G.confirm({ title: 'Disconnect ' + d.name + '?', text: 'Dashboards that depend on it will stop updating.', confirm: 'Disconnect', danger: true, onConfirm: () => { c(); S.local.ds[d.id] = { status: 'Attention', sync: 'Disconnected' }; G.toast(d.name + ' disconnected'); fill(); } }), 'ghost'), G.btn('Cancel', c), G.btn('Save', () => { c(); G.toast('Settings saved for ' + d.name); }, 'pri')] }); }
      function team() { return h('div', { class: 'g-card pad0' }, (G.rows('team') || []).map((t) => h('div', { class: 'g-setrow' }, h('div', { class: 'g-row', style: 'flex-wrap:nowrap' }, h('span', { class: 'g-av', text: G.initials(t.name) }), h('div', null, h('b', { text: t.name }), h('div', { class: 'xs muted', text: t.role + ' · ' + t.email }))), h('div', { class: 'g-row' }, G.badge(t.access), h('span', { class: 'xs muted', text: t.last_active }))))); }
      function integrations() { const items = [['Slack', '#growth · daily digest, alerts'], ['Email', 'Weekly report to leadership'], ['Webhooks', 'Send Radar alerts to your own systems'], ['Wispr Flow voice', 'Hold-to-speak in Ask Growth OS']]; return h('div', { class: 'g-card pad0' }, items.map(([n, d]) => h('div', { class: 'g-setrow' }, h('div', null, h('b', { text: n }), h('div', { class: 'xs muted', text: d })), toggle(n !== 'Webhooks', (v) => G.toast(n + (v ? ' enabled' : ' disabled')))))); }
      function goals() { return h('div', { class: 'g-two' }, (G.rows('goals') || []).map((g) => { const p = Math.min(100, g.current / g.target * 100); return h('div', { class: 'g-card' }, h('b', { text: g.name }), h('div', { class: 'g-row g-mt8', style: 'align-items:baseline' }, h('span', { class: 'num', style: 'font-size:22px;font-weight:600', text: F.val(g.unit, g.current) }), h('span', { class: 'muted sm', text: 'of ' + F.val(g.unit, g.target) })), G.pbar(p, g.pace === 'On track' ? '' : 'amber'), h('div', { class: 'xs muted g-mt8', text: Math.round(p) + '% · ' + g.pace })); })); }
      function alerts() { return h('div', { class: 'g-card pad0' }, (G.rows('alert_rules') || []).map((a) => h('div', { class: 'g-setrow' }, h('div', null, h('b', { text: a.metric }), h('div', { class: 'xs muted', text: a.cond + ' → ' + a.notify })), toggle(S.local.alert[a.id] != null ? S.local.alert[a.id] : a.enabled, (v) => { S.local.alert[a.id] = v; G.toast('Alert ' + (v ? 'enabled' : 'paused')); })))); }
      function update() { fill(); }
      return { update };
    },
  });

  /* =========================== ASK RADAR =========================== */
  G.page('ask', {
    ds: ['ask', 'suggestions'],
    build(root, opts) {
      S.local.askHist = S.local.askHist || [];
      const out = h('div', { class: 'g-ask-out' }), chips = h('div', { class: 'g-row' });
      const inp = h('input', { class: 'g-input', type: 'text', placeholder: 'Ask anything about your growth…', 'aria-label': 'Ask Growth OS', style: 'flex:1;min-width:200px', onkeydown: (e) => { if (e.key === 'Enter') run(inp.value); } });
      const mic = h('button', { class: 'g-mic', type: 'button', 'aria-label': 'Hold to speak' }, h('span', { text: '🎙' }));
      const status = h('div', { class: 'sm muted', style: 'text-align:center', text: 'Hold to speak, or type below' }), wave = h('div', { class: 'g-wave' }, d3.range(14).map(() => h('i')));
      root.append(G.head('Optimize', 'Ask Growth OS', 'Ask a question out loud. Get the analysis, the evidence, and the action.'),
        h('div', { class: 'g-card g-ask-in' }, h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0 16px' }, mic, wave, status, h('div', { class: 'xs muted' }, 'Powered by ', h('b', { text: 'Wispr Flow' }), ' · voice is simulated in this prototype')),
          h('div', { class: 'g-row' }, inp, G.btn('Ask', () => run(inp.value), 'pri')), h('div', { class: 'xs muted g-mt8', text: 'Try one of these' }), chips), out);
      const items = () => G.rows('ask') || [];
      chips.replaceChildren(...SUG().slice(0, 6).map((a) => h('button', { class: 'g-chip', type: 'button', onclick: () => run(a.q), text: a.q })));
      let t0 = 0, tm = null;
      const start = (e) => { e.preventDefault(); t0 = Date.now(); mic.classList.add('live'); wave.classList.add('on'); status.textContent = 'Listening… release to send'; try { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (SR && false) new SR(); } catch (x) { /* ignore */ } };
      const stop = () => { if (!mic.classList.contains('live')) return; mic.classList.remove('live'); wave.classList.remove('on'); if (Date.now() - t0 < 450) { status.textContent = 'Too short — hold the button while you speak'; return; } status.textContent = 'Transcribing with Wispr Flow…'; const pool = SUG().slice(0, 4); const q = inp.value.trim() || pool[S.local.askHist.length % pool.length].q; setTimeout(() => { inp.value = q; status.textContent = 'Heard: “' + q + '”'; run(q); }, 600); };
      mic.addEventListener('pointerdown', start); window.addEventListener('pointerup', stop); mic.addEventListener('pointercancel', stop);
      mic.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); }); mic.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); });
      function match(q) { return G.askMatch(q); }
      function run(q) {
        q = (q || '').trim(); if (!q) return G.toast('Type or speak a question first', { tone: 'bad' });
        inp.value = q; S.local.askHist.unshift(q);
        const a = match(q);
        const steps = ['Question', 'Answer', 'Evidence', 'Impact', 'Action'];
        const stepper = h('div', { class: 'g-psteps' }, steps.map((s, i) => h('span', { class: 'g-pstep', 'data-i': i }, h('b', { text: i + 1 }), s)));
        const card = h('div', { class: 'g-card g-fade' }, stepper, h('div', { class: 'g-mt16' }, G.skel(3, 18)));
        out.replaceChildren(card);
        const mark = (n) => stepper.querySelectorAll('.g-pstep').forEach((s) => s.classList.toggle('on', +s.dataset.i <= n));
        mark(0);
        if (!a) { setTimeout(() => { mark(4); card.replaceChildren(h('div', { class: 'g-gap8' }, h('div', { class: 'g-eyebrow', text: 'QUESTION' }), h('b', { text: q }), G.empty('?', 'I can’t answer that from the connected data yet', 'This prototype answers questions about signups, CAC, creators, leads, ROAS, creatives and forecasts. Try one of the examples.'))); }, 700); return; }
        const body = h('div', { class: 'g-gap16' });
        card.replaceChildren(stepper, body);
        const secs = [
          () => h('div', null, h('div', { class: 'g-eyebrow', text: 'QUESTION' }), h('div', { style: 'font-size:18px;font-weight:600', text: q })),
          () => h('div', null, h('div', { class: 'g-eyebrow', text: 'ANSWER' }), G.mk(h('div', { style: 'font-weight:600', text: a.headline }), 'ask', 'headline', { id: a.id }), G.mk(h('p', { class: 'sm', text: a.analysis }), 'ask', 'analysis', { id: a.id })),
          () => h('div', null, h('div', { class: 'g-eyebrow', text: 'EVIDENCE' }), h('div', { class: 'g-ev' }, G.J(a.evidence).map(([k, v]) => h('div', null, h('small', { text: k }), h('b', { text: v }))))),
          () => h('div', null, h('div', { class: 'g-eyebrow', text: 'BUSINESS IMPACT' }), h('p', { style: 'margin:0', text: a.impact || a.analysis })),
          () => h('div', null, h('div', { class: 'g-eyebrow', text: 'RECOMMENDATION' }), G.mk(h('p', { style: 'margin:0;font-weight:600', text: a.reco }), 'ask', 'reco', { id: a.id })),
          () => h('div', null, h('div', { class: 'g-eyebrow', text: 'EXPECTED IMPACT' }), h('p', { style: 'margin:0', text: G.ansExpected(a) })),
          () => G.ansButtons(a, null, q),
        ];
        secs.forEach((fn, i) => setTimeout(() => { if (!document.body.contains(card)) return; body.append(h('div', { class: 'g-fade' }, fn())); mark(Math.min(4, i)); }, 350 + i * 450));
        histRender();
      }
      const hist = h('div');
      root.append(hist);
      function histRender() { const hs = [...new Set(S.local.askHist)].slice(0, 5); hist.replaceChildren(hs.length ? G.card('Recent questions', null, h('div', { class: 'g-gap8' }, hs.map((q) => h('button', { class: 'g-chip', type: 'button', onclick: () => run(q), text: q })))) : h('span')); }
      function update() { histRender(); if (opts && opts.q) { const q = opts.q; opts.q = null; setTimeout(() => run(q), 80); } }
      return { update };
    },
  });
  /* ---------- Ask Growth OS bar + answer banner (shared) ---------- */
  G.askGo = (q) => {
    const a = G.askMatch(q);
    if (!a) { G.toast('I can’t answer that from the connected data yet. Try “Which campaign has the best CAC?”', { tone: 'bad' }); return false; }
    S.answerPending = { q, a };
    let o = {}; try { o = G.J(a.go_opts || '{}'); } catch (e) { /* ignore */ }
    G.go(a.go, o); return true;
  };
  G.answerBanner = (ans) => {
    const a = ans.a, box = h('div', { class: 'g-card g-ans g-fade', role: 'status' });
    box.append(h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('div', { class: 'g-eyebrow', style: 'margin:0', text: 'Ask Growth OS · “' + ans.q + '”' }), h('button', { class: 'g-btn ghost sm', type: 'button', 'aria-label': 'Dismiss answer', onclick: () => { S.answer = null; box.remove(); }, text: '✕' })),
      G.mk(h('div', { style: 'font-size:16px;font-weight:600;margin-top:4px', text: a.headline }), 'ask', 'headline', { id: a.id }),
      G.mk(h('p', { class: 'sm', style: 'margin:6px 0', text: a.analysis }), 'ask', 'analysis', { id: a.id }),
      h('div', { class: 'g-eyebrow', style: 'margin-top:8px', text: 'Evidence' }), h('div', { class: 'g-ev' }, G.J(a.evidence).map(([k, v]) => h('div', null, h('small', { text: k }), h('b', { text: v })))),
      a.impact ? h('p', { class: 'sm', style: 'margin:8px 0 0' }, h('b', { text: 'Business impact: ' }), a.impact) : null,
      h('p', { class: 'sm', style: 'margin:4px 0 0' }, h('b', { text: 'Expected impact: ' }), G.ansExpected(a)),
      h('div', { class: 'g-row g-mt8' }, h('span', { class: 'sm' }, h('b', { text: 'Recommendation: ' }), G.mk(h('span', { text: a.reco }), 'ask', 'reco', { id: a.id })), G.btn('Why this?', () => G.evidenceDrawer({ rec: a.reco, a: { title: 'Evidence', rows: G.J(a.evidence) }, pattern: a.analysis, result: a.impact || '' }), 'sm'), G.btn('Ask another', () => { S.answer = null; G.go('ask'); }, 'sm')));
    return box;
  };
  G.askBar = () => {
    const inp = h('input', { class: 'g-input', type: 'text', placeholder: 'Ask Growth OS… “Which campaign has the best CAC?”', 'aria-label': 'Ask Growth OS', style: 'flex:1;min-width:180px', onkeydown: (e) => { if (e.key === 'Enter') G.askGo(inp.value); } });
    const mic = h('button', { class: 'g-micbtn', type: 'button', 'aria-label': 'Hold to speak', title: 'Hold to speak' }, h('span', { text: '🎙' }), h('span', { class: 'sm', text: 'Hold to speak' }));
    const status = h('span', { class: 'xs muted', text: 'Powered by Wispr Flow · voice is simulated in this prototype' });
    let t0 = 0;
    const start = (e) => { e.preventDefault(); t0 = Date.now(); mic.classList.add('live'); status.textContent = 'Listening… release to send'; };
    const stop = () => {
      if (!mic.isConnected) { window.removeEventListener('pointerup', stop); return; }
      if (!mic.classList.contains('live')) return;
      mic.classList.remove('live');
      if (Date.now() - t0 < 450) { status.textContent = 'Too short — hold the button while you speak'; return; }
      status.textContent = 'Transcribing with Wispr Flow…';
      const pool = SUG().slice(0, 4); S.micIdx = (S.micIdx || 0) + 1;
      const q = inp.value.trim() || pool[(S.micIdx - 1) % pool.length].q;
      setTimeout(() => { inp.value = q; status.textContent = 'Heard: “' + q + '”'; G.askGo(q); }, 500);
    };
    mic.addEventListener('pointerdown', start); window.addEventListener('pointerup', stop); mic.addEventListener('pointercancel', stop);
    mic.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); }); mic.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); });
    const chipRow = h('div', { class: 'g-row', style: 'gap:6px' });
    const fillChips = () => chipRow.replaceChildren(...(G.COMMAND_QS && G.WS.mode() !== 'empty' ? G.COMMAND_QS.map((q) => ({ q })) : SUG().slice(0, 4)).map((a) => h('button', { class: 'g-chip', type: 'button', onclick: () => G.askGo(a.q), text: a.q })));
    fillChips();
    return h('div', { class: 'g-card g-askbar' }, h('div', { class: 'g-row', style: 'flex-wrap:nowrap' }, h('b', { style: 'white-space:nowrap', text: 'Ask Growth OS' }), inp, mic, G.btn('Ask', () => G.askGo(inp.value), 'pri')), h('div', { class: 'g-row g-mt8' }, chipRow), h('div', { class: 'g-mt8' }, status));
  };
})();
