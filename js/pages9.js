(function () {
  'use strict';
  /* Analytics sections, part 2: CAC trend, performance trend, campaign comparison, creator efficiency,
     sales funnel, pipeline by stage, revenue growth, and "where should the next ₹1 go". */
  const G = window.G, h = G.h, S = G.S, F = G.F, CH = G.ch, SX = G.sx;
  const sum = G.sum, div = G.div, clamp = G.clamp, r0 = Math.round;
  const money = (v) => F.inr(v);
  const R = () => S.range;
  const noData = () => G.empty('◌', 'Nothing to chart yet', 'Connect data or load demo data and this view fills in.');
  const goCh = (name) => (name === 'Creators' ? G.go('creators') : G.go('channels'));
  const DAY = 864e5;
  G.live = (s) => { s.update(); requestAnimationFrame(() => { if (s.el.isConnected) s.update(); }); return s; };

  /* previous-period daily rows for the whole business (only when the series is long enough) */
  const prevRows = (Rg) => {
    const n = G.RN[Rg], ser = G.rows('series') || []; if (ser.length < 2 * n) return null;
    const a = G.an(Rg), ctr = div(a.tot.clicks, a.tot.impr) || 0.016;
    return ser.slice(-2 * n, -n).map((r) => ({ date: new Date(new Date(r.date + 'T00:00:00Z').getTime() + n * DAY), impr: r.clicks / ctr, clicks: r.clicks, visitors: r.traffic, spend: r.spend, signups: r.signups, activated: r.activated, customers: r.customers, revenue: r.revenue }));
  };
  G.miniSim = (title, sub, rows, onApply, applyLabel) => G.modal({ title, sub, body: h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Per month', 'Current', 'After', 'Change'].map((t, i) => h('th', { class: i ? 'r' : '', text: t })))),
    h('tbody', null, rows.map(([l, a, b, fm, dir]) => { const d = b - a, pct = a ? d / a * 100 : 0, good = dir === 0 ? null : dir > 0 ? d > 0 : d < 0; return h('tr', { class: 'row' }, h('td', { text: l }), h('td', { class: 'r num', text: fm(a) }), h('td', { class: 'r num', style: 'font-weight:600', text: fm(b) }), h('td', { class: 'r num' }, Math.abs(pct) < 0.05 ? h('span', { class: 'muted', text: '—' }) : h('span', { class: 'dl ' + (good == null ? 'flat' : good ? 'up' : 'down'), text: (d > 0 ? '+' : '−') + Math.abs(pct).toFixed(1) + '%' }))); }))),
    actions: (c) => [G.btn('Close', c), onApply ? G.btn(applyLabel || 'Apply', () => { c(); onApply(); }, 'pri') : null] });

  /* ======================= CAC TREND ======================= */
  SX.cac = () => {
    const f = G.pf('cac', { r: '30d', ch: 'all', cmp: true }), stats = h('div', { class: 'g-cacs' }), cBox = h('div', { class: 'g-chart' }), insBox = h('div'), ctl = h('span', { class: 'g-row', style: 'gap:8px' });
    const s = { el: G.card('Customer Acquisition Cost', 'What it costs to win a customer, against your target.', h('div', { class: 'g-gap16' }, stats, cBox, insBox), ctl) };
    s.update = () => {
      const a = G.an(f.r), a30 = G.an('30d');
      const chOpts = [{ v: 'all', l: 'All channels' }].concat(a30.ch.filter((c) => c.spend > 0 && c.cac).map((c) => ({ v: c.name, l: c.name })));
      if (!chOpts.some((o) => o.v === f.ch)) f.ch = 'all';
      ctl.replaceChildren(G.seg([{ v: '7d', l: '7D' }, { v: '30d', l: '30D' }, { v: '90d', l: '90D' }], f.r, (v) => { f.r = v; s.update(); }), G.sel(chOpts, f.ch, (v) => { f.ch = v; s.update(); }, 'Channel'), G.chip ? null : h('button', { class: 'g-chip' + (f.cmp ? ' on' : ''), type: 'button', 'aria-pressed': f.cmp, onclick: () => { f.cmp = !f.cmp; s.update(); } }, 'vs previous period'));
      if (a.empty) { cBox.replaceChildren(noData()); stats.replaceChildren(); insBox.replaceChildren(); return; }
      const ent = f.ch === 'all' ? null : a.ch.find((c) => c.name === f.ch), cur = ent ? ent.cac : a.tot.cac, prev = ent ? (ent.d_cac != null ? ent.cac / (1 + ent.d_cac / 100) : null) : a.prev.cac, chg = prev ? (cur / prev - 1) * 100 : null;
      const tg = G.targets().cac, gap = tg ? (cur / tg - 1) * 100 : null;
      stats.replaceChildren(...[['Current CAC', F.inrF(cur), null], ['Previous CAC', prev ? F.inrF(prev) : '—', null], ['Change', chg == null ? '—' : F.d(chg), chg == null ? null : chg <= 0 ? 'up' : 'down'], ['Target CAC', tg ? F.inrF(tg) : 'Not set', null], ['Status', gap == null ? '—' : Math.abs(gap) < 0.5 ? 'On target' : F.pct(Math.abs(gap), 0) + (gap > 0 ? ' above target' : ' below target'), gap == null ? null : gap > 0.5 ? 'down' : 'up']].map(([k, v, t]) => h('div', null, h('small', { text: k }), h('b', { class: 'num ' + (t || ''), text: v }))));
      const rows = G.anTS(f.ch === 'all' ? 'all' : 'channel', f.ch, f.r), win = G.winFor(f.r), series = [{ name: f.ch === 'all' ? 'CAC' : f.ch + ' CAC', color: 'var(--g-em)', data: G.metricSeries(rows, 'cac', win), w: 2.4 }];
      const pr = f.cmp && f.ch === 'all' ? prevRows(f.r) : null;
      if (pr) series.push({ name: 'Previous period', color: 'var(--g-ink-3)', data: G.metricSeries(pr, 'cac', win), dash: '3 3', w: 1.6 });
      if (tg && series[0].data.length) series.push({ name: 'Target CAC', color: 'var(--g-amber)', dash: '6 4', w: 1.6, data: [[series[0].data[0][0], tg], [series[0].data[series[0].data.length - 1][0], tg]] });
      G.line(cBox, { series, height: 230, zero: false, yFmt: (v) => F.inrF(v), tipFmt: (v) => F.inrF(v), label: 'CAC trend' });
      if (f.cmp && f.ch === 'all' && !pr) cBox.append(h('div', { class: 'xs muted g-mt8', text: 'A previous-period line needs twice this many days of history; the change above compares period totals.' }));
      /* Radar read */
      const paid = a30.ch.filter((c) => c.spend > 0 && c.cac);
      if (tg && gap > 0.5 && paid.length > 1) {
        const worst = paid.map((c) => ({ c, x: (c.cac - tg) * c.customers })).sort((p, q) => q.x - p.x)[0].c, best = paid.slice().sort((p, q) => p.cac - q.cac)[0];
        const amt = Math.max(5000, r0(Math.min(worst.spend * 0.25, 60000) / 5000) * 5000), sim = G.sim([{ frm: worst.name, to: best.name, amount: amt }]);
        insBox.replaceChildren(G.chartInsight({ tone: 'amber', signal: 'Blended CAC ' + F.inrF(a30.tot.cac) + ' is ' + F.pct(Math.abs(a30.tot.cac / tg - 1) * 100, 0) + ' above the ' + F.inrF(tg) + ' target.', impact: 'Each customer costs ' + F.inrF(a30.tot.cac - tg) + ' more than planned; across ' + F.n(a30.tot.customers) + ' customers that is ' + money((a30.tot.cac - tg) * a30.tot.customers) + ' a month.', cause: worst.name + ' adds the most excess cost: ' + F.inrF(worst.cac) + ' CAC on ' + F.n(worst.customers) + ' customers.', action: 'Move ' + F.inrF(amt) + ' a month from ' + worst.name + ' to ' + best.name + ' (' + F.inrF(best.cac) + ' CAC).', expected: 'CAC ' + F.inrF(sim.base.cac) + ' → ' + F.inrF(sim.next.cac), conf: 79, metric: 'cac',
          investigate: () => goCh(worst.name), simulate: () => G.simModal({ frm: worst.name, moves: [{ to: best.name, amount: amt }], title: 'Simulate: bring CAC to target' }), apply: () => G.applyInsight({ signal: 'CAC above target', action: 'Move ' + F.inrF(amt) + ' a month from ' + worst.name + ' to ' + best.name, expected: 'CAC ' + F.inrF(sim.base.cac) + ' → ' + F.inrF(sim.next.cac), metric: 'cac', amount: amt, kind: 'budget' }) }));
      } else insBox.replaceChildren(tg ? h('div', { class: 'g-ai' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'Radar insight'), h('p', { text: gap <= 0.5 ? 'CAC is at or below target. Keep the channel mix that produced it.' : 'Not enough channels to recommend a shift.' })) : h('div', { class: 'xs muted', text: 'Set a CAC target in Settings → Company to see the gap to target.' }));
    };
    return s;
  };

  /* ======================= CAMPAIGN PERFORMANCE TREND ======================= */
  G.perfInsight = (ent, mk, first, last, pct, a) => {
    const M = G.METRICS[mk], worse = M.good * pct < 0, name = ent.label;
    if (!worse || Math.abs(pct) < 5) return null;
    const e = ent.row, wk = G.RN[R()] / 7;
    const sg = (G.rows('signals') || []).filter((x) => x.range === R());
    if (mk === 'ctr') {
      const cre = (G.rows('creatives') || []).filter((c) => c.range === R() && (ent.kind === 'channel' ? c.channel === ent.name : ent.kind === 'campaign' ? c.campaign === ent.name : true) && c.d_ctr != null).sort((p, q) => p.d_ctr - q.d_ctr), worst = cre[0];
      const sig = worst && sg.find((x) => new RegExp('creative #' + worst.num + '\\b', 'i').test(x.what || ''));
      if (sig) return { tone: 'amber', signal: sig.what, impact: sig.impact, cause: (G.J(sig.cause) || [])[0] || sig.evidence, action: sig.action, expected: sig.expected || 'Recover the lost signups', conf: sig.conf, metric: 'signups', investigate: () => G.investigate(sig), simulate: () => G.signalSim(sig), apply: () => G.signalAct(sig) };
      const lost = e.impr && e.clicks ? (first - last) / 100 * (e.impr / wk) * (e.signups / e.clicks) : 0;
      return { tone: 'amber', signal: name + ' CTR ' + F.pct(first, 2) + ' → ' + F.pct(last, 2) + ' (' + F.d(pct) + ').', impact: 'About ' + r0(lost) + ' fewer signups a week at the same spend.', cause: worst ? worst.ref + ' CTR ' + F.d(worst.d_ctr) + ' is the steepest decline.' : 'Click-through is falling across creatives.', action: worst ? 'Refresh ' + worst.ref + ' and shift spend to the best-performing creative.' : 'Refresh the creative.', expected: '+' + r0(lost * 0.7) + ' signups a week', conf: 74, metric: 'signups', investigate: () => G.go('channels') };
    }
    const txt = { cpc: ['Each click costs more, so the same budget buys less traffic.', 'Tighten targeting or refresh the creative.'], srate: ['Fewer visitors start signup, so every later stage shrinks.', 'Fix the landing page and message match.'], act: ['Signups are not reaching the product, so paid acquisition decays.', 'Improve first-run onboarding.'], cac: ['Each customer now costs more to win.', 'Rebalance budget toward lower-CAC channels.'], roas: ['Each rupee of spend returns less revenue.', 'Move spend toward the higher-ROAS channels.'] }[mk];
    return { tone: 'amber', signal: name + ' ' + M.l + ' ' + M.fm(first) + ' → ' + M.fm(last) + ' (' + F.d(pct) + ').', impact: txt[0], cause: 'The decline is visible across the period, not a single bad day.', action: txt[1], expected: 'Back to the start-of-period ' + M.l + ' of ' + M.fm(first), conf: 70, metric: mk, investigate: () => G.go(ent.kind === 'campaign' ? 'campaigns' : 'channels', ent.kind === 'campaign' ? { open: ent.name } : {}) };
  };
  SX.perf = () => {
    const f = G.pf('perf', { m: 'ctr', ent: 'all' }), cBox = h('div', { class: 'g-chart' }), note = h('div', { class: 'g-seq' }), insBox = h('div'), ctl = h('span', { class: 'g-row', style: 'gap:8px' });
    const s = { el: G.card('Campaign Performance Trend', 'One metric over time, for the whole business, a channel or a campaign.', h('div', { class: 'g-gap16' }, h('div', { class: 'g-tools' }, G.seg(Object.keys(G.METRICS).map((k) => ({ v: k, l: G.METRICS[k].l })), f.m, (v) => { f.m = v; s.update(); })), note, cBox, insBox), ctl) };
    s.update = () => {
      const a = G.an(R()); if (a.empty) { cBox.replaceChildren(noData()); note.replaceChildren(); insBox.replaceChildren(); return; }
      const ents = [{ v: 'all', l: 'All channels', kind: 'all' }].concat(a.ch.filter((c) => c.clicks > 0).map((c) => ({ v: 'ch:' + c.name, l: c.name, kind: 'channel', name: c.name, row: c }))).concat(a.camps.map((c) => ({ v: 'cp:' + c.key, l: c.name.replace(/^Wispr Flow — /, ''), kind: 'campaign', name: c.key, row: c })));
      if (!ents.some((e) => e.v === f.ent)) f.ent = 'all';
      const E = ents.find((e) => e.v === f.ent), M = G.METRICS[f.m];
      ctl.replaceChildren(G.sel(ents.map((e) => ({ v: e.v, l: e.l })), f.ent, (v) => { f.ent = v; s.update(); }, 'Filter by channel or campaign'));
      const rows = G.anTS(E.kind, E.name, R()), win = G.winFor(R()), pts = G.metricSeries(rows, f.m, win);
      if (pts.length < 3) { cBox.replaceChildren(G.empty('◌', 'Not enough days to chart', 'Choose a longer date range.')); note.replaceChildren(); insBox.replaceChildren(); return; }
      const i0 = Math.min(win - 1, pts.length - 2), first = pts[i0][1], last = pts[pts.length - 1][1], pct = (last / first - 1) * 100, worse = M.good * pct < 0 && Math.abs(pct) >= 5, better = M.good * pct > 0 && Math.abs(pct) >= 5;
      const col = worse ? 'var(--g-red)' : better ? 'var(--g-em)' : 'var(--g-ink-2)';
      const idx = [i0, r0(i0 + (pts.length - 1 - i0) / 3), r0(i0 + 2 * (pts.length - 1 - i0) / 3), pts.length - 1];
      note.replaceChildren(h('b', { text: E.l + ' · ' + M.l }), h('span', { class: 'seq' }, idx.map((i, k) => h('span', null, k ? h('em', { text: '→' }) : null, h('b', { class: 'num', text: M.fm(pts[i][1]) })))), h('span', { class: 'dl ' + (worse ? 'down' : better ? 'up' : 'flat'), text: (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct).toFixed(1) + '% over the period' }));
      const series = [{ name: E.l + ' ' + M.l, color: col, data: pts, w: 2.4 }], pr = f.ent === 'all' ? prevRows(R()) : null;
      if (pr) series.push({ name: 'Previous period', color: 'var(--g-ink-3)', dash: '3 3', w: 1.5, data: G.metricSeries(pr, f.m, win) });
      G.line(cBox, { series, height: 230, zero: false, yFmt: (v) => M.fm(v), tipFmt: (v) => M.fm(v), label: M.l + ' trend' });
      const ins = G.perfInsight({ label: E.l, kind: E.kind, name: E.name, row: E.row || {} }, f.m, first, last, pct, a);
      insBox.replaceChildren(ins ? G.chartInsight(ins) : h('div', { class: 'xs muted', text: worse ? '' : 'No meaningful deterioration for this selection — nothing for Radar to raise.' }));
    };
    return s;
  };

  /* ======================= CAMPAIGN COMPARISON ======================= */
  const CSORT = [['spend', 'Spend', money, 1], ['ctr', 'CTR', (v) => F.pct(v, 2), 1], ['signups', 'Signups', F.n, 1], ['activation', 'Activation', (v) => F.pct(v, 1), 1], ['customers', 'Customers', F.n, 1], ['revenue', 'Revenue', money, 1], ['cac', 'CAC', F.inrF, -1], ['roas', 'ROAS', F.x, 1]];
  SX.campaigns = () => {
    const f = G.pf('campSort', { k: 'roas' }), box = h('div'), seg = h('span');
    const s = { el: G.card('Campaign Performance', 'Every campaign on one scale. Click a campaign to open its workspace.', box, seg) };
    s.update = () => {
      const a = G.an(R()); seg.replaceChildren(G.sel(CSORT.map(([v, l]) => ({ v, l: 'Sort by ' + l })), f.k, (v) => { f.k = v; s.update(); }, 'Sort campaigns'));
      if (a.empty || !a.camps.length) { box.replaceChildren(noData()); return; }
      const [k, , fm, dir] = CSORT.find((x) => x[0] === f.k), rc = G.campClass(a);
      const rows = a.camps.filter((c) => c[k] != null).sort((p, q) => (dir > 0 ? q[k] - p[k] : p[k] - q[k]));
      const bestId = rows[0] && rows[0].key;
      box.replaceChildren(CH.hbar(rows.map((c) => { const r = rc(c); return { key: c.key, name: c.name.replace(/^Wispr Flow — /, ''), sub: c.channel, value: c[k], color: c.key === bestId ? 'var(--g-em)' : 'var(--g-ink-3)', tag: G.badge(r.label, r.tone), c, r }; }), { fmt: fm, onPick: (key) => G.go('campaigns', { open: key }),
        tip: (r) => h('div', null, h('b', { text: r.name }), [['Spend', money(r.c.spend)], ['CTR', F.pct(r.c.ctr, 2)], ['Signups', F.n(r.c.signups)], ['Customers', F.n(r.c.customers)], ['CAC', F.inrF(r.c.cac)], ['Revenue', money(r.c.revenue)], ['ROAS', F.x(r.c.roas)]].map(([x, y]) => h('div', { class: 'r' }, h('span', { text: x }), h('b', { text: y }))), h('div', { class: 'xs muted', text: r.r.why })) }),
      h('div', { class: 'xs muted g-mt8', text: (dir < 0 ? 'Lower is better for CAC. ' : '') + 'Green bar = leader on this metric. Badges classify each campaign as Scale, Maintain, Optimize or Pause against the account average. Hover for why.' }));
    };
    return s;
  };

  /* ======================= CREATOR EFFICIENCY ======================= */
  G.creatorQuad = (rows) => { const mx = d3.median(rows, (r) => r.views), my = d3.median(rows, (r) => r.customers); return (r) => { const hx = r.views >= mx, hy = r.customers > my; return hx && hy ? 'Scale' : !hx && hy ? 'Test' : hx ? 'Optimize' : 'Stop'; }; };
  SX.creators = () => {
    const box = h('div', { class: 'g-chart' }), insBox = h('div'), leg = h('div', { class: 'g-legend g-mt8' });
    const s = { el: G.card('Creator Efficiency', 'Reach is not the same as growth. Views against the customers a creator actually brings.', h('div', { class: 'g-gap16' }, box, leg, insBox)) };
    s.update = () => {
      const a = G.an(R()), rows = a.cr.filter((c) => c.views > 0); if (a.empty || rows.length < 2) { box.replaceChildren(G.empty('◌', 'Not enough creators to plot', 'Needs at least two creators with views.')); leg.replaceChildren(); insBox.replaceChildren(); return; }
      const q = G.creatorQuad(rows), tone = { Scale: 'good', Test: 'warn', Optimize: 'warn', Stop: 'bad' };
      CH.scatter(box, rows.map((c) => ({ key: c.key, name: c.handle, x: c.views, y: c.customers, r: Math.max(1, c.revenue), tone: tone[q(c)], c, quad: q(c) })), { xl: 'Views →', yl: 'Customers →', height: 340, q: { tl: 'TEST · low reach, high impact', tr: 'SCALE · high reach, high impact', bl: 'STOP · low reach, low impact', br: 'OPTIMIZE · high reach, low impact' },
        onPick: (key) => G.go('creators', { open: key }),
        tip: (p) => h('div', null, h('b', { text: p.c.handle }), [['Quadrant', p.quad], ['Views', F.n(p.c.views)], ['Customers', F.n(p.c.customers)], ['Revenue', money(p.c.revenue)], ['CAC', p.c.cac ? F.inrF(p.c.cac) : '—'], ['Customers per 1K views', (p.c.customers / p.c.views * 1000).toFixed(2)]].map(([k, v]) => h('div', { class: 'r' }, h('span', { text: k }), h('b', { text: v })))) });
      leg.replaceChildren(...[['var(--g-em)', 'Scale'], ['var(--g-amber)', 'Test / Optimize'], ['var(--g-red)', 'Stop'], ['var(--g-ink-3)', 'Bubble size = revenue']].map(([c, l]) => h('span', null, h('i', { style: 'background:' + c }), l)));
      const opt = rows.filter((c) => q(c) === 'Optimize').sort((p, c2) => c2.views - p.views)[0], best = rows.slice().sort((p, c2) => (c2.customers / c2.views) - (p.customers / p.views))[0];
      if (opt && best && opt.key !== best.key) {
        const amt = Math.max(1000, r0(opt.spend * 0.5 / 500) * 500), gainC = amt / (best.cac || best.spend / Math.max(1, best.customers)) - amt / (opt.cac || opt.spend / Math.max(1, opt.customers));
        insBox.replaceChildren(G.chartInsight({ tone: 'amber', signal: opt.handle + ' has ' + F.c(opt.views) + ' views but only ' + F.n(opt.customers) + ' customers.', impact: (opt.customers / opt.views * 1000).toFixed(2) + ' customers per 1K views vs ' + (best.customers / best.views * 1000).toFixed(2) + ' for ' + best.handle + '. Reach is being paid for, not growth.', cause: 'Audience is large but not converting: weak call to action or poor audience fit.', action: 'Cut ' + opt.handle + ' payout by ' + F.inrF(amt) + ' and give it to ' + best.handle + '.', expected: '+' + Math.max(1, r0(gainC)) + ' customers a month', conf: 72, metric: 'customers',
          investigate: () => G.go('creators', { open: opt.key }), simulate: () => G.miniSim('Simulate: shift creator budget', opt.handle + ' → ' + best.handle, [['Creator spend', opt.spend + best.spend, opt.spend + best.spend, money, 0], ['Customers (both)', opt.customers + best.customers, opt.customers + best.customers + gainC, F.n, 1], ['Blended CAC (both)', (opt.spend + best.spend) / Math.max(1, opt.customers + best.customers), (opt.spend + best.spend) / Math.max(1, opt.customers + best.customers + gainC), F.inrF, -1]], () => G.logDecision({ title: 'Cut ' + opt.handle + ' payout by ' + F.inrF(amt) + ', give it to ' + best.handle, reason: 'High reach, low business impact', expected: '+' + Math.max(1, r0(gainC)) + ' customers a month', metric: 'customers', amount: amt, kind: 'creator' }), 'Apply & log'),
          apply: () => G.applyInsight({ signal: opt.handle + ' high reach, low impact', action: 'Cut ' + opt.handle + ' payout by ' + F.inrF(amt) + ' and give it to ' + best.handle, expected: '+' + Math.max(1, r0(gainC)) + ' customers a month', metric: 'customers', amount: amt, kind: 'creator' }) }));
      } else insBox.replaceChildren();
    };
    return s;
  };

  /* ======================= SALES FUNNEL + PIPELINE ======================= */
  G.salesStages = (Rg) => {
    const lk = {}, pl = {}; (G.rows('lead_kpis') || []).filter((k) => k.range === Rg).forEach((k) => (lk[k.metric] = k)); (G.rows('pipeline_kpis') || []).forEach((k) => (pl[k.metric] = k));
    if (!lk.new) return [];
    const won = lk.opps && pl.winrate ? Math.round(lk.opps.value * pl.winrate.value / 100) : null, wonPrev = lk.opps && pl.winrate ? Math.round(lk.opps.prev * (pl.winrate.value - (pl.winrate.delta || 0)) / 100) : null;
    const defs = [['new', 'New leads', lk.new.value, lk.new.prev], ['qualified', 'Qualified', lk.qualified.value, lk.qualified.prev], ['high', 'High intent', lk.high.value, lk.high.prev], ['opps', 'Opportunity', lk.opps.value, lk.opps.prev]];
    if (won != null) defs.push(['won', 'Won', won, wonPrev]);
    return defs.map(([key, label, value, prev], i) => { const o = { key, label, value, prev, fmt: F.n, delta: prev ? (value / prev - 1) * 100 : null, good: true }; if (i) { o.conv = value / defs[i - 1][2] * 100; o.prevConv = defs[i - 1][3] && prev ? prev / defs[i - 1][3] * 100 : null; o.drop = 100 - o.conv; } return o; });
  };
  SX.sales = () => {
    const fBox = h('div'), bn = h('div', { class: 'g-gap16' });
    const s = { el: h('div', { class: 'g-gap16' }, G.card('Sales Funnel', 'From new lead to won deal, with the conversion at every step.', fBox), bn) };
    s.update = () => {
      const st = G.salesStages(R()); if (!st.length) { fBox.replaceChildren(noData()); bn.replaceChildren(); return; }
      fBox.replaceChildren(CH.funnel(st, { sel: null, onPick: (k) => (k === 'opps' || k === 'won' ? G.go('pipeline') : G.go('leads', k === 'high' ? { filter: 'followup' } : {})) }), h('div', { class: 'xs muted g-mt8', text: 'Won = opportunities × current win rate. Click a stage to open its records.' }));
      const ps = G.pipelineStats(), leads = (G.rows('leads') || []), hi = leads.filter((l) => (l.intent === 'High' || l.intent === 'Very High') && !['Customer', 'Opportunity'].includes(l.stage)), waiting = leads.filter((l) => l.waiting);
      const steps = st.slice(2), low = steps.filter((x) => x.conv != null).sort((p, q) => p.conv - q.conv)[0], toOpp = low && low.key === 'opps';
      const leakV = toOpp ? sum(hi, 'est_value') : sum(ps.stalled, 'value'), affected = toOpp ? hi.length : ps.stalled.length;
      const cards = [];
      if (low) cards.push(h('div', { class: 'g-card g-bn' }, h('div', { class: 'g-eyebrow', text: 'BIGGEST SALES BOTTLENECK' }), h('b', { style: 'font-size:16px', text: st[st.indexOf(low) - 1].label + ' → ' + low.label }), h('div', { class: 'num', style: 'font-size:26px;font-weight:600;margin:2px 0', text: F.pct(low.conv, 0) + ' conversion' }),
        h('div', { class: 'sm muted', text: affected + (toOpp ? ' high-intent leads have not become opportunities' : ' open deals are stalled for 7+ days') }), h('div', { class: 'sm g-mt8' }, 'Potential pipeline leakage: ', h('b', { text: money(leakV) })),
        h('div', { class: 'g-row g-mt8' }, G.btn(toOpp ? 'View affected leads' : 'View stalled deals', () => (toOpp ? G.go('leads', { filter: 'followup' }) : G.go('pipeline', { stalled: true })), 'sm pri'))));
      cards.push(h('div', { class: 'g-card g-bn' }, h('div', { class: 'g-eyebrow', text: 'FOLLOW UP NOW' }), h('b', { style: 'font-size:16px', text: waiting.length + ' high-intent leads waiting' }), h('div', { class: 'num', style: 'font-size:26px;font-weight:600;margin:2px 0', text: money(sum(waiting, 'est_value')) }), h('div', { class: 'sm muted', text: 'potential pipeline · no follow-up in 3+ days' }),
        h('div', { class: 'g-row g-mt8' }, G.btn('Follow up', () => G.go('leads', { filter: 'followup' }), 'sm pri'))));
      cards.push(h('div', { class: 'g-card g-bn' }, h('div', { class: 'g-eyebrow', text: 'PIPELINE AT RISK' }), h('b', { style: 'font-size:16px', text: ps.stalled.length + ' deals stalled over 7 days' }), h('div', { class: 'num', style: 'font-size:26px;font-weight:600;margin:2px 0', text: money(sum(ps.stalled, 'value')) }), h('div', { class: 'sm muted', text: 'of ' + money(ps.value) + ' open pipeline' }),
        h('div', { class: 'g-row g-mt8' }, G.btn('View deals', () => G.go('pipeline', { stalled: true }), 'sm pri'))));
      bn.replaceChildren(h('div', { class: 'g-bns' }, cards), low ? G.chartInsight({ tone: 'amber', signal: low.label + ' converts only ' + F.pct(low.conv, 0) + (low.prevConv != null ? ' (' + F.pct(low.prevConv, 0) + ' last period)' : '') + '.', impact: money(leakV) + ' of pipeline is leaking at this step.', cause: toOpp ? 'High-intent leads are not being followed up fast enough.' : 'Deals go quiet after the proposal stage.', action: toOpp ? 'Follow up with ' + affected + ' high-intent leads today.' : 'Re-engage ' + affected + ' stalled deals this week.', expected: '+' + money(leakV * (G.rows('pipeline_kpis').find((k) => k.metric === 'winrate') || { value: 30 }).value / 100) + ' expected revenue at the current win rate', conf: 76, metric: 'pipeline',
        investigate: () => (toOpp ? G.go('leads', { filter: 'followup' }) : G.go('pipeline', { stalled: true })), apply: () => G.applyInsight({ signal: low.label + ' bottleneck', action: toOpp ? 'Follow up with ' + affected + ' high-intent leads today' : 'Re-engage ' + affected + ' stalled deals', expected: '+' + money(leakV * 0.3) + ' pipeline recovered', metric: 'pipeline', kind: 'sales' }) }) : null);
    };
    return s;
  };
  const GROUPS = [['New', ['New', 'Contacted']], ['Qualified', ['Qualified', 'Meeting']], ['Proposal', ['Proposal']], ['Negotiation', ['Negotiation']], ['Won', ['Won']]];
  SX.pipelineStage = () => {
    const box = h('div'), kp = h('div', { class: 'g-cacs' });
    const s = { el: G.card('Pipeline by Stage', 'Deal count, pipeline value and probability-weighted value at each stage.', h('div', { class: 'g-gap16' }, kp, box)) };
    s.update = () => {
      const ps = G.pipelineStats(); if (!ps.deals.length) { box.replaceChildren(noData()); kp.replaceChildren(); return; }
      const rows = GROUPS.map(([n, sts]) => { const d = ps.deals.filter((x) => sts.includes(x.stage)); return { n, d, count: d.length, value: sum(d, 'value'), weighted: n === 'Won' ? sum(d, 'value') : sum(d, (x) => x.value * (x.probability || 0) / 100) }; });
      const mx = Math.max(...rows.map((r) => r.value)) || 1;
      kp.replaceChildren(...[['Pipeline', money(ps.value)], ['Weighted', money(ps.weighted)], ['Won', money(ps.won)], ['Open deals', String(ps.open.length)]].map(([k, v]) => h('div', null, h('small', { text: k }), h('b', { class: 'num', text: v }))));
      box.replaceChildren(h('div', { class: 'g-pp' }, h('div', { class: 'g-pp-r hd' }, h('span', { text: 'Stage' }), h('span', { text: 'Pipeline value  ·  weighted' }), h('span', { class: 'r', text: 'Deals' }), h('span', { class: 'r', text: 'Value' }), h('span', { class: 'r', text: 'Weighted' })),
        rows.map((r) => h('button', { class: 'g-pp-r', type: 'button', onclick: () => G.go('pipeline', { stage: r.n }), onmousemove: (e) => G.tip.show(e, h('div', null, h('b', { text: r.n }), [['Deals', r.count], ['Pipeline value', money(r.value)], ['Weighted value', money(r.weighted)]].map(([k, v]) => h('div', { class: 'r' }, h('span', { text: k }), h('b', { text: v }))), h('div', { class: 'xs muted', text: 'Click to open these records' }))), onmouseleave: G.tip.hide },
          h('span', { class: 'n', text: r.n }), h('span', { class: 'bars' }, h('span', { class: 'o', style: `width:${r.value / mx * 100}%` }, h('i', { style: `width:${r.value ? r.weighted / r.value * 100 : 0}%` }))), h('span', { class: 'r num', text: r.count }), h('span', { class: 'r num', text: money(r.value) }), h('span', { class: 'r num', text: money(r.weighted) })))));
    };
    return s;
  };

  /* ======================= REVENUE GROWTH ======================= */
  SX.revenue = () => {
    const stats = h('div', { class: 'g-cacs' }), cBox = h('div', { class: 'g-chart' }), insBox = h('div');
    const s = { el: G.card('Revenue Growth', 'Cumulative revenue for the period, against the previous period and the pace needed for target.', h('div', { class: 'g-gap16' }, stats, cBox, insBox)) };
    s.update = () => {
      const a = G.an(R()); if (a.empty) { cBox.replaceChildren(noData()); stats.replaceChildren(); insBox.replaceChildren(); return; }
      const rows = G.anTS('all', null, R()), n = rows.length, pr = prevRows(R()), tg = G.targets().revenue, mp = G.monthProj(), chg = a.prev.revenue ? (a.tot.revenue / a.prev.revenue - 1) * 100 : null;
      const cum = (rr) => { let c = 0; return rr.map((r) => [r.date, (c += r.revenue)]); };
      const pace = tg ? tg * n / 30 : null, ahead = pace ? (a.tot.revenue / pace - 1) * 100 : null;
      stats.replaceChildren(...[['Revenue', money(a.tot.revenue), null], ['vs previous period', chg == null ? '—' : F.d(chg), chg == null ? null : chg >= 0 ? 'up' : 'down'], ['Target (' + (R() === '30d' ? 'monthly' : n + '-day pace') + ')', pace ? money(pace) : 'Not set', null], ['Projected month-end', mp ? money(mp.proj) : '—', mp && tg ? (mp.proj >= tg ? 'up' : 'down') : null], ['Pace vs target', ahead == null ? '—' : F.pct(Math.abs(ahead), 0) + (ahead >= 0 ? ' ahead' : ' behind'), ahead == null ? null : ahead >= 0 ? 'up' : 'down']].map(([k, v, t]) => h('div', null, h('small', { text: k }), h('b', { class: 'num ' + (t || ''), text: v }))));
      const series = [{ name: 'This period', color: 'var(--g-em)', data: cum(rows), w: 2.4 }];
      if (pr) series.push({ name: 'Previous period', color: 'var(--g-ink-3)', dash: '3 3', w: 1.5, data: cum(pr) });
      if (pace) series.push({ name: 'Target pace', color: 'var(--g-amber)', dash: '6 4', w: 1.5, data: rows.map((r, i) => [r.date, pace * (i + 1) / n]) });
      G.line(cBox, { series, height: 240, zero: true, yFmt: money, tipFmt: money, label: 'Cumulative revenue' });
      if (!pr) cBox.append(h('div', { class: 'xs muted g-mt8', text: 'A previous-period line needs twice this many days of history; the change above compares period totals.' }));
      insBox.replaceChildren(mp && tg ? h('div', { class: 'g-ai' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'Radar insight'), h('p', { text: 'At the last 7 days’ pace, ' + mp.month + ' closes at ' + money(mp.proj) + ' — ' + (mp.proj >= tg ? F.pct((mp.proj / tg - 1) * 100, 0) + ' above' : F.pct((1 - mp.proj / tg) * 100, 0) + ' below') + ' the ' + money(tg) + ' target. ' + (mp.proj >= tg ? 'Protect the channels producing it.' : 'Closing the gap needs ' + money(tg - mp.proj) + ' more; model a fix in Forecast.') }), h('div', { class: 'g-row g-mt8' }, G.btn('Open Forecast', () => G.go('forecast'), 'sm'))) : null);
    };
    return s;
  };

  /* ======================= WHERE SHOULD THE NEXT ₹1 GO ======================= */
  G.nextRupee = () => {
    const a = G.an('30d'); if (a.empty) return null;
    const EF = { Creators: 0.8, Referral: 0.65 }, tr = a.tot.revenue, ts = a.tot.spend;
    const rows = a.ch.filter((c) => c.spend > 0 && c.roas).map((c) => { const sp = c.spend / ts; return Object.assign({}, c, { marg: c.roas * (EF[c.name] || 0.9), spShare: sp, cap: sp < 0.08 && c.roas >= a.tot.roas ? 'High' : sp < 0.2 ? 'Medium' : 'Limited', conv: div(c.customers, c.visitors) * 100 }); }).sort((p, q) => q.marg - p.marg);
    if (rows.length < 3) return { rows, recs: [], moves: [] };
    const from = rows.slice().reverse().find((c) => c.spShare >= 0.06) || rows[rows.length - 1], tos = rows.filter((c) => c.cap !== 'Limited' && c.name !== from.name && c.marg > from.marg * 1.5).slice(0, 2);
    const total = Math.min(from.spend * 0.25, 90000), amt = Math.max(5000, r0(total / 5000) * 5000), moves = tos.length === 2 ? [{ frm: from.name, to: tos[0].name, amount: r0(amt * 0.7 / 5000) * 5000 || 5000 }, { frm: from.name, to: tos[1].name, amount: Math.max(5000, r0(amt * 0.3 / 5000) * 5000) }] : tos.length ? [{ frm: from.name, to: tos[0].name, amount: amt }] : [];
    return { rows, from, tos, moves };
  };
  SX.nextRupee = () => {
    const box = h('div'), insBox = h('div');
    const s = { el: G.card('Next ₹1', 'Where should the next rupee go? Marginal revenue per rupee, cost per customer and room to grow.', h('div', { class: 'g-gap16' }, box, insBox)) };
    s.update = () => {
      const N = G.nextRupee(); if (!N || N.rows.length < 3) { box.replaceChildren(noData()); insBox.replaceChildren(); return; }
      const a = G.an('30d'), mx = N.rows[0].marg, moved = {}; N.rows.forEach((c) => (moved[c.name] = c.spend)); N.moves.forEach((m) => { moved[m.frm] -= m.amount; moved[m.to] += m.amount; });
      box.replaceChildren(h('div', { class: 'g-nr' }, h('div', { class: 'g-nr-r hd' }, h('span', { text: 'Channel' }), h('span', { text: '₹1 returns' }), h('span', { class: 'r', text: 'CAC' }), h('span', { class: 'r', text: 'Visit → customer' }), h('span', { class: 'r', text: 'Room to grow' }), h('span', { class: 'r', text: 'Spend now → recommended' })),
        N.rows.map((c) => h('button', { class: 'g-nr-r', type: 'button', onclick: () => goCh(c.name), onmousemove: (e) => G.tip.show(e, h('div', null, h('b', { text: c.name }), h('div', { class: 'r' }, h('span', { text: 'Average ROAS' }), h('b', { text: F.x(c.roas) })), h('div', { class: 'r' }, h('span', { text: 'Marginal (after diminishing returns)' }), h('b', { text: F.x(c.marg) })), h('div', { class: 'r' }, h('span', { text: 'Share of spend' }), h('b', { text: F.pct(c.spShare * 100, 0) })))), onmouseleave: G.tip.hide },
          h('span', { class: 'n' }, h('i', { style: 'background:' + c.col }), c.name), h('span', { class: 'bars' }, h('span', { class: 'bsp' }, h('i', { style: `width:${c.marg / mx * 100}%;background:${c.col}` })), h('b', { class: 'num', text: '₹1 → ₹' + c.marg.toFixed(2) })), h('span', { class: 'r num', text: F.inrF(c.cac) }), h('span', { class: 'r num', text: F.pct(c.conv, 2) }), h('span', { class: 'r' }, G.badge(c.cap, c.cap === 'High' ? 'green' : c.cap === 'Limited' ? 'amber' : '')),
          h('span', { class: 'r num xs', text: money(c.spend) + ' → ' + money(moved[c.name]) })))),
      h('div', { class: 'xs muted g-mt8', text: 'Marginal return = average ROAS × a diminishing-returns factor (0.9; 0.8 for creators, 0.65 for referral), the same assumption the simulator uses.' }));
      if (N.moves.length) {
        const sim = G.sim(N.moves), dr = sim.next.revenue - sim.base.revenue, dc = sim.next.customers - sim.base.customers, tot = sum(N.moves, 'amount');
        insBox.replaceChildren(G.chartInsight({ tone: '', signal: N.from.name + ' returns the least per marginal rupee (₹' + N.from.marg.toFixed(2) + ').', impact: N.tos.map((t) => t.name + ' returns ₹' + t.marg.toFixed(2)).join(' and ') + ' per rupee.', cause: 'Allocation follows past habit rather than current returns.', action: 'Move ' + F.inrF(tot) + ' a month from ' + N.from.name + (N.moves.length === 2 ? ' to ' + N.moves[0].to + ' and ' + N.moves[1].to : ' to ' + N.moves[0].to) + '.', expected: '+' + r0(dc) + ' customers and +' + money(dr) + ' revenue a month at the same spend', conf: 83, metric: 'revenue', amount: tot,
          investigate: () => G.evidenceDrawer({ rec: 'Move budget from ' + N.from.name, a: { title: N.from.name, rows: [['Average ROAS', F.x(N.from.roas)], ['Marginal return', '₹' + N.from.marg.toFixed(2)], ['CAC', F.inrF(N.from.cac)]] }, b: { title: N.tos.map((t) => t.name).join(' + '), rows: N.tos.map((t) => [t.name + ' marginal return', '₹' + t.marg.toFixed(2)]) }, pattern: 'Marginal return is average ROAS adjusted for diminishing returns on the destination.', result: '+' + r0(dc) + ' customers a month.' }),
          simulate: () => G.simModal({ frm: N.from.name, moves: N.moves.map((m) => ({ to: m.to, amount: m.amount })), title: 'Simulate allocation' }), apply: () => G.applyInsight({ signal: 'Next ₹1', action: 'Move ' + F.inrF(tot) + ' a month from ' + N.from.name + ' to ' + N.moves.map((m) => m.to).join(' and '), expected: '+' + r0(dc) + ' customers, +' + money(dr) + ' revenue a month', metric: 'revenue', amount: tot, kind: 'budget' }) }));
      } else insBox.replaceChildren();
    };
    return s;
  };

  /* ======================= tabbed channel analytics (Channels page) ======================= */
  SX.channelTabs = () => {
    const f = G.pf('chtabs', { t: 'contrib' }), tabs = [['contrib', 'Contribution', SX.contribution], ['spend', 'Spend vs revenue', SX.spendRev], ['matrix', 'Efficiency matrix', SX.matrix], ['cac', 'CAC', SX.cac], ['trend', 'Performance trend', SX.perf]];
    const bar = h('div', { class: 'g-tabs-row' }), holder = h('div'), built = {};
    const s = { el: h('div', { class: 'g-gap16' }, bar, holder) };
    s.update = () => {
      bar.replaceChildren(G.seg(tabs.map(([v, l]) => ({ v, l })), f.t, (v) => { f.t = v; holder.replaceChildren(); s.update(); }));
      const t = tabs.find((x) => x[0] === f.t); built[t[0]] = built[t[0]] || t[2](); if (holder.firstChild !== built[t[0]].el) holder.replaceChildren(built[t[0]].el);
      built[t[0]].update(); requestAnimationFrame(() => { if (built[t[0]].el.isConnected) built[t[0]].update(); });
    };
    return s;
  };
})();
