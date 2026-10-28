(function () {
  'use strict';
  /* Analytics sections, part 1: Growth Scorecard, Growth Funnel + leaks, Where Growth Comes From,
     Revenue Contribution, Spend vs Revenue, Channel Efficiency Matrix, What Drove Growth.
     Every section returns { el, update } and reads the one model G.an(R). */
  const G = window.G, h = G.h, S = G.S, F = G.F, CH = G.ch, SX = (G.sx = {});
  const sum = G.sum, div = G.div, clamp = G.clamp, r0 = Math.round;
  const money = (v) => F.inr(v);
  const fmtFor = { impr: F.c, clicks: F.c, visitors: F.c, signups: F.n, activated: F.n, leads: F.n, customers: F.n, revenue: money };
  const sec = (o) => { const body = h('div'); const el = o.bare ? body : G.card(o.title, o.sub, body, o.right, o.cls); return { el, body, update: () => {} }; };
  const goCh = (name) => (name === 'Creators' ? G.go('creators') : G.go('channels'));
  const R = () => S.range;
  const noData = () => G.empty('◌', 'Nothing to chart yet', 'Connect data or load demo data and this view fills in.');
  const sgn = (v) => (v >= 0 ? '+' : '−');

  /* ======================= GROWTH SCORECARD ======================= */
  const DIMS = ['Acquisition', 'Conversion', 'Activation', 'Revenue', 'Pipeline', 'Retention'];
  function pipelineStats() {
    const dl = (G.rows('deals') || []).concat(S.local.newDeals || []).map((d) => Object.assign({}, d, { stage: (S.local.dealStage || {})[d.id] || d.stage }, (S.local.dealDone || {})[d.id] ? { stalled: false } : {}));
    const open = dl.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost');
    return { deals: dl, open, stalled: open.filter((d) => d.stalled), value: sum(open, 'value'), weighted: sum(open, (d) => d.value * (d.probability || 0) / 100), won: sum(dl.filter((d) => d.stage === 'Won'), 'value') };
  }
  G.pipelineStats = pipelineStats;
  G.scorecard = (Rg) => {
    const a = G.an(Rg), hs = (G.rows('health') || []).filter((x) => x.range === Rg), by = {}; hs.forEach((x) => (by[x.dim] = x));
    if (a.empty) return [];
    const pk = {}; (G.rows('pipeline_kpis') || []).forEach((k) => (pk[k.metric] = k));
    const ps = pipelineStats();
    const chs = a.ch, paid = chs.filter((c) => c.spend > 0);
    const low = (arr, k, minShareKey, minShare, asc) => arr.filter((c) => (c['sh_' + minShareKey] || 0) >= minShare && c[k] != null).sort((x, y) => (asc ? x[k] - y[k] : y[k] - x[k]))[0];
    const blendSrate = div(a.tot.signups, a.tot.visitors) * 100, blendAct = div(a.tot.activated, a.tot.signups) * 100;
    const prevSrate = a.prev.visitors ? div(a.prev.signups, a.prev.visitors) * 100 : null, prevAct = a.prev.signups ? div(a.prev.activated, a.prev.signups) * 100 : null;
    const pp = (x, y) => (x != null && y != null ? x - y : null);
    const out = [];
    const worstSig = low(paid.length ? paid : chs, 'd_signups', 'signups', 0.03, true);
    out.push({ dim: 'Acquisition', metrics: [['Signups', F.n(a.tot.signups), a.kp.signups && a.kp.signups.delta, true], ['CTR', F.pct(a.tot.ctr, 2), a.kp.ctr && a.kp.ctr.delta, true], ['CPC', F.inrF(div(a.tot.spend, a.tot.clicks)), null, false], ['Spend', money(a.tot.spend), a.kp.spend && a.kp.spend.delta, null]], trend: ['signups', 'Signups per day'],
      issue: worstSig && worstSig.d_signups < 0 ? worstSig.name + ' signups are ' + F.d(worstSig.d_signups).replace('−', '−') + ' vs the previous period.' : 'No channel is shrinking; ' + (chs.slice().sort((x, y) => (x.d_signups || 0) - (y.d_signups || 0))[0] || {}).name + ' is growing slowest.',
      action: worstSig && worstSig.d_signups < 0 ? 'Review ' + worstSig.name + ' creative and targeting.' : 'Add budget where signups are compounding.', go: ['channels', {}] });
    const lowS = low(chs, 'srate', 'visitors', 0.05, true);
    out.push({ dim: 'Conversion', metrics: [['Visit → signup', F.pct(blendSrate, 2), pp(blendSrate, prevSrate) == null ? null : (blendSrate / prevSrate - 1) * 100, true], ['Qualified → customer', F.pct(div(a.tot.customers, a.tot.leads) * 100, 1), null, true], ['Customers', F.n(a.tot.customers), a.kp.customers && a.kp.customers.delta, true]], trend: ['srate', 'Visitor → signup rate'],
      issue: lowS ? lowS.name + ' converts only ' + F.pct(lowS.srate, 2) + ' of visitors vs ' + F.pct(blendSrate, 2) + ' blended.' : 'Conversion is even across channels.', action: lowS ? 'Fix the landing page and signup flow for ' + lowS.name + ' traffic.' : 'Test a stronger call to action.', go: ['attribution', {}] });
    const lowA = low(chs, 'act', 'signups', 0.05, true);
    out.push({ dim: 'Activation', metrics: [['Activation rate', F.pct(blendAct, 1), pp(blendAct, prevAct) == null ? null : (blendAct / prevAct - 1) * 100, true], ['Activated users', F.n(a.tot.activated), a.kp.activated && a.kp.activated.delta, true], ['Weakest channel', lowA ? lowA.name + ' · ' + F.pct(lowA.act, 1) : '—', null, null]], trend: ['act', 'Activation rate'],
      issue: lowA ? lowA.name + ' activates only ' + F.pct(lowA.act, 1) + ' of signups vs ' + F.pct(blendAct, 1) + ' blended.' : 'Activation is steady.', action: lowA ? 'Improve onboarding for ' + lowA.name + ' signups.' : 'Keep onboarding as is.', go: ['campaigns', {}] });
    const lowR = low(paid, 'roas', 'spend', 0.05, true);
    out.push({ dim: 'Revenue', metrics: [['Revenue', money(a.tot.revenue), a.kp.revenue && a.kp.revenue.delta, true], ['ROAS', F.x(a.tot.roas), a.kp.roas && a.kp.roas.delta, true], ['CAC', F.inrF(a.tot.cac), a.kp.cac && a.kp.cac.delta, false]], trend: ['revenue', 'Revenue per day'],
      issue: lowR ? lowR.name + ' returns ' + F.x(lowR.roas) + ' on ' + F.pct(lowR.sh_spend * 100, 0) + ' of spend vs ' + F.x(a.tot.roas) + ' blended.' : 'Spend is returning evenly.', action: lowR ? 'Move budget from ' + lowR.name + ' to your best-returning channel.' : 'Hold the mix.', go: ['channels', { sim: true }] });
    if (pk.pipeline) {
      const sc = clamp(r0(58 + (pk.pipeline.delta || 0) * 1.2 + ((pk.winrate && pk.winrate.value) - 25) * 0.7 - (ps.open.length ? ps.stalled.length / ps.open.length * 28 : 0)), 25, 97);
      out.push({ dim: 'Pipeline', score: sc, delta: pk.pipeline.delta ? r0(pk.pipeline.delta / 2) : 0, metrics: [['Pipeline', money(pk.pipeline.value), pk.pipeline.delta, true], ['Weighted', money(pk.weighted.value), pk.weighted.delta, true], ['Win rate', F.pct(pk.winrate.value, 1), pk.winrate.delta, true], ['Stalled deals', String(ps.stalled.length) + ' · ' + money(sum(ps.stalled, 'value')), null, null]], trend: null,
        issue: ps.stalled.length ? ps.stalled.length + ' deals have been idle for 7+ days (' + money(sum(ps.stalled, 'value')) + ').' : 'No stalled deals.', action: ps.stalled.length ? 'Follow up on stalled deals today.' : 'Keep moving deals forward.', go: ['pipeline', { stalled: true }] });
    }
    const waiting = (G.rows('leads') || []).filter((l) => l.waiting);
    out.push({ dim: 'Retention', metrics: [['High-intent leads waiting', String(waiting.length), null, null], ['Win rate', pk.winrate ? F.pct(pk.winrate.value, 1) : '—', pk.winrate && pk.winrate.delta, true], ['Sales cycle', pk.cycle ? pk.cycle.value + ' days' : '—', pk.cycle && pk.cycle.delta, false]], trend: null,
      issue: waiting.length ? waiting.length + ' high-intent leads have had no follow-up in 3+ days (' + money(sum(waiting, 'est_value')) + ' potential).' : 'Every high-intent lead has been contacted.', action: waiting.length ? 'Follow up with the waiting leads now.' : 'Keep the follow-up cadence.', go: ['leads', { filter: 'followup' }] });
    return out.map((d) => {
      const x = by[d.dim]; if (x && d.score == null) { d.score = x.score; d.delta = x.delta; d.note = x.note; }
      d.status = d.score >= 80 ? 'Healthy' : d.score >= 65 ? 'Watch' : 'Needs attention';
      return d;
    }).filter((d) => d.score != null).sort((p, q) => DIMS.indexOf(p.dim) - DIMS.indexOf(q.dim));
  };
  function dimModal(d) {
    const tone = d.score >= 80 ? 'green' : d.score >= 65 ? 'amber' : 'red';
    const tr = h('div', { class: 'g-chart', style: 'min-height:90px' });
    const body = h('div', { class: 'g-gap16' },
      h('div', { class: 'g-row', style: 'align-items:baseline;gap:12px' }, h('b', { class: 'num', style: 'font-size:34px', text: d.score }), h('span', { class: 'dl ' + (d.delta > 0 ? 'up' : d.delta < 0 ? 'down' : 'flat'), text: (d.delta > 0 ? '▲ ' : d.delta < 0 ? '▼ ' : '') + Math.abs(d.delta || 0) + ' pts vs previous' }), G.badge(d.status, tone)),
      h('div', null, h('div', { class: 'g-sig-k', text: 'Underlying metrics' }), h('div', { class: 'g-gap8 g-mt8' }, d.metrics.map(([l, v, dl, good]) => h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('span', { class: 'sm muted', text: l }), h('span', { class: 'g-row', style: 'gap:8px;flex-wrap:nowrap' }, h('b', { class: 'num', text: v }), dl != null ? G.dl(dl, good) : null))))),
      d.trend ? h('div', null, h('div', { class: 'g-sig-k', text: 'Trend · ' + d.trend[1] }), tr) : null,
      h('div', null, h('div', { class: 'g-sig-k', text: 'Biggest issue' }), h('p', { class: 'sm', style: 'margin:4px 0 0', text: d.issue })),
      h('div', { class: 'g-sig-a' }, h('div', { class: 'g-sig-k', text: 'Recommended action' }), h('div', { style: 'font-weight:600', text: d.action })));
    G.modal({ title: d.dim + ' score', sub: 'How this score is built: each underlying metric against the previous period and your blended average.', body, actions: (c) => [G.btn('See what’s driving it', () => { c(); G.dimDrill(d.dim); }), G.btn('Take me there', () => { c(); G.go(d.go[0], d.go[1]); }, 'pri')] });
    if (d.trend) { const rows = G.anTS('all', null, R()); const key = d.trend[0]; const pts = key === 'signups' || key === 'revenue' ? rows.map((r) => [r.date, r[key]]) : G.metricSeries(rows, key, G.winFor(R())); setTimeout(() => G.line(tr, { series: [{ name: d.trend[1], color: 'var(--g-em)', data: pts }], height: 100, zero: false, yFmt: (v) => (key === 'revenue' ? money(v) : key === 'signups' ? F.c(v) : F.pct(v, key === 'srate' ? 1 : 0)) }), 30); }
  }
  SX.scorecard = () => {
    const box = h('div', { class: 'g-sc' }), s = { el: h('div', null, h('div', { class: 'g-sc-h' }, h('b', { text: 'Growth Scorecard' }), h('span', { class: 'xs muted', text: 'Click a score to see what is behind it.' })), box) };
    s.update = () => {
      const sc = G.scorecard(R());
      box.replaceChildren(...(sc.length ? sc.map((d) => h('button', { class: 'g-sc-t ' + (d.score >= 80 ? 'ok' : d.score >= 65 ? 'wa' : 'bd'), type: 'button', 'aria-label': d.dim + ' score ' + d.score, onclick: () => dimModal(d) },
        h('small', { text: d.dim }), h('div', { class: 'g-row', style: 'align-items:baseline;gap:6px;flex-wrap:nowrap' }, h('b', { class: 'num', text: d.score }), h('span', { class: 'ar ' + (d.delta > 0 ? 'up' : d.delta < 0 ? 'down' : ''), text: d.delta > 0 ? '↑' : d.delta < 0 ? '↓' : '→' })), G.pbar(d.score, d.score >= 80 ? '' : d.score >= 65 ? 'amber' : 'red'))) : [noData()]));
    };
    return s;
  };

  /* ======================= GROWTH FUNNEL + LEAKS ======================= */
  const STEP = {
    clicks: { name: 'Impression → Click', go: ['channels', {}], act: (w) => 'Refresh the creative on ' + w + ' to lift click-through.', why: 'Weak click-through wastes impressions you already paid for.', nm: 'clicked' },
    visitors: { name: 'Click → Landing visit', go: ['channels', {}], act: (w) => 'Check page speed and tracking for ' + w + ' traffic.', why: 'Clicks that never load the page are paid for and lost.', nm: 'reached the landing page' },
    signups: { name: 'Landing → Signup', go: ['attribution', {}], act: (w) => 'Fix the signup flow and message match for ' + w + ' traffic.', why: 'Visitors are reaching you but not starting.', nm: 'signed up' },
    activated: { name: 'Signup → Activation', go: ['campaigns', {}], act: (w) => 'Improve first-run onboarding for ' + w + ' signups.', why: 'People sign up but never experience the product.', nm: 'activated' },
    leads: { name: 'Activation → Qualified lead', go: ['leads', {}], act: (w) => 'Route activated ' + w + ' users to sales sooner.', why: 'Activated users are not becoming sales conversations.', nm: 'became qualified leads' },
    customers: { name: 'Qualified lead → Customer', go: ['pipeline', {}], act: (w) => 'Follow up faster on qualified leads from ' + w + '.', why: 'Qualified leads are slipping away before they buy.', nm: 'became customers' },
  };
  G.funnelLeaks = (Rg) => {
    const a = G.an(Rg); if (a.empty) return [];
    const keys = ['clicks', 'visitors', 'signups', 'activated', 'leads', 'customers'], order = G.STG.map((s) => s[0]);
    return keys.map((k) => {
      const from = order[order.indexOf(k) - 1], tot = a.tot[k] / a.tot[from], rows = a.ch.filter((c) => (c[from] || 0) >= a.tot[from] * 0.03 && (c[k] || 0) >= 0).map((c) => ({ c, r: c[k] / c[from] })).filter((x) => isFinite(x.r));
      if (rows.length < 2) return null;
      const rates = rows.map((x) => x.r).sort((p, q) => p - q), bench = Math.max(tot, d3.quantile(rates, 0.75));
      const worst = rows.slice().sort((p, q) => p.r - q.r)[0];
      const gapUsers = Math.max(0, a.tot[from] * (bench - tot)), perUser = a.tot.revenue / (a.tot[k] || 1), opp = gapUsers * 0.25 * perUser;
      return { key: k, from, st: STEP[k], conv: tot * 100, drop: (1 - tot) * 100, bench: bench * 100, gapUsers, opp, worst: worst.c.name, worstR: worst.r * 100, lost: a.tot[from] - a.tot[k] };
    }).filter(Boolean).sort((p, q) => q.opp - p.opp);
  };
  function driversPanel(k, a) {
    const label = G.STG.find((s) => s[0] === k)[1], f = fmtFor[k], i = G.STG.findIndex((s) => s[0] === k), from = i ? G.STG[i - 1][0] : null;
    const rows = a.ch.filter((c) => (c[k] || 0) > 0).sort((p, q) => q[k] - p[k]), tot = a.tot[k];
    const conv = from && k !== 'revenue' ? a.ch.filter((c) => (c[from] || 0) >= a.tot[from] * 0.03).map((c) => ({ n: c.name, r: c[k] / c[from] * 100 })).sort((p, q) => q.r - p.r) : [];
    const go = k === 'leads' ? ['leads', {}] : k === 'customers' || k === 'revenue' ? ['channels', {}] : ['channels', {}];
    return h('div', { class: 'g-gap8' }, h('div', { class: 'g-eyebrow', text: 'DRIVERS · ' + label.toUpperCase() }), h('b', { style: 'font-size:15px', text: 'Top ' + label.toLowerCase() + ' sources' }),
      h('div', { class: 'g-gap8' }, rows.slice(0, 6).map((c) => h('button', { class: 'g-src', type: 'button', onclick: () => goCh(c.name), onmousemove: (e) => G.tip.show(e, h('div', null, h('b', { text: c.name }), h('div', { class: 'r' }, h('span', { text: label }), h('b', { text: f(c[k]) })), h('div', { class: 'xs muted', text: 'Click to open the channel' }))), onmouseleave: G.tip.hide },
        h('span', { class: 'n' }, h('i', { style: 'background:' + c.col }), c.name), h('span', { class: 'b' }, h('i', { style: `width:${c[k] / rows[0][k] * 100}%;background:${c.col}` })), h('span', { class: 'v num', text: F.pct(c[k] / tot * 100, 0) })))),
      conv.length > 1 ? h('div', { class: 'xs muted g-mt8' }, 'Best conversion from previous stage: ', h('b', { text: conv[0].n + ' ' + F.pct(conv[0].r, conv[0].r < 10 ? 2 : 1) }), ' · weakest: ', h('b', { text: conv[conv.length - 1].n + ' ' + F.pct(conv[conv.length - 1].r, conv[conv.length - 1].r < 10 ? 2 : 1) })) : null,
      h('div', { class: 'g-row g-mt8' }, G.btn('Open channels', () => G.go('channels'), 'sm'), k === 'customers' || k === 'revenue' ? G.btn('Open attribution', () => G.go('attribution'), 'sm') : null));
  }
  SX.funnel = () => {
    const f = G.pf('funnel', { sel: 'signups' });
    const fBox = h('div'), dBox = h('div', { class: 'g-card g-fn-d' }), lBox = h('div', { class: 'g-leaks' }), iBox = h('div');
    const s = { el: h('div', { class: 'g-gap16' }, h('div', { class: 'g-grid' }, h('div', { class: 's8' }, G.card('Growth Funnel', 'Impressions to revenue for the selected period. Click a stage to see what drives it.', fBox)), h('div', { class: 's4' }, dBox)),
      h('div', null, h('div', { class: 'g-sc-h' }, h('b', { text: 'Biggest Funnel Leaks' }), h('span', { class: 'xs muted', text: 'Where users drop furthest below your own best channels.' })), lBox), iBox) };
    s.update = () => {
      const a = G.an(R());
      if (a.empty) { fBox.replaceChildren(noData()); dBox.replaceChildren(); lBox.replaceChildren(); iBox.replaceChildren(); return; }
      const leaks = G.funnelLeaks(R()), top3 = leaks.slice(0, 3);
      const stages = a.funnel.map((x) => Object.assign({ fmt: fmtFor[x.key], good: true }, x));
      fBox.replaceChildren(CH.funnel(stages, { sel: f.sel, leakKeys: top3.map((l) => l.key), onPick: (k) => { f.sel = k; s.update(); } }), h('div', { class: 'xs muted g-mt8', text: 'Bar widths are scaled so every stage stays readable. Highlighted stages are the biggest leaks.' }));
      dBox.replaceChildren(driversPanel(f.sel, a));
      lBox.replaceChildren(...(top3.length ? top3.map((l, i) => h('div', { class: 'g-card g-leak' },
        h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('div', null, h('div', { class: 'g-eyebrow', text: 'LEAK ' + (i + 1) }), h('b', { style: 'font-size:15px', text: l.st.name })), h('b', { class: 'num lk', text: F.pct(l.drop, 1) + ' drop' })),
        h('div', { class: 'sm g-mt8' }, h('b', { text: F.n(l.gapUsers) }), ' more users would have ' + l.st.nm + ' at the pace of your best channels. ' + l.worst + ' converts ' + F.pct(l.worstR, l.worstR < 10 ? 2 : 1) + ' vs ' + F.pct(l.bench, l.bench < 10 ? 2 : 1) + '.'),
        h('div', { class: 'g-leak-k' }, h('div', null, h('small', { text: 'Why it matters' }), h('div', { class: 'sm', text: l.st.why })), h('div', null, h('small', { text: 'Revenue opportunity' }), h('div', { class: 'sm' }, h('b', { text: money(l.opp) }), ' if a quarter of the gap closes')), h('div', null, h('small', { text: 'Recommended action' }), h('div', { class: 'sm', text: l.st.act(l.worst) }))),
        h('div', { class: 'g-row g-mt8' }, G.btn('Investigate', () => G.go(l.st.go[0], l.st.go[1]), 'sm'))))
        : [h('div', { class: 'muted sm', text: 'No meaningful leaks found — conversion is even across channels.' })]));
      const l0 = top3[0];
      iBox.replaceChildren(l0 ? G.chartInsight({ tone: 'amber', signal: l0.st.name + ' converts ' + F.pct(l0.conv, l0.conv < 10 ? 2 : 1) + ' (' + F.pct(l0.drop, 1) + ' drop-off).', impact: F.n(l0.gapUsers) + ' users below best-channel pace — about ' + money(l0.opp) + ' of revenue within reach.', cause: l0.worst + ' converts ' + F.pct(l0.worstR, l0.worstR < 10 ? 2 : 1) + ' vs ' + F.pct(l0.bench, 1) + ' at the top quartile.', action: l0.st.act(l0.worst), expected: '+' + money(l0.opp) + ' revenue if a quarter of the gap closes', conf: clamp(60 + r0(Math.min(30, l0.gapUsers / Math.max(1, a.tot[l0.from]) * 400)), 55, 90), metric: 'revenue',
        investigate: () => G.go(l0.st.go[0], l0.st.go[1]), simulate: () => G.go('forecast', { pick: 'conv-10' }), apply: () => G.applyInsight({ signal: l0.st.name + ' leak', action: l0.st.act(l0.worst), expected: '+' + money(l0.opp) + ' revenue', metric: 'revenue', kind: 'funnel' }) }) : null);
    };
    return s;
  };

  /* ======================= WHERE GROWTH COMES FROM ======================= */
  const CM = [['signups', 'Signups'], ['activated', 'Activated users'], ['customers', 'Customers'], ['revenue', 'Revenue']];
  const chTip = (c) => h('div', null, h('b', { text: c.name }), [['Spend', c.spend ? money(c.spend) : '—'], ['Clicks', F.c(c.clicks)], ['Signups', F.n(c.signups)], ['Activation', c.act != null ? F.pct(c.act, 1) : '—'], ['Customers', F.n(c.customers)], ['Revenue', money(c.revenue)], ['CAC', c.cac ? F.inrF(c.cac) : '—'], ['ROAS', c.roas ? F.x(c.roas) : '∞ (no spend)']].map(([k, v]) => h('div', { class: 'r' }, h('span', { text: k }), h('b', { text: v }))));
  G.chTip = chTip;
  SX.contribution = () => {
    const f = G.pf('contrib', { m: 'revenue' }), cBox = h('div', { class: 'g-chart' }), lBox = h('div', { class: 'g-gap8' }), insBox = h('div');
    const seg = h('span');
    const s = { el: G.card('Where Growth Comes From', 'Contribution by channel over time. Hover for the full channel economics; click to open it.', h('div', { class: 'g-gap16' }, h('div', { class: 'g-grid' }, h('div', { class: 's8', style: 'min-width:0' }, cBox), h('div', { class: 's4' }, lBox)), insBox), seg) };
    s.update = () => {
      const a = G.an(R()); seg.replaceChildren(G.seg(CM.map(([v, l]) => ({ v, l })), f.m, (v) => { f.m = v; s.update(); }));
      if (a.empty) { cBox.replaceChildren(noData()); lBox.replaceChildren(); return; }
      const m = f.m, top = a.ch.filter((c) => c[m] > 0).sort((p, q) => q[m] - p[m]), keys = top.slice(0, 8).map((c) => c.name), other = top.slice(8).map((c) => c.name);
      const series = {}; top.forEach((c) => (series[c.name] = G.anTS('channel', c.name, R())));
      const n = (series[top[0].name] || []).length, step = R() === '7d' ? 1 : R() === '30d' ? 6 : 10, B = [], idx = [];
      for (let i = 0; i < n; i += step) idx.push([i, Math.min(n, i + step)]);
      idx.forEach(([lo, hi]) => { const vals = {}; top.forEach((c) => { const v = sum((series[c.name] || []).slice(lo, hi), m); if (other.includes(c.name)) vals.Other = (vals.Other || 0) + v; else vals[c.name] = v; }); B.push({ label: d3.utcFormat('%b %-d')(series[top[0].name][lo].date), vals }); });
      const ks = keys.concat(other.length ? ['Other'] : []);
      CH.stack(cBox, { buckets: B, keys: ks.slice().reverse(), color: (k) => (k === 'Other' ? 'var(--g-line)' : G.chCol(k)), fmt: m === 'revenue' ? money : F.c, height: 270,
        tip: (k, b) => { const c = a.ch.find((x) => x.name === k); return c ? h('div', null, h('div', { class: 'xs muted', text: 'Period starting ' + b.label }), h('div', { class: 'r' }, h('span', { text: CM.find((x) => x[0] === m)[1] + ' in this period' }), h('b', { text: (m === 'revenue' ? money : F.n)(b.vals[k]) })), h('hr', { class: 'tsep' }), chTip(c)) : h('b', { text: k + ' — ' + (m === 'revenue' ? money : F.n)(b.vals[k]) }); }, onPick: (k) => (k === 'Other' ? G.go('channels') : goCh(k)) });
      const T = a.tot[m];
      lBox.replaceChildren(h('div', { class: 'xs muted', text: CM.find((x) => x[0] === m)[1] + ' share · ' + G.RL[R()].toLowerCase() }), ...top.slice(0, 8).map((c) => h('button', { class: 'g-src', type: 'button', onclick: () => goCh(c.name), onmousemove: (e) => G.tip.show(e, chTip(c)), onmouseleave: G.tip.hide },
        h('span', { class: 'n' }, h('i', { style: 'background:' + c.col }), c.name), h('span', { class: 'b' }, h('i', { style: `width:${c[m] / top[0][m] * 100}%;background:${c.col}` })), h('span', { class: 'v num', text: F.pct(c[m] / T * 100, 0) }))),
      other.length ? h('div', { class: 'xs muted', text: 'Other (' + other.length + '): ' + F.pct(sum(top.slice(8), m) / T * 100, 0) }) : null);
      const hero = top[0], eff = a.ch.filter((c) => c.roas).sort((p, q) => q.roas - p.roas)[0];
      insBox.replaceChildren(hero ? h('div', { class: 'g-ai' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'Radar insight'), h('p', { text: hero.name + ' contributes ' + F.pct(hero[m] / T * 100, 0) + ' of ' + CM.find((x) => x[0] === m)[1].toLowerCase() + (eff && eff.name !== hero.name ? ', while ' + eff.name + ' returns the most per rupee (' + F.x(eff.roas) + ').' : '.') + ' Contribution and efficiency together show where the next rupee should go.' }), h('div', { class: 'g-row g-mt8' }, G.btn('Where should the next ₹1 go?', () => G.go('channels'), 'sm'))) : null);
    };
    return s;
  };

  /* ======================= REVENUE CONTRIBUTION DONUT ======================= */
  SX.donut = () => {
    const f = G.pf('donut', { by: 'channel', sel: null }), dBox = h('div', { class: 'g-chart g-donut' }), det = h('div', { class: 'g-donut-d' });
    const seg = h('span');
    const s = { el: G.card('Revenue Contribution', 'Where the revenue comes from. Click a slice for its detail.', h('div', { class: 'g-donut-g' }, dBox, det), seg) };
    s.update = () => {
      const a = G.an(R()); seg.replaceChildren(G.seg([{ v: 'channel', l: 'Channel' }, { v: 'campaign', l: 'Campaign' }, { v: 'creator', l: 'Creator' }], f.by, (v) => { f.by = v; f.sel = null; s.update(); }));
      if (a.empty) { dBox.replaceChildren(noData()); det.replaceChildren(); return; }
      let items;
      if (f.by === 'channel') items = a.ch.filter((c) => c.revenue > 0).map((c) => ({ key: c.name, label: c.name, value: c.revenue, color: c.col, row: c }));
      else if (f.by === 'campaign') items = a.camps.filter((c) => c.revenue > 0).map((c, i) => ({ key: c.key, label: c.name.replace(/^Wispr Flow — /, ''), value: c.revenue, color: ['var(--g-em)', '#b8923f', '#b5654d', '#7d8f68', '#a77b9a', '#c4a27a', '#8e9490'][i % 7], row: c }));
      else { items = a.cr.filter((c) => c.revenue > 0).sort((p, q) => q.revenue - p.revenue).map((c, i) => ({ key: c.key, label: c.name, value: c.revenue, color: ['var(--g-em)', '#7fc6a4', '#a9c64a', '#b8923f', '#c4a27a', '#8e9490'][Math.min(i, 5)], row: c })); const rest = a.tot.revenue - sum(items, 'value'); if (rest > 0) items.push({ key: '__rest', label: 'Non-creator channels', value: rest, color: 'var(--g-line)', row: null }); }
      items.sort((p, q) => (p.key === '__rest') - (q.key === '__rest') || q.value - p.value);
      if (!items.some((i) => i.key === f.sel)) f.sel = (items.find((i) => i.row) || items[0] || {}).key;
      const sel = items.find((i) => i.key === f.sel), T = sum(items, 'value');
      CH.donut(dBox, items, { sel: f.sel, centerV: money(T), centerL: 'Revenue', height: 220, label: 'Revenue contribution by ' + f.by, onPick: (k) => { f.sel = k; s.update(); } });
      const r = sel && sel.row;
      det.replaceChildren(h('div', { class: 'g-eyebrow', text: f.by.toUpperCase() + ' DETAIL' }), h('b', { style: 'font-size:18px', text: sel ? sel.label : '—' }), h('div', { class: 'num', style: 'font-size:26px;font-weight:600;margin:2px 0', text: sel ? money(sel.value) : '—' }), h('div', { class: 'sm muted', text: sel ? F.pct(sel.value / T * 100, 0) + ' of total revenue' + (f.by === 'creator' ? ' (creators only: ' + money(sum(a.cr, 'revenue')) + ' of ' + money(a.tot.revenue) + ')' : '') : '' }),
        r ? h('div', { class: 'g-ev g-mt8' }, [['ROAS', r.roas ? F.x(r.roas) : r.roi ? F.x(r.roi) : '—'], ['Customers', F.n(r.customers)], ['CAC', r.cac ? F.inrF(r.cac) : '—'], ['Spend', r.spend ? money(r.spend) : '—']].map(([k, v]) => h('div', null, h('small', { text: k }), h('b', { text: v })))) : null,
        r ? h('div', { class: 'g-row g-mt8' }, G.btn(f.by === 'campaign' ? 'Open campaign' : f.by === 'creator' ? 'Open creator' : sel.label === 'Creators' ? 'Open creators' : 'Open channel', () => (f.by === 'campaign' ? G.go('campaigns', { open: sel.key }) : f.by === 'creator' ? G.go('creators', { open: sel.key }) : goCh(sel.key)), 'sm pri')) : null);
    };
    return s;
  };

  /* ======================= SPEND VS REVENUE ======================= */
  G.spendRevVerdicts = (a) => {
    const paid = a.ch.filter((c) => c.spend > 0), ts = sum(paid, 'spend'), tr = sum(paid, 'revenue'), blend = tr / (ts || 1);
    return paid.map((c) => {
      const sp = c.spend / ts, rv = c.revenue / (tr || 1);
      const v = c.roas < blend * 0.75 && sp >= 0.06 ? 'hs' : c.roas >= blend * 1.5 && rv >= sp * 1.4 ? 'ls' : null;
      return { c, sp, rv, v, blend };
    });
  };
  SX.spendRev = () => {
    const body = h('div'), insBox = h('div');
    const s = { el: G.card('Spend vs Revenue', 'Where the money goes against where the revenue comes from.', h('div', { class: 'g-gap16' }, body, insBox)) };
    s.update = () => {
      const a = G.an(R()); if (a.empty) { body.replaceChildren(noData()); insBox.replaceChildren(); return; }
      const V = G.spendRevVerdicts(a).sort((p, q) => q.c.revenue - p.c.revenue), mx = Math.max(...V.map((x) => Math.max(x.c.spend, x.c.revenue))) || 1, blend = V[0] ? V[0].blend : 0;
      body.replaceChildren(h('div', { class: 'g-sr' }, h('div', { class: 'g-sr-r hd' }, h('span', { text: 'Channel' }), h('span', { text: 'Spend  ·  Revenue' }), h('span', { class: 'r', text: 'ROAS' }), h('span')),
        V.map((x) => h('button', { class: 'g-sr-r', type: 'button', onclick: () => goCh(x.c.name), onmousemove: (e) => G.tip.show(e, chTip(x.c)), onmouseleave: G.tip.hide },
          h('span', { class: 'n' }, h('i', { style: 'background:' + x.c.col }), x.c.name),
          h('span', { class: 'bars' }, h('span', { class: 'bsp' }, h('i', { style: `width:${x.c.spend / mx * 100}%` })), h('span', { class: 'brv' }, h('i', { style: `width:${x.c.revenue / mx * 100}%;background:${x.c.roas >= blend ? 'var(--g-em)' : 'var(--g-amber)'}` }))),
          h('span', { class: 'v num r', text: F.x(x.c.roas) }), x.v === 'hs' ? G.badge('High spend · low return', 'red') : x.v === 'ls' ? G.badge('Low spend · high return', 'green') : h('span')))),
      h('div', { class: 'g-legend g-mt8' }, h('span', null, h('i', { style: 'background:var(--g-ink-3)' }), 'Spend'), h('span', null, h('i', { style: 'background:var(--g-em)' }), 'Revenue (ROAS above blended ' + F.x(blend) + ')'), h('span', null, h('i', { style: 'background:var(--g-amber)' }), 'Revenue (ROAS below blended)')));
      const hs = V.filter((x) => x.v === 'hs').sort((p, q) => q.sp - p.sp)[0], ls = V.filter((x) => x.v === 'ls').sort((p, q) => q.c.roas - p.c.roas)[0];
      if (hs && ls) {
        const amt = Math.max(5000, r0(Math.min(hs.c.spend * 0.25, 60000) / 5000) * 5000), sim = G.sim([{ frm: hs.c.name, to: ls.c.name, amount: amt }]), dr = sim.next.revenue - sim.base.revenue, dc = sim.next.customers - sim.base.customers;
        const mv = R() === '30d' ? 1 : (R() === '7d' ? 7 / 30 : 3);
        insBox.replaceChildren(G.chartInsight({ tone: 'amber', signal: hs.c.name + ' takes ' + F.pct(hs.sp * 100, 0) + ' of spend and returns ' + F.pct(hs.rv * 100, 0) + ' of revenue (' + F.x(hs.c.roas) + ' ROAS).', impact: ls.c.name + ' returns ' + F.x(ls.c.roas) + ' on ' + F.pct(ls.sp * 100, 0) + ' of spend, so each rupee is working harder there.', cause: 'Spend has not followed returns: the mix is set by history, not by ROAS.', action: 'Move ' + F.inrF(amt) + ' a month from ' + hs.c.name + ' to ' + ls.c.name + '.', expected: '+' + money(dr) + ' revenue and +' + r0(dc) + ' customers a month', conf: 82, amount: amt, metric: 'revenue',
          investigate: () => G.go('channels'), simulate: () => G.simModal({ frm: hs.c.name, moves: [{ to: ls.c.name, amount: amt }], title: 'Simulate: move budget ' + hs.c.name + ' → ' + ls.c.name }), apply: () => G.applyInsight({ signal: hs.c.name + ' high spend, low return', action: 'Move ' + F.inrF(amt) + ' a month from ' + hs.c.name + ' to ' + ls.c.name, expected: '+' + money(dr) + ' revenue, +' + r0(dc) + ' customers a month', metric: 'revenue', amount: amt, kind: 'budget' }) }));
      } else insBox.replaceChildren();
    };
    return s;
  };

  /* ======================= CHANNEL EFFICIENCY MATRIX ======================= */
  G.matrixCells = (a) => {
    const paid = a.ch.filter((c) => c.spend > 0 && c.cac), blendCac = a.tot.cac, tr = sum(paid, 'revenue'), hiRev = (c) => c.revenue / (tr || 1) >= 1 / Math.max(4, paid.length) * 0.9;
    const cells = { tl: { title: 'SCALE', sub: 'High revenue · low CAC', items: [] }, tr: { title: 'OPTIMIZE', sub: 'High revenue · high CAC', items: [] }, bl: { title: 'TEST', sub: 'Low revenue · low CAC', items: [] }, br: { title: 'REDUCE', sub: 'Low revenue · high CAC', items: [] } };
    const verdict = {};
    paid.forEach((c) => { const hi = hiRev(c), lo = c.cac <= blendCac, k = (hi ? 't' : 'b') + (lo ? 'l' : 'r'); cells[k].items.push({ key: c.name, label: c.name, color: c.col, tip: h('div', null, h('b', { text: c.name }), h('div', { class: 'r' }, h('span', { text: 'Revenue' }), h('b', { text: money(c.revenue) })), h('div', { class: 'r' }, h('span', { text: 'CAC' }), h('b', { text: F.inrF(c.cac) + ' vs ' + F.inrF(blendCac) })))}); verdict[c.name] = cells[k].title; });
    return { cells, verdict, blendCac, organic: a.ch.find((c) => c.spend === 0 && c.revenue > 0) };
  };
  SX.matrix = () => {
    const body = h('div'), insBox = h('div');
    const s = { el: G.card('Channel Efficiency Matrix', 'Channels placed by revenue and by cost to win a customer. Verdicts feed GTM Radar.', h('div', { class: 'g-gap16' }, body, insBox)) };
    s.update = () => {
      const a = G.an(R()); if (a.empty) { body.replaceChildren(noData()); insBox.replaceChildren(); return; }
      const M = G.matrixCells(a);
      body.replaceChildren(CH.matrix(M.cells, { onPick: (k) => goCh(k) }), h('div', { class: 'xs muted g-mt8', text: 'Low CAC = at or below the blended ' + F.inrF(M.blendCac) + '. High revenue = at least an even share of paid revenue.' + (M.organic ? ' Organic (' + money(M.organic.revenue) + ', no spend) is not shown — protect it.' : '') }));
      const sc = M.cells.tl.items[0], rd = M.cells.br.items[0] || M.cells.tr.items[0];
      if (sc && rd) {
        const ch = (n) => a.ch.find((c) => c.name === n), amt = 60000, sim = G.sim([{ frm: rd.key, to: sc.key, amount: Math.min(amt, ch(rd.key).spend) }]), dr = sim.next.revenue - sim.base.revenue, dc = sim.next.customers - sim.base.customers;
        insBox.replaceChildren(G.chartInsight({ tone: '', signal: sc.key + ' is in SCALE; ' + rd.key + ' is in ' + (M.cells.br.items[0] ? 'REDUCE' : 'OPTIMIZE') + '.', impact: sc.key + ' wins customers at ' + F.inrF(ch(sc.key).cac) + ' vs ' + F.inrF(ch(rd.key).cac) + ' on ' + rd.key + '.', cause: 'Budget is split by habit, not by cost per customer.', action: 'Move ' + F.inrF(Math.min(amt, ch(rd.key).spend)) + ' a month from ' + rd.key + ' to ' + sc.key + '.', expected: '+' + r0(dc) + ' customers and +' + money(dr) + ' revenue a month', conf: 80, metric: 'customers',
          investigate: () => G.go('channels'), simulate: () => G.simModal({ frm: rd.key, moves: [{ to: sc.key, amount: Math.min(amt, ch(rd.key).spend) }], title: 'Simulate: ' + rd.key + ' → ' + sc.key }), apply: () => G.applyInsight({ signal: 'Efficiency matrix: ' + sc.key + ' SCALE, ' + rd.key + ' ' + (M.cells.br.items[0] ? 'REDUCE' : 'OPTIMIZE'), action: 'Move ' + F.inrF(Math.min(amt, ch(rd.key).spend)) + ' a month from ' + rd.key + ' to ' + sc.key, expected: '+' + r0(dc) + ' customers, +' + money(dr) + ' revenue a month', metric: 'customers', amount: Math.min(amt, ch(rd.key).spend), kind: 'budget' }) }));
      } else insBox.replaceChildren();
    };
    return s;
  };

  /* ======================= WHAT DROVE GROWTH (waterfall) ======================= */
  G.growthDrivers = (Rg) => {
    const a = G.an(Rg); if (a.empty || a.prev.revenue == null) return null;
    const rows = a.ch.map((c) => ({ c, d: c.revenue - (c.prevRev || 0) })).sort((p, q) => q.d - p.d);
    const pos = rows.filter((x) => x.d > 0).slice(0, 3), neg = rows.filter((x) => x.d < 0).slice(-2).reverse();
    const shown = new Set(pos.concat(neg).map((x) => x.c.name)), restD = sum(rows.filter((x) => !shown.has(x.c.name)), 'd');
    const steps = [{ key: '__start', label: 'Previous period', value: a.prev.revenue, kind: 'start' }];
    pos.forEach((x) => steps.push({ key: x.c.name, label: x.c.name + ' growth', value: x.d, kind: 'delta', row: x.c }));
    neg.forEach((x) => steps.push({ key: x.c.name, label: x.c.name + ' decline', value: x.d, kind: 'delta', row: x.c }));
    if (Math.abs(restD) > a.tot.revenue * 0.002) steps.push({ key: '__rest', label: 'Other channels', value: restD, kind: 'delta' });
    steps.push({ key: '__end', label: 'This period', value: a.tot.revenue, kind: 'end' });
    return { steps, a };
  };
  SX.drivers = () => {
    const body = h('div', { class: 'g-chart' }), insBox = h('div');
    const s = { el: G.card('What Drove Growth?', 'Why revenue changed versus the previous period, by channel. The bars add up exactly.', h('div', { class: 'g-gap16' }, body, insBox)) };
    s.update = () => {
      const g = G.growthDrivers(R()); if (!g) { body.replaceChildren(noData()); insBox.replaceChildren(); return; }
      const { steps, a } = g;
      CH.waterfall(body, steps, { fmt: money, height: 270,
        tip: (b) => h('div', null, h('b', { text: b.label }), h('div', { class: 'r' }, h('span', { text: b.kind === 'delta' ? 'Change in revenue' : 'Revenue' }), h('b', { text: (b.kind === 'delta' ? sgn(b.value) : '') + money(Math.abs(b.value)) })), b.row ? h('div', { class: 'xs muted', text: 'Click for the evidence' }) : null),
        onPick: (b) => {
          if (!b.row) return;
          const c = b.row, prev = c.prevRev || 0;
          G.drawer({ title: c.name + ' · ' + (b.value >= 0 ? 'growth' : 'decline'), sub: 'Revenue ' + money(prev) + ' → ' + money(c.revenue) + ' (' + sgn(b.value) + money(Math.abs(b.value)) + ')', body: h('div', { class: 'g-gap16' },
            h('div', { class: 'g-ev' }, [['Revenue', money(c.revenue)], ['Signups', F.n(c.signups) + ' (' + F.d(c.d_signups || 0) + ')'], ['ROAS', c.roas ? F.x(c.roas) + ' (' + F.d(c.d_roas || 0) + ')' : '—'], ['CAC', c.cac ? F.inrF(c.cac) + ' (' + F.d(c.d_cac || 0) + ')' : '—']].map(([k, v]) => h('div', null, h('small', { text: k }), h('b', { text: v })))),
            h('p', { class: 'sm', text: 'Previous-period revenue by channel is estimated from each channel’s own signup and ROAS change, scaled to the reported previous total of ' + money(a.prev.revenue) + '.' })),
          footer: (close) => [G.btn(c.name === 'Creators' ? 'Open creators' : 'Open channel', () => { close(); goCh(c.name); }, 'pri')] });
        } });
      const worst = steps.filter((x) => x.kind === 'delta' && x.value < 0)[0] || null, best = steps.filter((x) => x.kind === 'delta' && x.value > 0)[0] || null;
      if (worst && best && worst.row && best.row) {
        const amt = Math.min(60000, r0(worst.row.spend * 0.25 / 5000) * 5000) || 5000, sim = G.sim([{ frm: worst.row.name, to: best.row.name, amount: amt }]), dr = sim.next.revenue - sim.base.revenue;
        insBox.replaceChildren(G.chartInsight({ tone: 'amber', signal: worst.row.name + ' revenue ' + sgn(worst.value) + money(Math.abs(worst.value)) + ' vs previous period.', impact: best.row.name + ' added ' + money(best.value) + ', which more than offset it' + (best.value + worst.value > 0 ? '' : ' only in part') + '.', cause: worst.row.name + ' ROAS ' + F.d(worst.row.d_roas || 0) + ' and signups ' + F.d(worst.row.d_signups || 0) + '.', action: 'Move ' + F.inrF(amt) + ' a month from ' + worst.row.name + ' to ' + best.row.name + '.', expected: '+' + money(dr) + ' revenue a month', conf: 78, metric: 'revenue',
          investigate: () => goCh(worst.row.name), simulate: () => G.simModal({ frm: worst.row.name, moves: [{ to: best.row.name, amount: amt }], title: 'Simulate: ' + worst.row.name + ' → ' + best.row.name }), apply: () => G.applyInsight({ signal: worst.row.name + ' revenue decline', action: 'Move ' + F.inrF(amt) + ' a month from ' + worst.row.name + ' to ' + best.row.name, expected: '+' + money(dr) + ' revenue a month', metric: 'revenue', amount: amt, kind: 'budget' }) }));
      } else insBox.replaceChildren();
    };
    return s;
  };
})();
