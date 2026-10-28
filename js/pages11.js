(function () {
  'use strict';
  /* Intelligence layer: Growth Status, Growth Score, Growth Trend, funnel diagnostics + conversion chart,
     opportunities + risks (ranked, explainable), forecast outlook, lead alerts, creator leaderboard,
     "View data" trust drawer and extra Ask answers. Everything derives from the one model G.an(R). */
  const G = window.G, h = G.h, S = G.S, F = G.F, SX = G.sx, CH = G.ch, sum = G.sum, div = G.div, clamp = G.clamp, r0 = Math.round;
  const money = (v) => F.inr(v), R = () => S.range;
  const noData = () => G.empty('◌', 'Not enough data to calculate this.', 'Connect a data source or turn on Demo Data and this view fills in.');
  const sgn = (v) => (v >= 0 ? '+' : '−');
  const live = (s) => { s.update(); requestAnimationFrame(() => { if (s.el.isConnected) s.update(); }); return s; };
  const NAMES = { impr: 'Impressions', clicks: 'Clicks', visitors: 'Landing visits', signups: 'Signups', activated: 'Activated users', leads: 'Qualified leads', customers: 'Customers', revenue: 'Revenue' };
  const dayN = () => G.RN[R()];

  /* ======================= DATA TRUST: "View data" ======================= */
  const rel = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' minutes ago' : m < 1440 ? Math.round(m / 60) + ' hours ago' : Math.round(m / 1440) + ' days ago'; };
  G.viewData = (o) => {
    const w = G.WS.active(), mode = G.WS.mode(), ser = (G.rows('series') || []).slice(-dayN()), imps = w.imports || [];
    const last = imps.length ? Math.max.apply(null, imps.map((i) => i.at || 0)) : 0;
    const fd = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const src = mode === 'demo' ? 'Demo dataset (simulated) · ' + w.name : imps.length ? Array.from(new Set(imps.map((i) => i.name))).join(', ') : 'No source connected';
    const upd = mode === 'demo' ? 'Simulated data. It regenerates identically on every load.' : last ? rel(last) : '—';
    const row = (k, v) => h('div', { class: 'g-vd-r' }, h('small', { text: k }), h('div', { text: v }));
    return G.drawer({ title: 'View data · ' + o.title, sub: o.value ? 'Current value ' + o.value : null, body: h('div', { class: 'g-gap16' },
      h('div', { class: 'g-vd' }, row('Data source', src), row('Last updated', upd), row('Time range', G.RL[R()] + (ser.length ? ' · ' + fd(ser[0].date) + ' – ' + fd(ser[ser.length - 1].date) : '')), row('Records', o.records != null ? (typeof o.records === 'number' ? F.n(o.records) : o.records) : '—'), row('Calculation', o.calc || '—')),
      mode === 'demo' ? h('p', { class: 'xs muted', text: 'Demo Data is ON, so every figure is simulated. Turn it off to see only your connected data.' }) : null,
      h('div', { class: 'g-row' }, G.btn('Open Data Sources', () => G.go('datasources'), 'sm'))) });
  };
  const vdBtn = (o) => h('button', { class: 'g-vd-b', type: 'button', onclick: (e) => { e.stopPropagation(); G.viewData(typeof o === 'function' ? o() : o); } }, 'View data');
  const recOf = (a, k) => a.tot[k] != null ? a.ch.length + ' channel rows' : '—';

  /* ======================= "WHY THIS?" ======================= */
  G.whyThis = (it) => G.drawer({ title: 'Why this?', sub: it.title, body: h('div', { class: 'g-gap16' },
    ...[['Metric', it.why.metric], ['Comparison', it.why.comparison], ['Data source', G.WS.mode() === 'demo' ? 'Demo dataset (simulated)' : 'Your connected data'], ['Reasoning', it.why.reasoning], ['Confidence', r0(it.conf * 100) + '% · ' + (it.why.conf || 'based on how much data supports it')]].map(([k, v]) => h('div', null, h('div', { class: 'g-sig-k', text: k }), h('p', { style: 'margin:4px 0 0', text: v }))),
    it.action ? h('div', { class: 'g-sig-a' }, h('div', { class: 'g-sig-k', text: 'Recommended action' }), h('div', { style: 'font-weight:600', text: it.action })) : null) });

  /* ======================= GROWTH STATUS (executive KPI strip) ======================= */
  G.kpiStatus = (Rg) => {
    const a = G.an(Rg); if (a.empty) return [];
    const N = G.RN[Rg], T = G.targets(), revT = T.revenue * N / 30, ratio = revT / (a.tot.revenue || 1), ps = G.pipelineStats(), mp = G.monthProj();
    const pk = {}; (G.rows('pipeline_kpis') || []).forEach((k) => (pk[k.metric] = k));
    const act = div(a.tot.activated, a.tot.signups) * 100, pAct = a.prev.signups ? div(a.prev.activated, a.prev.signups) * 100 : null;
    const cv = div(a.tot.customers, a.tot.visitors) * 100, pCv = a.prev.visitors ? div(a.prev.customers, a.prev.visitors) * 100 : null;
    const rel2 = (x, y) => (x != null && y ? (x / y - 1) * 100 : null), K = a.kp;
    const o = [
      { key: 'revenue', label: 'Revenue', value: money(a.tot.revenue), delta: K.revenue && K.revenue.delta, good: true, pct: a.tot.revenue / revT * 100, vs: r0(a.tot.revenue / revT * 100) + '% of target', tgt: money(revT), trend: 'revenue', calc: 'Sum of revenue across all channels in the period.', rec: recOf(a, 'revenue') },
      { key: 'customers', label: 'New customers', value: F.n(a.tot.customers), delta: K.customers && K.customers.delta, good: true, pct: 100 / ratio, vs: r0(100 / ratio) + '% of implied target', tgt: F.n(r0(a.tot.customers * ratio)), note: 'Target implied by the revenue target at today’s revenue per customer.', trend: 'customers', calc: 'Customers acquired in the period, summed across channels.', rec: a.tot.customers },
      { key: 'leads', label: 'Qualified leads', value: F.n(a.tot.leads), delta: K.leads && K.leads.delta, good: true, pct: 100 / ratio, vs: r0(100 / ratio) + '% of implied target', tgt: F.n(r0(a.tot.leads * ratio)), note: 'Implied by the revenue target at today’s lead-to-revenue rate.', trend: 'leads', calc: 'Activated users judged sales-qualified, summed across channels.', rec: a.tot.leads },
      { key: 'activation', label: 'Activation', value: F.pct(act, 1), delta: rel2(act, pAct), good: true, pct: null, vs: 'No target set', trend: 'activation', calc: 'Activated users ÷ signups.', rec: a.tot.signups },
      { key: 'cac', label: 'CAC', value: F.inrF(a.tot.cac), delta: K.cac && K.cac.delta, good: false, pct: T.cac / a.tot.cac * 100, vs: (a.tot.cac <= T.cac ? r0((1 - a.tot.cac / T.cac) * 100) + '% below target' : r0((a.tot.cac / T.cac - 1) * 100) + '% above target'), tgt: F.inrF(T.cac), trend: 'cac', calc: 'Total spend ÷ customers.', rec: a.tot.customers },
      { key: 'roas', label: 'ROAS', value: F.x(a.tot.roas), delta: K.roas && K.roas.delta, good: true, pct: a.tot.revenue / revT * 100, vs: r0(a.tot.revenue / revT * 100) + '% of the ROAS needed', note: 'Target ROAS is the return needed to hit the revenue target at current spend.', trend: 'roas', calc: 'Revenue ÷ spend.', rec: a.tot.customers },
      { key: 'conversion', label: 'Conversion rate', value: F.pct(cv, 2), delta: rel2(cv, pCv), good: true, pct: null, vs: 'No target set', calc: 'Customers ÷ landing visits.', rec: a.tot.visitors },
      { key: 'pipeline', label: 'Pipeline', value: money(ps.value), delta: pk.pipeline && pk.pipeline.delta, good: true, pct: null, vs: ps.open.length + ' open deals', calc: 'Value of open deals (not won or lost).', rec: ps.deals.length + ' deals' },
      { key: 'forecast', label: 'Revenue forecast', value: money(mp.proj), delta: null, good: true, pct: mp.proj / T.revenue * 100, vs: r0(mp.proj / T.revenue * 100) + '% of monthly target', tgt: money(T.revenue), calc: 'Month-to-date revenue + the last 7 days’ average × days left.', rec: 'MTD + 7-day pace' },
    ];
    o.forEach((k) => {
      const p = k.pct, d = k.delta == null ? null : (k.good ? k.delta : -k.delta);
      k.status = p != null ? (p >= 95 ? 'Healthy' : p >= 80 ? 'Needs attention' : 'At risk') : d == null ? 'Healthy' : d >= 0 ? 'Healthy' : d > -10 ? 'Needs attention' : 'At risk';
    });
    return o;
  };
  const toneOf = (s) => (s === 'Healthy' ? 'green' : s === 'Needs attention' ? 'amber' : 'red');
  G.trendFocus = (m) => { G.pf('trend', { m: 'revenue' }).m = m; if (G.__trend) G.__trend.update(); const e = G.__trend && G.__trend.el; if (e && e.isConnected) e.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  SX.status = () => {
    const box = h('div', { class: 'g-st' }), s = { el: h('div', null, box) };
    s.update = () => {
      const ks = G.kpiStatus(R());
      box.replaceChildren(...(ks.length ? ks.map((k) => h('div', { class: 'g-st-c ' + toneOf(k.status).replace('green', 'ok').replace('amber', 'wa').replace('red', 'bd'), role: 'button', tabindex: '0', 'aria-label': k.label + ' ' + k.value + ', ' + k.status,
        onclick: () => (k.trend ? G.trendFocus(k.trend) : G.viewData({ title: k.label, value: k.value, calc: k.calc, records: k.rec })), onkeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); },
        onmousemove: (e) => k.note && G.tip.show(e, h('div', null, k.note)), onmouseleave: G.tip.hide },
        h('div', { class: 'g-st-t' }, h('small', { text: k.label }), G.badge(k.status, toneOf(k.status))),
        h('b', { class: 'num g-st-v', text: k.value }),
        h('div', { class: 'g-row', style: 'gap:6px;flex-wrap:nowrap' }, k.delta != null ? G.dl(k.delta, k.good) : h('span', { class: 'xs muted', text: '—' }), h('span', { class: 'xs muted', text: 'vs previous' })),
        h('div', { class: 'xs g-st-g', text: k.vs }),
        k.pct != null ? G.pbar(clamp(k.pct, 0, 100), k.status === 'Healthy' ? '' : k.status === 'At risk' ? 'red' : 'amber') : h('div', { style: 'height:6px' }),
        vdBtn(() => ({ title: k.label, value: k.value, calc: k.calc + (k.tgt ? ' Target: ' + k.tgt + '.' : ''), records: k.rec })))) : [noData()]));
    };
    return s;
  };

  /* ======================= GROWTH SCORE (explainable) + Efficiency dimension ======================= */
  const sc0 = G.scorecard;
  G.scorecard = (Rg) => {
    const out = sc0(Rg); if (!out.length) return out;
    const a = G.an(Rg), T = G.targets(); if (!a.tot.cac || !T.cac || out.some((d) => d.dim === 'Efficiency')) return out;
    const f = (cac, roasD, cacD) => clamp(r0(100 * clamp(T.cac / cac, 0.4, 1.1) / 1.1 * 0.92 + clamp(((roasD || 0) - (cacD || 0)) / 3, -5, 5)), 25, 97);
    const kp = a.kp, score = f(a.tot.cac, kp.roas && kp.roas.delta, kp.cac && kp.cac.delta), prev = a.prev.cac ? f(a.prev.cac, 0, 0) : score;
    const paid = a.ch.filter((c) => c.spend > 0 && c.cac).sort((x, y) => y.cac - x.cac), worst = paid[0];
    const d = { dim: 'Efficiency', score, delta: score - prev, status: score >= 80 ? 'Healthy' : score >= 65 ? 'Watch' : 'Needs attention',
      metrics: [['Blended CAC', F.inrF(a.tot.cac), kp.cac && kp.cac.delta, false], ['CAC target', F.inrF(T.cac), null, null], ['ROAS', F.x(a.tot.roas), kp.roas && kp.roas.delta, true], ['Spend', money(a.tot.spend), kp.spend && kp.spend.delta, null]], trend: ['cac', 'Blended CAC'],
      issue: worst ? worst.name + ' costs ' + F.inrF(worst.cac) + ' per customer vs ' + F.inrF(a.tot.cac) + ' blended.' : 'CAC is even across channels.', action: worst ? 'Shift budget from ' + worst.name + ' toward your lowest-CAC channel.' : 'Hold the mix.', go: ['channels', { sim: true }] };
    const i = out.findIndex((x) => x.dim === 'Revenue'); out.splice(i < 0 ? out.length : i + 1, 0, d); return out;
  };
  G.growthScore = (Rg) => {
    const sc = G.scorecard(Rg); if (!sc.length) return null;
    const avg = (k) => r0(sum(sc, k) / sc.length), score = avg('score'), prev = r0(sum(sc, (d) => d.score - (d.delta || 0)) / sc.length);
    const sorted = sc.slice().sort((p, q) => q.score - p.score);
    return { score, delta: score - prev, dims: sc, strong: sorted.filter((d) => d.score >= 80).slice(0, 3), weak: sorted.slice().reverse().filter((d) => d.score < 80).slice(0, 3), status: score >= 80 ? 'Healthy' : score >= 65 ? 'Needs attention' : 'At risk' };
  };
  const gsModal = (g) => G.modal({ title: 'Growth Score ' + g.score + ' / 100', sub: 'The plain average of ' + g.dims.length + ' dimension scores. No hidden weights.', wide: true, body: h('div', { class: 'g-gap16' },
    h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Dimension', 'Score', 'Weight', 'Contribution', 'Status'].map((t, i) => h('th', { class: i ? 'r' : '', text: t })))),
      h('tbody', null, g.dims.map((d) => h('tr', { style: 'cursor:pointer', onclick: () => G.go(d.go[0], d.go[1]) }, h('td', null, h('b', { text: d.dim })), h('td', { class: 'r num', text: d.score }), h('td', { class: 'r num', text: F.pct(100 / g.dims.length, 0) }), h('td', { class: 'r num', text: (d.score / g.dims.length).toFixed(1) + ' pts' }), h('td', { class: 'r' }, G.badge(d.status, d.score >= 80 ? 'green' : d.score >= 65 ? 'amber' : 'red'))))),
      h('tfoot', null, h('tr', null, h('td', null, h('b', { text: 'Growth Score' })), h('td', { class: 'r num' }, h('b', { text: g.score })), h('td', { class: 'r num', text: '100%' }), h('td', { class: 'r num', text: g.score + ' pts' }), h('td')))),
    h('p', { class: 'sm muted', style: 'margin:0', text: 'Each dimension is built from the metrics under it, compared with the previous period and your own best channels. Click a dimension on the scorecard to see them. Efficiency compares blended CAC with your CAC target.' }),
    g.weak.length ? h('div', { class: 'g-sig-a' }, h('div', { class: 'g-sig-k', text: 'Where the score is lost' }), h('div', { class: 'sm' }, g.weak.map((d) => d.dim + ' (' + d.score + ')').join(' · '))) : null) });
  const sc1 = SX.scorecard;
  SX.scorecard = () => {
    const s = sc1(), chip = h('div', { class: 'g-gs' }); s.el.insertBefore(chip, s.el.children[1]);
    const u0 = s.update;
    s.update = () => {
      u0(); const g = G.growthScore(R());
      chip.replaceChildren(...(g ? [h('button', { class: 'g-gs-b', type: 'button', onclick: () => gsModal(g), 'aria-label': 'Growth Score ' + g.score + ' out of 100. Show how it is calculated.' },
        h('span', { class: 'xs muted', text: 'GROWTH SCORE' }), h('b', { class: 'num', text: g.score }), h('span', { class: 'muted', text: '/ 100' }), G.badge(g.status, toneOf(g.status)), G.dl(g.delta, true, ' pts'),
        h('span', { class: 'sm g-gs-t' }, g.strong.length ? h('span', null, h('b', { text: 'Strong: ' }), g.strong.map((d) => d.dim).join(', ')) : null, g.strong.length && g.weak.length ? '  ·  ' : '', g.weak.length ? h('span', null, h('b', { text: 'Weak: ' }), g.weak.map((d) => d.dim).join(', ')) : null), h('span', { class: 'xs', style: 'color:var(--g-em)', text: 'How is this calculated?' }))] : []));
    };
    return s;
  };

  /* ======================= GROWTH TREND ======================= */
  const TM = {
    revenue: { l: 'Revenue', fm: money, add: true }, customers: { l: 'Customers', fm: F.n, add: true }, signups: { l: 'Signups', fm: F.n, add: true }, leads: { l: 'Qualified leads', fm: F.n, add: true },
    activation: { l: 'Activation', fm: (v) => F.pct(v, 1), key: 'act' }, cac: { l: 'CAC', fm: F.inrF, key: 'cac', good: -1 }, roas: { l: 'ROAS', fm: F.x, key: 'roas' },
  };
  SX.trend = () => {
    const f = G.pf('trend', { m: 'revenue' }), chips = h('div', { class: 'g-chips' }), box = h('div', { class: 'g-chart', style: 'min-height:290px' }), sumB = h('div', { class: 'sm' }), vd = h('span');
    const s = { el: G.card('Growth Over Time', 'Actual against the previous period and target, with a forecast at the latest pace. Hover for the details.', h('div', { class: 'g-gap8' }, chips, box, sumB), vd) };
    s.update = () => {
      const a = G.an(R()), M = TM[f.m] || TM.revenue, rows = G.anTS('all', null, R());
      chips.replaceChildren(...Object.keys(TM).map((k) => h('button', { class: 'g-chip' + (f.m === k ? ' on' : ''), type: 'button', 'aria-pressed': f.m === k, onclick: () => { f.m = k; s.update(); } }, TM[k].l)));
      if (a.empty || !rows.length) { box.replaceChildren(noData()); sumB.replaceChildren(); vd.replaceChildren(); return; }
      const N = dayN(), T = G.targets(), revT = T.revenue * N / 30, ratio = revT / (a.tot.revenue || 1), win = G.winFor(R()), last = rows[rows.length - 1].date, H = Math.max(3, Math.min(7, r0(rows.length / 4)));
      const dayMs = 864e5; let act, prevV, tgtV = null, fc, curTot = null, prevTot = null, tgtTot = null;
      if (M.add) {
        const sg = sum(rows, 'signups') || 1;
        act = rows.map((r) => [r.date, f.m === 'leads' ? a.tot.leads * r.signups / sg : r[f.m]]);
        curTot = sum(act, (d) => d[1]); prevTot = f.m === 'leads' ? a.prev.leads : a.prev[f.m]; const k = prevTot && curTot ? prevTot / curTot : null;
        prevV = k ? act.map((d) => [d[0], d[1] * k]) : null;
        tgtTot = f.m === 'revenue' ? revT : f.m === 'signups' ? T.signups * N / 30 : curTot * ratio; tgtV = act.map((d) => [d[0], tgtTot / act.length]);
        const base = d3.mean(act.slice(-7), (d) => d[1]); fc = d3.range(0, H + 1).map((i) => [new Date(last.getTime() + i * dayMs), i ? base : act[act.length - 1][1]]);
      } else {
        act = G.metricSeries(rows, M.key, win);
        const pv = f.m === 'activation' ? (a.prev.signups ? div(a.prev.activated, a.prev.signups) * 100 : null) : f.m === 'cac' ? a.prev.cac : a.prev.roas;
        prevV = pv ? act.map((d) => [d[0], pv]) : null; prevTot = pv;
        const tv = f.m === 'cac' ? T.cac : f.m === 'roas' ? revT / (a.tot.spend || 1) : null; tgtV = tv ? act.map((d) => [d[0], tv]) : null; tgtTot = tv;
        const base = act.length ? act[act.length - 1][1] : 0; fc = d3.range(0, H + 1).map((i) => [new Date(last.getTime() + i * dayMs), base]);
      }
      const prevMap = new Map((prevV || []).map((d) => [+d[0], d[1]])), tgtMap = new Map((tgtV || []).map((d) => [+d[0], d[1]]));
      const series = [{ name: 'Actual', color: 'var(--g-em)', data: act, w: 2.4 }];
      if (prevV) series.push({ name: 'Previous period', color: 'var(--g-ink-3)', data: prevV, dash: '4 4', w: 1.6 });
      if (tgtV) series.push({ name: 'Target', color: 'var(--g-amber)', data: tgtV, dash: '7 4', w: 1.4 });
      series.push({ name: 'Forecast', color: 'var(--g-em)', data: fc, dash: '2 4', w: 2 });
      const all = series.flatMap((x) => x.data.map((d) => d[1]));
      G.line(box, { series, height: 270, zero: M.add, yFmt: (v) => M.fm(v), tipFmt: (v) => M.fm(v), splitAt: last, label: 'Growth trend chart for ' + M.l,
        tipExtra: (d0) => { const av = act.find((d) => +d[0] === +d0), pv = prevMap.get(+d0); if (!av || !pv) return null; const ch = (av[1] / pv - 1) * 100; return h('div', { class: 'r' }, h('span', { text: 'Change vs previous' }), h('b', { text: F.d(ch) })); } });
      const totNow = M.add ? curTot : act.length ? act[act.length - 1][1] : null, chg = prevTot && totNow != null ? (totNow / prevTot - 1) * 100 : null;
      sumB.replaceChildren(h('b', { text: M.l + ' ' + (totNow != null ? M.fm(totNow) : '—') }), chg != null ? h('span', null, ' · ', G.dl(chg, M.good !== -1), ' vs previous period') : null,
        tgtTot ? h('span', { class: 'muted', text: ' · target ' + M.fm(tgtTot) + (M.add ? ' for the period' : '') + (curTot && tgtTot ? ' (' + r0(curTot / tgtTot * 100) + '% reached)' : '') }) : h('span', { class: 'muted', text: ' · no target set' }),
        h('div', { class: 'xs muted', text: 'Previous period is the prior ' + N + ' days, drawn on the same dates with the same daily shape. The forecast extends the last 7 days’ pace for ' + H + ' days. Simulated data.' }));
      vd.replaceChildren(vdBtn(() => ({ title: M.l + ' trend', value: totNow != null ? M.fm(totNow) : null, calc: M.add ? 'Daily ' + M.l.toLowerCase() + ' summed over the period.' : M.l + ' calculated over a rolling ' + win + '-day window.', records: rows.length + ' daily rows' })));
    };
    G.__trend = s; return s;
  };

  /* ======================= FUNNEL: conversion chart + diagnostics ======================= */
  const STAGES = ['clicks', 'visitors', 'signups', 'activated', 'leads', 'customers'];
  const TRANS = { clicks: 'Impressions → Clicks', visitors: 'Clicks → Landing visits', signups: 'Landing visits → Signups', activated: 'Signups → Activated', leads: 'Activated → Qualified leads', customers: 'Qualified leads → Customers' };
  const prevRowOf = (c, k) => {
    if (k === 'signups') return c.signups / (1 + (c.d_signups || 0) / 100);
    if (k === 'revenue') return c.prevRev;
    if (k === 'activated') return c.activated / ((1 + (c.d_signups || 0) / 100) * (1 + (c.d_activation || 0) / 100));
    return null;
  };
  const stepFor = (k) => {
    const l = G.funnelLeaks(R()).find((x) => x.key === k) || null; if (!l || l.gapUsers >= 1) return l;
    /* the blended rate is already the top-quartile rate here, so measure the headroom of the weakest channel against it */
    const a = G.an(R()), tot = a.tot[k] / a.tot[l.from], rows = a.ch.filter((c) => (c[l.from] || 0) >= a.tot[l.from] * 0.03 && c[k] >= 0).map((c) => ({ c, r: c[k] / c[l.from] })).filter((x) => isFinite(x.r)).sort((p, q) => p.r - q.r), w = rows[0];
    if (!w || w.r >= tot) return l;
    const gap = (tot - w.r) * w.c[l.from], per = a.tot.revenue / (a.tot[k] || 1);
    return Object.assign({}, l, { worst: w.c.name, worstR: w.r * 100, bench: tot * 100, gapUsers: gap, opp: gap * 0.25 * per });
  };
  SX.funnelPlus = () => {
    const base = SX.funnel(), f = G.pf('funnel', { sel: 'signups' }), cBox = h('div'), dBox = h('div'), lkBox = h('div'), deepBox = h('div');
    const s = { el: h('div', { class: 'g-gap16' }, base.el, lkBox, G.card('Funnel conversion', 'Conversion at every step against your own best-channel benchmark, so leaks are obvious.', cBox), dBox, deepBox) };
    base.el.addEventListener('click', () => setTimeout(diag, 0));
    function conv() {
      const a = G.an(R()); if (a.empty) { cBox.replaceChildren(noData()); return; }
      const leaks = G.funnelLeaks(R()), L = {}; leaks.forEach((l) => (L[l.key] = l));
      const rows = STAGES.map((k) => { const fs = a.funnel.find((x) => x.key === k), l = L[k], bench = l ? l.bench * 100 : null; return { k, conv: fs.conv, prevConv: fs.prevConv, bench: l ? (l.bench < 1 ? l.bench * 100 : l.bench) : null, delta: fs.prevConv ? (fs.conv / fs.prevConv - 1) * 100 : null }; });
      rows.forEach((r) => { r.ratio = r.bench ? r.conv / r.bench : 1; });
      const best = rows.slice().sort((p, q) => q.ratio - p.ratio)[0], worst = rows.slice().sort((p, q) => p.ratio - q.ratio)[0], det = rows.filter((r) => r.delta != null).sort((p, q) => p.delta - q.delta)[0], opp = leaks[0] && leaks[0].key;
      const fm = (v) => F.pct(v, v < 10 ? 2 : 1);
      cBox.replaceChildren(h('div', { class: 'g-cv' }, rows.map((r) => {
        const tags = [r.k === best.k ? ['Best conversion', 'green'] : null, r.k === worst.k ? ['Worst vs benchmark', 'red'] : null, det && r.k === det.k && det.delta < 0 ? ['Biggest deterioration', 'amber'] : null, r.k === opp ? ['Biggest opportunity', 'dark'] : null].filter(Boolean);
        const w = clamp(r.conv / ((r.bench || r.conv) * 1.5) * 100, 3, 100), mk = r.bench ? clamp(r.bench / (r.bench * 1.5) * 100, 3, 100) : null;
        return h('button', { class: 'g-cv-r' + (f.sel === r.k ? ' on' : ''), type: 'button', onclick: () => { f.sel = r.k; base.update(); diag(); },
          onmousemove: (e) => G.tip.show(e, h('div', null, h('b', { text: TRANS[r.k] }), h('div', { class: 'r' }, h('span', { text: 'Conversion' }), h('b', { text: fm(r.conv) })), r.bench ? h('div', { class: 'r' }, h('span', { text: 'Benchmark (top-quartile channel)' }), h('b', { text: fm(r.bench) })) : null, r.delta != null ? h('div', { class: 'r' }, h('span', { text: 'vs previous period' }), h('b', { text: F.d(r.delta) })) : null, h('div', { class: 'xs muted', text: 'Click for the diagnostics of this stage' }))), onmouseleave: G.tip.hide },
          h('span', { class: 'n' }, TRANS[r.k]), h('span', { class: 'b' }, h('i', { style: 'width:' + w + '%' + (r.k === worst.k ? ';background:var(--g-red)' : r.k === best.k ? '' : ';background:var(--g-ink-3)') }), mk ? h('u', { style: 'left:' + mk + '%' }) : null),
          h('span', { class: 'v num', text: fm(r.conv) }), h('span', { class: 'v2 num muted', text: r.bench ? 'benchmark ' + fm(r.bench) : '' }), h('span', { class: 'v3' }, r.delta != null ? G.dl(r.delta, true) : null), h('span', { class: 't' }, tags.map(([t, tone]) => G.badge(t, tone))));
      })), h('div', { class: 'xs muted g-mt8', text: 'The tick marks the benchmark: the conversion of your top-quartile channel at that step. Click a step to see what drives it.' }));
    }
    function diag() {
      const a = G.an(R()); if (a.empty) { dBox.replaceChildren(); return; }
      const k = f.sel, i = G.STG.map((x) => x[0]).indexOf(k), from = i > 0 ? G.STG[i - 1][0] : null, fmK = (v) => (k === 'revenue' ? money(v) : F.n(v));
      const tot = a.tot[k], label = NAMES[k] || k, ps = a.ch.filter((c) => c[k] > 0);
      const blended = from ? tot / a.tot[from] : null;
      const rows = ps.map((c) => { const pv = prevRowOf(c, k), nn = pv != null ? c[k] - pv : null; return { c, v: c[k], share: c[k] / tot, nn, chg: pv ? (c[k] / pv - 1) * 100 : null, excess: from ? c[k] - blended * c[from] : null }; }).sort((p, q) => q.v - p.v);
      const nnTot = rows.some((r) => r.nn != null) ? sum(rows, (r) => Math.max(0, r.nn || 0)) : 0;
      const keyOf = (r) => (nnTot > 0 ? r.nn : r.excess != null ? r.excess : r.v), ranked = rows.slice().sort((p, q) => keyOf(q) - keyOf(p));
      const pos = ranked.filter((r) => keyOf(r) > 0).slice(0, 2), neg = ranked.slice().reverse().filter((r) => keyOf(r) < 0).slice(0, 2), top = rows[0], lk = stepFor(k);
      const head = nnTot > 0 && top && top.nn > 0 ? (() => { const t2 = ranked[0]; return t2.c.name + ' generated ' + r0(t2.nn / nnTot * 100) + '% of net-new ' + label.toLowerCase() + ' (' + sgn(t2.nn) + fmK(Math.abs(t2.nn)) + ').'; })() : top ? top.c.name + ' contributes ' + r0(top.share * 100) + '% of ' + label.toLowerCase() + '.' : '';
      const rec = lk ? lk.st.act(lk.worst) : top ? 'Scale ' + top.c.name + ' while it stays efficient.' : 'Hold the mix.';
      const lo = lk ? lk.gapUsers * 0.25 / (a.tot[k] || 1) * 100 : (top ? top.share * 0.2 * 0.9 * 100 * 0.7 : 0), hi = lk ? lk.gapUsers * 0.45 / (a.tot[k] || 1) * 100 : (top ? top.share * 0.2 * 0.9 * 100 : 0);
      const exp = '+' + lo.toFixed(1) + '–' + hi.toFixed(1) + '% ' + label.toLowerCase() + ' over the next 30 days' + (lk ? ' (about ' + money(lk.opp) + ' of revenue)' : '') + '. An estimate from your own channel gaps.';
      const mx = rows[0] ? rows[0].v : 1, blk = (t, body) => h('div', { class: 'g-ans-b' }, h('div', { class: 'g-eyebrow', text: t }), body);
      const lst = (arr, why) => (arr.length ? h('div', { class: 'g-gap8' }, arr.map((r) => h('div', { class: 'sm' }, h('b', { text: r.c.name }), ' ', why(r)))) : h('div', { class: 'sm muted', text: 'None.' }));
      dBox.replaceChildren(G.card('Why is ' + label.toLowerCase() + ' changing?', head, h('div', { class: 'g-gap16' },
        h('div', { class: 'g-tw' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Channel', 'Contribution', 'Absolute', 'vs previous period'].concat(from ? ['vs blended pace'] : []).map((t, j) => h('th', { class: j ? 'r' : '', text: t })))),
          h('tbody', null, rows.slice(0, 8).map((r) => h('tr', { style: 'cursor:pointer', onclick: () => (r.c.name === 'Creators' ? G.go('creators') : G.go('channels')) },
            h('td', null, h('span', { class: 'g-dotc', style: 'background:' + r.c.col }), r.c.name), h('td', { class: 'r' }, h('span', { class: 'g-hb-i' }, h('i', { style: 'width:' + r.v / mx * 100 + '%;background:' + r.c.col })), ' ', h('b', { class: 'num', text: F.pct(r.share * 100, 0) })),
            h('td', { class: 'r num', text: fmK(r.v) }), h('td', { class: 'r' }, r.chg != null ? G.dl(r.chg, true) : h('span', { class: 'muted', text: '—' })),
            from ? h('td', { class: 'r num', text: (r.excess >= 0 ? '+' : '−') + F.n(Math.abs(r.excess)) }) : null))))),
        h('div', { class: 'g-ans' }, blk('BIGGEST POSITIVE DRIVERS', lst(pos, (r) => (nnTot > 0 ? 'added ' + fmK(r.nn) + ' net-new' : 'is ' + F.n(r.excess) + ' above the blended pace'))), blk('BIGGEST NEGATIVE DRIVERS', lst(neg, (r) => (nnTot > 0 ? 'lost ' + fmK(Math.abs(r.nn)) : 'is ' + F.n(Math.abs(r.excess)) + ' below the blended pace'))),
          blk('BIGGEST OPPORTUNITY', h('div', { class: 'sm', text: lk ? lk.worst + ' converts ' + F.pct(lk.worstR, lk.worstR < 10 ? 2 : 1) + ' vs ' + F.pct(lk.bench, lk.bench < 10 ? 2 : 1) + ' at your best channels: ' + F.n(lk.gapUsers) + ' users of headroom.' : 'No meaningful gap at this step.' })),
          blk('RECOMMENDED ACTION', h('div', { class: 'sm', style: 'font-weight:600', text: rec })), blk('EXPECTED IMPACT', h('div', { class: 'sm', text: exp }))),
        h('div', { class: 'g-row' }, G.btn('Investigate', () => (lk ? G.go(lk.st.go[0], lk.st.go[1]) : G.go('channels')), 'sm'), G.btn('Simulate', () => G.go('forecast', { pick: 'conv-10' }), 'sm'), G.btn('Apply', () => G.applyInsight({ signal: label + ' diagnostics', action: rec, expected: exp.split(' over')[0], metric: k, kind: 'funnel' }), 'sm pri'), vdBtn(() => ({ title: label + ' by channel', value: fmK(tot), calc: 'Channel ' + label.toLowerCase() + ' summed; net-new = this period − previous period.', records: ps.length + ' channels' }))))));
    }
    s.update = () => {
      base.update(); conv(); diag();
      const lc = G.leakCallout && G.leakCallout(); lkBox.replaceChildren(...(lc ? [lc] : []));
      const dd = G.stageDeep && G.stageDeep(f.sel, G.funnelLeaks(R()).find((l) => l.key === f.sel)); deepBox.replaceChildren(...(dd ? [G.card('Stage drill-down: ' + (NAMES[f.sel] || f.sel), 'Rate, trend, campaigns and causes for the selected step.', dd)] : []));
    };
    return s;
  };

  /* ======================= OPPORTUNITIES + RISKS (ranked, explainable) ======================= */
  const EFF = (c) => c.roas * (c.name === 'Creators' ? 0.8 : c.name === 'Referral' ? 0.65 : 0.9);
  G.campClass = (a) => {
    const avgC = a.tot.cac, avgR = a.tot.roas, avgV = div(a.tot.customers, a.tot.clicks);
    return (c) => {
      const cacD = c.cac && avgC ? (c.cac / avgC - 1) * 100 : null, roasD = c.roas && avgR ? (c.roas / avgR - 1) * 100 : null, cv = div(c.customers, c.clicks), cvD = cv && avgV ? (cv / avgV - 1) * 100 : null;
      if (!c.spend || cacD == null) return { label: 'Maintain', tone: '', why: 'Not enough spend or customers yet to judge this campaign.' };
      if (cacD <= -15 && (roasD || 0) >= 0) return { label: 'Scale', tone: 'green', why: 'CAC is ' + r0(Math.abs(cacD)) + '% below the account average' + (cvD != null ? ' while customer conversion is ' + r0(cvD) + '% ' + (cvD >= 0 ? 'above' : 'below') + ' average' : '') + '. ROAS ' + F.x(c.roas) + ' vs ' + F.x(avgR) + '.' };
      if (cacD >= 30 || (roasD != null && roasD <= -40)) return { label: 'Pause', tone: 'red', why: 'CAC is ' + r0(cacD) + '% above the account average and ROAS is ' + F.x(c.roas) + ' vs ' + F.x(avgR) + ' blended. Spend is not earning its keep.' };
      if (cacD > 5 || (cvD != null && cvD < -10)) return { label: 'Optimize', tone: 'amber', why: (cacD > 5 ? 'CAC is ' + r0(cacD) + '% above average' : 'Customer conversion is ' + r0(Math.abs(cvD)) + '% below average') + '. Fix the weakest step before adding budget.' };
      return { label: 'Maintain', tone: '', why: 'CAC is within ' + r0(Math.abs(cacD)) + '% of the account average and ROAS is ' + F.x(c.roas) + '. Keep the budget as is.' };
    };
  };
  const leadsRows = () => G.rows('leads') || [];
  G.opportunities = (Rg) => {
    const a = G.an(Rg); if (a.empty) return []; const out = [], paid = a.ch.filter((c) => c.spend > 0 && c.customers > 0), cc = G.campClass(a);
    const ev = (m, c, r, conf) => ({ metric: m, comparison: c, reasoning: r, conf });
    if (paid.length >= 2) {
      const big = paid.filter((c) => c.sh_spend >= 0.05), pool = big.length >= 2 ? big : paid, s2 = pool.slice().sort((x, y) => EFF(y) - EFF(x)), best = s2[0], worst = s2[s2.length - 1];
      if (best.name !== worst.name && EFF(best) > EFF(worst)) { const sh = worst.spend * 0.2, gain = sh * (EFF(best) - EFF(worst));
        out.push({ id: 'o-shift', kind: 'opp', title: 'Shift 20% of ' + worst.name + ' budget to ' + best.name, evidence: best.name + ' returns ' + F.x(best.roas) + ' ROAS vs ' + worst.name + ' at ' + F.x(worst.roas) + '.', impactVal: gain, impactTxt: '+' + money(gain) + ' revenue', conf: best.sh_spend < 0.2 ? 0.78 : 0.66, ease: 4, action: 'Move ' + money(sh) + ' from ' + worst.name + ' to ' + best.name, go: ['channels', { sim: true }], metric: 'revenue',
          why: ev('ROAS and marginal return by channel', best.name + ' ' + F.x(best.roas) + ' vs ' + worst.name + ' ' + F.x(worst.roas), 'Returns fall as spend grows, so the gain applies a discount (' + (best.name === 'Creators' ? '0.8' : best.name === 'Referral' ? '0.65' : '0.9') + '×) to the better channel.', 'channels with at least 5% of spend, ' + (best.sh_spend < 0.2 ? 'still lightly funded' : 'already well funded')) }); }
    }
    a.camps.filter((c) => cc(c).label === 'Scale').sort((x, y) => y.roas - x.roas).slice(0, 1).forEach((c) => { const gain = c.spend * 0.2 * c.roas * 0.8;
      out.push({ id: 'o-camp', kind: 'opp', title: 'Scale ' + c.name.replace(/^Wispr Flow — /, ''), evidence: cc(c).why, impactVal: gain, impactTxt: '+' + money(gain) + ' revenue', conf: 0.72, ease: 4, action: 'Raise the ' + c.name.replace(/^Wispr Flow — /, '') + ' budget by 20%', go: ['campaigns', { open: c.key }], metric: 'revenue', why: ev('CAC, ROAS and conversion vs account average', 'CAC ' + F.inrF(c.cac) + ' vs ' + F.inrF(a.tot.cac), 'A campaign well below average CAC with at least average ROAS has room to take more budget.', 'based on ' + F.n(c.customers) + ' customers') }); });
    const crs = a.cr.filter((c) => c.spend > 0 && c.customers > 0).map((c) => Object.assign({ roasC: c.revenue / c.spend }, c)).sort((x, y) => y.roasC - x.roasC);
    if (crs[0] && crs[0].roasC > a.tot.roas) { const c = crs[0], gain = c.spend * 0.25 * c.roasC * 0.8;
      out.push({ id: 'o-creator', kind: 'opp', title: c.handle + ' returns ' + F.x(c.roasC) + ' on ' + money(c.spend), evidence: c.handle + ' has ' + F.x(c.roasC) + ' ROAS vs ' + F.x(a.tot.roas) + ' blended and CAC ' + F.inrF(c.cac) + '.', impactVal: gain, impactTxt: '+' + money(gain) + ' revenue', conf: 0.7, ease: 3, action: 'Increase the ' + c.handle + ' sponsorship by 25%', go: ['creators', { open: c.key }], metric: 'revenue', why: ev('Creator ROAS', F.x(c.roasC) + ' vs ' + F.x(a.tot.roas) + ' blended', 'Strong return on a small spend suggests untapped audience; scaling is discounted for diminishing returns.', 'based on ' + F.n(c.customers) + ' customers') }); }
    const wait = leadsRows().filter((l) => l.waiting);
    if (wait.length) { const pk = (G.rows('pipeline_kpis') || []).find((k) => k.metric === 'winrate'), wr = (pk ? pk.value : 25) / 100, gain = sum(wait, 'est_value') * wr;
      out.push({ id: 'o-leads', kind: 'opp', title: wait.length + ' high-intent leads are waiting for outreach', evidence: wait.length + ' leads with no contact in 3+ days, worth about ' + money(sum(wait, 'est_value')) + ' if all convert.', impactVal: gain, impactTxt: '+' + money(gain) + ' expected', conf: 0.82, ease: 5, action: 'Follow up with the waiting leads today', go: ['leads', { filter: 'followup' }], metric: 'pipeline', why: ev('High-intent leads without follow-up', wait.length + ' leads, ' + money(sum(wait, 'est_value')), 'Intent decays quickly. Expected value applies your current win rate (' + r0(wr * 100) + '%).', 'based on lead activity signals') }); }
    const L = G.funnelLeaks(Rg)[0];
    if (L) out.push({ id: 'o-leak', kind: 'opp', title: 'Fix ' + L.st.name + ' (' + F.pct(L.drop, 1) + ' drop)', evidence: L.worst + ' converts ' + F.pct(L.worstR, L.worstR < 10 ? 2 : 1) + ' vs ' + F.pct(L.bench, L.bench < 10 ? 2 : 1) + ' at your best channels.', impactVal: L.opp, impactTxt: '+' + money(L.opp) + ' if a quarter closes', conf: 0.6, ease: 2, action: L.st.act(L.worst), go: L.st.go, metric: 'revenue', why: ev('Stage conversion by channel', L.worst + ' ' + F.pct(L.worstR, 2) + ' vs benchmark ' + F.pct(L.bench, 2), 'Closing a quarter of the gap to your own best channel is a cautious assumption.', 'moderate: it depends on a funnel fix') });
    const rising = a.ch.filter((c) => c.d_signups >= 8 && c.sh_signups >= 0.05).sort((x, y) => y.d_signups - x.d_signups)[0];
    if (rising) { const gain = rising.revenue * rising.d_signups / 100 * 0.5; out.push({ id: 'o-rise', kind: 'opp', title: rising.name + ' signups are up ' + F.d(rising.d_signups), evidence: rising.name + ' now delivers ' + r0(rising.sh_signups * 100) + '% of signups and is still growing.', impactVal: gain, impactTxt: '+' + money(gain) + ' if the trend holds', conf: 0.6, ease: 3, action: 'Back ' + rising.name + ' with budget or content while it is rising', go: ['channels', {}], metric: 'signups', why: ev('Signups growth', F.d(rising.d_signups) + ' vs previous period', 'A channel that is still compounding deserves attention before it plateaus.', 'moderate: trend may not persist') }); }
    const fall = a.camps.filter((c) => c.d_cac <= -8 && c.spend > 0 && cc(c).label !== 'Scale').sort((x, y) => x.d_cac - y.d_cac)[0];
    if (fall) { const gain = fall.spend * 0.15 * fall.roas * 0.8; out.push({ id: 'o-cac', kind: 'opp', title: fall.name.replace(/^Wispr Flow — /, '') + ' CAC is falling ' + F.d(fall.d_cac), evidence: 'CAC moved to ' + F.inrF(fall.cac) + ' (' + F.d(fall.d_cac) + ').', impactVal: gain, impactTxt: '+' + money(gain) + ' revenue', conf: 0.6, ease: 4, action: 'Add 15% budget to ' + fall.name.replace(/^Wispr Flow — /, ''), go: ['campaigns', { open: fall.key }], metric: 'revenue', why: ev('Campaign CAC trend', F.d(fall.d_cac) + ' vs previous period', 'Falling CAC means the audience is responding; more budget captures it.', 'moderate') }); }
    const mx = Math.max.apply(null, out.map((o) => o.impactVal)) || 1;
    out.forEach((o) => { o.I = clamp(Math.ceil(5 * o.impactVal / mx), 1, 5); o.C = clamp(r0(o.conf * 5), 1, 5); o.E = o.ease; o.score = o.I * o.C * o.E; });
    return out.sort((p, q) => q.score - p.score);
  };
  G.risks = (Rg) => {
    const a = G.an(Rg); if (a.empty) return []; const out = [], T = G.targets(), N = G.RN[Rg], mp = G.monthProj(), ps = G.pipelineStats(), K = a.kp, cc = G.campClass(a);
    const ev = (m, c, r, conf) => ({ metric: m, comparison: c, reasoning: r, conf });
    const up = a.ch.filter((c) => c.cac && c.d_cac >= 10 && c.sh_spend >= 0.05).sort((x, y) => y.d_cac - x.d_cac)[0];
    if (up) { const extra = up.spend * (1 - 1 / (1 + up.d_cac / 100)); out.push({ id: 'r-cac', kind: 'risk', title: 'CAC is rising on ' + up.name, sev: up.d_cac >= 20 ? 'High' : 'Medium', evidence: up.name + ' CAC is ' + F.inrF(up.cac) + ' (' + F.d(up.d_cac) + ') on ' + r0(up.sh_spend * 100) + '% of spend.', impact: 'About ' + money(extra) + ' of extra spend for the same customers.', impactVal: extra, conf: 0.8, action: 'Review ' + up.name + ' targeting and shift spend to cheaper channels', go: ['channels', { sim: true }], why: ev('CAC change by channel', F.d(up.d_cac) + ' vs previous period', 'A sustained CAC rise on a material share of spend erodes ROAS first.', 'high: measured on real spend') }); }
    const cv = a.funnel.find((x) => x.key === 'signups');
    if (cv && cv.prevConv && cv.conv < cv.prevConv * 0.97) out.push({ id: 'r-conv', kind: 'risk', title: 'Landing → signup conversion is declining', sev: cv.conv < cv.prevConv * 0.9 ? 'High' : 'Medium', evidence: 'Conversion is ' + F.pct(cv.conv, 2) + ' vs ' + F.pct(cv.prevConv, 2) + ' in the previous period.', impact: 'Roughly ' + F.n(r0((cv.prevConv - cv.conv) / 100 * a.tot.visitors)) + ' fewer signups for the same traffic.', impactVal: (cv.prevConv - cv.conv) / 100 * a.tot.visitors * 100, conf: 0.75, action: 'Audit the landing page and signup flow', go: ['attribution', {}], why: ev('Landing → signup conversion', F.pct(cv.conv, 2) + ' vs ' + F.pct(cv.prevConv, 2), 'Falling conversion on steady traffic points at the page or the message match.', 'moderate') });
    if (ps.open.length && ps.stalled.length / ps.open.length >= 0.3) out.push({ id: 'r-pipe', kind: 'risk', title: 'Pipeline is slowing', sev: ps.stalled.length / ps.open.length >= 0.5 ? 'High' : 'Medium', evidence: ps.stalled.length + ' of ' + ps.open.length + ' open deals have been idle 7+ days (' + money(sum(ps.stalled, 'value')) + ').', impact: money(sum(ps.stalled, (d) => d.value * (d.probability || 0) / 100)) + ' of weighted value at risk.', impactVal: sum(ps.stalled, (d) => d.value * (d.probability || 0) / 100), conf: 0.85, action: 'Follow up on stalled deals this week', go: ['pipeline', { stalled: true }], why: ev('Stalled deals', ps.stalled.length + ' of ' + ps.open.length + ' open deals', 'Deals idle for a week lose probability quickly.', 'high: counted directly from deal activity') });
    const gap = T.revenue - (mp.proj || 0);
    if (gap > 0 && mp.proj / T.revenue < 0.95) out.push({ id: 'r-rev', kind: 'risk', title: 'Revenue is tracking below target', sev: mp.proj / T.revenue < 0.85 ? 'High' : 'Medium', evidence: 'Projected ' + mp.month + ' close is ' + money(mp.proj) + ' vs a ' + money(T.revenue) + ' target (' + r0(mp.proj / T.revenue * 100) + '%).', impact: money(gap) + ' short of target at the current pace.', impactVal: gap, conf: 0.7, action: 'Open the forecast and pick a lever to close the gap', go: ['forecast', {}], why: ev('Projected month-end revenue', money(mp.proj) + ' vs ' + money(T.revenue), 'Month-to-date plus the last 7 days’ average for the days left.', 'moderate: assumes the recent pace holds') });
    const top = a.ch.slice().sort((x, y) => y.revenue - x.revenue)[0], share = top ? top.revenue / (a.tot.revenue || 1) : 0;
    if (share >= 0.3) out.push({ id: 'r-dep', kind: 'risk', title: 'Revenue depends on ' + top.name, sev: share >= 0.4 ? 'High' : 'Medium', evidence: top.name + ' delivers ' + r0(share * 100) + '% of revenue.', impact: 'A 20% drop there would cost about ' + money(top.revenue * 0.2) + '.', impactVal: top.revenue * 0.2, conf: 0.7, action: 'Build a second strong channel to reduce the dependency', go: ['channels', {}], why: ev('Revenue share by channel', r0(share * 100) + '% from ' + top.name, 'High concentration means one platform change can move the whole number.', 'high: arithmetic on revenue') });
    const fat = a.camps.filter((c) => c.d_ctr <= -10 && c.spend > 0).sort((x, y) => x.d_ctr - y.d_ctr)[0];
    if (fat) out.push({ id: 'r-fat', kind: 'risk', title: 'Creative fatigue on ' + fat.name.replace(/^Wispr Flow — /, ''), sev: fat.d_ctr <= -18 ? 'High' : 'Medium', evidence: 'CTR is ' + F.pct(fat.ctr, 2) + ' (' + F.d(fat.d_ctr) + ' vs previous period).', impact: 'Fewer clicks lifts CAC at the same spend.', impactVal: fat.spend * Math.abs(fat.d_ctr) / 100 * 0.5, conf: 0.7, action: 'Refresh the creative before spend is wasted', go: ['campaigns', { open: fat.key }], why: ev('Campaign CTR trend', F.d(fat.d_ctr) + ' vs previous period', 'A sliding CTR on a steady audience is the first sign of fatigue.', 'moderate') });
    const cq = G.creatorQuad(a.cr.filter((c) => c.views > 0)), badC = a.cr.filter((c) => c.views > 0 && c.spend > 0 && cq(c) === 'Stop').sort((x, y) => y.spend - x.spend)[0];
    if (badC) out.push({ id: 'r-crt', kind: 'risk', title: badC.handle + ' is not converting', sev: 'Medium', evidence: F.c(badC.views) + ' views but only ' + F.n(badC.customers) + (badC.customers === 1 ? ' customer' : ' customers') + ' for ' + money(badC.spend) + '.', impact: money(badC.spend) + ' of sponsorship with little return.', impactVal: badC.spend, conf: 0.65, action: 'Pause or renegotiate the ' + badC.handle + ' deal', go: ['creators', { open: badC.key }], why: ev('Creator reach vs customers', F.n(badC.customers) + ' customers on ' + F.c(badC.views) + ' views', 'Below-median reach and below-median customers is the weakest quadrant.', 'moderate') });
    const L = G.funnelLeaks(Rg)[0];
    if (L && L.drop >= 30 && L.key !== 'clicks') out.push({ id: 'r-leak', kind: 'risk', title: 'Funnel leakage at ' + L.st.name, sev: L.drop >= 60 ? 'High' : 'Medium', evidence: F.pct(L.drop, 1) + ' of users drop here; ' + L.worst + ' is the weakest.', impact: money(L.opp) + ' of revenue within reach.', impactVal: L.opp, conf: 0.6, action: L.st.act(L.worst), go: L.st.go, why: ev('Stage drop-off', F.pct(L.drop, 1), 'This step loses the most users relative to your best channels.', 'moderate') });
    const ret = G.scorecard(Rg).find((d) => d.dim === 'Retention');
    if (ret && ret.score < 65) out.push({ id: 'r-ret', kind: 'risk', title: 'Follow-up and retention are weak', sev: 'Medium', evidence: ret.issue, impact: 'Warm leads cool off without contact.', impactVal: 1, conf: 0.6, action: ret.action, go: ret.go, why: ev('Retention score', String(ret.score), 'Built from waiting high-intent leads, win rate and sales cycle.', 'moderate') });
    const sevN = { High: 3, Medium: 2, Low: 1 };
    return out.sort((p, q) => sevN[q.sev] - sevN[p.sev] || q.impactVal - p.impactVal);
  };
  const act = (it) => G.applyInsight({ signal: it.title, action: it.action, expected: it.impactTxt || it.impact, metric: it.metric || 'revenue', kind: it.kind });
  const oppRow = (it, i) => h('div', { class: 'g-or', role: 'button', tabindex: '0', onclick: () => G.whyThis(it), onkeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); } },
    h('span', { class: 'g-or-n num', text: i + 1 }), h('div', { class: 'g-or-b' }, h('b', { text: it.title }), h('div', { class: 'sm muted', text: it.evidence }),
      h('div', { class: 'g-row g-mt8', style: 'gap:8px' }, h('span', { class: 'g-or-i', onmousemove: (e) => G.tip.show(e, h('div', null, h('b', { text: 'Impact × Confidence × Ease' }), h('div', { class: 'r' }, h('span', { text: 'Impact' }), h('b', { text: it.I + '/5' })), h('div', { class: 'r' }, h('span', { text: 'Confidence' }), h('b', { text: it.C + '/5' })), h('div', { class: 'r' }, h('span', { text: 'Ease' }), h('b', { text: it.E + '/5' })))), onmouseleave: G.tip.hide, text: 'I' + it.I + ' × C' + it.C + ' × E' + it.E + ' = ' + it.score }), h('b', { class: 'g-or-v', text: it.impactTxt })),
      h('div', { class: 'g-row g-mt8' }, G.btn('Investigate', (e) => { e && e.stopPropagation(); G.go(it.go[0], it.go[1]); }, 'sm'), G.btn('Why this?', (e) => { e && e.stopPropagation(); G.whyThis(it); }, 'sm'), G.btn('Apply', (e) => { e && e.stopPropagation(); act(it); }, 'sm pri'))));
  const riskRow = (it, i) => h('div', { class: 'g-or', role: 'button', tabindex: '0', onclick: () => riskDrawer(it), onkeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); } },
    h('span', { class: 'g-or-n num', text: i + 1 }), h('div', { class: 'g-or-b' }, h('div', { class: 'g-row', style: 'gap:8px' }, h('b', { text: it.title }), G.badge(it.sev, it.sev === 'High' ? 'red' : 'amber')), h('div', { class: 'sm muted', text: it.evidence }),
      h('div', { class: 'sm g-mt8' }, h('b', { text: 'Potential impact: ' }), it.impact),
      h('div', { class: 'g-row g-mt8' }, G.btn('Evidence', (e) => { e && e.stopPropagation(); riskDrawer(it); }, 'sm'), G.btn('Investigate', (e) => { e && e.stopPropagation(); G.go(it.go[0], it.go[1]); }, 'sm'), G.btn('Mitigate', (e) => { e && e.stopPropagation(); act(it); }, 'sm pri'))));
  G.riskDrawer = (it) => riskDrawer(it);
  function riskDrawer(it) {
    G.drawer({ title: it.title, sub: 'Severity: ' + it.sev, body: h('div', { class: 'g-gap16' },
      ...[['Severity', it.sev], ['Evidence', it.evidence], ['Potential impact', it.impact], ['Recommended action', it.action], ['Why this?', it.why.reasoning], ['Metric and comparison', it.why.metric + ' · ' + it.why.comparison], ['Confidence', r0(it.conf * 100) + '% · ' + it.why.conf]].map(([k, v]) => h('div', null, h('div', { class: 'g-sig-k', text: k }), h('p', { style: 'margin:4px 0 0', text: v }))),
      h('div', { class: 'g-row' }, G.btn('Investigate', () => G.go(it.go[0], it.go[1]), 'sm'), G.btn('Mitigate', () => act(it), 'sm pri'))) });
  }
  const listAll = (title, sub, items, row) => G.modal({ title, sub, wide: true, body: h('div', { class: 'g-orl' }, items.map(row)) });
  SX.oppRisk = () => {
    const oB = h('div', { class: 'g-orl' }), rB = h('div', { class: 'g-orl' }), oAll = h('span'), rAll = h('span');
    const s = { el: h('div', { class: 'g-grid' }, h('div', { class: 's6' }, G.card('Growth Opportunities', 'Ranked by Impact × Confidence × Ease. Click one to see why.', oB, oAll)), h('div', { class: 's6' }, G.card('Growth Risks', 'Severity first. Every risk has evidence and an action.', rB, rAll))) };
    s.update = () => {
      const o = G.opportunities(R()), r = G.risks(R());
      oB.replaceChildren(...(o.length ? o.slice(0, 4).map(oppRow) : [noData()])); rB.replaceChildren(...(r.length ? r.slice(0, 4).map(riskRow) : [h('div', { class: 'sm muted', style: 'padding:12px', text: 'No material risks detected in this period.' })]));
      oAll.replaceChildren(o.length > 4 ? G.btn('All ' + o.length, () => listAll('Growth Opportunities', 'Every opportunity found, ranked.', G.opportunities(R()), oppRow), 'sm') : '');
      rAll.replaceChildren(r.length > 4 ? G.btn('All ' + r.length, () => listAll('Growth Risks', 'Every risk found, most severe first.', G.risks(R()), riskRow), 'sm') : '');
    };
    return s;
  };

  /* ======================= FORECAST OUTLOOK ======================= */
  G.outlook = () => {
    const a = G.an(R()); if (a.empty) return null;
    const ser = G.rows('series') || [], T = G.targets(), mp = G.monthProj(); if (!ser.length || !mp) return null;
    const lastD = new Date(ser[ser.length - 1].date + 'T00:00:00Z'), y = lastD.getUTCFullYear(), m = lastD.getUTCMonth(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const mtd = ser.filter((r) => { const d = new Date(r.date + 'T00:00:00Z'); return d.getUTCFullYear() === y && d.getUTCMonth() === m; }), left = dim - lastD.getUTCDate();
    const rec = ser.slice(-14).map((r) => r.revenue), sd = d3.deviation(rec) || 0, avg7 = mp.avg7, band = 1.28 * sd * Math.sqrt(Math.max(1, left));
    const base = mp.proj, best = base + band, worst = Math.max(mtd.reduce((s2, r) => s2 + r.revenue, 0), base - band), need = T.revenue / (base || 1) - 1;
    return { mtd, left, dim, y, m, lastD, base, best, worst, band, sd, avg7, target: T.revenue, need, mtdTot: sum(mtd, 'revenue'), a, T };
  };
  SX.outlook = () => {
    const box = h('div', { class: 'g-chart', style: 'min-height:230px' }), tiles = h('div', { class: 'g-three' }), lev = h('div'), head = h('div');
    const s = { el: G.card('Revenue outlook', 'Where this month closes at the current pace, with the range of likely outcomes.', h('div', { class: 'g-gap16' }, head, tiles, box, lev)) };
    s.update = () => {
      const o = G.outlook(); if (!o) { head.replaceChildren(noData()); tiles.replaceChildren(); box.replaceChildren(); lev.replaceChildren(); return; }
      const mon = o.lastD.toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });
      head.replaceChildren(h('p', { style: 'margin:0;font-size:15px' }, 'At current trajectory, projected ', mon, ' revenue is ', h('b', { text: money(o.base) }), '. ', o.need > 0.005 ? h('span', null, 'The ', money(o.target), ' target requires ', h('b', { text: '+' + F.pct(o.need * 100, 1) }), ' improvement.') : h('span', null, 'That clears the ', money(o.target), ' target.')));
      const tile = (t, v, n, cls) => h('div', { class: 'g-tile ' + (cls || '') }, h('small', { text: t }), h('b', { class: 'num', text: money(v) }), h('div', { class: 'xs muted', text: n }));
      tiles.replaceChildren(tile('Best case', o.best, 'Pace runs hot (80% range, upper)', 'ok'), tile('Base case', o.base, 'MTD + 7-day average × ' + o.left + ' days left'), tile('Worst case', o.worst, 'Pace cools (80% range, lower)', o.worst < o.target * 0.85 ? 'bd' : ''));
      let cum = 0; const act2 = o.mtd.map((r) => { cum += r.revenue; return [new Date(r.date + 'T00:00:00Z'), cum]; }), t0 = act2[act2.length - 1];
      const proj = [t0], bd = [[t0[0], t0[1], t0[1]]]; for (let i = 1; i <= o.left; i++) { const d = new Date(t0[0].getTime() + i * 864e5), v = t0[1] + o.avg7 * i, w = 1.28 * o.sd * Math.sqrt(i); proj.push([d, v]); bd.push([d, Math.max(t0[1], v - w), v + w]); }
      const tgt = [[act2[0][0], o.target * act2.length / o.dim], [new Date(o.lastD.getTime() + o.left * 864e5), o.target]];
      G.line(box, { series: [{ name: 'Actual (cumulative)', color: 'var(--g-em)', data: act2, w: 2.4 }, { name: 'Projection', color: 'var(--g-em)', data: proj, dash: '3 4' }, { name: 'Target pace', color: 'var(--g-amber)', data: tgt, dash: '7 4', w: 1.4 }], band: { data: bd }, splitAt: t0[0], height: 230, zero: true, yFmt: money, tipFmt: money, label: 'Revenue outlook chart' });
      const gap = Math.max(0, o.target - o.base), a = o.a, bestC = a.ch.filter((c) => c.spend > 0 && c.customers).sort((p, q) => EFF(q) - EFF(p))[0], needDaily = o.left ? Math.max(0, (o.target - o.mtdTot) / o.left) : 0;
      lev.replaceChildren(gap > 0 ? h('div', { class: 'g-gap8' }, h('div', { class: 'g-sig-k', text: 'Levers needed to hit the target (each on its own)' }),
        h('div', { class: 'g-three' }, [['Close the pace gap', 'Average ' + money(needDaily) + ' a day for the last ' + o.left + ' days, vs ' + money(o.avg7) + ' now (' + F.d((needDaily / o.avg7 - 1) * 100) + ').'], ['Improve conversion', 'Customers need to rise about ' + F.pct(o.need * 100, 1) + ' at today’s revenue per customer.'], [bestC ? 'Add spend on ' + bestC.name : 'Add spend', bestC ? 'About ' + money(a.tot.spend * o.need * 0.5) + ' more over the period at ' + F.x(bestC.roas) + ' ROAS closes ' + money(gap) + ' (before diminishing returns).' : 'Needs a paid channel with customers.']].map(([t, d]) => h('div', { class: 'g-ans-b' }, h('div', { class: 'g-eyebrow', text: t }), h('div', { class: 'sm', text: d }))))) : h('div', { class: 'sm muted', text: 'On pace. Protect the channels producing the revenue.' }));
    };
    return s;
  };

  /* ======================= LEADS: alerts + velocity ======================= */
  SX.leadIntel = () => {
    const aBox = h('div', { class: 'g-gap8' }), vBox = h('div');
    const s = { el: h('div', { class: 'g-grid' }, h('div', { class: 's5' }, G.card('High-intent alerts', 'Leads that need a human today.', aBox)), h('div', { class: 's7' }, G.card('Lead velocity', 'How long leads sit at each stage, and how many have gone quiet.', vBox))) };
    const list = (title, ls) => G.drawer({ title, sub: ls.length + ' leads', body: h('div', { class: 'g-gap8' }, ls.slice(0, 40).map((l) => h('div', { class: 'g-card', style: 'padding:10px' }, h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('div', null, h('b', { text: l.name }), h('div', { class: 'xs muted', text: l.company + ' · ' + l.source })), h('b', { class: 'num', text: l.score })), h('div', { class: 'xs muted g-mt8', text: 'Last activity ' + (l.last_activity_mins < 60 ? l.last_activity_mins + ' min' : r0(l.last_activity_mins / 60) + ' h') + ' ago · ' + l.next_action }))) ) });
    s.update = () => {
      const L = leadsRows(); if (!L.length) { aBox.replaceChildren(noData()); vBox.replaceChildren(); return; }
      const wait = L.filter((l) => l.waiting), price = L.filter((l) => (l.pricing_visits || 0) >= 3), quiet = L.filter((l) => ['Qualified', 'Contacted', 'Meeting'].includes(l.stage) && l.last_activity_mins > 2880);
      const al = [[wait, ' high-intent leads are waiting for outreach.', 'Follow up now', () => G.go('leads', { filter: 'followup' })], [price, ' accounts visited pricing 3+ times.', 'Review', () => list('Pricing visits 3+', price)], [quiet, ' qualified leads have no sales activity in 48 hours.', 'Review', () => list('No activity in 48 hours', quiet)]];
      aBox.replaceChildren(...al.map(([ls, t, cta, fn]) => h('div', { class: 'g-al' + (ls.length ? '' : ' none') }, h('div', null, h('b', { class: 'num', text: ls.length }), t), ls.length ? G.btn(cta, fn, 'sm pri') : h('span', { class: 'xs muted', text: 'All clear' }))));
      const by = {}; L.forEach((l) => { (by[l.stage] = by[l.stage] || []).push(l); });
      const order = ['New', 'Contacted', 'Qualified', 'Meeting', 'Opportunity', 'Customer'], stg = order.filter((x) => by[x]).concat(Object.keys(by).filter((x) => !order.includes(x)));
      vBox.replaceChildren(h('div', { class: 'g-tw' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Stage', 'Leads', 'Median age (days)', 'Quiet 48h+', 'Avg intent score'].map((t, i) => h('th', { class: i ? 'r' : '', text: t })))),
        h('tbody', null, stg.map((k) => { const ls = by[k]; return h('tr', null, h('td', null, h('b', { text: k })), h('td', { class: 'r num', text: ls.length }), h('td', { class: 'r num', text: r0(d3.median(ls, (l) => l.signup_days_ago || 0)) }), h('td', { class: 'r num', text: ls.filter((l) => l.last_activity_mins > 2880).length }), h('td', { class: 'r num', text: r0(d3.mean(ls, (l) => l.score || 0)) })); })))),
      h('div', { class: 'xs muted g-mt8', text: 'Age is days since signup. A long median age with many quiet leads means the stage is where leads stall.' }));
    };
    return s;
  };

  /* ======================= CREATOR LEADERBOARD ======================= */
  SX.creatorBoard = () => {
    const f = G.pf('crBoard', { k: 'revenue' }), box = h('div'), seg = h('span');
    const s = { el: G.card('Creator leaderboard', 'Rank creators by what matters to you. Click one to open the creator.', box, seg) };
    const RK = [['revenue', 'Revenue', (c) => c.revenue, 1], ['signups', 'Signups', (c) => c.signups, 1], ['cac', 'CAC', (c) => c.cac || 1e12, -1], ['roas', 'ROAS', (c) => (c.spend ? c.revenue / c.spend : 0), 1], ['share', 'Growth contribution', (c) => c.revenue, 1]];
    s.update = () => {
      const a = G.an(R()); seg.replaceChildren(G.sel(RK.map(([v, l]) => ({ v, l: 'Rank by ' + l })), f.k, (v) => { f.k = v; s.update(); }, 'Rank creators'));
      if (a.empty || !a.cr.length) { box.replaceChildren(noData()); return; }
      const [, , fn, dir] = RK.find((x) => x[0] === f.k), rows = a.cr.slice().sort((p, q) => (dir > 0 ? fn(q) - fn(p) : fn(p) - fn(q))), totRev = sum(a.cr, 'revenue') || 1;
      box.replaceChildren(h('div', { class: 'g-tw' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['#', 'Creator', 'Spend', 'Reach', 'Engagement', 'Clicks', 'Signups', 'Customers', 'Revenue', 'CAC', 'ROAS', 'Contribution'].map((t, i) => h('th', { class: i > 1 ? 'r' : '', text: t })))),
        h('tbody', null, rows.slice(0, 12).map((c, i) => h('tr', { style: 'cursor:pointer', onclick: () => G.go('creators', { open: c.key }) }, h('td', { class: 'num', text: i + 1 }), h('td', null, h('b', { text: c.handle })), h('td', { class: 'r num', text: c.spend ? money(c.spend) : '—' }), h('td', { class: 'r num', text: F.c(c.views) }), h('td', { class: 'r num', text: F.pct(c.engagement, 1) }), h('td', { class: 'r num', text: F.c(c.clicks) }), h('td', { class: 'r num', text: F.n(c.signups) }), h('td', { class: 'r num', text: F.n(c.customers) }), h('td', { class: 'r num', text: money(c.revenue) }), h('td', { class: 'r num', text: c.cac ? F.inrF(c.cac) : '—' }), h('td', { class: 'r num', text: c.spend ? F.x(c.revenue / c.spend) : '—' }), h('td', { class: 'r num', text: F.pct(c.revenue / totRev * 100, 1) })))))),
      h('div', { class: 'xs muted g-mt8', text: 'Qualified leads are not tracked per creator, so that column is left out rather than estimated.' }));
    };
    return s;
  };

  /* ======================= HOME: performance tabs + today strip + recent decisions ======================= */
  SX.perfTabs = () => {
    const f = G.pf('perfTabs', { t: 'eff' }), seg = h('div', { class: 'g-chips' }), body = h('div'), cache = {};
    const effTable = () => { const a = G.an(R()), rows = a.ch.filter((c) => c.revenue > 0).sort((p, q) => q.revenue - p.revenue);
      return G.card('Channel efficiency', 'CAC, ROAS and conversion for every channel.', h('div', { class: 'g-tw' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Channel', 'Revenue share', 'Spend', 'CAC', 'ROAS', 'Signup rate', 'Activation'].map((t, i) => h('th', { class: i ? 'r' : '', text: t })))),
        h('tbody', null, rows.map((c) => h('tr', { style: 'cursor:pointer', onclick: () => (c.name === 'Creators' ? G.go('creators') : G.go('channels')) }, h('td', null, h('span', { class: 'g-dotc', style: 'background:' + c.col }), c.name), h('td', { class: 'r num', text: F.pct(c.sh_revenue * 100, 0) }), h('td', { class: 'r num', text: c.spend ? money(c.spend) : '—' }), h('td', { class: 'r num', text: c.cac ? F.inrF(c.cac) : '—' }), h('td', { class: 'r num', text: c.roas ? F.x(c.roas) : '—' }), h('td', { class: 'r num', text: F.pct(c.srate, 2) }), h('td', { class: 'r num', text: F.pct(c.act, 1) }))))))); };
    const T = [['eff', 'Channels'], ['camp', 'Campaigns'], ['cr', 'Creators'], ['unit', 'Unit economics'], ['qual', 'Growth quality'], ['map', 'Opportunity map']];
    const s = { el: h('div', { class: 'g-gap16' }, seg, body) };
    const two = (a, b) => ({ el: h('div', { class: 'g-gap16' }, a.el, b.el), update: () => { a.update(); b.update(); } });
    const mk = { eff: () => two(SX.matrix(), SX.chanTable()), camp: () => two(SX.campaigns(), SX.campCharts()), cr: () => { const c = SX.creators(), b = SX.creatorBoard(); return { el: h('div', { class: 'g-gap16' }, c.el, b.el), update: () => { c.update(); b.update(); } }; }, unit: () => SX.unit(), qual: () => SX.quality(), map: () => SX.oppMap() };
    s.update = () => {
      seg.replaceChildren(...T.map(([k, l]) => h('button', { class: 'g-chip' + (f.t === k ? ' on' : ''), type: 'button', 'aria-pressed': f.t === k, onclick: () => { f.t = k; s.update(); } }, l)));
      const k = f.t; cache[k] = cache[k] || mk[k](); if (body.firstChild !== cache[k].el) body.replaceChildren(cache[k].el); live(cache[k]);
    };
    return s;
  };
  SX.todayStrip = () => {
    const mt = h('div', { class: 'g-st g-st-sm' }), nd = h('div', { class: 'g-grid' });
    const s = { el: h('div', { class: 'g-gap16' }, mt, nd) };
    s.update = () => {
      const a = G.an(R()), ser = G.rows('series') || [], ps = G.pipelineStats(); if (a.empty || ser.length < 8) { mt.replaceChildren(); nd.replaceChildren(); return; }
      const d = ser[ser.length - 1], p7 = ser.slice(-8, -1), av = (k) => d3.mean(p7, (r) => r[k]), N = dayN();
      const dayLabel = new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const t3 = ser.slice(-3), cac3 = sum(t3, 'spend') / Math.max(1, sum(t3, 'customers')), cacP = sum(p7, 'spend') / Math.max(1, sum(p7, 'customers'));
      const act1 = d.activated / Math.max(1, d.signups) * 100, actP = sum(p7, 'activated') / Math.max(1, sum(p7, 'signups')) * 100;
      const tiles = [['Revenue', money(d.revenue), (d.revenue / av('revenue') - 1) * 100, true], ['Signups', F.n(d.signups), (d.signups / av('signups') - 1) * 100, true], ['Qualified leads', F.n(a.tot.leads / N), null, true, 'avg per day'], ['Activation', F.pct(act1, 1), (act1 / actP - 1) * 100, true], ['CAC (3 days)', F.inrF(cac3), (cac3 / cacP - 1) * 100, false], ['Pipeline', money(ps.value), null, true, ps.open.length + ' open deals'], ['Customers', F.n(d.customers), (d.customers / av('customers') - 1) * 100, true]];
      mt.replaceChildren(h('div', { class: 'g-st-lab xs muted', text: 'Latest synced day · ' + dayLabel + ' vs the previous 7-day average' }), ...tiles.map(([l, v, dl, good, sub]) => h('div', { class: 'g-st-c' }, h('small', { text: l }), h('b', { class: 'num g-st-v', text: v }), dl != null ? G.dl(dl, good) : h('span', { class: 'xs muted', text: sub || '' }))));
      const rk = G.risks(R()).slice(0, 3), op = G.opportunities(R()).slice(0, 3), tot = sum(op, 'impactVal');
      const riskNodes = rk.length ? rk.map((r) => h('button', { class: 'g-al', type: 'button', onclick: () => riskDrawer(r) }, h('div', { style: 'text-align:left' }, G.badge(r.sev, r.sev === 'High' ? 'red' : 'amber'), ' ', h('b', { text: r.title }), h('div', { class: 'xs muted', text: r.evidence })))) : [h('div', { class: 'sm muted', text: 'Nothing needs attention right now.' })];
      const opNodes = op.length ? op.map((o) => h('button', { class: 'g-al', type: 'button', onclick: () => G.whyThis(o) }, h('div', { style: 'text-align:left' }, h('b', { text: o.action }), h('div', { class: 'xs muted', text: o.impactTxt })))) : [h('div', { class: 'sm muted', text: 'No opportunities found yet.' })];
      if (op.length) opNodes.push(h('div', { class: 'sm', style: 'padding:6px 2px' }, h('b', { text: 'Combined expected impact: ' }), '+' + money(tot) + ' (estimates; they overlap)'));
      nd.replaceChildren(h('div', { class: 's6' }, G.card('What needs attention', 'The three highest-priority issues.', h('div', { class: 'g-gap8' }, riskNodes))), h('div', { class: 's6' }, G.card('What to do today', 'Three actions, with the expected impact.', h('div', { class: 'g-gap8' }, opNodes))));
    };
    return s;
  };
  SX.recentDecisions = () => {
    const box = h('div', { class: 'g-gap8' }), s = { el: G.card('Recent decisions', 'What was decided, and whether it worked.', box, G.btn('Decision Log', () => G.go('decisions'), 'sm')) };
    s.update = () => {
      const d = (G.decisions ? G.decisions() : []).slice(0, 3);
      box.replaceChildren(...(d.length ? d.map((x) => h('div', { class: 'g-al', style: 'cursor:default' }, h('div', null, h('b', { text: x.title || x.decision }), h('div', { class: 'xs muted', text: (x.expected ? 'Expected: ' + x.expected : '') + (x.actual ? ' · Actual: ' + x.actual : '') })), x.status ? G.badge(x.status, /valid/i.test(x.status) ? 'green' : /miss/i.test(x.status) ? 'red' : 'amber') : null)) : [h('div', { class: 'sm muted', text: 'No decisions logged yet. Apply a recommendation and it appears here.' })]));
    };
    return s;
  };

  /* ======================= ASK: more answers from the data ======================= */
  const askCache = new WeakMap();
  const extraAsk = () => {
    const a = G.an('30d'); if (!a || a.empty) return []; if (askCache.has(a)) return askCache.get(a);
    const out = [], T = G.targets(), paid = a.ch.filter((c) => c.spend > 0 && c.customers > 0), cc = G.campClass(a), L = G.funnelLeaks('30d'), op = G.opportunities('30d');
    const add = (id, q, keys, group, headline, analysis, evidence, reco, go, extra) => out.push(Object.assign({ id, q, keys, group, headline, analysis, evidence, reco, action: 'Open', toast: '', go, go_opts: {}, impact: '', feat: null }, extra || {}));
    const grow = a.ch.map((c) => ({ c, g: c.revenue - (c.prevRev || 0) })).sort((p, q) => q.g - p.g)[0];
    if (grow) add('n-growth', 'Where am I getting the highest growth?', ['highest growth', 'most growth', 'fastest growing', 'where am i getting'], 'REVENUE', grow.c.name + ' added the most revenue growth: ' + sgn(grow.g) + money(Math.abs(grow.g)) + ' vs the previous period.', 'Previous-period revenue by channel is an estimate; the blended total is exact.', [['Channel', grow.c.name], ['Revenue now', money(grow.c.revenue)], ['Share of revenue', F.pct(grow.c.sh_revenue * 100, 0)], ['Signups change', F.d(grow.c.d_signups)]], 'Protect and extend ' + grow.c.name + '.', grow.c.name === 'Creators' ? 'creators' : 'channels');
    const pause = a.camps.filter((c) => cc(c).label === 'Pause'), opt = a.camps.filter((c) => cc(c).label === 'Optimize'), scale = a.camps.filter((c) => cc(c).label === 'Scale');
    add('n-stop', 'Which campaigns should I stop?', ['stop', 'pause', 'cut campaign', 'shut down'], 'CAMPAIGNS', pause.length ? 'Pause ' + pause.map((c) => c.name.replace(/^Wispr Flow — /, '')).join(', ') + '.' : 'No campaign clearly needs pausing.', pause.length ? pause.map((c) => c.name + ': ' + cc(c).why).join(' ') : 'Every campaign is within range of the account average. ' + (opt.length ? opt.length + ' to optimize.' : ''), (pause.length ? pause : opt).slice(0, 4).map((c) => [c.name.replace(/^Wispr Flow — /, ''), 'CAC ' + F.inrF(c.cac) + ' · ROAS ' + F.x(c.roas)]).concat([['Account CAC', F.inrF(a.tot.cac)]]), pause.length ? 'Pause the weakest and move the budget to a campaign marked Scale.' : 'Optimize the weakest campaign before cutting.', 'campaigns');
    add('n-scale', 'Which campaigns should I scale?', ['should i scale', 'campaigns to scale', 'scale up', 'which campaigns should'], 'CAMPAIGNS', scale.length ? 'Scale ' + scale.map((c) => c.name.replace(/^Wispr Flow — /, '')).join(', ') + '.' : 'No campaign clears the bar to scale yet.', scale.length ? scale.map((c) => cc(c).why).join(' ') : 'A campaign needs CAC at least 15% below average and ROAS at or above average.', scale.slice(0, 4).map((c) => [c.name.replace(/^Wispr Flow — /, ''), 'CAC ' + F.inrF(c.cac) + ' · ROAS ' + F.x(c.roas)]), scale.length ? 'Raise the budget of the top campaign by 20%.' : 'Keep testing.', 'campaigns');
    const up = a.ch.filter((c) => c.cac && c.d_cac > 0).sort((p, q) => q.d_cac - p.d_cac), bc = a.kp.cac;
    add('n-cacup', 'Why is CAC increasing?', ['cac increasing', 'why is cac', 'cac up', 'cac rising', 'cac going up'], 'CAMPAIGNS', bc && bc.delta > 0 ? 'Blended CAC is up ' + F.pct(bc.delta, 1) + ' to ' + F.inrF(a.tot.cac) + '.' : 'Blended CAC is not increasing. It is ' + F.d(bc ? bc.delta : 0) + ' at ' + F.inrF(a.tot.cac) + '.', up.length ? up.slice(0, 2).map((c) => c.name + ' CAC is ' + F.d(c.d_cac) + ' at ' + F.inrF(c.cac)).join('; ') + '. A rising channel pulls the blend up.' : 'No channel has a rising CAC.', up.slice(0, 4).map((c) => [c.name, F.inrF(c.cac) + ' (' + F.d(c.d_cac) + ')']).concat([['CAC target', F.inrF(T.cac)]]), up.length ? 'Review ' + up[0].name + ' and shift budget toward lower-CAC channels.' : 'Keep the mix.', 'channels');
    const roi = paid.slice().sort((p, q) => q.roas - p.roas)[0];
    if (roi) add('n-roi', 'Which channel has the best ROI?', ['best roi', 'best channel', 'highest roas', 'channel has the best'], 'REVENUE', roi.name + ' has the best return at ' + F.x(roi.roas) + ' ROAS.', roi.name + ' earns ' + F.x(roi.roas) + ' per rupee on ' + F.pct(roi.sh_spend * 100, 1) + ' of spend, against ' + F.x(a.tot.roas) + ' blended.', paid.slice().sort((p, q) => q.roas - p.roas).slice(0, 4).map((c) => [c.name, F.x(c.roas) + ' · CAC ' + F.inrF(c.cac)]), 'Test more budget on ' + roi.name + ' with a simulation first.', 'channels', { go_opts: { sim: true } });
    const l0 = L[0];
    if (l0) add('n-leak', 'Which funnel stage is leaking the most?', ['funnel stage', 'stage is leaking', 'leaking the most', 'biggest leak'], 'GTM', l0.st.name + ' leaks the most: ' + F.pct(l0.drop, 1) + ' drop.', l0.worst + ' converts ' + F.pct(l0.worstR, l0.worstR < 10 ? 2 : 1) + ' vs ' + F.pct(l0.bench, l0.bench < 10 ? 2 : 1) + ' at your best channels. ' + l0.st.why, L.slice(0, 3).map((l) => [l.st.name, F.pct(l.drop, 1) + ' drop · ' + money(l.opp) + ' within reach']), l0.st.act(l0.worst), l0.st.go[0]);
    const cr = a.cr, crC = sum(cr, 'customers'), crRev = sum(cr, 'revenue');
    if (cr.length) add('n-crcust', 'Which customers came from creators?', ['came from creators', 'creator customers', 'customers from creators'], 'CREATORS', F.n(crC) + ' customers (' + F.pct(crC / (a.tot.customers || 1) * 100, 0) + ' of all) came from creators, worth ' + money(crRev) + '.', 'Creators bring customers at a CAC of ' + F.inrF(sum(cr, 'spend') / Math.max(1, crC)) + ' against ' + F.inrF(a.tot.cac) + ' blended.', cr.slice().sort((p, q) => q.customers - p.customers).slice(0, 4).map((c) => [c.handle, F.n(c.customers) + ' customers · ' + money(c.revenue)]), 'Open the creator leaderboard.', 'creators');
    const q = cr.filter((c) => c.customers >= 3).map((c) => ({ c, rpc: c.revenue / c.customers })).sort((p, q2) => q2.rpc - p.rpc);
    if (q.length) add('n-crq', 'Which creators are driving the highest-quality customers?', ['highest-quality', 'quality customers', 'creators driving', 'best customers'], 'CREATORS', q[0].c.handle + ' brings the highest-value customers at ' + money(q[0].rpc) + ' each.', 'Quality here is revenue per customer. The account average is ' + money(a.tot.revenue / Math.max(1, a.tot.customers)) + '.', q.slice(0, 4).map((x) => [x.c.handle, money(x.rpc) + ' per customer · ' + F.n(x.c.customers) + ' customers']), 'Brief more creators like ' + q[0].c.handle + '.', 'creators');
    const waste = paid.filter((c) => c.roas < a.tot.roas * 0.5 && c.sh_spend >= 0.03).sort((p, q2) => q2.spend - p.spend);
    add('n-waste', 'Where are we wasting spend?', ['wasting spend', 'wasted', 'waste'], 'CAMPAIGNS', waste.length ? 'About ' + money(sum(waste, (c) => c.spend * (1 - c.roas / a.tot.roas))) + ' is spent below your blended return, mostly on ' + waste[0].name + '.' : 'No channel is far below your blended return.', waste.length ? waste.map((c) => c.name + ' returns ' + F.x(c.roas) + ' on ' + money(c.spend)).join('; ') + '. Blended ROAS is ' + F.x(a.tot.roas) + '.' : 'Every channel with meaningful spend returns at least half of the blended ROAS.', waste.slice(0, 4).map((c) => [c.name, money(c.spend) + ' · ' + F.x(c.roas)]).concat([['Blended ROAS', F.x(a.tot.roas)]]), waste.length ? 'Move part of the ' + waste[0].name + ' budget to ' + (roi ? roi.name : 'a better channel') + '.' : 'Keep monitoring.', 'channels', { go_opts: { sim: true } });
    if (op.length) add('n-top3', 'Give me the top 3 growth opportunities.', ['top 3', 'growth opportunities', 'top three', 'biggest opportunities'], 'GTM', 'Your top opportunity is: ' + op[0].title + '.', 'Ranked by Impact × Confidence × Ease from your own data.', op.slice(0, 3).map((o, i) => [(i + 1) + '. ' + o.title, o.impactTxt + ' · score ' + o.score]), op[0].action + '.', op[0].go[0], { go_opts: op[0].go[1] });
    const mp = G.monthProj();
    if (mp && T.revenue) { const pc = mp.proj / T.revenue * 100, gap = Math.max(0, T.revenue - mp.proj);
      add('n-month', 'Are we on track for our monthly target?', ['monthly target', 'on track for our monthly', 'month-end', 'month target', 'monthly revenue target'], 'REVENUE', pc >= 95 ? 'Yes. ' + mp.month + ' is projected to close at ' + money(mp.proj) + ' (' + r0(pc) + '% of target).' : 'Not yet. ' + mp.month + ' is projected to close at ' + money(mp.proj) + ', ' + r0(pc) + '% of the ' + money(T.revenue) + ' target.', 'Month-to-date revenue is ' + money(mp.mtd) + '. The last 7 days average ' + money(mp.avg7) + ' a day, with ' + mp.left + ' days left.', [['Month to date', money(mp.mtd)], ['Projected close', money(mp.proj)], ['Target', money(T.revenue)], ['Gap', gap ? money(gap) : 'None']], gap ? 'Open the forecast and pick a lever: the gap needs about +' + F.pct(gap / mp.proj * 100, 1) + ' on the current pace.' : 'Protect the channels producing the revenue.', 'forecast'); }
    const a7 = G.an('7d');
    if (a7 && !a7.empty) { const mv = [['Revenue', a7.kp.revenue, true], ['Signups', a7.kp.signups, true], ['Customers', a7.kp.customers, true], ['CAC', a7.kp.cac, false], ['CTR', a7.kp.ctr, true], ['ROAS', a7.kp.roas, true]].filter((x) => x[1] && x[1].delta != null).sort((p, q) => Math.abs(q[1].delta) - Math.abs(p[1].delta)).slice(0, 3);
      if (mv.length) add('n-week', 'What changed this week?', ['changed this week', 'this week', 'last 7 days', 'past week'], 'TODAY', mv.map((x) => x[0] + ' ' + F.d(x[1].delta)).join(', ') + ' vs the previous 7 days.', 'The three biggest movers over the last 7 days, against the 7 days before.', mv.map((x) => [x[0], F.d(x[1].delta) + (x[2] ? (x[1].delta >= 0 ? ' · good' : ' · watch') : (x[1].delta <= 0 ? ' · good' : ' · watch'))]), 'Open GTM Radar to see what is behind each move.', 'radar'); }
    if (op.length) add('n-todo', 'What should the growth team do today?', ['growth team do', 'team do today', 'should we do today', 'what should the growth team'], 'TODAY', 'Do these three things today: ' + op.slice(0, 3).map((o) => o.action).join('; ') + '.', 'Ranked by Impact × Confidence × Ease from your own data.', op.slice(0, 3).map((o) => [o.action, o.impactTxt]), op[0].action + '.', op[0].go[0], { go_opts: op[0].go[1] });
    askCache.set(a, out); return out;
  };
  const rows0 = G.rows;
  G.rows = (id) => { const r = rows0(id); if (id !== 'ask' || !r) return r; let ex; try { ex = extraAsk(); } catch (e) { return r; } if (!ex.length) return r; const have = new Set(r.map((x) => x.q.toLowerCase())); return r.concat(ex.filter((x) => !have.has(x.q.toLowerCase()))); };

  /* ======================= placement ======================= */
  const ext = (id, fn) => {
    const p = G.pages[id]; if (!p) return; const b = p.build;
    p.build = function (root, opts) {
      const api = b.call(this, root, opts) || {}; let ex = {};
      try { ex = fn(root, opts) || {}; } catch (e) { console.error('[growth-os] extending ' + id, e); }
      return Object.assign({}, api, { update() { api.update && api.update.apply(this, arguments); try { ex.update && ex.update(); } catch (e) { console.error(e); } } });
    };
  };
  const before = (root, el, re) => { const t = Array.from(root.children).find((c) => c.classList.contains('g-sec') && re.test(c.textContent || '')); if (t) root.insertBefore(el, t); else root.append(el); };
  const multi = (list) => ({ update() { list.forEach((x) => { x.update(); requestAnimationFrame(() => { if (x.el.isConnected) x.update(); }); }); } });
  ext('leads', (root) => { const s = SX.leadIntel(); before(root, G.sec('Lead intelligence', 'Alerts that need action today, and how fast leads move.'), /Sales funnel/); before(root, s.el, /Sales funnel/); return multi([s]); });
  ext('creators', (root) => { const s = SX.creatorBoard(); before(root, s.el, /Creator performance/); return multi([s]); });
  ext('forecast', (root) => { const s = SX.outlook(); const first = Array.from(root.children).find((c) => c.classList.contains('g-kpis')); if (first && first.nextSibling) root.insertBefore(s.el, first.nextSibling); else root.append(s.el); return multi([s]); });
  ext('radar', (root) => { const s = SX.oppRisk(); root.append(h('div', { class: 'g-sec' }, h('h2', { text: 'Opportunities and risks' }), h('p', { text: 'Ranked and explainable. Click any row to see why.' })), s.el); return multi([s]); });
})();
