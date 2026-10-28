(function () {
  'use strict';
  /* The decision loop: Growth Decision Log, "what we've learned", the closed experiment loop,
     the attribution contribution chart, the allocation simulator, and the wiring that places each
     analytics section on the page where it belongs. */
  const G = window.G, h = G.h, S = G.S, F = G.F, CH = G.ch, SX = G.sx;
  const sum = G.sum, div = G.div, r0 = Math.round;
  const money = (v) => F.inr(v);
  const DAY = 864e5;
  const fdate = (iso) => { try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch (e) { return iso; } };

  /* ---------- parse "+31 qualified leads", "₹2.4L revenue", "CAC ₹3,617 → ₹3,400" so a result can be measured against it ---------- */
  const TOK = /([+−-]?)\s?(₹?)(\d[\d,]*\.?\d*)\s?(Cr|L|K)?/g;
  const toks = (str) => { const out = []; let m; TOK.lastIndex = 0; while ((m = TOK.exec(str || ''))) { let v = parseFloat(m[3].replace(/,/g, '')); if (m[4] === 'L') v *= 1e5; else if (m[4] === 'Cr') v *= 1e7; else if (m[4] === 'K') v *= 1e3; out.push({ i: m.index, len: m[0].length, sign: m[1], cur: !!m[2], suf: m[4] || '', v: m[1] === '−' || m[1] === '-' ? -v : v, raw: m[0] }); } return out; };
  const fmtTok = (t, val) => { const a = Math.abs(val), sg = t.sign ? (val < 0 ? '−' : '+') : (val < 0 ? '−' : ''); if (t.cur) return sg + (t.suf === 'L' ? '₹' + (a / 1e5).toFixed(1) + 'L' : t.suf === 'Cr' ? '₹' + (a / 1e7).toFixed(2) + 'Cr' : t.suf === 'K' ? '₹' + (a / 1e3).toFixed(0) + 'K' : '₹' + F.n(a)); return sg + (a >= 100 || Number.isInteger(t.v) ? F.n(a) : a.toFixed(1)) + (t.suf || ''); };
  G.measure = (d) => {
    const ts = toks(d.expected); if (!ts.length) return { actual: d.expected, ratio: 1 };
    const arrow = /→/.test(d.expected) && ts.length > 1, rnd = G.rng ? G.rng(d.id)() : 0.5, f = 0.75 + rnd * 0.5, t = arrow ? ts[ts.length - 1] : ts[0], base = arrow ? ts[0].v : 0;
    const actualV = base + (t.v - base) * f, txt = d.expected.slice(0, t.i) + fmtTok(t, actualV) + d.expected.slice(t.i + t.len);
    return { actual: txt, ratio: f };
  };
  const statusOf = (ratio) => (ratio >= 0.95 ? 'Validated' : ratio >= 0.6 ? 'Partially validated' : 'Missed');

  /* ---------- decision store (per workspace, persisted) ---------- */
  function seeds() {
    const w = G.WS.active(); if (G.WS.mode(w) !== 'demo') return [];
    const a = G.an('30d'); if (a.empty) return [];
    const END = G.END || '2026-10-27', dAgo = (n) => new Date(new Date(END + 'T00:00:00Z').getTime() - n * DAY).toISOString().slice(0, 10), out = [];
    const N = G.nextRupee && G.nextRupee();
    const mk = (n, o) => out.push(Object.assign({ id: 'seed-' + n, seed: true, ts: new Date(dAgo(o.ago) + 'T09:00:00Z').getTime(), date: dAgo(o.ago), kind: 'budget' }, o));
    if (N && N.from && N.tos && N.tos[0]) {
      const amt = Math.min(40000, r0(N.from.spend * 0.3 / 5000) * 5000) || 5000, sim = G.sim([{ frm: N.from.name, to: N.tos[0].name, amount: amt }]), dl = Math.max(2, r0(sim.next.leads - sim.base.leads));
      mk(1, { ago: 24, title: 'Moved ' + F.inrF(amt) + ' a month from ' + N.from.name + ' to ' + N.tos[0].name, reason: N.tos[0].name + ' returned ' + F.x(N.tos[0].roas) + ' vs ' + F.x(N.from.roas) + ' on ' + N.from.name, expected: '+' + dl + ' qualified leads a month', actual: '+' + r0(dl * 1.19) + ' qualified leads a month', ratio: 1.19, status: 'Validated' });
    }
    const cre = (G.rows('creatives') || []).filter((c) => c.range === '30d' && c.d_ctr != null).sort((p, q) => p.d_ctr - q.d_ctr)[0];
    if (cre) { const e = Math.max(5, r0(cre.signups / 4.3 * 0.25)); mk(2, { ago: 17, kind: 'creative', title: 'Paused ' + cre.ref + ' on ' + cre.channel + ' and moved its budget to the best creative', reason: cre.ref + ' CTR ' + F.d(cre.d_ctr) + ' vs previous period', expected: '+' + e + ' weekly signups', actual: '+' + r0(e * 0.72) + ' weekly signups', ratio: 0.72, status: 'Partially validated' }); }
    const best = a.ch.filter((c) => c.spend > 0 && c.roas).sort((p, q) => q.roas - p.roas)[0];
    if (best) { const e = r0(best.signups * 0.2 * 0.85); mk(3, { ago: 12, title: 'Increased ' + best.name + ' budget by 20%', reason: best.name + ' has the best ROAS (' + F.x(best.roas) + ') and room to grow', expected: '+' + e + ' signups', actual: '+' + r0(e * 1.07) + ' signups', ratio: 1.07, status: 'Validated' }); }
    mk(4, { ago: 6, kind: 'funnel', title: 'Added a pricing banner to the landing page', reason: 'Visitor → signup rate lagged the best channels', expected: '+0.5 pts visitor → signup rate', actual: '+0.2 pts visitor → signup rate', ratio: 0.4, status: 'Missed' });
    return out;
  }
  G.decisions = () => { const w = G.WS.active(); return (w.decisions || []).concat(seeds()).sort((p, q) => q.ts - p.ts); };
  G.logDecision = (o) => {
    const w = G.WS.active(); w.decisions = w.decisions || [];
    const d = { id: 'dec-' + Date.now() + '-' + w.decisions.length, ts: Date.now(), date: new Date().toISOString().slice(0, 10), kind: o.kind || 'chart', owner: o.owner || '', evidence: o.evidence || '', followUp: o.followUp || '', title: o.title, reason: o.reason || '', expected: o.expected || '', metric: o.metric || '', amount: o.amount || null, status: 'Measuring', actual: null, ratio: null };
    w.decisions.unshift(d); G.WS.save(); G.afterAction && G.afterAction();
    G.toast('Decision logged: ' + o.title, { action: { label: 'Open log', fn: () => G.go('decisions') } });
    if (G.cur && G.cur.id === 'decisions') G.rerender();
    return d;
  };
  G.measureDecision = (id) => {
    const w = G.WS.active(), d = (w.decisions || []).find((x) => x.id === id); if (!d) return;
    const m = G.measure(d); d.actual = m.actual; d.ratio = m.ratio; d.status = statusOf(m.ratio); G.WS.save(); G.rerender();
    G.toast(d.status + ': ' + m.actual, { tone: d.status === 'Missed' ? 'bad' : undefined });
  };
  G.removeDecision = (id) => { const w = G.WS.active(); w.decisions = (w.decisions || []).filter((x) => x.id !== id); G.WS.save(); G.rerender(); };

  /* ---------- what we've learned ---------- */
  G.learnings = () => {
    const ds = G.decisions().filter((d) => d.status !== 'Measuring'), out = [], a = G.an('30d');
    const KIND = { budget: ['Moving budget toward higher-return channels works', 'Keep reallocating each month toward the best marginal return.'], creative: ['Replacing fatigued creative recovers part of the loss', 'Rotate creative before CTR falls more than 10%.'], creator: ['Creator reallocation pays back', 'Judge creators by customers, not views.'], funnel: ['Landing-page tweaks need a real test first', 'Run a controlled experiment before changing the page for everyone.'], sales: ['Faster follow-up converts waiting leads', 'Keep a same-day follow-up rule for high-intent leads.'] };
    const by = {}; ds.forEach((d) => (by[d.kind] = (by[d.kind] || []).concat(d)));
    Object.keys(by).forEach((k) => {
      const L = by[k], v = L.filter((d) => d.status === 'Validated').length, avg = r0(sum(L, (d) => (d.ratio || 0) * 100) / L.length), K = KIND[k] || ['What worked', 'Repeat the decisions that were validated.'];
      out.push({ title: v >= L.length / 2 ? K[0] : k === 'funnel' ? K[0] : 'Expected gains from ' + k + ' changes were overstated', ev: [L.length + ' decision' + (L.length === 1 ? '' : 's'), v + ' validated', 'Average result ' + avg + '% of expected'], reco: v >= L.length / 2 ? K[1] : 'Set smaller expectations and measure sooner.', tone: v >= L.length / 2 ? 'green' : 'amber' });
    });
    if (!a.empty) {
      const paid = a.ch.filter((c) => c.spend > 0 && c.cac && c.name !== 'Creators' && c.name !== 'Referral'), cr = a.ch.find((c) => c.name === 'Creators');
      if (cr && cr.cac && paid.length >= 2) { const pc = sum(paid, 'spend') / sum(paid, 'customers'), imp = (1 - cr.cac / pc) * 100; if (imp > 5) out.push({ title: 'Creator campaigns consistently beat paid social on CAC', ev: [F.inrF(cr.cac) + ' creator CAC', F.inrF(pc) + ' paid-channel CAC', F.pct(imp, 0) + ' cheaper'], reco: 'Increase creator allocation in future campaigns.', tone: 'green' }); }
      const ex = (G.rows('experiments') || []).filter((e) => e.lift != null), win = ex.filter((e) => e.status === 'Winning'), los = ex.filter((e) => e.status === 'Losing');
      if (ex.length >= 3) out.push({ title: win.length ? 'Tests that won: ' + win.slice().sort((p, q) => q.lift - p.lift).slice(0, 2).map((e) => e.name).join(', ') : 'No test has won yet', ev: [ex.length + ' experiments', win.length + ' winning · ' + los.length + ' losing', win.length ? 'Average winning lift +' + (sum(win, 'lift') / win.length).toFixed(1) + '%' : 'No clear lift yet'], reco: win.length ? 'Ship the winners and stop the losers early.' : 'Let running tests reach confidence before deciding.', tone: win.length ? 'green' : '' });
    }
    return out;
  };

  /* ---------- Growth Decision Log page ---------- */
  G.page('decisions', {
    ds: [],
    build(root) {
      const kBox = h('div', { class: 'g-kpis', style: '--min:170px' }), lBox = h('div', { class: 'g-grid' }), tBox = h('div', { class: 'g-card pad0' });
      root.append(G.head('Optimize', 'Growth Decision Log', 'Every recommendation you applied, what you expected, and what actually happened.', [G.btn('Open GTM Radar', () => G.go('radar')), G.btn('Where should the next ₹1 go?', () => G.go('channels'), 'pri')]),
        G.flowRibbonLoop(), kBox, G.sec('What we’ve learned', 'Patterns from your own decisions and experiments. Growth OS gets smarter from your history.'), lBox, G.sec('Decisions', 'Newest first. Apply a recommendation anywhere in Growth OS and it appears here.'), tBox);
      function update() {
        const all = G.decisions(), m = all.filter((d) => d.status !== 'Measuring'), v = m.filter((d) => d.status === 'Validated').length;
        kBox.replaceChildren(...[['Decisions logged', String(all.length), all.filter((d) => !d.seed).length + ' yours' + (all.some((d) => d.seed) ? ' · ' + all.filter((d) => d.seed).length + ' demo history' : '')], ['Validated', m.length ? F.pct(v / m.length * 100, 0) : '—', v + ' of ' + m.length + ' measured'], ['Result vs expected', m.length ? r0(sum(m, (d) => (d.ratio || 0) * 100) / m.length) + '%' : '—', 'Average across measured decisions'], ['Still measuring', String(all.length - m.length), 'Measure once enough days pass']].map(([k, val, sub]) => h('div', { class: 'g-card g-kpi' }, h('div', { class: 'g-kpi-l', text: k }), h('div', { class: 'g-kpi-v num', text: val }), h('div', { class: 'xs muted', text: sub }))));
        const L = G.learnings();
        lBox.replaceChildren(...(L.length ? L.map((l) => h('div', { class: 'g-card g-learn', style: 'grid-column:span 4;min-width:0' }, h('div', { class: 'g-eyebrow', text: 'LEARNING' }), h('b', { style: 'font-size:15px', text: l.title }), h('ul', { class: 'g-ul g-mt8' }, l.ev.map((e) => h('li', { text: e }))), h('div', { class: 'sm g-mt8' }, h('b', { text: 'Recommendation: ' }), l.reco)))
          : [h('div', { style: 'grid-column:1/-1' }, G.card(null, null, G.empty('◌', 'Nothing to learn from yet', 'Apply a recommendation, then measure the result. Patterns show up here once there is history.')))]));
        tBox.replaceChildren(all.length ? h('div', { style: 'overflow-x:auto' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Date', 'Decision', 'Reason', 'Expected', 'Actual', 'Status', ''].map((t) => h('th', { text: t })))),
          h('tbody', null, all.map((d) => h('tr', { class: 'row' }, h('td', { class: 'num', text: fdate(d.date) }), h('td', null, h('b', { text: d.title }), d.seed ? h('div', { class: 'xs muted', text: 'Demo history' }) : null), h('td', { class: 'sm', text: d.reason }), h('td', { class: 'sm', text: d.expected || '—' }), h('td', { class: 'sm', text: d.actual || '—' }),
            h('td', null, G.badge(d.status, d.status === 'Validated' ? 'green' : d.status === 'Missed' ? 'red' : d.status === 'Partially validated' ? 'amber' : '')),
            h('td', { class: 'r' }, d.seed ? null : h('span', { class: 'g-row', style: 'gap:6px;justify-content:flex-end;flex-wrap:nowrap' }, d.status === 'Measuring' ? G.btn('Measure result', () => G.measureDecision(d.id), 'sm') : null, G.btn('Remove', () => G.removeDecision(d.id), 'sm ghost')))))))) : G.empty('☰', 'No decisions yet', 'Apply a recommendation from GTM Radar, Next ₹1 or any chart insight. Each one is recorded with the result you expect.', G.btn('Open GTM Radar', () => G.go('radar'), 'pri')));
        if (G.WS.mode() === 'demo') tBox.append(h('div', { class: 'xs muted', style: 'padding:10px 16px', text: 'Measure result compares the metric after the decision with what was expected. In this demo the measurement is simulated; with real data it reads your actual numbers.' }));
      }
      return { update };
    },
  });
  G.flowRibbonLoop = () => h('div', { class: 'g-flow' }, G.chain(['SIGNAL', 'DIAGNOSIS', 'RECOMMENDATION', 'SIMULATION', 'ACTION', 'OUTCOME', 'LEARNING'], true));

  /* ---------- tie existing Apply / Take-action flows into the log ---------- */
  const oSig = G.signalAct;
  G.signalAct = (s, after) => oSig(s, () => { G.logDecision({ title: G.sigTitle ? G.sigTitle(s) : s.action, reason: s.what, expected: s.expected || '', metric: s.metric || '', kind: s.go === 'creators' ? 'creator' : s.go === 'leads' || s.go === 'pipeline' ? 'sales' : /creative/i.test(s.what || '') ? 'creative' : 'budget' }); after && after(); });

  /* ---------- closed experiment loop ---------- */
  SX.expLoop = () => {
    const box = h('div', { class: 'g-gap8' });
    const s = { el: G.card('Closed loop: Radar → experiment → result → recommendation', 'Experiments feed their result back into GTM Radar, so the next recommendation starts from what you learned.', box) };
    s.update = () => {
      const ex = (S.local.exps || []).concat(G.rows('experiments') || []).map((e) => Object.assign({}, e, (S.local.expRes || {})[e.id] || {}));
      const done = ex.filter((e) => e.status === 'Winning' || e.status === 'Losing').sort((p, q) => Math.abs(q.lift || 0) - Math.abs(p.lift || 0)).slice(0, 4), run = ex.filter((e) => e.status === 'Running').slice(0, 2);
      const logged = (id) => (G.WS.active().decisions || []).some((d) => d.expRef === id);
      box.replaceChildren(...done.map((e) => {
        const win = e.status === 'Winning', rec = win ? 'Recommendation validated. Scale ' + (G.J(e.variants).slice(-1)[0] || { name: 'the winner' }).name + '.' : 'Recommendation rejected. Stop this variation and keep the control.';
        return h('div', { class: 'g-loop' }, h('div', { class: 'g-loop-n' }, h('b', { text: e.name }), h('div', { class: 'xs muted', text: e.metric })), h('div', { class: 'g-loop-r' }, G.dl(e.lift, true)), h('div', { class: 'sm g-loop-t' }, h('span', { class: 'g-dot ' + (win ? '' : 'red') }), rec),
          logged(e.id) ? G.badge('In decision log', 'green') : G.btn(win ? 'Record decision' : 'Record learning', () => { const d = G.logDecision({ title: (win ? 'Scaled: ' : 'Stopped: ') + e.name, reason: 'Experiment result ' + F.d(e.lift) + ' on ' + e.metric, expected: win ? 'Lift of ' + F.d(e.lift) : 'Avoid ' + F.d(e.lift), kind: 'experiment', metric: e.metric }); const w = G.WS.active(), x = (w.decisions || []).find((y) => y.id === d.id); if (x) { x.expRef = e.id; x.actual = 'Measured in experiment: ' + F.d(e.lift); x.ratio = 1; x.status = win ? 'Validated' : 'Validated'; G.WS.save(); } s.update(); }, 'sm'));
      }), ...run.map((e) => h('div', { class: 'g-loop' }, h('div', { class: 'g-loop-n' }, h('b', { text: e.name }), h('div', { class: 'xs muted', text: e.metric })), h('div', { class: 'g-loop-r' }, e.lift != null ? G.dl(e.lift, true) : null), h('div', { class: 'sm g-loop-t' }, h('span', { class: 'g-dot amber' }), 'Running — result due ' + e.ends + '.'), G.badge('Running', 'green'))),
      done.length || run.length ? null : h('div', { class: 'sm muted', text: 'No experiments yet. Create one from a GTM Radar signal and its result will show up here.' }));
    };
    return s;
  };
  /* build an experiment from a Radar signal: hypothesis, control, variant, metrics, expected outcome */
  G.signalExp = (s) => {
    const cause = (G.J(s.cause) || [])[0] || s.evidence || '';
    const metric = /ctr|creative|hook/i.test(s.what || '') ? 'CTR' : /activation/i.test(s.what || '') ? 'Signup → activation rate' : /cac/i.test(s.what || '') ? 'CAC' : 'Signups';
    G.expModal({ name: 'Test: ' + (G.sigTitle ? G.sigTitle(s) : s.action), scope: /creative|hook|ctr/i.test(s.what || '') ? 'creative' : 'growth', hyp: 'If we ' + String(s.action || '').replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()) + ', then ' + (s.expected || 'performance improves') + ', because ' + String(cause).replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()) + '.', control: 'Current setup', variant: String(s.action || '').replace(/\.$/, ''), primary: metric, secondary: 'Signups, Activation, CAC, Revenue', expected: s.expected || '' });
  };

  /* ---------- attribution: contribution that follows the selected model ---------- */
  SX.attr = () => {
    const box = h('div'), chain = G.chain(['Ad', 'Creator', 'Landing page', 'Signup', 'Activation', 'Lead', 'Customer', 'Revenue'], true);
    const s = { el: G.card('Revenue by attribution model', 'Switch the model above and this view re-allocates revenue. Dotted marker = last-touch credit.', h('div', { class: 'g-gap16' }, h('div', { class: 'g-flow' }, chain), box)) };
    s.update = () => {
      const f = G.pf('attribution', { model: 'data' }), all = G.rows('attribution') || [], rows = all.filter((r) => r.model === f.model).sort((p, q) => q.revenue - p.revenue), last = {}; all.filter((r) => r.model === 'last').forEach((r) => (last[r.source] = r.revenue));
      if (!rows.length) { box.replaceChildren(G.empty('◌', 'No attribution data', 'Attribution needs customers linked to touchpoints.')); return; }
      const tot = sum(rows, 'revenue');
      box.replaceChildren(CH.hbar(rows.map((r) => ({ key: r.source, name: r.source, sub: F.n(r.customers) + ' customers', value: r.revenue, color: G.chCol(r.source), tag: h('span', { class: 'num xs', text: F.pct(r.revenue / tot * 100, 0) + (f.model !== 'last' && last[r.source] != null ? ' · last ' + F.pct(last[r.source] / tot * 100, 0) : '') }), r })), { fmt: money, onPick: (k) => (k === 'Creators' ? G.go('creators') : G.go('channels')), tip: (r) => h('div', null, h('b', { text: r.name }), h('div', { class: 'r' }, h('span', { text: 'Revenue' }), h('b', { text: money(r.value) })), h('div', { class: 'r' }, h('span', { text: 'CAC' }), h('b', { text: r.r.cac ? F.inrF(r.r.cac) : '—' })), h('div', { class: 'r' }, h('span', { text: 'ROI' }), h('b', { text: r.r.roi ? F.x(r.r.roi) : '—' }))) }));
    };
    G.attrRefresh = () => { if (s.el.isConnected) s.update(); };
    return s;
  };

  /* ---------- allocation simulator (Forecast) ---------- */
  SX.allocSim = () => {
    const box = h('div', { class: 'g-gap16' }), st = { frm: null, mv: {} };
    const s = { el: G.card('Allocation simulator', 'Move budget between channels and watch the projected month change immediately.', box) };
    s.update = () => {
      const N = G.nextRupee(); if (!N || N.rows.length < 3) { box.replaceChildren(G.empty('◌', 'Nothing to simulate yet', 'Needs at least three channels with spend.')); return; }
      const ch = G.chan30(), names = N.rows.map((c) => c.name);
      if (!st.frm || !ch[st.frm]) { st.frm = N.from.name; st.mv = {}; N.moves.forEach((m) => (st.mv[m.to] = m.amount)); }
      const tos = names.filter((n) => n !== st.frm).slice(0, 5), out = h('div'), note = h('div', { class: 'sm' });
      const redraw = () => { const moves = Object.keys(st.mv).filter((k) => st.mv[k] > 0).map((k) => ({ frm: st.frm, to: k, amount: st.mv[k] })), moved = sum(moves, 'amount'), over = moved > ch[st.frm].spend; const r = G.sim(over ? [] : moves); out.replaceChildren(G.simTable(r)); const dc = r.next.customers - r.base.customers, dr = r.next.revenue - r.base.revenue; note.replaceChildren(over ? 'Moving more than ' + st.frm + ' spends. Lower an amount.' : h('span', null, h('b', { text: 'Projected: ' }), (dc >= 0 ? '+' : '−') + Math.abs(r0(dc)) + ' customers and ' + (dr >= 0 ? '+' : '−') + money(Math.abs(dr)) + ' revenue a month at the same total spend (' + money(moved) + ' moved).')); applyB.disabled = over || !moved; };
      const applyB = G.btn('Apply & log decision', () => { const moves = Object.keys(st.mv).filter((k) => st.mv[k] > 0).map((k) => ({ frm: st.frm, to: k, amount: st.mv[k] })), r = G.sim(moves), moved = sum(moves, 'amount'); G.logDecision({ title: 'Moved ' + F.inrF(moved) + ' a month from ' + st.frm + ' to ' + moves.map((m) => m.to).join(' and '), reason: 'Allocation simulator', expected: '+' + r0(r.next.customers - r.base.customers) + ' customers a month', metric: 'customers', amount: moved, kind: 'budget' }); }, 'pri');
      box.replaceChildren(h('div', { class: 'g-row' }, h('span', { class: 'sm', text: 'Take budget from' }), G.sel(names, st.frm, (v) => { st.frm = v; st.mv = {}; s.update(); }, 'Source channel')),
        ...tos.map((n) => { const val = h('b', { class: 'num', style: 'min-width:70px;text-align:right', text: F.inrF(st.mv[n] || 0) }); const rg = h('input', { type: 'range', min: 0, max: Math.round(ch[st.frm].spend), step: 5000, value: st.mv[n] || 0, 'aria-label': 'Budget to move to ' + n, style: 'flex:1;min-width:140px;accent-color:var(--g-em)', oninput: () => { st.mv[n] = +rg.value; val.textContent = F.inrF(st.mv[n]); redraw(); } }); return h('div', { class: 'g-row', style: 'flex-wrap:nowrap' }, h('span', { class: 'sm', style: 'min-width:110px', text: '→ ' + n }), rg, val); }), out, note, h('div', { class: 'g-row' }, applyB));
      redraw();
    };
    return s;
  };

  /* ---------- placement: put each section where it belongs, without rebuilding any page ---------- */
  const ext = (id, fn) => {
    const p = G.pages[id]; if (!p) return; const b = p.build;
    p.build = function (root, opts) {
      const api = b.call(this, root, opts) || {}; let ex = {};
      try { ex = fn(root, opts) || {}; } catch (e) { console.error('[growth-os] extending ' + id, e); }
      return Object.assign({}, api, { update() { api.update && api.update.apply(this, arguments); try { ex.update && ex.update(); } catch (e) { console.error(e); } } });
    };
  };
  const before = (root, el, re) => { const t = Array.from(root.children).find((c) => c.classList.contains('g-sec') && re.test(c.textContent || '')); if (t) root.insertBefore(el, t); else root.append(el); };
  const multi = (list) => ({ update() { list.forEach((s) => { s.update(); requestAnimationFrame(() => { if (s.el.isConnected) s.update(); }); }); } });
  ext('channels', (root) => {
    const tabs = SX.channelTabs(); before(root, G.sec('Growth analytics', 'Where growth comes from, what it costs, and which channel is efficient.'), /Channel comparison/); before(root, tabs.el, /Channel comparison/); return multi([tabs]);
  });
  ext('creators', (root) => { const c = SX.creators(); before(root, c.el, /Creator performance/); return multi([c]); });
  ext('leads', (root) => { const s = SX.sales(); before(root, G.sec('Sales funnel', 'Where leads turn into customers, and where they leak.'), /All leads/); before(root, s.el, /All leads/); return multi([s]); });
  ext('pipeline', (root, opts) => {
    const s = SX.pipelineStage(); before(root, s.el, /^Deals/); const stage = opts && opts.stage;
    return { update() { s.update(); requestAnimationFrame(() => { if (s.el.isConnected) s.update(); }); if (stage) setTimeout(() => { const names = { New: ['New', 'Contacted'], Qualified: ['Qualified', 'Meeting'], Proposal: ['Proposal'], Negotiation: ['Negotiation'], Won: ['Won'] }[stage] || [stage]; root.querySelectorAll('.g-kcol').forEach((c) => { const t = (c.querySelector('.g-kh b') || {}).textContent; c.classList.toggle('flash', names.includes(t)); }); const f = root.querySelector('.g-kcol.flash'); f && f.scrollIntoView({ block: 'nearest', inline: 'center' }); }, 30); } };
  });
  ext('attribution', (root) => { const s = SX.attr(); before(root, G.sec('Contribution by model', 'The same customers, credited differently.'), /Attribution model/); before(root, s.el, /Attribution model/); return multi([s]); });
  ext('forecast', (root) => { const s = SX.allocSim(), r = SX.revenue(); root.append(G.sec('Allocation simulator', 'Try a different split before you commit budget.'), s.el, G.sec('Revenue trajectory', 'Where revenue is heading against target.'), r.el); return multi([s, r]); });
  ext('experiments', (root) => { const s = SX.expLoop(); before(root, s.el, /All experiments/); return multi([s]); });

  /* ---------- Radar detail: label the six parts the way the product promises them ---------- */
  G.radarRename = { 'What changed': 'Signal', 'Why it matters': 'Impact', 'What caused it': 'Cause', 'What to do': 'Recommendation' };
  /* ---------- Ask Growth OS answer: ANSWER → EVIDENCE → BUSINESS IMPACT → RECOMMENDATION → EXPECTED IMPACT ---------- */
  const budgetAns = (a) => /budget|shift|move|reallocat|allocation|next ₹1|scale/i.test((a.reco || '') + ' ' + (a.q || '')) && (a.go === 'channels' || a.go === 'forecast' || /budget|shift|move/i.test(a.reco || ''));
  G.ansMoves = (a) => { if (!budgetAns(a)) return null; const N = G.nextRupee && G.nextRupee(); return N && N.moves && N.moves.length ? N : null; };
  G.ansExpected = (a) => {
    if (a.expected) return a.expected;
    const N = G.ansMoves(a);
    if (N) { const r = G.sim(N.moves); return '+' + r0(r.next.customers - r.base.customers) + ' customers and +' + money(r.next.revenue - r.base.revenue) + ' revenue a month at the same total spend (move ' + F.inrF(sum(N.moves, 'amount')) + ' from ' + N.from.name + ').'; }
    return a.impact ? 'Acting removes this: ' + a.impact : 'Act, then re-check this number in 7 days.';
  };
  G.ansButtons = (a, close, q) => {
    const N = G.ansMoves(a), ev = G.J(a.evidence) || [], c = close || (() => {});
    return h('div', { class: 'g-row g-mt8' },
      G.btn('View evidence', () => G.evidenceDrawer({ rec: a.reco || a.headline, a: { title: 'Evidence', rows: ev }, pattern: a.analysis, result: G.ansExpected(a) }), 'sm'),
      N ? G.btn('Simulate', () => { c(); G.simModal({ frm: N.from.name, moves: N.moves.map((m) => ({ to: m.to, amount: m.amount })), title: 'Simulate allocation' }); }, 'sm') : null,
      G.btn('Take action', () => { if (N) { const r = G.sim(N.moves); c(); G.applyInsight({ signal: a.headline, action: 'Move ' + F.inrF(sum(N.moves, 'amount')) + ' a month from ' + N.from.name + ' to ' + N.moves.map((m) => m.to).join(' and '), expected: '+' + r0(r.next.customers - r.base.customers) + ' customers a month', metric: 'customers', kind: 'budget' }); } else { c(); S.answerPending = { q: q || a.q, a }; G.go(a.go, G.J(a.go_opts || '{}') || {}); } }, 'pri sm'));
  };
  G.ansCard = (a, back, close, q) => {
    const ev = G.J(a.evidence) || [], blk = (t, body) => h('div', { class: 'g-ans-b' }, h('div', { class: 'g-eyebrow', text: t }), body);
    return h('div', { class: 'g-ans-card' }, back, h('div', { class: 'g-eyebrow', text: 'GROWTH ANALYST · ' + (a.group || 'ANSWER') }),
      blk('ANSWER', h('div', null, h('div', { class: 'g-ans-h', text: a.headline }), a.analysis ? h('p', { class: 'sm', style: 'margin:4px 0 0', text: a.analysis }) : null)),
      ev.length ? blk('EVIDENCE', h('div', { class: 'g-ev' }, ev.map(([k, v]) => h('div', null, h('small', { text: k }), h('b', { text: v }))))) : null,
      blk('BUSINESS IMPACT', h('p', { class: 'sm', style: 'margin:0', text: a.impact || a.analysis || '—' })),
      a.reco ? blk('RECOMMENDATION', h('p', { class: 'sm', style: 'margin:0;font-weight:600', text: a.reco })) : null,
      blk('EXPECTED IMPACT', h('p', { class: 'sm', style: 'margin:0', text: G.ansExpected(a) })),
      a.src && a.src.length ? blk('SOURCE DATA', h('div', { class: 'g-row', style: 'flex-wrap:wrap' }, a.src.map(([l, pg, o]) => G.btn(l + ' →', () => { close && close(); G.go(pg, o || {}); }, 'sm')))) : null,
      G.ansButtons(a, close, q),
      h('div', { class: 'g-row g-mt8' }, G.btn('Why this?', () => G.whyThis && G.whyThis({ conf: 0.8, title: a.headline, evidence: a.analysis || '', impactTxt: a.impact || '', action: a.reco || '', why: { metric: (ev[0] || [])[0] || 'Source data', comparison: (ev[0] || [])[1] || '', reasoning: a.analysis || '', conf: 'Computed from your connected data' } }), 'sm'), G.btn('Log decision', () => G.logDecisionModal && G.logDecisionModal({ title: a.reco || a.headline, reason: a.headline, evidence: ev.map((e) => e[0] + ': ' + e[1]).join('; '), expected: G.ansExpected(a) }), 'sm')));
  };
})();
