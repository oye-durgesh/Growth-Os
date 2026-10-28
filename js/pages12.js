(function () {
  'use strict';
  /* Command-center layer 2: shared analytics model adapters, KPI strip with sparklines and 4-level status,
     the 5-card Growth Brief, funnel stage drill-down + largest leak, channel contribution summary,
     channel performance matrix, campaign charts, Growth Opportunity Matrix, unit economics, growth quality
     (cohorts), decision logging with owner / follow-up, and more Ask answers. Reads only G.an(R). */
  const G = window.G, h = G.h, S = G.S, F = G.F, SX = G.sx, CH = G.ch, sum = G.sum, div = G.div, clamp = G.clamp, r0 = Math.round;
  const money = (v) => F.inr(v), R = () => S.range, dayN = () => G.RN[R()];
  const noData = () => G.empty('◌', 'Not enough data to calculate this.', 'Connect a data source or turn on Demo Data and this view fills in.');
  const live = (s) => { s.update(); requestAnimationFrame(() => { if (s.el.isConnected) s.update(); }); return s; };
  const isDemo = () => G.WS.mode() === 'demo';
  const iso = (d) => d.toISOString().slice(0, 10);
  const plural = (n, w) => F.n(n) + ' ' + w + (n === 1 ? '' : 's');

  /* ======================= SHARED ANALYTICS MODEL (typed adapters over G.an) ======================= */
  G.model = {
    funnel: (Rg) => G.an(Rg || R()).funnel.map((f) => ({ id: f.key, name: f.label, volume: f.value, conversionRate: f.conv, dropOffRate: f.drop, previousVolume: f.prev })),
    channels: (Rg) => G.an(Rg || R()).ch.map((c) => ({ channelId: c.id || c.name, channel: c.name, spend: c.spend, impressions: c.impr, clicks: c.clicks, leads: c.leads, customers: c.customers, revenue: c.revenue, cac: c.cac, roas: c.roas, conversionRate: div(c.customers, c.visitors) * 100 })),
    campaigns: (Rg) => G.an(Rg || R()).camps.map((c) => ({ campaignId: c.key, campaign: c.name, channel: c.channel, spend: c.spend, leads: c.leads, customers: c.customers, revenue: c.revenue, cac: c.cac, roas: c.roas, conversionRate: div(c.customers, c.clicks) * 100 })),
    dimension: (k, Rg) => { const a = G.an(Rg || R()), tot = a.tot[k] || 1; return a.ch.filter((c) => c[k] > 0).map((c) => ({ id: c.name, name: c.name, value: c[k], percentage: c[k] / tot * 100, change: k === 'signups' ? c.d_signups : k === 'revenue' && c.prevRev ? (c.revenue / c.prevRev - 1) * 100 : null })); },
    /* MetricPoint[] for one metric over the active range (previousValue is shape-matched; target is flat) */
    series: (metric, Rg) => {
      Rg = Rg || R(); const a = G.an(Rg), rows = G.anTS('all', null, Rg); if (a.empty || !rows.length) return [];
      const N = G.RN[Rg], T = G.targets(), win = G.winFor(Rg), add = { revenue: 1, customers: 1, signups: 1, activated: 1, leads: 1 };
      let pts;
      if (add[metric]) { const sg = sum(rows, 'signups') || 1; pts = rows.map((r) => [r.date, metric === 'leads' ? a.tot.leads * r.signups / sg : r[metric]]); }
      else if (metric === 'conversion') pts = rows.map((r, i) => { const w = rows.slice(Math.max(0, i - win + 1), i + 1); return [r.date, div(sum(w, 'customers'), sum(w, 'visitors')) * 100]; });
      else pts = G.metricSeries(rows, metric === 'activation' ? 'act' : metric, win);
      const tot = sum(pts, (d) => d[1]), prevTot = add[metric] ? (metric === 'leads' ? a.prev.leads : a.prev[metric]) : null, k = add[metric] && prevTot && tot ? prevTot / tot : null;
      const tgt = metric === 'revenue' ? T.revenue * N / 30 / N : metric === 'signups' ? T.signups * N / 30 / N : metric === 'cac' ? T.cac : null;
      return pts.map((d) => ({ date: iso(d[0]), value: d[1], target: tgt == null ? undefined : tgt, previousValue: k ? d[1] * k : undefined }));
    },
  };

  /* ======================= KPI STRIP v2: sparkline, target, attainment, 4-level status ======================= */
  const spark = (pts, color, fm) => {
    const W = 160, H = 46, v = pts.filter((d) => d.value != null && isFinite(d.value)); if (v.length < 3) return h('div', { style: 'height:30px' });
    const vals = v.map((d) => d.value), x = d3.scaleLinear([0, v.length - 1], [3, W - 3]), mn = d3.min(vals), mx = d3.max(vals), y = d3.scaleLinear([mn, mx === mn ? mn + 1 : mx], [H - 6, 8]);
    const dt = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('Sept', 'Sep');
    const iMin = vals.indexOf(mn), iMax = vals.indexOf(mx), last = v.length - 1, col = color || 'var(--g-em)';
    const wrap = h('div', { class: 'g-sp' }), svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H).attr('preserveAspectRatio', 'none').attr('aria-hidden', 'true');
    svg.append('path').attr('d', d3.line().x((d, i) => x(i)).y((d) => y(d.value))(v)).style('fill', 'none').style('stroke', col).attr('stroke-width', 1.6).attr('stroke-linejoin', 'round').attr('vector-effect', 'non-scaling-stroke');
    const cur = svg.append('circle').attr('r', 2.6).style('fill', col).attr('cx', x(last)).attr('cy', y(vals[last])), hov = svg.append('line').attr('y1', 0).attr('y2', H).style('stroke', 'var(--g-ink-3)').style('opacity', 0);
    const svgN = svg.node(); wrap.append(svgN);
    wrap.append(h('div', { class: 'g-sp-l xs' }, h('span', null, dt(v[0].date) + ' ', h('b', { class: 'num', text: fm(vals[0]) })), h('span', null, dt(v[last].date) + ' ', h('b', { class: 'num', text: fm(vals[last]) }))), h('div', { class: 'g-sp-l xs' }, h('span', null, 'Low ', h('b', { class: 'num', text: fm(mn) })), h('span', null, 'High ', h('b', { class: 'num', text: fm(mx) }))));
    svgN.addEventListener('mousemove', (e) => { const r = svgN.getBoundingClientRect(), i = clamp(Math.round((e.clientX - r.left) / r.width * (W - 6) / (W - 6) * last), 0, last); hov.attr('x1', x(i)).attr('x2', x(i)).style('opacity', 1); cur.attr('cx', x(i)).attr('cy', y(vals[i])); G.tip.show(e, h('div', null, h('b', { text: dt(v[i].date) }), h('div', { class: 'r' }, h('span', { text: 'Value' }), h('b', { text: fm(vals[i]) })))); });
    svgN.addEventListener('mouseleave', () => { hov.style('opacity', 0); cur.attr('cx', x(last)).attr('cy', y(vals[last])); G.tip.hide(); });
    return wrap;
  };
  const FM = { revenue: money, customers: (v) => F.n(Math.round(v)), leads: (v) => F.n(Math.round(v)), activation: (v) => F.pct(v, 1), cac: F.inrF, roas: F.x, conversion: (v) => F.pct(v, 2) };
  const LV = { Healthy: 'green', Watch: 'amber', 'Needs attention': 'amber', Critical: 'red' };
  G.kpiStatus = (Rg) => {
    const a = G.an(Rg); if (a.empty) return [];
    const N = G.RN[Rg], T = G.targets(), revT = T.revenue * N / 30, ratio = revT / (a.tot.revenue || 1), ps = G.pipelineStats(), K = a.kp;
    const pk = {}; (G.rows('pipeline_kpis') || []).forEach((k) => (pk[k.metric] = k));
    const act = div(a.tot.activated, a.tot.signups) * 100, pAct = a.prev.signups ? div(a.prev.activated, a.prev.signups) * 100 : null;
    const cv = div(a.tot.customers, a.tot.visitors) * 100, pCv = a.prev.visitors ? div(a.prev.customers, a.prev.visitors) * 100 : null;
    const rel = (x, y) => (x != null && y ? (x / y - 1) * 100 : null), sp = (m) => G.model.series(m, Rg);
    const o = [
      { key: 'revenue', label: 'Revenue', value: money(a.tot.revenue), delta: K.revenue && K.revenue.delta, good: true, pct: a.tot.revenue / revT * 100, tgt: money(revT), trend: 'revenue', spark: sp('revenue'), calc: 'Sum of revenue across all channels in the period.', rec: a.ch.length + ' channel rows' },
      { key: 'customers', label: 'New customers', value: F.n(a.tot.customers), delta: K.customers && K.customers.delta, good: true, tgt: F.n(r0(a.tot.customers * ratio)) + ' (implied)', implied: r0(100 / ratio), trend: 'customers', spark: sp('customers'), calc: 'Customers acquired in the period. The target is implied by the revenue target at today’s revenue per customer.', rec: a.tot.customers },
      { key: 'leads', label: 'Qualified leads', value: F.n(a.tot.leads), delta: K.leads && K.leads.delta, good: true, tgt: F.n(r0(a.tot.leads * ratio)) + ' (implied)', implied: r0(100 / ratio), trend: 'leads', spark: sp('leads'), calc: 'Activated users judged sales-qualified. The target is implied by the revenue target.', rec: a.tot.leads },
      { key: 'activation', label: 'Activation', value: F.pct(act, 1), delta: rel(act, pAct), good: true, tgt: null, trend: 'activation', spark: sp('activation'), calc: 'Activated users ÷ signups.', rec: a.tot.signups },
      { key: 'cac', label: 'CAC', value: F.inrF(a.tot.cac), delta: K.cac && K.cac.delta, good: false, pct: T.cac / a.tot.cac * 100, tgt: F.inrF(T.cac), trend: 'cac', spark: sp('cac'), calc: 'Total spend ÷ customers.', rec: a.tot.customers },
      { key: 'roas', label: 'ROAS', value: F.x(a.tot.roas), delta: K.roas && K.roas.delta, good: true, tgt: F.x(revT / (a.tot.spend || 1)) + ' (implied)', implied: r0(a.tot.revenue / revT * 100), trend: 'roas', spark: sp('roas'), calc: 'Revenue ÷ spend. The target is the return needed to hit the revenue target at current spend.', rec: a.tot.customers },
      { key: 'conversion', label: 'Conversion rate', value: F.pct(cv, 2), delta: rel(cv, pCv), good: true, tgt: null, spark: sp('conversion'), calc: 'Customers ÷ landing visits.', rec: a.tot.visitors },
      { key: 'pipeline', label: 'Pipeline', value: money(ps.value), delta: pk.pipeline && pk.pipeline.delta, good: true, tgt: null, sub: ps.open.length + ' open deals', spark: [], calc: 'Value of open deals (not won or lost).', rec: ps.deals.length + ' deals' },
    ];
    o.forEach((k) => {
      const d = k.delta == null ? null : (k.good ? k.delta : -k.delta);
      k.status = k.pct != null ? (k.pct >= 95 ? 'Healthy' : k.pct >= 80 ? 'Watch' : k.pct >= 60 ? 'Needs attention' : 'Critical') : d == null ? 'Healthy' : d >= 0 ? 'Healthy' : d > -5 ? 'Watch' : d > -12 ? 'Needs attention' : 'Critical';
      k.vs = k.pct != null ? (k.key === 'cac' ? (a.tot.cac <= T.cac ? r0((1 - a.tot.cac / T.cac) * 100) + '% below target' : r0((a.tot.cac / T.cac - 1) * 100) + '% above target') : r0(k.pct) + '% of target') : k.implied != null ? r0(k.implied) + '% of implied target' : 'No target set';
    });
    return o;
  };
  SX.status = () => {
    const box = h('div', { class: 'g-st g-st4' }), s = { el: h('div', null, box) };
    s.update = () => {
      const ks = G.kpiStatus(R()), tone = (st) => ({ Healthy: 'ok', Watch: 'wa', 'Needs attention': 'wa', Critical: 'bd' }[st]);
      box.replaceChildren(...(ks.length ? ks.map((k) => h('div', { class: 'g-st-c ' + tone(k.status), role: 'button', tabindex: '0', 'aria-label': k.label + ' ' + k.value + ', ' + k.status,
        onclick: () => (k.trend ? G.trendFocus(k.trend) : G.viewData({ title: k.label, value: k.value, calc: k.calc, records: k.rec })), onkeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); } },
      h('div', { class: 'g-st-t' }, h('small', { text: k.label }), G.badge(k.status, LV[k.status])),
      h('b', { class: 'num g-st-v', text: k.value }),
      h('div', { class: 'g-row', style: 'gap:6px;flex-wrap:nowrap' }, k.delta != null ? G.dl(k.delta, k.good) : h('span', { class: 'xs muted', text: '—' }), h('span', { class: 'xs muted', text: 'vs previous' })),
      h('div', { class: 'xs g-st-g' }, k.tgt ? 'Target ' + k.tgt + ' · ' + k.vs : k.sub ? k.sub + ' · ' + k.vs : k.vs),
      k.pct != null ? G.pbar(clamp(k.pct, 0, 100), k.status === 'Healthy' ? '' : k.status === 'Critical' ? 'red' : 'amber') : h('div', { style: 'height:6px' }),
      k.spark.length ? spark(k.spark, k.status === 'Critical' ? 'var(--g-red)' : k.status === 'Healthy' ? 'var(--g-em)' : 'var(--g-amber)', FM[k.key] || F.n) : h('div', { class: 'xs muted', style: 'height:30px', text: 'No daily history' }),
      h('button', { class: 'g-vd-b', type: 'button', onclick: (e) => { e.stopPropagation(); G.viewData({ title: k.label, value: k.value, calc: k.calc + (k.tgt ? ' Target: ' + k.tgt + '.' : ''), records: k.rec }); } }, 'View data'))) : [noData()]));
    };
    return s;
  };

  /* ======================= TODAY'S GROWTH BRIEF (5 cards) ======================= */
  const netNew = (a) => { const rows = a.ch.filter((c) => c.signups > 0).map((c) => ({ c, nn: c.signups - c.signups / (1 + (c.d_signups || 0) / 100) })).sort((p, q) => q.nn - p.nn), tot = sum(rows, (r) => Math.max(0, r.nn)); return { rows, tot }; };
  G.brief = (Rg) => {
    const a = G.an(Rg); if (a.empty) return null;
    const nn = netNew(a), top = nn.rows[0], ops = G.opportunities(Rg), rk = G.risks(Rg), shift = ops.find((o) => o.id === 'o-shift') || ops[1] || ops[0], opp = ops.find((o) => o !== shift) || ops[0];
    const act = rk.find((r) => r.id === 'r-act') && a.kp.signups && a.kp.signups.delta > 0 ? rk.find((r) => r.id === 'r-act') : null, risk = act || rk[0];
    return { a, driver: top && nn.tot > 0 && top.nn > 0 ? { title: top.c.name + ' generated ' + r0(top.nn / nn.tot * 100) + '% of net-new signups.', sub: '+' + F.n(r0(top.nn)) + ' signups, ' + F.d(top.c.d_signups) + ' vs previous period.', rows: nn.rows.slice(0, 6) } : null, risk, opp, shift };
  };
  const driverDrawer = (b) => G.drawer({ title: 'Biggest growth driver', sub: b.driver.title, body: h('div', { class: 'g-gap16' },
    h('div', { class: 'g-tw' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Channel', 'Signups', 'Net new', 'Change'].map((t, i) => h('th', { class: i ? 'r' : '', text: t })))), h('tbody', null, b.driver.rows.map((r) => h('tr', { style: 'cursor:pointer', onclick: () => (r.c.name === 'Creators' ? G.go('creators') : G.go('channels')) }, h('td', null, h('span', { class: 'g-dotc', style: 'background:' + r.c.col }), r.c.name), h('td', { class: 'r num', text: F.n(r.c.signups) }), h('td', { class: 'r num', text: (r.nn >= 0 ? '+' : '−') + F.n(Math.abs(r0(r.nn))) }), h('td', { class: 'r' }, G.dl(r.c.d_signups, true))))))),
    h('p', { class: 'sm muted', style: 'margin:0', text: 'Net new = signups this period minus the same channel’s previous period.' }), h('div', { class: 'g-row' }, G.btn('Open channels', () => G.go('channels'), 'sm'), G.btn('See the funnel diagnostics', () => { G.go('home'); }, 'sm'))) });
  SX.brief = () => {
    const box = h('div', { class: 'g-br' }), s = { el: box };
    s.update = () => {
      const b = G.brief(R()); if (!b) { box.replaceChildren(noData()); return; }
      const card = (eyebrow, tone, title, sub, onclick, extra) => h('div', { class: 'g-br-c ' + tone, role: 'button', tabindex: '0', onclick, onkeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); } }, h('div', { class: 'g-eyebrow', text: eyebrow }), h('b', { class: 'g-br-t', text: title }), h('div', { class: 'sm muted', text: sub }), extra || null, h('span', { class: 'g-br-l', text: 'See the evidence →' }));
      const cards = [];
      cards.push(b.driver ? card('BIGGEST GROWTH DRIVER', 'ok', b.driver.title, b.driver.sub, () => driverDrawer(b)) : card('BIGGEST GROWTH DRIVER', 'ok', 'Not enough history to name a driver yet.', 'Needs a previous period to compare.', () => G.go('channels')));
      cards.push(b.risk ? card('BIGGEST RISK', 'rk', b.risk.title, b.risk.evidence, () => G.riskDrawer(b.risk)) : card('BIGGEST RISK', 'ok', 'No material risk detected.', 'Every monitored metric is within range.', () => G.go('radar')));
      cards.push(b.opp ? card('BIGGEST OPPORTUNITY', 'op', b.opp.title, b.opp.evidence, () => G.whyThis(b.opp)) : card('BIGGEST OPPORTUNITY', 'op', 'No opportunity found yet.', 'More data sharpens this.', () => G.go('radar')));
      cards.push(b.shift ? card('RECOMMENDED ACTION', 'ac', b.shift.action + '.', b.shift.evidence, () => G.whyThis(b.shift), h('div', { class: 'g-row g-mt8' }, G.btn('Apply', (e) => { e && e.stopPropagation(); G.applyInsight({ signal: b.shift.title, action: b.shift.action, expected: b.shift.impactTxt, metric: b.shift.metric || 'revenue', kind: 'budget' }); }, 'sm pri'), G.btn('Log decision', (e) => { e && e.stopPropagation(); G.logDecisionModal({ title: b.shift.action, reason: b.shift.evidence, evidence: b.shift.evidence, expected: b.shift.impactTxt, metric: b.shift.metric }); }, 'sm'))) : card('RECOMMENDED ACTION', 'ac', 'Hold the current mix.', 'Nothing clears the bar to act on.', () => G.go('radar')));
      cards.push(b.shift ? card('EXPECTED IMPACT', 'ex', 'Projected ' + b.shift.impactTxt.replace(/ revenue$/, '') + ' over the next 30 days.', 'Estimated from your own channel returns, with a discount for diminishing returns.', () => G.whyThis(b.shift)) : card('EXPECTED IMPACT', 'ex', 'No projection yet.', 'Acting on a recommendation creates one.', () => G.go('forecast')));
      box.replaceChildren(...cards);
    };
    return s;
  };

  /* ======================= FUNNEL: stage drill-down + largest leak ======================= */
  const CAMP_RATE = { clicks: (c) => div(c.clicks, c.impressions || c.impr) * 100, signups: (c) => div(c.signups, c.clicks) * 100, activated: (c) => c.activation, leads: (c) => div(c.leads, div(c.signups * c.activation, 100)) * 100, customers: (c) => div(c.customers, c.leads) * 100 };
  const SER_KEY = { clicks: 'ctr', signups: 'srate', activated: 'act' };
  G.stageDeep = (k, lk) => {
    const a = G.an(R()), label = { clicks: 'Click-through', visitors: 'Landing visit rate', signups: 'Signup rate', activated: 'Activation rate', leads: 'Qualified-lead rate', customers: 'Customer rate' }[k]; if (!label) return null;
    const fm = (v) => F.pct(v, v < 10 ? 2 : 1), rf = CAMP_RATE[k], box = h('div', { class: 'g-chart', style: 'min-height:90px' });
    const cs = rf ? a.camps.filter((c) => c.spend > 0 || c.clicks > 0).map((c) => ({ c, r: rf(c) })).filter((x) => x.r != null && isFinite(x.r)).sort((p, q) => q.r - p.r) : [];
    const cur = a.funnel.find((f) => f.key === k), blended = cur && cur.conv;
    const causes = [];
    if (lk) causes.push(lk.worst + ' converts ' + fm(lk.worstR) + ' vs ' + fm(lk.bench) + ' at your best channels.');
    if (cs.length > 1) causes.push(cs[cs.length - 1].c.name.replace(/^Wispr Flow — /, '') + ' is the weakest campaign here at ' + fm(cs[cs.length - 1].r) + '.');
    if (cur && cur.prevConv && cur.conv < cur.prevConv) causes.push('The rate slipped from ' + fm(cur.prevConv) + ' to ' + fm(cur.conv) + ' versus the previous period.');
    if (!causes.length) causes.push('No single cause stands out; conversion is even across channels and campaigns.');
    const node = h('div', { class: 'g-gap16' },
      h('div', { class: 'g-grid' },
        h('div', { class: 's4' }, h('div', { class: 'g-sig-k', text: label }), h('div', { class: 'g-row', style: 'align-items:baseline;gap:10px' }, h('b', { class: 'num', style: 'font-size:28px', text: blended != null ? fm(blended) : '—' }), cur && cur.prevConv ? G.dl((cur.conv / cur.prevConv - 1) * 100, true) : null), h('div', { class: 'xs muted', text: 'vs previous period' })),
        h('div', { class: 's8' }, h('div', { class: 'g-sig-k', text: 'Trend' }), SER_KEY[k] ? box : h('div', { class: 'sm muted', style: 'padding:8px 0', text: 'This rate is not tracked daily, so there is no trend line.' }))),
      h('div', { class: 'g-grid' },
        h('div', { class: 's6' }, h('div', { class: 'g-sig-k', text: 'By campaign' }), cs.length ? h('div', { class: 'g-gap8 g-mt8' }, cs.slice(0, 2).concat(cs.length > 4 ? cs.slice(-2) : cs.slice(2)).map((x) => h('button', { class: 'g-al', type: 'button', onclick: () => G.go('campaigns', { open: x.c.key }) }, h('span', null, h('b', { text: x.c.name.replace(/^Wispr Flow — /, '') }), h('span', { class: 'xs muted', text: '  ' + x.c.channel })), h('b', { class: 'num', text: fm(x.r) })))) : h('div', { class: 'sm muted', text: 'Campaign-level data is not available for this stage.' })),
        h('div', { class: 's6' }, h('div', { class: 'g-sig-k', text: 'Top causes of loss' }), h('ul', { class: 'g-ul g-mt8' }, causes.map((c) => h('li', { text: c }))))),
      h('div', { class: 'sm muted' }, h('b', { text: 'Audience, device and geography: ' }), 'not tracked in the connected data. Add Google Analytics or product events in Data Sources to break this stage down further. ', h('button', { class: 'g-vd-b', type: 'button', onclick: () => G.go('datasources') }, 'Open Data Sources')));
    if (SER_KEY[k]) setTimeout(() => { if (box.isConnected) { const rows = G.anTS('all', null, R()); G.line(box, { series: [{ name: label, color: 'var(--g-em)', data: G.metricSeries(rows, SER_KEY[k], G.winFor(R())) }], height: 100, zero: false, yFmt: (v) => F.pct(v, v < 10 ? 1 : 0), tipFmt: (v) => F.pct(v, v < 10 ? 2 : 1), label: label + ' trend' }); } }, 0);
    return node;
  };
  G.leakCallout = () => {
    const a = G.an(R()); if (a.empty) return null;
    const keys = ['visitors', 'signups', 'activated', 'leads', 'customers'], names = { visitors: 'Landing visits', signups: 'Signups', activated: 'Activated users', leads: 'Qualified leads', customers: 'Customers' }, order = G.STG.map((s) => s[0]);
    const f = a.funnel.filter((x) => keys.includes(x.key)).sort((p, q) => q.drop - p.drop)[0]; if (!f) return null;
    const from = order[order.indexOf(f.key) - 1], fromName = NAMES[from] || from, rf = CAMP_RATE[f.key], cs = rf ? a.camps.filter((c) => c.clicks > 0).map((c) => ({ c, r: rf(c) })).filter((x) => x.r != null && isFinite(x.r)).sort((p, q) => p.r - q.r).slice(0, 3) : [];
    const chs = a.ch.filter((c) => (c[from] || 0) >= a.tot[from] * 0.03 && c[f.key] >= 0).map((c) => ({ c, r: c[f.key] / c[from] * 100 })).sort((p, q) => p.r - q.r).slice(0, 2);
    const fm = (v) => F.pct(v, v < 10 ? 2 : 1), lk = G.funnelLeaks(R()).find((l) => l.key === f.key);
    return h('div', { class: 'g-leakbar' }, h('div', { class: 'g-eyebrow', text: 'LARGEST FUNNEL LEAK' }), h('b', { style: 'font-size:16px', text: fromName + ' → ' + names[f.key] }),
      h('p', { class: 'sm', style: 'margin:4px 0 8px', text: F.pct(f.drop, 1) + ' of ' + fromName.toLowerCase() + ' do not become ' + names[f.key].toLowerCase() + '.' }),
      h('div', { class: 'g-grid' },
        h('div', { class: 's6' }, h('div', { class: 'g-sig-k', text: 'Why?' }), h('ul', { class: 'g-ul g-mt8' },
          cs.length ? h('li', null, h('b', { text: 'Campaign: ' }), cs.map((x) => x.c.name.replace(/^Wispr Flow — /, '') + ' ' + fm(x.r)).join(', ')) : null,
          chs.length ? h('li', null, h('b', { text: 'Channel: ' }), chs.map((x) => x.c.name + ' ' + fm(x.r)).join(', ')) : null,
          h('li', { class: 'muted', text: 'Landing page, audience, device, geography: not tracked yet.' }))),
        h('div', { class: 's6' }, h('div', { class: 'g-sig-k', text: 'What to do' }), h('p', { class: 'sm', style: 'margin:4px 0 0', text: lk ? lk.st.act(lk.worst) : 'Review the weakest campaigns at this step' + (cs.length ? ': ' + cs.map((x) => x.c.name.replace(/^Wispr Flow — /, '')).join(', ') : '') + '.' }))));
  };
  const NAMES = { impr: 'Impressions', clicks: 'Clicks', visitors: 'Landing visits', signups: 'Signups', activated: 'Activated users', leads: 'Qualified leads', customers: 'Customers', revenue: 'Revenue' };

  /* ======================= CHANNEL CONTRIBUTION SUMMARY ======================= */
  SX.contribSummary = () => {
    const f = G.pf('cSum', { m: 'revenue' }), seg = h('span'), dBox = h('div', { class: 'g-chart g-donut' }), side = h('div', { class: 'g-gap8' });
    const s = { el: G.card('Contribution and leaders', 'Share of the total, and which channel leads on each measure.', h('div', { class: 'g-donut-g' }, dBox, side), seg) };
    s.update = () => {
      const a = G.an(R()); seg.replaceChildren(G.seg([['revenue', 'Revenue'], ['customers', 'Customers'], ['signups', 'Signups']].map(([v, l]) => ({ v, l })), f.m, (v) => { f.m = v; s.update(); }));
      if (a.empty) { dBox.replaceChildren(noData()); side.replaceChildren(); return; }
      const m = f.m, items = a.ch.filter((c) => c[m] > 0).sort((p, q) => q[m] - p[m]), tot = a.tot[m] || 1;
      CH.donut(dBox, items.map((c) => ({ key: c.name, label: c.name, value: c[m], color: c.col })), { label: m + ' contribution', center: F.pct(items[0] ? items[0][m] / tot * 100 : 0, 0), centerSub: items[0] ? items[0].name : '', onPick: (k) => (k === 'Creators' ? G.go('creators') : G.go('channels')) });
      const paid = a.ch.filter((c) => c.spend > 0 && c.customers > 0 && c.sh_spend >= 0.03), grow = a.ch.filter((c) => c.d_signups != null && c.sh_signups >= 0.03);
      const best = items[0], eff = paid.slice().sort((p, q) => p.cac - q.cac)[0], conv = a.ch.filter((c) => c.visitors > 0 && c.sh_visitors !== 0 && c.customers > 0).slice().sort((p, q) => q.customers / q.visitors - p.customers / p.visitors)[0], fast = grow.slice().sort((p, q) => q.d_signups - p.d_signups)[0], risk = grow.filter((c) => c.d_signups < 0).sort((p, q) => p.d_signups - q.d_signups)[0];
      const row = (t, c, txt, tone) => h('button', { class: 'g-al', type: 'button', onclick: () => (c.name === 'Creators' ? G.go('creators') : G.go('channels')) }, h('div', { style: 'text-align:left' }, h('small', { class: 'xs muted', text: t }), h('div', null, h('i', { class: 'g-dotc', style: 'background:' + c.col }), h('b', { text: c.name }), ' ', h('span', { class: 'sm ' + (tone || ''), text: txt }))));
      side.replaceChildren(best ? row('Best channel', best, F.pct(best[m] / tot * 100, 0) + ' of ' + m) : '', eff ? row('Most efficient', eff, 'CAC ' + F.inrF(eff.cac)) : '', conv ? row('Best converting', conv, F.pct(conv.customers / conv.visitors * 100, 2) + ' visit → customer') : '', fast ? row('Fastest growing', fast, F.d(fast.d_signups) + ' signups') : '', risk ? row('At risk', risk, F.d(risk.d_signups) + ' signups', 'dn') : h('div', { class: 'sm muted', text: 'At risk: no channel is shrinking.' }));
    };
    return s;
  };

  /* ======================= CHANNEL PERFORMANCE MATRIX (table + recommendation) ======================= */
  G.channelCalls = (Rg) => {
    const a = G.an(Rg); if (a.empty) return []; const sh = a.ch.map((c) => c.sh_revenue || 0).sort((p, q) => p - q), medSh = d3.median(sh), T = G.targets();
    return a.ch.filter((c) => c.revenue > 0 || c.spend > 0).map((c) => {
      const hiVol = (c.sh_revenue || 0) >= Math.max(medSh, 0.08), eff = c.spend > 0 ? (c.cac ? c.cac <= a.tot.cac : false) && c.roas >= a.tot.roas * 0.9 : true, unpaid = !(c.spend > 0);
      const call = hiVol && eff ? 'SCALE' : hiVol ? 'OPTIMIZE' : eff ? 'INVESTIGATE' : 'PAUSE';
      const rec = unpaid ? (hiVol ? 'Unpaid and large. Protect it and invest in content that feeds it.' : 'Unpaid and small. Keep it low-cost and watch for growth.') : call === 'SCALE' ? 'Add budget in 15% steps while CAC stays under ' + F.inrF(Math.min(T.cac * 1.1, a.tot.cac * 1.1)) + '.' : call === 'OPTIMIZE' ? 'CAC is ' + r0((c.cac / a.tot.cac - 1) * 100) + '% above blended on ' + r0(c.sh_revenue * 100) + '% of revenue. Fix targeting and creative before adding spend.' : call === 'INVESTIGATE' ? 'Returns ' + F.x(c.roas) + ' on a small share. Test whether it holds at double the budget.' : 'Low volume at ' + F.x(c.roas) + ' ROAS. Pause and move ' + money(c.spend * 0.5) + ' to a SCALE channel.';
      return { c, call, rec, unpaid };
    }).sort((p, q) => q.c.revenue - p.c.revenue);
  };
  SX.chanTable = () => {
    const box = h('div'), s = { el: G.card('Channel performance matrix', 'Volume against efficiency. SCALE = high volume and efficient; OPTIMIZE = high volume, costly; INVESTIGATE = small but efficient; PAUSE = small and costly.', box) };
    s.update = () => {
      const rows = G.channelCalls(R()); if (!rows.length) { box.replaceChildren(noData()); return; }
      const mxR = Math.max.apply(null, rows.map((r) => r.c.revenue)) || 1, tone = { SCALE: 'green', OPTIMIZE: 'amber', INVESTIGATE: 'dark', PAUSE: 'red' };
      box.replaceChildren(h('div', { class: 'g-tw' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Channel', 'Spend', 'Signups', 'Customers', 'Revenue', 'CAC', 'ROAS', 'Conversion', 'Call', 'Recommendation'].map((t, i) => h('th', { class: i && i < 8 ? 'r' : '', text: t })))),
        h('tbody', null, rows.map(({ c, call, rec }) => h('tr', { style: 'cursor:pointer', onclick: () => (c.name === 'Creators' ? G.go('creators') : G.go('channels')) },
          h('td', null, h('span', { class: 'g-dotc', style: 'background:' + c.col }), h('b', { text: c.name })), h('td', { class: 'r num', text: c.spend ? money(c.spend) : '—' }), h('td', { class: 'r num', text: F.n(c.signups) }), h('td', { class: 'r num', text: F.n(c.customers) }),
          h('td', { class: 'r' }, h('span', { class: 'g-hb-i' }, h('i', { style: 'width:' + c.revenue / mxR * 100 + '%;background:' + c.col })), ' ', h('b', { class: 'num', text: money(c.revenue) })), h('td', { class: 'r num', text: c.cac ? F.inrF(c.cac) : '—' }), h('td', { class: 'r num', text: c.roas ? F.x(c.roas) : '—' }), h('td', { class: 'r num', text: F.pct(div(c.customers, c.visitors) * 100, 2) }),
          h('td', null, G.badge(call, tone[call])), h('td', { class: 'sm', style: 'min-width:220px', text: rec })))))));
    };
    return s;
  };

  /* ======================= CAMPAIGN CHARTS: trend, spend vs revenue, CAC, ROAS, mini-funnel ======================= */
  SX.campCharts = () => {
    const f = G.pf('campChart', { c: 'all', ch: 'all', ob: 'all', m: 'rev' }), ctl = h('div', { class: 'g-tools' }), box = h('div', { class: 'g-chart', style: 'min-height:250px' }), mini = h('div'), sumB = h('div', { class: 'xs muted' }), bars = h('div', { class: 'g-grid' });
    const s = { el: h('div', { class: 'g-gap16' }, G.card('Campaign performance over time', 'Pick a campaign, channel or objective. Revenue, spend against revenue, or CAC.', h('div', { class: 'g-gap8' }, ctl, box, sumB, mini)), bars) };
    const campsOf = (a) => a.camps.filter((c) => (f.c === 'all' || c.key === f.c) && (f.ch === 'all' || (c.chs || []).includes(f.ch) || c.channel === f.ch) && (f.ob === 'all' || c.goal === f.ob));
    s.update = () => {
      const a = G.an(R()); if (a.empty || !a.camps.length) { box.replaceChildren(noData()); bars.replaceChildren(); mini.replaceChildren(); ctl.replaceChildren(); return; }
      const goals = Array.from(new Set(a.camps.map((c) => c.goal).filter(Boolean)));
      ctl.replaceChildren(G.sel([{ v: 'all', l: 'All campaigns' }].concat(a.camps.map((c) => ({ v: c.key, l: c.name.replace(/^Wispr Flow — /, '') }))), f.c, (v) => { f.c = v; s.update(); }, 'Campaign'), G.sel([{ v: 'all', l: 'All channels' }].concat(a.ch.filter((c) => c.spend > 0).map((c) => ({ v: c.name, l: c.name }))), f.ch, (v) => { f.ch = v; s.update(); }, 'Channel'),
        goals.length ? G.sel([{ v: 'all', l: 'All objectives' }].concat(goals.map((g) => ({ v: g, l: g }))), f.ob, (v) => { f.ob = v; s.update(); }, 'Objective') : '', G.seg([['rev', 'Revenue'], ['sr', 'Spend vs revenue'], ['cac', 'CAC']].map(([v, l]) => ({ v, l })), f.m, (v) => { f.m = v; s.update(); }));
      const sel = campsOf(a); if (!sel.length) { box.replaceChildren(G.empty('◌', 'No campaign matches these filters', 'Try a different channel or objective.')); mini.replaceChildren(); return; }
      const all = f.c === 'all' && f.ch === 'all' && f.ob === 'all'; let rows;
      if (all) rows = G.anTS('all', null, R());
      else { const ts = sel.map((c) => G.anTS('campaign', c.key, R())).filter((t) => t.length); rows = ts.length ? ts[0].map((d, i) => { const o = { date: d.date }; ['impr', 'clicks', 'visitors', 'spend', 'signups', 'activated', 'customers', 'revenue'].forEach((k) => (o[k] = sum(ts, (t) => t[i][k]))); return o; }) : []; }
      if (!rows.length) { box.replaceChildren(noData()); return; }
      const series = f.m === 'rev' ? [{ name: 'Revenue', color: 'var(--g-em)', data: rows.map((r) => [r.date, r.revenue]), w: 2.4 }] : f.m === 'sr' ? [{ name: 'Revenue', color: 'var(--g-em)', data: rows.map((r) => [r.date, r.revenue]), w: 2.4 }, { name: 'Spend', color: 'var(--g-amber)', data: rows.map((r) => [r.date, r.spend]), dash: '6 4', w: 1.8 }] : [{ name: 'CAC', color: 'var(--g-em)', data: G.metricSeries(rows, 'cac', G.winFor(R())), w: 2.4 }];
      G.line(box, { series, height: 250, zero: f.m !== 'cac', yFmt: f.m === 'cac' ? F.inrF : money, tipFmt: f.m === 'cac' ? F.inrF : money, label: 'Campaign performance chart' });
      const sp = sum(rows, 'spend'), rv = sum(rows, 'revenue'), cu = sum(rows, 'customers');
      sumB.replaceChildren(h('span', null, 'Selection: ' + sel.length + ' campaign' + (sel.length === 1 ? '' : 's') + ' · spend ' + money(sp) + ' · revenue ' + money(rv) + ' · ROAS ' + (sp ? F.x(rv / sp) : '—') + ' · CAC ' + (cu ? F.inrF(sp / cu) : '—') + '. Daily values follow the selected date range.'));
      if (sel.length === 1) { const c = sel[0], st = [['Impressions', c.impressions || c.impr || 0], ['Clicks', c.clicks], ['Leads', c.leads], ['Customers', c.customers], ['Revenue', c.revenue]];
        mini.replaceChildren(h('div', { class: 'g-sig-k', text: 'Campaign funnel · ' + c.name.replace(/^Wispr Flow — /, '') }), h('div', { class: 'g-mf g-mt8' }, st.map(([l, v], i) => h('div', { class: 'g-mf-s' }, h('small', { text: l }), h('b', { class: 'num', text: l === 'Revenue' ? money(v) : F.c(v) }), i && i < 4 && st[i - 1][1] ? h('span', { class: 'xs muted', text: F.pct(v / st[i - 1][1] * 100, v / st[i - 1][1] < 0.1 ? 2 : 1) + ' of ' + st[i - 1][0].toLowerCase() }) : h('span', { class: 'xs muted', text: ' ' })))), h('div', { class: 'g-row g-mt8' }, G.btn('Open campaign intelligence', () => G.go('campaigns', { open: c.key }), 'sm pri'))); }
      else mini.replaceChildren(h('div', { class: 'xs muted', text: 'Pick one campaign to see its own funnel from impressions to revenue.' }));
      const cc = G.campClass(a), mk = (title, key, fmv, dir) => { const r = a.camps.filter((c) => c[key] != null && c.spend > 0).sort((p, q) => (dir > 0 ? q[key] - p[key] : p[key] - q[key])); return h('div', { class: 's6' }, G.card(title, dir < 0 ? 'Lower is better.' : 'Higher is better.', CH.hbar(r.map((c, i) => ({ key: c.key, name: c.name.replace(/^Wispr Flow — /, ''), sub: c.channel, value: c[key], color: i === 0 ? 'var(--g-em)' : 'var(--g-ink-3)', tag: G.badge(cc(c).label, cc(c).tone) })), { fmt: fmv, onPick: (k) => G.go('campaigns', { open: k }), tip: (x) => h('div', null, h('b', { text: x.name }), h('div', { class: 'xs muted', text: cc(a.camps.find((c) => c.key === x.key)).why })) }))); };
      bars.replaceChildren(mk('Campaign CAC', 'cac', F.inrF, -1), mk('Campaign ROAS', 'roas', F.x, 1));
    };
    return s;
  };

  /* ======================= GROWTH OPPORTUNITY MATRIX ======================= */
  SX.oppMap = () => {
    const f = G.pf('oppMap', { set: 'both' }), box = h('div', { class: 'g-chart', style: 'min-height:380px' }), seg = h('span'), note = h('div', { class: 'xs muted g-mt8' });
    const s = { el: G.card('Growth Opportunity Matrix', 'Efficiency (return on spend vs your blended ROAS) against growth (signup change vs the previous period). Click a point.', h('div', null, box, note), seg) };
    s.update = () => {
      const a = G.an(R()); seg.replaceChildren(G.seg([['both', 'All'], ['ch', 'Channels'], ['camp', 'Campaigns']].map(([v, l]) => ({ v, l })), f.set, (v) => { f.set = v; s.update(); }));
      if (a.empty) { box.replaceChildren(noData()); return; }
      const pts = []; if (f.set !== 'camp') a.ch.filter((c) => c.spend > 0 && c.roas && c.d_signups != null).forEach((c) => pts.push({ key: 'ch:' + c.name, name: c.name, x: c.roas / a.tot.roas, y: c.d_signups, r: c.spend, col: c.col, type: 'Channel', c }));
      if (f.set !== 'ch') a.camps.filter((c) => c.spend > 0 && c.roas && c.d_signups != null).forEach((c) => pts.push({ key: 'camp:' + c.key, name: c.name.replace(/^Wispr Flow — /, ''), x: c.roas / a.tot.roas, y: c.d_signups, r: c.spend, col: 'var(--g-ink-2)', type: 'Campaign', c }));
      if (pts.length < 2) { box.replaceChildren(G.empty('◌', 'Not enough data to plot', 'Needs at least two items with spend and a previous period.')); return; }
      const W = box.clientWidth || 700, H = 380, m = { t: 20, r: 20, b: 46, l: 54 };
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x = d3.scaleLog([Math.min(0.4, d3.min(xs) * 0.8), Math.max(2, d3.max(xs) * 1.2)], [m.l, W - m.r]), gy = a.kp.signups ? a.kp.signups.delta : 0;
      const y = d3.scaleLinear([Math.min(-5, d3.min(ys) - 5), Math.max(10, d3.max(ys) + 8)], [H - m.b, m.t]), rs = d3.scaleSqrt([0, d3.max(pts, (p) => p.r)], [4, 20]);
      box.replaceChildren(); const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H).attr('role', 'img').attr('aria-label', 'Growth opportunity matrix');
      y.ticks(5).forEach((t) => { svg.append('line').attr('class', 'gl').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)); svg.append('text').attr('class', 'ax').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').text(t + '%'); });
      [0.5, 1, 2, 4].filter((t) => x(t) > m.l && x(t) < W - m.r).forEach((t) => svg.append('text').attr('class', 'ax').attr('x', x(t)).attr('y', H - 26).attr('text-anchor', 'middle').text(t + '×'));
      svg.append('text').attr('class', 'ax').attr('x', (m.l + W - m.r) / 2).attr('y', H - 8).attr('text-anchor', 'middle').text('Efficiency: ROAS vs blended →');
      svg.append('text').attr('class', 'ax').attr('transform', `translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Growth: signups vs previous period →');
      svg.append('line').attr('class', 'ref').attr('x1', x(1)).attr('x2', x(1)).attr('y1', m.t).attr('y2', H - m.b); svg.append('line').attr('class', 'ref').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(gy)).attr('y2', y(gy));
      const ql = (t, ax, ay, anc) => svg.append('text').attr('class', 'ql').attr('x', ax).attr('y', ay).attr('text-anchor', anc).text(t);
      ql('OPTIMIZE · growing, costly', m.l + 6, m.t + 11, 'start'); ql('SCALE · growing, efficient', W - m.r - 4, m.t + 11, 'end'); ql('PAUSE · flat, costly', m.l + 6, H - m.b - 6, 'start'); ql('INVESTIGATE · flat, efficient', W - m.r - 4, H - m.b - 6, 'end');
      const call = (p) => (p.x >= 1 ? (p.y >= gy ? 'SCALE' : 'INVESTIGATE') : p.y >= gy ? 'OPTIMIZE' : 'PAUSE');
      svg.selectAll('circle.pt').data(pts).join('circle').attr('class', 'pt').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', (p) => rs(p.r)).style('fill', (p) => p.col).style('fill-opacity', (p) => (p.type === 'Channel' ? 0.85 : 0.45)).style('stroke', (p) => p.col).style('cursor', 'pointer').attr('tabindex', 0).attr('role', 'button').attr('aria-label', (p) => p.name + ' ' + call(p))
        .on('mousemove', (e, p) => G.tip.show(e, h('div', null, h('b', { text: p.name }), h('div', { class: 'r' }, h('span', { text: 'Type' }), h('b', { text: p.type })), h('div', { class: 'r' }, h('span', { text: 'Call' }), h('b', { text: call(p) })), h('div', { class: 'r' }, h('span', { text: 'ROAS' }), h('b', { text: F.x(p.c.roas) + ' (' + p.x.toFixed(2) + '× blended)' })), h('div', { class: 'r' }, h('span', { text: 'Signups change' }), h('b', { text: F.d(p.y) })), h('div', { class: 'r' }, h('span', { text: 'Spend' }), h('b', { text: money(p.r) })), h('div', { class: 'xs muted', text: 'Click to open' })))).on('mouseleave', G.tip.hide)
        .on('click', (e, p) => (p.type === 'Campaign' ? G.go('campaigns', { open: p.c.key }) : p.name === 'Creators' ? G.go('creators') : G.go('channels'))).on('keydown', (e, p) => { if (e.key === 'Enter') (p.type === 'Campaign' ? G.go('campaigns', { open: p.c.key }) : G.go('channels')); });
      if (pts.length <= 12) svg.selectAll('text.pl').data(pts).join('text').attr('class', 'pl ax').attr('x', (p) => x(p.x)).attr('y', (p) => y(p.y) - rs(p.r) - 4).attr('text-anchor', 'middle').text((p) => p.name.slice(0, 16));
      note.replaceChildren(h('span', null, 'Bubble size = spend. Lines mark the blended ROAS and the blended signup growth (' + F.d(gy) + '). Creators are not plotted: they have no previous-period data, so their growth cannot be measured; see the creator matrix on Creators.'));
    };
    return s;
  };

  /* ======================= UNIT ECONOMICS ======================= */
  G.unitEcon = (Rg) => {
    const a = G.an(Rg); if (a.empty || !a.tot.customers) return null;
    const co = G.WS.active().company || {}, gm = co.grossMargin ? +co.grossMargin / 100 : isDemo() ? 0.8 : null, arpc = a.tot.revenue / a.tot.customers, parpc = a.prev.customers ? a.prev.revenue / a.prev.customers : null, cac = a.tot.cac, pcac = a.prev.cac;
    const q = G.cohortData(), life = q && q.life ? q.life : null, ltv = gm != null && life ? arpc * gm * life : null, pltv = ltv != null && parpc ? parpc * gm * life : null;
    const payback = gm != null ? cac / (arpc * gm / 12) : null;
    return { a, gm, arpc, parpc, cac, pcac, ltv, pltv, ratio: ltv ? ltv / cac : null, pratio: pltv && pcac ? pltv / pcac : null, payback, life, assumed: !co.grossMargin && isDemo() };
  };
  SX.unit = () => {
    const kBox = h('div', { class: 'g-st g-st-sm g-st6' }), cBox = h('div', { class: 'g-chart', style: 'min-height:230px' }), ins = h('div');
    const s = { el: h('div', { class: 'g-gap16' }, kBox, G.card('CAC vs LTV', 'Both indexed to the start of the period (= 100). If CAC climbs faster than LTV, acquisition is getting less attractive.', cBox), ins) };
    s.update = () => {
      const u = G.unitEcon(R()); if (!u) { kBox.replaceChildren(); cBox.replaceChildren(noData()); ins.replaceChildren(); return; }
      const tile = (l, v, dl, good, sub) => h('div', { class: 'g-st-c', style: 'cursor:default' }, h('small', { text: l }), h('b', { class: 'num g-st-v', text: v }), dl != null ? G.dl(dl, good) : h('span', { class: 'xs muted', text: sub || ' ' }));
      const na = 'Needs data';
      kBox.replaceChildren(tile('CAC', F.inrF(u.cac), u.pcac ? (u.cac / u.pcac - 1) * 100 : null, false), tile('LTV', u.ltv ? money(u.ltv) : na, u.pltv ? (u.ltv / u.pltv - 1) * 100 : null, true, u.ltv ? '' : 'Set gross margin'), tile('LTV : CAC', u.ratio ? u.ratio.toFixed(1) + '×' : na, u.pratio ? (u.ratio / u.pratio - 1) * 100 : null, true), tile('Payback', u.payback ? u.payback.toFixed(1) + ' months' : na, null, true, u.payback ? 'on gross profit' : 'Set gross margin'), tile('Gross margin', u.gm != null ? r0(u.gm * 100) + '%' : na, null, true, u.assumed ? 'Assumed (demo)' : ''), tile('Revenue per customer', money(u.arpc), u.parpc ? (u.arpc / u.parpc - 1) * 100 : null, true));
      const rows = G.anTS('all', null, R()), win = G.winFor(R()), cacS = G.metricSeries(rows, 'cac', win);
      const arpcS = rows.map((r, i) => { const w = rows.slice(Math.max(0, i - win + 1), i + 1), cu = sum(w, 'customers'); return cu ? [r.date, sum(w, 'revenue') / cu] : null; }).filter(Boolean);
      const ix = (arr) => { const b = arr[0] ? arr[0][1] : 1; return arr.map((d) => [d[0], d[1] / b * 100]); };
      if (u.ltv) G.line(cBox, { series: [{ name: 'CAC (index)', color: 'var(--g-amber)', data: ix(cacS) }, { name: 'LTV (index)', color: 'var(--g-em)', data: ix(arpcS) }], height: 230, zero: false, yFmt: (v) => String(r0(v)), tipFmt: (v) => v.toFixed(0), label: 'CAC versus LTV index chart' });
      else G.line(cBox, { series: [{ name: 'CAC', color: 'var(--g-amber)', data: cacS }], height: 230, zero: false, yFmt: F.inrF, tipFmt: F.inrF, label: 'CAC trend' });
      const cD = u.pcac ? (u.cac / u.pcac - 1) * 100 : null, lD = u.pltv ? (u.ltv / u.pltv - 1) * 100 : u.parpc ? (u.arpc / u.parpc - 1) * 100 : null;
      const a = u.a, paid = a.camps.filter((c) => c.spend > 0 && c.cac), med = d3.median(paid, (c) => c.cac), above = paid.filter((c) => c.cac > med).sort((p, q) => q.spend - p.spend).slice(0, 2);
      const worse = cD != null && lD != null && cD > lD + 1, better = cD != null && lD != null && cD < lD - 1;
      const sig = cD == null ? 'Not enough history to compare CAC and LTV.' : 'Your CAC ' + (cD >= 0 ? 'increased ' : 'fell ') + F.pct(Math.abs(cD), 1) + (lD != null ? ', while LTV ' + (lD >= 0 ? 'increased ' : 'fell ') + F.pct(Math.abs(lD), 1) + '. ' : '. ') + (worse ? 'Acquisition efficiency is deteriorating.' : better ? 'Acquisition efficiency is improving.' : 'Acquisition efficiency is steady.');
      ins.replaceChildren(G.chartInsight({ tone: worse ? 'amber' : '', signal: sig, impact: u.ratio ? 'LTV:CAC is ' + u.ratio.toFixed(1) + '× with a ' + u.payback.toFixed(1) + '-month payback.' : 'LTV needs a gross margin and retention data.', cause: above.length ? above.map((c) => c.name.replace(/^Wispr Flow — /, '') + ' (CAC ' + F.inrF(c.cac) + ')').join(' and ') + ' sit above the portfolio median of ' + F.inrF(med) + '.' : 'No campaign is far above the median CAC.', action: above.length ? 'Reduce spend on ' + above.map((c) => c.name.replace(/^Wispr Flow — /, '')).join(' and ') + '.' : 'Hold the mix and keep CAC below target.', expected: above.length ? 'About ' + money(sum(above, (c) => c.spend * 0.2)) + ' freed for lower-CAC campaigns.' : 'No change needed.', investigate: () => G.go('campaigns'), apply: above.length ? () => G.applyInsight({ signal: sig, action: 'Reduce spend on ' + above.map((c) => c.name.replace(/^Wispr Flow — /, '')).join(' and ') + ' by 20%', expected: 'About ' + money(sum(above, (c) => c.spend * 0.2)) + ' freed for lower-CAC campaigns', metric: 'cac', kind: 'budget' }) : null }));
      if (u.assumed) ins.append(h('p', { class: 'xs muted g-mt8', text: 'Demo assumptions: gross margin 80% and revenue per customer treated as annual. LTV = revenue per customer × gross margin × expected lifetime in years from the simulated retention curve.' }));
      if (u.gm == null) ins.append(h('div', { class: 'g-row g-mt8' }, h('span', { class: 'sm muted', text: 'LTV needs a gross margin. Add it in Company setup.' }), G.btn('Open Company setup', () => G.go('settings'), 'sm')));
    };
    return s;
  };

  /* ======================= GROWTH QUALITY: cohorts + retention ======================= */
  G.cohortData = () => {
    if (!isDemo()) return null; const a = G.an(R()), ser = (G.rows('series') || []); if (a.empty || ser.length < 40) return null;
    const by = {}; ser.forEach((r) => { const k = r.date.slice(0, 7); (by[k] = by[k] || { k, signups: 0, activated: 0, days: 0 }); by[k].signups += r.signups; by[k].activated += r.activated; by[k].days++; });
    const ms = Object.values(by).filter((m) => m.days >= 20).sort((p, q) => (p.k < q.k ? -1 : 1)).slice(-4), avgAct = sum(ms, 'activated') / (sum(ms, 'signups') || 1), curve = [1, 0.66, 0.54, 0.47, 0.43], last = ser[ser.length - 1].date.slice(0, 7);
    const hash = (s) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 997; return x; };
    const rows = ms.map((m, i) => { const act = m.activated / m.signups, qf = clamp(Math.pow(act / avgAct, 0.9), 0.85, 1.12), obs = ms.length - i; return { k: m.k, signups: m.signups, act: act * 100, cells: curve.map((c, j) => (j < obs ? (j === 0 ? 100 : clamp(r0(c * 100 * qf + ((hash(m.k + j) % 5) - 2)), 5, 99)) : null)) }; });
    const m1 = rows.filter((r) => r.cells[1] != null).map((r) => r.cells[1]), m4 = 0.43 / 0.66, life = clamp(1 / (1 - clamp(Math.pow(m4, 3) + 0.3, 0.3, 0.85)), 1.2, 5);
    return { rows, life, m1: m1.length ? d3.mean(m1) : null, m1First: m1[0], m1Last: m1[m1.length - 1], last };
  };
  SX.quality = () => {
    const kBox = h('div', { class: 'g-st g-st-sm g-st5' }), hm = h('div'), ins = h('div');
    const s = { el: h('div', { class: 'g-gap16' }, kBox, G.card('Cohort retention', 'Rows are signup months. Columns are months since signup. Each cell is the share of activated users still active.', hm), ins) };
    s.update = () => {
      const a = G.an(R()); if (a.empty) { kBox.replaceChildren(); hm.replaceChildren(noData()); ins.replaceChildren(); return; }
      const cd = G.cohortData(), u = G.unitEcon(R()), act = div(a.tot.activated, a.tot.signups) * 100, pAct = a.prev.signups ? div(a.prev.activated, a.prev.signups) * 100 : null, na = 'Needs data';
      const tile = (l, v, dl, good, sub) => h('div', { class: 'g-st-c', style: 'cursor:default' }, h('small', { text: l }), h('b', { class: 'num g-st-v', text: v }), dl != null ? G.dl(dl, good) : h('span', { class: 'xs muted', text: sub || ' ' }));
      kBox.replaceChildren(tile('Activation rate', F.pct(act, 1), pAct ? (act / pAct - 1) * 100 : null, true), tile('Month-1 retention', cd && cd.m1 ? F.pct(cd.m1, 0) : na, null, true, cd ? 'Simulated' : 'No usage data'), tile('Repeat usage', cd && cd.m1 ? F.pct(cd.m1 * 0.9, 0) : na, null, true, cd ? 'Simulated' : 'No usage data'), tile('Revenue per customer', money(a.tot.revenue / a.tot.customers), a.prev.customers ? ((a.tot.revenue / a.tot.customers) / (a.prev.revenue / a.prev.customers) - 1) * 100 : null, true), tile('Customer LTV', u && u.ltv ? money(u.ltv) : na, null, true, u && u.ltv ? 'Simulated' : 'Set gross margin'));
      if (!cd) { hm.replaceChildren(G.empty('◌', 'Not enough data to calculate this.', 'Cohort retention needs product usage events. Connect them to see which signup months produce lasting users.', G.btn('Connect data source', () => G.go('datasources'), 'sm pri'))); ins.replaceChildren(); return; }
      const col = (v) => (v == null ? 'transparent' : 'rgba(52,211,153,' + (0.12 + clamp(v, 5, 100) / 100 * 0.78).toFixed(2) + ')');
      hm.replaceChildren(h('div', { class: 'g-tw' }, h('table', { class: 'g-tbl g-hm' }, h('thead', null, h('tr', null, ['Signup month', 'Signups', 'Activation'].concat([0, 1, 2, 3, 4].map((i) => 'Month ' + i)).map((t, i) => h('th', { class: i ? 'r' : '', text: t })))),
        h('tbody', null, cd.rows.map((r) => h('tr', null, h('td', null, h('b', { text: new Date(r.k + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }) })), h('td', { class: 'r num', text: F.n(r.signups) }), h('td', { class: 'r num', text: F.pct(r.act, 1) }), ...r.cells.map((v) => h('td', { class: 'r num g-hm-c', style: 'background:' + col(v) + ';color:' + (v != null && v > 75 ? '#06110c' : 'inherit'), text: v == null ? '' : v + '%' }))))))),
      h('div', { class: 'xs muted g-mt8', text: 'Simulated retention in this prototype. With real data this reads your product usage events.' }));
      const dlt = cd.m1Last != null && cd.m1First != null ? cd.m1Last - cd.m1First : 0, sg = a.kp.signups ? a.kp.signups.delta : 0;
      ins.replaceChildren(G.chartInsight({ tone: dlt < -1 ? 'amber' : '', signal: 'Signups are ' + F.d(sg) + ' while month-1 retention moved ' + (dlt >= 0 ? '+' : '−') + Math.abs(r0(dlt)) + ' pts from the oldest to the newest cohort.', impact: dlt < -1 ? 'Growth is getting cheaper to start but lower quality to keep.' : 'Newer cohorts hold up as well as older ones, so growth quality is steady.', cause: 'Cohort activation ranges from ' + F.pct(d3.min(cd.rows, (r) => r.act), 1) + ' to ' + F.pct(d3.max(cd.rows, (r) => r.act), 1) + '.', action: dlt < -1 ? 'Improve first-run onboarding before scaling the weakest sources.' : 'Keep scaling; recheck retention each month.', expected: dlt < -1 ? 'Recovers about ' + r0(-dlt) + ' pts of month-1 retention.' : 'No change needed.', investigate: () => G.go('campaigns') }));
    };
    return s;
  };

  /* ======================= DECISION LOGGING with owner + follow-up ======================= */
  const OWNERS = ['Growth', 'Marketing', 'Sales', 'Content', 'Product'];
  G.logDecisionModal = (o) => {
    const fu = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const form = G.form([{ k: 'title', label: 'Decision', val: o.title || '' }, { k: 'reason', label: 'Reason', type: 'textarea', val: o.reason || '' }, { k: 'evidence', label: 'Evidence', type: 'textarea', val: o.evidence || '' }, { k: 'expected', label: 'Expected impact', val: o.expected || '' }, { k: 'owner', label: 'Owner', type: 'select', opts: OWNERS, val: o.owner || 'Growth' }, { k: 'followUp', label: 'Follow-up date', type: 'date', val: fu }]);
    G.modal({ title: 'Log decision', sub: 'Record it now. Growth OS asks “did this work?” on the follow-up date.', body: form.el, actions: (close) => [G.btn('Cancel', close), G.btn('Log decision', () => { const v = form.get(); if (!v.title.trim()) return G.toast('Add the decision first', { tone: 'bad' }); close(); G.logDecision({ title: v.title.trim(), reason: v.reason, evidence: v.evidence, expected: v.expected, owner: v.owner, followUp: v.followUp, metric: o.metric || 'revenue', kind: o.kind || 'chart', amount: o.amount }); }, 'pri')] });
  };

  /* ======================= ASK: more answers + command center ======================= */
  const askCache = new WeakMap();
  const extraAsk2 = () => {
    const a = G.an(R()); if (!a || a.empty) return []; if (askCache.has(a)) return askCache.get(a);
    const out = [], T = G.targets(), cc = G.campClass(a), L = G.funnelLeaks(R()), paid = a.ch.filter((c) => c.spend > 0 && c.customers > 0), ops = G.opportunities(R()), rks = G.risks(R());
    const add = (id, q, keys, group, headline, analysis, evidence, reco, go, src, extra) => out.push(Object.assign({ id, q, keys, group, headline, analysis, evidence, reco, action: 'Open', toast: '', go, go_opts: {}, impact: '', feat: null, src: src || [[go, go, {}]] }, extra || {}));
    const keyFor = { campaigns: 'Campaigns', channels: 'Channels', creators: 'Creators', leads: 'Leads', pipeline: 'Pipeline', forecast: 'Forecast', radar: 'GTM Radar', attribution: 'Attribution' };
    const l0 = L.filter((l) => l.key !== 'clicks')[0] || L[0], fl = a.funnel.filter((f) => ['visitors', 'signups', 'activated', 'leads', 'customers'].includes(f.key)).sort((p, q) => q.drop - p.drop)[0];
    if (fl) add('m-lose', 'Where am I losing customers?', ['losing customers', 'lose customers', 'losing users', 'where am i losing', 'drop off'], 'GTM', 'Most users are lost between ' + (NAMES[G.STG.map((s) => s[0])[G.STG.map((s) => s[0]).indexOf(fl.key) - 1]] || 'the previous step') + ' and ' + NAMES[fl.key].toLowerCase() + ': ' + F.pct(fl.drop, 1) + ' drop.', l0 ? l0.worst + ' is the weakest channel at this kind of step. ' + l0.st.why : 'Conversion is even across channels.', a.funnel.filter((f) => f.drop != null && f.key !== 'impr').map((f) => [NAMES[f.key], F.pct(f.drop, 1) + ' drop']).slice(0, 5), l0 ? l0.st.act(l0.worst) : 'Review the weakest step.', 'home', [['Growth funnel', 'home', {}], ['Channels', 'channels', {}]], { go_opts: {} });
    const act = a.funnel.find((f) => f.key === 'activated'), wk = a.ch.filter((c) => c.sh_signups >= 0.05 && c.act != null).sort((p, q) => p.act - q.act)[0];
    if (act && act.prevConv) add('m-act', 'Why did activation fall?', ['activation fall', 'activation drop', 'why did activation', 'activation down', 'activation decline'], 'GTM', act.conv >= act.prevConv ? 'Activation has not fallen: it is ' + F.pct(act.conv, 1) + ' vs ' + F.pct(act.prevConv, 1) + '.' : 'Activation fell ' + F.pct((1 - act.conv / act.prevConv) * 100, 1) + ' to ' + F.pct(act.conv, 1) + ' while signups ' + (a.kp.signups.delta >= 0 ? 'rose ' : 'fell ') + F.pct(Math.abs(a.kp.signups.delta), 1) + '.', wk ? wk.name + ' activates only ' + F.pct(wk.act, 1) + ' of its signups and brings ' + r0(wk.sh_signups * 100) + '% of them. A mix shift toward weaker sources dilutes the blend.' : 'No channel stands out.', a.ch.filter((c) => c.sh_signups >= 0.05 && c.act != null).sort((p, q) => p.act - q.act).slice(0, 4).map((c) => [c.name, F.pct(c.act, 1) + ' activation · ' + r0(c.sh_signups * 100) + '% of signups']), wk ? 'Improve onboarding for ' + wk.name + ' signups.' : 'Keep onboarding as is.', 'campaigns', [['Campaigns', 'campaigns', {}], ['Channels', 'channels', {}]]);
    const camps = a.camps.filter((c) => c.spend > 0), nw = camps.filter((c) => ['Pause', 'Optimize'].includes(cc(c).label)).sort((p, q) => q.spend - p.spend);
    add('m-notwork', 'Which campaigns are not working?', ['not working', 'underperform', 'which campaigns are not', 'worst campaigns', 'poor campaign'], 'CAMPAIGNS', nw.length ? nw.slice(0, 3).map((c) => c.name.replace(/^Wispr Flow — /, '')).join(', ') + ' ' + (nw.length === 1 ? 'is' : 'are') + ' underperforming.' : 'Every campaign is within range.', nw.slice(0, 3).map((c) => cc(c).label + ': ' + cc(c).why).join(' ') || 'No campaign is far from the account average.', nw.slice(0, 4).map((c) => [c.name.replace(/^Wispr Flow — /, ''), cc(c).label + ' · CAC ' + F.inrF(c.cac) + ' · ROAS ' + F.x(c.roas)]), nw.length ? 'Pause or fix them before adding any budget.' : 'Keep monitoring.', 'campaigns', [['Campaigns', 'campaigns', {}]]);
    const tc = camps.map((c) => ({ c, d: G.anTS('campaign', c.key, R()) })).filter((x) => x.d.length).map((x) => ({ c: x.c, last: x.d[x.d.length - 1] })).sort((p, q) => q.last.revenue - p.last.revenue);
    if (tc.length) add('m-today-camp', 'What are today’s campaign metrics?', ['campaign metrics', 'today’s campaign', 'todays campaign', 'campaigns today', 'campaign today'], 'TODAY', tc[0].c.name.replace(/^Wispr Flow — /, '') + ' leads today with ' + money(tc[0].last.revenue) + ' revenue.', 'Latest synced day, per campaign (daily values are distributed from the period totals in this prototype).', tc.slice(0, 5).map((x) => [x.c.name.replace(/^Wispr Flow — /, ''), money(x.last.revenue) + ' · spend ' + money(x.last.spend) + ' · ' + plural(r0(x.last.customers), 'customer')]), 'Open campaigns for the full picture.', 'campaigns', [['Campaigns', 'campaigns', {}]]);
    const cr = a.cr, crRev = sum(cr, 'revenue');
    if (cr.length) add('m-cr-rev', 'How much revenue is coming from creators?', ['revenue is coming from creators', 'revenue from creators', 'creators revenue', 'creator revenue'], 'CREATORS', money(crRev) + ' of revenue (' + F.pct(crRev / (a.tot.revenue || 1) * 100, 0) + ') comes from creators.', 'Creators spent ' + money(sum(cr, 'spend')) + ' and returned ' + F.x(crRev / Math.max(1, sum(cr, 'spend'))) + ' ROAS.', cr.slice().sort((p, q) => q.revenue - p.revenue).slice(0, 4).map((c) => [c.handle, money(c.revenue) + ' · ' + plural(c.customers, 'customer')]), 'Open the creator leaderboard.', 'creators', [['Creators', 'creators', {}]]);
    const ls = (G.rows('leads') || []).filter((l) => !/Customer|Won|Lost/i.test(l.stage || '')).sort((p, q) => (q.score || 0) - (p.score || 0)).slice(0, 5);
    if (ls.length) add('m-likely', 'Which customers are most likely to convert?', ['most likely to convert', 'likely to convert', 'likely to buy', 'convert next', 'likely customers'], 'SALES', ls[0].name + ' at ' + ls[0].company + ' is the most likely to convert (intent score ' + ls[0].score + ').', 'Ranked by intent score from product activity and pricing visits. Leads still waiting for follow-up are the fastest win.', ls.map((l) => [l.name + ' · ' + l.company, 'score ' + l.score + ' · ' + money(l.est_value) + (l.waiting ? ' · waiting' : '')]), 'Follow up with the top leads today.', 'leads', [['Leads', 'leads', { filter: 'followup' }]], { go_opts: { filter: 'followup' } });
    const ec = paid.slice().sort((p, q) => p.cac - q.cac)[0];
    if (ec) add('m-bestcac', 'Which channel has the best CAC?', ['channel has the best cac', 'channel has best cac', 'best cac', 'lowest cac channel', 'cheapest channel'], 'CAMPAIGNS', ec.name + ' has the lowest CAC at ' + F.inrF(ec.cac) + '.', 'Blended CAC is ' + F.inrF(a.tot.cac) + '. ' + ec.name + ' is ' + r0((1 - ec.cac / a.tot.cac) * 100) + '% below it, on ' + F.pct(ec.sh_spend * 100, 1) + ' of spend.', paid.slice().sort((p, q) => p.cac - q.cac).slice(0, 4).map((c) => [c.name, F.inrF(c.cac) + ' · ' + F.x(c.roas)]), 'Test more budget on ' + ec.name + ' with a simulation first.', 'channels', [['Channels', 'channels', {}]], { go_opts: { sim: true } });
    if (ops.length) add('m-invest', 'Where should I invest?', ['where should i invest', 'invest', 'where to invest', 'put more money'], 'GTM', 'Invest first in: ' + ops[0].title + '.', 'Opportunities are ranked by Impact × Confidence × Ease from your own data.', ops.slice(0, 3).map((o, i) => [(i + 1) + '. ' + o.title, o.impactTxt]), ops[0].action + '.', ops[0].go[0], [[keyFor[ops[0].go[0]] || 'Source', ops[0].go[0], ops[0].go[1]]], { go_opts: ops[0].go[1] });
    if (rks.length) add('m-broken', 'What is broken?', ['what is broken', 'broken', 'what’s broken', 'whats broken', 'what is wrong'], 'GTM', rks[0].title + (rks.length > 1 ? ' (and ' + (rks.length - 1) + ' more risk' + (rks.length > 2 ? 's' : '') + ').' : '.'), rks[0].evidence + ' ' + rks[0].impact, rks.slice(0, 4).map((r) => [r.sev + ' · ' + r.title, r.impact]), rks[0].action + '.', rks[0].go[0], [[keyFor[rks[0].go[0]] || 'Source', rks[0].go[0], rks[0].go[1]]], { go_opts: rks[0].go[1] });
    else add('m-broken', 'What is broken?', ['what is broken', 'broken', 'what’s broken', 'whats broken'], 'GTM', 'Nothing material is broken right now.', 'Every monitored metric is within range.', [['Risks found', '0']], 'Keep monitoring.', 'radar');
    const st = camps.filter((c) => cc(c).label === 'Pause')[0] || nw[0], badCh = paid.filter((c) => c.roas < a.tot.roas * 0.5 && c.sh_spend >= 0.03).sort((p, q) => q.spend - p.spend)[0];
    add('m-stop2', 'What should I stop?', ['what should i stop', 'should i stop', 'stop doing', 'stop spending'], 'CAMPAIGNS', st ? 'Stop spending on ' + st.name.replace(/^Wispr Flow — /, '') + (badCh ? ' and trim ' + badCh.name : '') + '.' : badCh ? 'Trim ' + badCh.name + ', which returns well under your blended ROAS.' : 'Nothing clearly needs to stop.', st ? cc(st).why : badCh ? badCh.name + ' returns ' + F.x(badCh.roas) + ' vs ' + F.x(a.tot.roas) + ' blended.' : 'All spend is earning a reasonable return.', [st ? [st.name.replace(/^Wispr Flow — /, ''), 'CAC ' + F.inrF(st.cac) + ' · ROAS ' + F.x(st.roas)] : null, badCh ? [badCh.name, F.x(badCh.roas) + ' on ' + money(badCh.spend)] : null].filter(Boolean).concat([['Blended ROAS', F.x(a.tot.roas)]]), 'Move the freed budget to a campaign marked Scale.', 'campaigns', [['Campaigns', 'campaigns', {}], ['Channels', 'channels', {}]]);
    const mp = G.monthProj();
    if (mp) add('m-target', 'Are we on target?', ['on target', 'are we on target', 'on pace', 'hit the target', 'hit our target'], 'REVENUE', mp.proj >= T.revenue * 0.95 ? 'Yes. ' + mp.month + ' is on pace for ' + money(mp.proj) + '.' : 'Not yet. ' + mp.month + ' is on pace for ' + money(mp.proj) + ', ' + r0(mp.proj / T.revenue * 100) + '% of the ' + money(T.revenue) + ' target.', 'Month-to-date ' + money(mp.mtd) + '; last 7 days average ' + money(mp.avg7) + ' a day; ' + mp.left + ' days left.', [['Projected', money(mp.proj)], ['Target', money(T.revenue)], ['Gap', money(Math.max(0, T.revenue - mp.proj))]], mp.proj >= T.revenue * 0.95 ? 'Protect the channels producing revenue.' : 'Open the forecast and pick a lever.', 'forecast', [['Forecast', 'forecast', {}]]);
    askCache.set(a, out); return out;
  };
  const rows1 = G.rows;
  G.rows = (id) => { const r = rows1(id); if (id !== 'ask' || !r) return r; let ex; try { ex = extraAsk2(); } catch (e) { console.error(e); return r; } if (!ex.length) return r; const have = new Set(r.map((x) => x.q.toLowerCase())); return r.concat(ex.filter((x) => !have.has(x.q.toLowerCase()))); };
  G.COMMAND_QS = ['What changed today?', 'What is driving growth?', 'What is broken?', 'Where should I invest?', 'What should I stop?', 'What should I do today?', 'Are we on target?'];

  /* ======================= placement ======================= */
  const ext = (id, fn) => {
    const p = G.pages[id]; if (!p) return; const b = p.build;
    p.build = function (root, opts) {
      const api = b.call(this, root, opts) || {}; let ex = {};
      try { ex = fn(root, opts) || {}; } catch (e) { console.error('[growth-os] extending ' + id, e); }
      return Object.assign({}, api, { update() { api.update && api.update.apply(this, arguments); try { ex.update && ex.update(); } catch (e) { console.error(e); } } });
    };
  };
  ext('decisions', () => ({ update() { const t = document.querySelector('.g-canvas table.g-tbl'); if (!t) return; Array.from(t.querySelectorAll('tbody tr')).forEach((tr, i) => { const d = G.decisions()[i]; if (!d || tr.dataset.x) return; tr.dataset.x = 1; const c = tr.children[1]; if (c && (d.owner || d.followUp)) c.append(h('div', { class: 'xs muted', text: [d.owner ? 'Owner: ' + d.owner : '', d.followUp ? 'Follow up: ' + d.followUp : ''].filter(Boolean).join(' · ') })); const r = tr.children[2]; if (r && d.evidence) r.append(h('div', { class: 'xs muted', text: 'Evidence: ' + d.evidence })); }); } }));
})();
