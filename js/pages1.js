(function () {
  'use strict';
  const G = window.G, h = G.h, S = G.S, F = G.F;

  /* ---------- shared cell helpers ---------- */
  G.statusBd = (s) => G.badge(s, { Active: 'green', Scaling: 'dark', 'Needs attention': 'amber', 'Winding down': '', Draft: '', Paused: '', Live: 'green', Running: 'green', Winning: 'dark', Losing: 'red', Inconclusive: 'amber', Connected: 'green', Attention: 'amber', Syncing: 'green', Won: 'dark', Lost: 'red' }[s] || '');
  G.healthDot = (c) => h('span', { class: 'g-dot ' + (c === 'green' ? '' : c === 'amber' ? 'amber' : c === 'red' ? 'red' : 'gray'), title: { green: 'Healthy', amber: 'Needs attention', red: 'Critical', gray: 'Not enough data' }[c] || '' });
  G.healthBd = (c, score) => G.badge({ green: 'Healthy', amber: 'Needs attention', red: 'Critical' }[c] + (score ? ' · ' + score : ''), { green: 'green', amber: 'amber', red: 'red' }[c]);
  G.nm = (name, sub, dot) => h('div', { class: 'nm' }, dot || null, h('div', null, h('div', { text: name }), sub ? h('small', { text: sub }) : null));
  G.ownerAv = (o) => h('span', { class: 'g-row', style: 'gap:6px;flex-wrap:nowrap' }, h('span', { class: 'g-av', text: G.initials(o) }), h('span', { text: o, class: 'sm' }));
  G.safe = (fn) => { try { return fn(); } catch (e) { console.error(e); return h('div', { class: 'muted', text: 'Unable to draw this section.' }); } };
  G.addDraft = (v) => { S.local.drafts = S.local.drafts || []; const id = 'draft-' + (S.local.drafts.length + 1); const d = { id, cid: id, name: v.name, channel: v.channel || 'Multi-channel', owner: v.owner || 'Aarav Mehta', status: 'Draft', health: 'gray', budget: +v.budget || null, goal: v.goal || '' }; S.local.drafts.push(d); return d; };
  G.expModal = (pre, done) => {
    pre = G.J(pre) || {};
    const hyp0 = pre.hyp || pre.hypothesis || '', met0 = pre.primary || pre.metric || 'CTR';
    const METS = ['Signups', 'Visitor → signup rate', 'Signup → activation rate', 'CTR', 'CAC', 'Trial → paid conversion'];
    const fields = [{ k: 'name', label: 'Experiment name', val: pre.name || '', ph: 'e.g. Hindi vs English landing page' }, { k: 'hyp', label: 'Hypothesis', type: 'textarea', val: hyp0, ph: 'If we change X, then Y will improve because Z.' }];
    if (pre.control || pre.variant) fields.push({ k: 'control', label: 'Control', val: pre.control || '' }, { k: 'variant', label: 'Variant', val: pre.variant || '' });
    fields.push({ k: 'metric', label: 'Primary metric', type: 'select', opts: METS.includes(met0) ? METS : METS.concat(met0), val: met0 }, { k: 'sec', label: 'Secondary metrics', val: pre.secondary || 'Signups, Activation, CAC, Revenue' }, { k: 'expo', label: 'Expected outcome', val: pre.expected || '', ph: 'e.g. +54 weekly signups' }, { k: 'split', label: 'Traffic split', type: 'select', opts: ['50 / 50', '70 / 30', '90 / 10'], val: '50 / 50' });
    const form = G.form(fields);
    G.modal({ title: 'Create experiment', sub: pre.control ? 'Prefilled from a GTM Radar signal. Review and start.' : 'Turn a growth idea into a measurable test.', body: form.el, actions: (close) => [G.btn('Cancel', close), G.btn('Create experiment', () => {
      const v = form.get(); if (!v.name.trim()) { G.toast('Name the experiment first', { tone: 'bad' }); return; }
      S.local.exps = S.local.exps || [];
      const ctl = v.control || 'Control', vr = v.variant || 'Variant';
      const e = { id: 'new-' + (S.local.exps.length + 1), scope: pre.scope || 'growth', campaign: '', name: v.name.trim(), hypothesis: v.hyp || 'Hypothesis to be defined.', metric: v.metric, unit: 'pct', baseline: null, target: null, current: null, confidence: 0, status: 'Running', impact: v.expo ? 'Expected: ' + v.expo : 'Collecting data', started: 'Today', ends: 'In 14 days', owner: 'Aarav Mehta', audience: 'India · same targeting for both variants', setup: 'Split ' + v.split + '. Primary metric: ' + v.metric + '. Secondary: ' + v.sec + '. Guardrail metrics: CAC and activation.', variants: [{ name: ctl, traffic: 50, value: 0, n: 0 }, { name: vr, traffic: 50, value: 0, n: 0 }], decision: (v.expo ? 'Expected outcome: ' + v.expo + '. ' : '') + 'Awaiting data. Growth OS will recommend a winner at 95% confidence and feed the result back into GTM Radar.', lift: null, local: true };
      S.local.exps.unshift(e); close(); G.toast('Experiment “' + e.name + '” created and running', { action: { label: 'Open', fn: () => G.go('experiments', { open: e.id }) } }); if (done) done(e);
    }, 'pri')] });
  };
  G.lastN = (rows, n) => rows.slice(-n);
  G.palette_colors = { spend: 'var(--g-ink-3)', traffic: '#7fc6a4', signups: 'var(--g-em)', activated: 'var(--g-forest)', revenue: '#9cc233' };

  /* =========================== HOME =========================== */
  const CAT = { winning: ['WINNING', 'green'], leaking: ['LEAKING', 'amber'], opportunity: ['OPPORTUNITY', 'dark'], risk: ['AT RISK', 'red'] };
  G.CAT = CAT;
  G.campDiag = (rows) => {
    const tc = d3.sum(rows, (r) => r.clicks || 0), tu = d3.sum(rows, (r) => r.customers || 0), bl = tu / Math.max(1, tc);
    return (r) => {
      if (r.clicks == null || r.customers == null || !r.clicks) return null;
      const per = r.customers / r.clicks * 1000, ratio = (r.customers / r.clicks) / bl, share = r.clicks / tc;
      const why = F.c(r.clicks) + ' clicks (' + Math.round(share * 100) + '% of traffic) → ' + per.toFixed(1) + ' customers per 1K clicks vs ' + (bl * 1000).toFixed(1) + ' blended.';
      if (share >= 0.08 && ratio < 0.75) return { tone: r.health === 'red' ? 'red' : 'amber', label: 'High traffic, weak conversion', why };
      if (ratio >= 1.2) return { tone: 'green', label: 'Converting well', why };
      return { tone: '', label: 'On par', why };
    };
  };
  /* Campaign-level recommendation: Scale / Watch / Reduce, from health and CAC against the blend. */
  G.campRec = (rows) => {
    const ok = rows.filter((r) => r.customers), bl = d3.sum(ok, (r) => r.spend || 0) / Math.max(1, d3.sum(ok, (r) => r.customers));
    return (r) => {
      if (r.spend == null || r.customers == null) return { label: 'Hold', tone: '', why: 'No performance data yet.' };
      const rel = r.cac ? r.cac / bl : 1, c = F.inrF(r.cac || 0) + ' CAC vs ' + F.inrF(bl) + ' blended · ' + F.x(r.roas) + ' ROAS';
      if (r.health === 'red' || rel > 1.35) return { label: 'Reduce', tone: 'red', why: c + '. Cut spend or fix the weak step before it burns more budget.' };
      if (r.health === 'green' && rel <= 1.05) return { label: 'Scale', tone: 'green', why: c + '. Efficient and healthy: add budget.' };
      return { label: 'Watch', tone: 'amber', why: c + '. Not yet efficient enough to scale. Hold budget and fix the weakest step.' };
    };
  };
  G.recBd = (rc) => (rc ? G.hover(G.badge(rc.label, rc.tone), () => rc.why) : '—');
  G.signalAct = (s, after) => G.confirm({ title: 'Take action', text: s.apply, detail: 'Recommendation: ' + s.action + ' Nothing changes until you approve it in the destination view.', confirm: 'Confirm', onConfirm: () => { S.done[s.id] = true; G.afterAction && G.afterAction(); G.toast('Done: ' + s.action, { action: { label: 'View', fn: () => G.go(s.go, G.J(s.go_opts || '{}')) } }); after && after(); } });
  G.signalSim = (s) => { const sim = G.J(s.sim); if (sim && sim.moves) G.simModal({ frm: sim.moves[0].frm, moves: sim.moves.map((m) => ({ to: m.to, amount: m.amount })), title: 'Simulate: ' + s.action }); else G.projModal(s); };
  G.signalCard = (s, o) => {
    o = o || {};
    const [lab, tone] = CAT[s.cat], done = S.done[s.id];
    const k = (t) => h('div', { class: 'g-sig-k', text: t });
    return h('div', { class: 'g-sig ' + s.cat + (done ? ' done' : '') },
      h('div', { class: 'g-row', style: 'justify-content:space-between' }, G.badge(lab, tone), done ? G.badge('Actioned', 'green') : G.badge(s.conf + '% confidence')),
      G.mk(h('div', { class: 'g-sig-w', text: s.what }), 'signals', 'what', { id: s.id }),
      k('Evidence'), G.mk(h('div', { class: 'sm', text: s.evidence }), 'signals', 'evidence', { id: s.id }),
      k('Business impact'), G.mk(h('div', { class: 'sm', text: s.impact }), 'signals', 'impact', { id: s.id }),
      h('div', { class: 'g-sig-a' }, h('div', { class: 'g-sig-k', text: 'Recommended action' }), G.mk(h('div', { style: 'font-weight:600', text: s.action }), 'signals', 'action', { id: s.id })),
      h('div', { class: 'g-row g-mt8' }, G.btn('Investigate', () => G.investigate(s), 'sm'), done ? G.btn('Undo', () => { S.done[s.id] = false; G.afterAction && G.afterAction(); o.refresh && o.refresh(); }, 'sm ghost') : G.btn('Take action', () => G.signalAct(s, o.refresh), 'pri sm'), h('button', { class: 'g-link', type: 'button', onclick: () => G.evidenceDrawer(G.J(s.ev)), text: 'Why this?' })));
  };
  G.page('home', {
    ds: ['kpis', 'health', 'series', 'funnel', 'drivers', 'signals', 'campaigns', 'ask', 'priorities', 'channels', 'creatives', 'leads', 'content_compare', 'creators', 'pipeline_kpis', 'creator_kpis'],
    build(root) {
      const f = G.pf('home', { metrics: ['signups', 'spend'], more: false });
      const hr = new Date().getHours();
      const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
      const head = G.head('Growth OS', 'From attention to revenue.', greet + '. Here’s what to do today to know what is driving growth, why, and what to do next.', [G.rangeSel(), G.btn('Open GTM Radar', () => G.go('radar'))]);
      const todayBox = h('div', { class: 'g-gap16' }), changedBox = h('div', { class: 'g-chgs' }), planBox = h('div', { class: 'g-plans' }), healthBox = h('div'), kpiS = h('div', { class: 'g-kpis', style: '--min:210px;margin-top:16px' }), radarBox = h('div', { class: 'g-kpis', style: '--min:260px' });
      const chartBox = h('div', { class: 'g-chart', style: 'min-height:260px' }), togg = h('div', { class: 'g-pill-row g-mb8' }), chartNote = h('div', { class: 'xs muted g-mt8' });
      const funnelBox = h('div', { class: 'g-funnel g-funnel-row' }), drvBox = h('div'), campBox = h('div');
      const METRICS = [['spend', 'Spend'], ['traffic', 'Traffic'], ['signups', 'Signups'], ['activated', 'Activated users'], ['revenue', 'Revenue']];
      METRICS.forEach(([k, l]) => togg.append(h('button', { class: 'g-chip' + (f.metrics.includes(k) ? ' on' : ''), type: 'button', 'data-k': k, 'aria-pressed': f.metrics.includes(k), onclick: () => {
        const on = f.metrics.includes(k);
        if (on && f.metrics.length === 1) { G.toast('Keep at least one metric selected'); return; }
        f.metrics = on ? f.metrics.filter((x) => x !== k) : f.metrics.concat(k);
        togg.querySelectorAll('.g-chip').forEach((c) => { c.classList.toggle('on', f.metrics.includes(c.dataset.k)); c.setAttribute('aria-pressed', f.metrics.includes(c.dataset.k)); });
        draw();
      } }, h('i', { style: 'background:' + G.palette_colors[k] }), l)));
      const campTbl = G.table({
        source: 'campaigns', key: ['range', 'cid'], id: (r) => r.cid, sort: { k: 'revenue', dir: -1 }, onRow: (r) => G.go('campaigns', { open: r.cid }),
        cols: [
          { k: 'name', label: 'Campaign', first: 1, f: (r) => G.nm(r.name, r.owner, G.healthDot(r.health)) },
          { k: 'spend', label: 'Spend', cls: 'r num', hide: 'n', f: (r) => F.inr(r.spend) },
          { k: 'impressions', label: 'Views', cls: 'r num', hide: 'm', f: (r) => F.c(r.impressions) },
          { k: 'clicks', label: 'Clicks', cls: 'r num', hide: 'm', f: (r) => F.c(r.clicks) },
          { k: 'signups', label: 'Signups', cls: 'r num', f: (r) => h('div', null, h('div', { text: F.n(r.signups) }), G.dl(r.d_signups, true)) },
          { k: 'activation', label: 'Activation', cls: 'r num', hide: 'm', f: (r) => F.pct(r.activation) },
          { k: 'customers', label: 'Customers', cls: 'r num', f: (r) => F.n(r.customers) },
          { k: 'cac', label: 'CAC', cls: 'r num', f: (r) => h('div', null, h('div', { text: F.inrF(r.cac) }), G.dl(r.d_cac, false)) },
          { k: 'revenue', label: 'Revenue', cls: 'r num', hide: 'n', f: (r) => F.inr(r.revenue) },
          { k: 'diag', label: 'Diagnosis', nofield: true, sv: (r) => r.customers / Math.max(1, r.clicks), f: (r) => { const d = r.__diag; return d ? G.hover(G.badge(d.label, d.tone), () => d.why) : '—'; } },
          { k: 'rec', label: 'Impact / recommendation', nofield: true, sv: (r) => ({ Scale: 3, Watch: 2, Reduce: 1 }[(r.__rec || {}).label] || 0), f: (r) => G.recBd(r.__rec) },
        ] });
      campBox.append(campTbl.el);
      /* the analytics layer: scorecard, funnel, revenue, drivers and channel contribution (see pages8-9) */
      const SXS = [G.sx.scorecard(), G.sx.funnelPlus(), G.sx.revenue(), G.sx.drivers(), G.sx.contribution(), G.sx.status(), G.sx.trend(), G.sx.perfTabs(), G.sx.oppRisk(), G.sx.outlook(), G.sx.todayStrip(), G.sx.recentDecisions(), G.sx.brief(), G.sx.contribSummary()];
      const [scoreS, funnelS, revS, drvS, conS, statS, trendS, perfS, orS, outS, todS, recS, briefS, csumS] = SXS;
      const more = h('div', { class: 'g-gap16', hidden: !f.more }), moreBtn = h('button', { class: 'g-btn', type: 'button', 'aria-expanded': !!f.more, onclick: () => { f.more = !f.more; more.hidden = !f.more; moreBtn.setAttribute('aria-expanded', f.more); moreBtn.textContent = f.more ? 'Hide detailed overview' : 'Show detailed overview'; } }, f.more ? 'Hide detailed overview' : 'Show detailed overview');
      more.append(G.sec('Growth health', 'A diagnostic layer. Click a dimension to see what is driving it.'), healthBox, kpiS,
        G.sec('Campaign performance', 'Views → Clicks → Signups → Activation → Customers, with a recommendation for each campaign.'), h('div', { class: 'g-card pad0' }, campBox),
        G.sec('Acquisition funnel (stage cards)', 'The same funnel as cards.'), G.card(null, null, funnelBox),
        G.sec('Growth signals', 'What is driving net-new growth.'), h('div', { class: 'g-grid' },
          h('div', { class: 's8' }, G.card('Growth overview', 'Toggle metrics to compare. Hover for daily values.', h('div', null, togg, chartBox, chartNote))),
          h('div', { class: 's4' }, G.card('What’s driving growth?', 'Ranked by contribution to net-new growth', drvBox))));
      root.append(head, G.flowRibbon(),
        G.sec('Growth status', 'The numbers that matter, against the previous period and your targets. Click one for its history.'), statS.el, G.sec('Today’s growth brief', 'Five things to know: what drives growth, what threatens it, and what to do.'), briefS.el, scoreS.el,
        G.sec('Today’s objective', 'Where you stand against today’s objective, and the one thing to do about it.'), todayBox, todS.el,
        G.sec('What changed', 'What moved, why it matters, and what to do. Each one is connected to GTM Radar.', G.btn('Open GTM Radar', () => G.go('radar'), 'sm')), changedBox,
        G.sec('Growth over time', 'Pick a metric. Actual, previous period, target and forecast on one chart.'), trendS.el,
        G.sec('Growth funnel', 'From attention to revenue: where users drop, and why.'), funnelS.el,
        G.sec('Where growth comes from', 'Contribution by channel.'), conS.el, csumS.el,
        G.sec('Efficiency and performance', 'Channels, campaigns and creators on one scale: what to scale, fix or stop.'), perfS.el,
        G.sec('Opportunities and risks', 'What to chase and what to protect, ranked.'), orS.el,
        G.sec('Today’s growth priorities', 'Ranked actions from GTM Radar. Simulate before you apply anything.'), planBox, G.askBar(),
        G.sec('GTM Radar', 'The few signals that matter right now: evidence, business impact and what to do.', G.btn('All signals', () => G.go('radar'), 'sm')), radarBox,
        G.sec('Revenue growth', 'Are we on pace for the target?'), revS.el,
        G.sec('What drove growth', 'Why revenue changed.'), drvS.el,
        G.sec('Forecast', 'Where the month closes and what it takes to hit the target.', G.btn('Open Forecast', () => G.go('forecast'), 'sm')), outS.el,
        G.sec('Recent decisions', 'The loop from recommendation to result.'), recS.el,
        h('div', { class: 'g-more' }, moreBtn), more);

      function draw() {
        const all = G.rows('series') || [];
        const n = G.RN[S.range], rows = all.slice(-n);
        const ser = f.metrics.map((k) => {
          const raw = rows.map((r) => r[k]); const base = d3.mean(raw.slice(0, 3)) || 1;
          const label = METRICS.find((m) => m[0] === k)[1];
          return { name: label, color: G.palette_colors[k], raw, data: rows.map((r, i) => [new Date(r.date), f.metrics.length > 1 ? (raw[i] / base) * 100 : raw[i]]), k };
        });
        const idx = f.metrics.length > 1;
        G.mk(chartBox, 'series');
        G.line(chartBox, { series: ser, height: 260, zero: !idx, yFmt: (v) => (idx ? String(Math.round(v)) : f.metrics[0] === 'spend' || f.metrics[0] === 'revenue' ? F.inr(v) : F.c(v)), tipFmt: (v, s) => (s.k === 'spend' || s.k === 'revenue' ? F.inrF(v) : F.n(v)), label: 'Growth overview chart' });
        chartNote.textContent = idx ? 'Indexed view — each metric starts at 100 so different scales can be compared. Hover for actual values.' : 'Daily values for ' + G.RL[S.range].toLowerCase() + '.';
      }
      function update() {
        const R = S.range, kp = G.byRange('kpis');
        G.homeIntel(R, { today: todayBox, changed: changedBox, plan: planBox }, update);
        const hs = G.byRange('health').sort((a, b) => a.order - b.order), ov = hs[0];
        healthBox.replaceChildren(G.card(null, null, h('div', { class: 'g-health' },
          h('div', null, h('div', { class: 'g-eyebrow', text: 'Growth health — ' + G.RL[R] }),
            h('div', { class: 'g-row', style: 'align-items:baseline;gap:12px' }, G.mk(h('span', { class: 'g-score num', text: ov.score }), 'health', 'score', { range: R, dim: 'overall' }), h('span', { class: 'g-score' }, h('small', { text: '/ 100' }))),
            h('div', { class: 'g-row g-mt8' }, G.mk(G.badge(ov.status, ov.score >= 80 ? 'green' : 'amber'), 'health', 'status', { range: R, dim: 'overall' }), G.mk(G.dl(ov.delta, true, ' pts'), 'health', 'delta', { range: R, dim: 'overall' }), h('span', { class: 'muted xs', text: 'vs previous period' })),
            G.mk(h('div', { class: 'sm g-mt8', style: 'color:var(--g-ink-2)', text: ov.note }), 'health', 'note', { range: R, dim: 'overall' })),
          h('div', { class: 'g-dims' }, hs.slice(1).map((d) => G.hover(h('div', { class: 'g-dim click', role: 'button', tabindex: '0', onclick: () => G.dimDrill(d.dim), onkeydown: (e) => { if (e.key === 'Enter') G.dimDrill(d.dim); } }, h('div', { class: 't', text: d.label }), h('div', { class: 'v' }, G.mk(h('span', { text: d.score }), 'health', 'score', { range: R, dim: d.dim }), G.mk(G.dl(d.delta, true, ''), 'health', 'delta', { range: R, dim: d.dim })), G.pbar(d.score, d.score >= 80 ? '' : d.score >= 72 ? 'amber' : 'red'), d.score < 80 ? h('div', { class: 'xs', style: 'color:var(--g-amber);margin-top:4px', text: 'Weak — see what’s driving it →' }) : null), () => h('div', null, h('b', { text: d.label }), h('div', { text: d.note || '' }))))))));
        const ORDER = ['spend', 'clicks', 'signups', 'activated', 'customers', 'cac', 'revenue'];
        kpiS.replaceChildren(...ORDER.map((m) => kp.find((k) => k.metric === m)).filter(Boolean).map((k) => G.kpiCard(k.metric === 'activated' ? Object.assign({}, k, { label: 'Activated users' }) : k, { driver: true })));
        // GTM Radar: top signal per category
        const sg = G.byRange('signals').sort((a, b) => a.order - b.order);
        radarBox.replaceChildren(...['winning', 'leaking', 'opportunity', 'risk'].map((c) => sg.find((x) => x.cat === c)).filter(Boolean).map((x) => G.signalCard(x, { refresh: update })));
        // campaigns
        const cps = G.byRange('campaigns').filter((r) => r.status !== 'Draft'), dg = G.campDiag(cps);
        const rc = G.campRec(cps);
        cps.forEach((r) => { r.__diag = dg(r); r.__rec = rc(r); });
        campTbl.set(cps);
        draw();
        SXS.forEach((x) => { x.update(); requestAnimationFrame(() => { if (x.el.isConnected) x.update(); }); });
        const NAMES = { Impressions: 'Views', Clicks: 'Clicks', Signups: 'Signups', 'Activated Users': 'Activation', Customers: 'Customers' };
        const fr = G.byRange('funnel').sort((a, b) => a.order - b.order).filter((x) => NAMES[x.stage]);
        const prevCount = {};
        funnelBox.replaceChildren(...fr.map((s, i) => {
          const prev = i ? fr[i - 1] : null, conv = prev ? s.count / prev.count * 100 : null;
          return h('div', { class: 'g-fs' + (s.flag === 'watch' ? ' watch' : '') },
            h('div', { class: 'h' }, h('span', { class: 'sm', text: NAMES[s.stage] }), s.flag === 'watch' ? G.badge('Watch', 'red') : null),
            G.mk(h('div', { class: 'n', style: 'font-size:22px', text: F.c(s.count) }), 'funnel', 'count', { range: R, stage: s.stage }),
            conv == null ? h('div', { class: 'xs muted', text: 'Top of funnel' }) : h('div', { class: 'xs' }, G.mk(h('b', { text: F.pct(s.rate, s.rate < 10 ? 2 : 1) }), 'funnel', 'rate', { range: R, stage: s.stage }), ' of previous stage ', G.mk(G.dl(s.rate_delta, true), 'funnel', 'rate_delta', { range: R, stage: s.stage })));
        }));
        const drv = G.byRange('drivers').sort((a, b) => a.rank - b.rank);
        drvBox.replaceChildren(...drv.map((d) => G.hover(h('div', { class: 'g-drv', role: 'button', tabindex: '0', onclick: () => G.go(d.channel === 'Creators' ? 'creators' : d.channel === 'Referral' ? 'campaigns' : 'channels'), onkeydown: (e) => e.key === 'Enter' && e.target.click() },
          h('div', { class: 'g-rank', text: d.rank }), h('div', { style: 'min-width:0' }, G.mk(h('div', { class: 'nm', text: d.name }), 'drivers', 'name', { range: R, rank: d.rank }),
            h('div', { class: 'ch' }, G.mk(h('span', { text: F.d(d.change) }), 'drivers', 'change', { range: R, rank: d.rank }), ' ', d.metric),
            h('div', { class: 'xs muted' }, F.n(d.net_new) + ' net-new · ' + F.pct(d.share, 0) + ' of growth'))), () => h('div', null, h('b', { text: d.name }), h('div', { text: d.text })))));
      }
      return { update };
    },
  });

  /* =========================== CAMPAIGNS =========================== */
  G.page('campaigns', {
    ds: ['campaigns', 'channels', 'signals', 'funnel'],
    build(root, opts) {
      const f = G.pf('campaigns', { q: '', channel: '', status: '', owner: '', health: '', open: null, tab: 'overview', cacMin: 0 });
      f.open = null; f.cacMin = 0; Object.assign(f, opts || {});
      S.local.drafts = S.local.drafts || [];
      const view = h('div');
      root.append(view);
      let listApi = null;

      function newCampaign() {
        const form = G.form([{ k: 'name', label: 'Campaign name', ph: 'e.g. Wispr Flow for Indian Developers' }, { k: 'goal', label: 'Goal', ph: 'e.g. 5,000 signups at CAC ≤ ₹3,000' },
          { k: 'channel', label: 'Primary channel', type: 'select', opts: ['Multi-channel', 'Creators', 'Google Ads', 'Meta', 'Instagram', 'LinkedIn', 'YouTube', 'Reddit', 'Referral'] },
          { k: 'owner', label: 'Owner', type: 'select', opts: ['Aarav Mehta', 'Diya Nair', 'Rohan Iyer', 'Meera Kapoor'] }, { k: 'budget', label: 'Monthly budget (₹)', type: 'number', ph: '150000' }]);
        G.modal({ title: 'New campaign', sub: 'Creates a draft. Nothing is spent until you launch it.', body: form.el, actions: (close) => [G.btn('Cancel', close), G.btn('Create draft', () => {
          const v = form.get();
          if (!v.name.trim()) { G.toast('Give the campaign a name first', { tone: 'bad' }); return; }
          S.local.drafts.push({ id: 'draft-' + (S.local.drafts.length + 1), cid: 'draft-' + (S.local.drafts.length + 1), name: v.name.trim(), channel: v.channel, owner: v.owner, status: 'Draft', health: 'gray', budget: +v.budget || null, goal: v.goal });
          close(); G.toast('Draft campaign “' + v.name.trim() + '” created'); f.open = null; draw();
        }, 'pri')] });
      }

      function listView() {
        const camps = G.byRange('campaigns').concat([]);
        const tools = h('div', { class: 'g-tools' });
        const q = G.search('Search campaigns', (v) => { f.q = v; fill(); }, f.q);
        const chOpts = [{ v: '', l: 'All channels' }].concat(['Google Ads', 'Meta', 'Instagram', 'LinkedIn', 'X', 'YouTube', 'Reddit', 'Organic', 'Referral', 'Creators'].map((c) => ({ v: c, l: c })));
        const stOpts = [{ v: '', l: 'All statuses' }].concat(['Active', 'Scaling', 'Needs attention', 'Winding down', 'Draft'].map((c) => ({ v: c, l: c })));
        const owOpts = [{ v: '', l: 'All owners' }].concat(['Aarav Mehta', 'Diya Nair', 'Rohan Iyer', 'Meera Kapoor'].map((c) => ({ v: c, l: c })));
        const hChips = h('div', { class: 'g-pill-row' });
        tools.append(q, G.rangeSel(), G.sel(chOpts, f.channel, (v) => { f.channel = v; fill(); }, 'Channel'), G.sel(stOpts, f.status, (v) => { f.status = v; fill(); }, 'Status'), G.sel(owOpts, f.owner, (v) => { f.owner = v; fill(); }, 'Owner'),
          h('span', { id: 'cac-chip' }));
        const tbl = G.table({
          source: 'campaigns', key: ['range', 'cid'], id: (r) => r.cid, sort: { k: 'revenue', dir: -1 }, empty: G.empty('◎', 'No campaigns match these filters', 'Clear a filter or create a new campaign.', G.btn('Clear filters', () => { Object.assign(f, { q: '', channel: '', status: '', owner: '', health: '', cacMin: 0 }); draw(); })),
          onRow: (r) => { if (r.status === 'Draft') return G.toast('Draft campaigns have no performance yet — add channels and launch to start tracking.'); f.open = r.cid; f.tab = 'overview'; draw(); },
          cols: [
            { k: 'name', label: 'Campaign', first: 1, f: (r) => G.nm(r.name, r.owner, G.healthDot(r.health)) },
            { k: 'channel', label: 'Channel', hide: 'm', f: (r) => h('span', { class: 'sm', text: r.channel }) },
            { k: 'spend', label: 'Spend', cls: 'r num', f: (r) => (r.spend == null ? '—' : F.inr(r.spend)) },
            { k: 'impressions', label: 'Impressions', cls: 'r num', hide: 'n', f: (r) => (r.impressions == null ? '—' : F.c(r.impressions)) },
            { k: 'clicks', label: 'Clicks', cls: 'r num', hide: 'm', f: (r) => (r.clicks == null ? '—' : F.c(r.clicks)) },
            { k: 'ctr', label: 'CTR', cls: 'r num', hide: 'm', f: (r) => (r.ctr == null ? '—' : F.pct(r.ctr, 2)) },
            { k: 'signups', label: 'Signups', cls: 'r num', f: (r) => (r.signups == null ? '—' : h('div', null, h('div', { text: F.n(r.signups) }), G.dl(r.d_signups, true))) },
            { k: 'activation', label: 'Activation', cls: 'r num', hide: 'm', f: (r) => (r.activation == null ? '—' : F.pct(r.activation)) },
            { k: 'customers', label: 'Customers', cls: 'r num', f: (r) => (r.customers == null ? '—' : F.n(r.customers)) },
            { k: 'cac', label: 'CAC', cls: 'r num', f: (r) => (r.cac == null ? '—' : h('div', null, h('div', { text: F.inrF(r.cac) }), G.dl(r.d_cac, false))) },
            { k: 'revenue', label: 'Revenue', cls: 'r num', f: (r) => (r.revenue == null ? '—' : F.inr(r.revenue)) },
            { k: 'roas', label: 'ROAS', cls: 'r num', hide: 'm', f: (r) => (r.roas == null ? '—' : F.x(r.roas)) },
            { k: 'trend', label: 'Trend', hide: 'n', sv: (r) => r.d_signups, f: (r) => (r.trend ? G.spark(G.J(r.trend), { w: 72, h: 24, tone: G.tone(r.d_signups, true) }) : '—') },
            { k: 'diag', label: 'Diagnosis', nofield: true, hide: 'm', sv: (r) => (r.customers == null ? null : r.customers / Math.max(1, r.clicks)), f: (r) => { const d = r.__diag; return d ? G.hover(G.badge(d.label, d.tone), () => d.why) : '—'; } },
            { k: 'rec', label: 'Impact / recommendation', nofield: true, sv: (r) => ({ Scale: 3, Watch: 2, Reduce: 1 }[(r.__rec || {}).label] || 0), f: (r) => G.recBd(r.__rec) },
            { k: 'status', label: 'Status', hide: 'n', f: (r) => G.statusBd(r.status) },
          ] });
        function fill() {
          const all = camps.concat(S.local.drafts.map((d) => Object.assign({ range: S.range }, d)));
          const ql = f.q.toLowerCase();
          const rows = all.filter((r) => (!ql || (r.name + ' ' + r.owner + ' ' + r.channel).toLowerCase().includes(ql)) && (!f.channel || (r.chs || []).includes(f.channel) || r.channel === f.channel) && (!f.status || r.status === f.status) && (!f.owner || r.owner === f.owner) && (!f.health || r.health === f.health) && (!f.cacMin || (r.cac || 0) > f.cacMin));
          const dg = G.campDiag(camps.filter((r) => r.clicks != null)), rc = G.campRec(camps.filter((r) => r.clicks != null));
          rows.forEach((r) => { r.__diag = dg(r); r.__rec = rc(r); });
          tbl.set(rows);
          const cnt = (c) => all.filter((r) => r.health === c).length;
          hChips.replaceChildren(...[['', 'All', all.length, ''], ['green', 'Healthy', cnt('green'), ''], ['amber', 'Needs attention', cnt('amber'), 'amber'], ['red', 'Critical', cnt('red'), 'red']].map(([k, l, n, c]) => h('button', { class: 'g-chip' + (f.health === k ? ' on' : ''), type: 'button', onclick: () => { f.health = k; fill(); } }, k ? h('span', { class: 'g-dot ' + (k === 'green' ? '' : c) }) : null, l + ' · ' + n)));
          const chip = tools.querySelector('#cac-chip'); chip.replaceChildren(f.cacMin ? h('button', { class: 'g-chip on', onclick: () => { f.cacMin = 0; fill(); } }, 'CAC above ₹' + F.n(f.cacMin) + ' ✕') : '');
        }
        fill();
        const rangeNote = h('div', { class: 'xs muted g-mt8', text: G.RL[S.range] + ' · Click a row to open the campaign workspace.' });
        return h('div', null, G.head('Growth', 'Campaigns', 'Track every growth initiative from spend to revenue.', [G.btn('+ New Campaign', newCampaign, 'pri')]), tools, hChips, h('div', { class: 'g-card pad0 g-mt8' }, tbl.el), rangeNote,
          G.sec('Campaign comparison', 'Every campaign on one scale. Sort by any metric.'), G.live(G.sx.campaigns()).el, G.sec('Performance trend', 'Is it getting better or worse? Filter by channel or campaign.'), G.live(G.sx.perf()).el);
      }

      /* ----- detail workspace ----- */
      function detailView() {
        const row = (G.rows('campaigns') || []).find((r) => r.range === S.range && r.cid === f.open);
        if (!row) { f.open = null; return listView(); }
        const det = (G.rows('campaign_detail') || []).find((r) => r.id === f.open);
        const wrap = h('div');
        wrap.append(h('div', { class: 'g-row g-mb8' }, G.btn('← All campaigns', () => { f.open = null; draw(); }, 'ghost sm'), h('span', { class: 'muted xs', text: 'Campaigns / ' + row.name })));
        wrap.append(G.head('Campaign workspace', row.name, row.goal, [G.healthBd(row.health, row.health_score), G.statusBd(row.status), h('span', { class: 'sm muted', text: 'Owner: ' + row.owner })]));
        // recommendation
        if (det && !S.dismissed[f.open]) {
          const done = S.applied[f.open];
          const recBox = h('div', { class: 'g-card g-rec ' + (done ? 'mint' : ''), style: 'margin-bottom:24px' },
            h('div', { class: 'g-eyebrow', text: done ? 'Applied' : 'Recommended next action' }),
            h('div', { class: 'g-row', style: 'align-items:flex-start' }, h('div', { style: 'flex:1 1 320px;min-width:0' }, G.mk(h('div', { style: 'font-size:17px;font-weight:600', text: det.rec_title }), 'campaign_detail', 'rec_title', { id: det.id }),
              h('p', { class: 'g-mt8', text: det.rec_text }), h('p', { class: 'sm g-mt8' }, h('b', { text: 'Reason: ' }), G.mk(h('span', { text: det.rec_reason }), 'campaign_detail', 'rec_reason', { id: det.id })), h('p', { class: 'sm muted', text: det.rec_impact })),
              done ? h('div', { class: 'g-gap8' }, h('div', { class: 'bd green', text: '✓ Budget change queued for approval' }), G.btn('Undo', () => { S.applied[f.open] = false; draw(); })) :
                h('div', { class: 'g-gap8', style: 'min-width:170px' }, G.btn('Apply recommendation', () => G.confirm({ title: det.rec_title, text: det.rec_text, detail: det.rec_impact + '. You can undo this from the campaign workspace.', confirm: 'Apply recommendation', onConfirm: () => { S.applied[f.open] = true; draw(); G.logDecision({ title: det.rec_title, reason: det.rec_reason, expected: det.rec_impact, kind: 'budget' }); } }), 'pri'),
                  G.btn('View evidence', () => G.drawer({ title: 'Evidence', sub: det.rec_title, body: h('div', { class: 'g-gap16' }, h('p', { text: det.rec_reason }), h('div', { class: 'g-ev' }, G.J(det.rec_evidence).map((e) => h('div', null, h('small', { text: e.label }), h('b', { text: e.value })))), h('p', { class: 'muted sm', text: 'Evidence is computed from the last 30 days of connected ad, analytics and CRM data. Recommendations never apply automatically.' })), footer: (c) => [G.btn('Close', c), G.btn('Open Channels & Ads', () => G.go('channels'))] })),
                  G.btn('Dismiss', () => { S.dismissed[f.open] = true; draw(); G.toast('Recommendation dismissed', { action: { label: 'Undo', fn: () => { S.dismissed[f.open] = false; draw(); } } }); }, 'ghost'))));
          wrap.append(recBox);
        } else if (det && S.dismissed[f.open]) {
          wrap.append(h('div', { class: 'g-card', style: 'margin-bottom:24px' }, h('div', { class: 'g-row' }, h('span', { class: 'muted', text: 'Recommendation dismissed.' }), G.btn('Restore', () => { S.dismissed[f.open] = false; draw(); }, 'sm'))));
        }
        const k = [
          { label: 'Spend', value: row.spend, unit: 'inr', delta: null, sub: 'of ' + F.inr(row.budget) + ' monthly budget', f: { value: 'spend' }, metric: 'spend' },
          { label: 'Signups', value: row.signups, unit: 'num', delta: row.d_signups, good_up: true, f: { value: 'signups', delta: 'd_signups' }, sub: 'vs previous period' },
          { label: 'CAC', value: row.cac, unit: 'inr', delta: row.d_cac, good_up: false, f: { value: 'cac', delta: 'd_cac' }, sub: 'vs previous period' },
          { label: 'Revenue', value: row.revenue, unit: 'inr', delta: null, f: { value: 'revenue' }, sub: F.n(row.customers) + ' customers' },
          { label: 'ROAS', value: row.roas, unit: 'x', delta: row.d_roas, good_up: true, f: { value: 'roas', delta: 'd_roas' }, sub: 'vs previous period' }];
        wrap.append(h('div', { class: 'g-kpis', style: '--min:170px' }, k.map((r) => G.kpiCard(r, { src: 'campaigns', where: { range: S.range, cid: row.cid } }))));
        const TL = { overview: 'Overview', funnel: 'Funnel', performance: 'Performance', creatives: 'Creative performance', channels: 'Channel contribution', creators: 'Creator contribution', radar: 'GTM Radar signals', actions: 'Recommended actions', audience: 'Audience', leads: 'Leads', attribution: 'Attribution', experiments: 'Experiments', activity: 'Activity' };
        const tabs = G.tabs(Object.keys(TL).map((t) => ({ v: t, l: TL[t] })), f.tab, (v) => { f.tab = v; tabBody(); });
        const body = h('div');
        wrap.append(h('div', { class: 'g-mt16' }, tabs), body);
        function tabBody() {
          body.replaceChildren(G.safe(() => tab(f.tab, row, det)));
        }
        tabBody();
        return wrap;
      }

      function funnelTab(row) {
        const chs = G.byRange('channels'), vis = d3.sum(chs, (c) => c.visitors), clk = d3.sum(chs, (c) => c.clicks) || 1;
        const all = G.byRange('campaigns').filter((c) => c.clicks != null);
        const mk = (c) => { const landing = Math.round(c.clicks * vis / clk), act = Math.round(c.signups * c.activation / 100); return [['Impressions', c.impressions], ['Clicks', c.clicks], ['Landing visits', landing], ['Signups', c.signups], ['Activated', act], ['Customers', c.customers], ['Revenue', c.revenue]]; };
        const st = mk(row), bl = all.map(mk), conv = (a, i) => (i && a[i - 1][1] ? a[i][1] / a[i - 1][1] : null);
        const blend = (i) => { const n = d3.sum(bl, (a) => a[i][1]), d = d3.sum(bl, (a) => a[i - 1][1]); return d ? n / d : null; };
        const rel = st.map((x, i) => (i && i < 6 ? conv(st, i) / blend(i) : 9)), worst = rel.indexOf(Math.min(...rel.slice(1, 6)));
        const mx = st[0][1] || 1;
        const rows = st.map(([l, v], i) => { const cv = conv(st, i), isRev = l === 'Revenue', leak = i === worst && rel[i] < 0.85;
          return h('div', { class: 'g-row', style: 'flex-wrap:nowrap;gap:12px;padding:6px 0' }, h('div', { style: 'width:120px;flex:none' }, h('b', { text: l })),
            h('div', { style: 'flex:1;min-width:0' }, isRev ? h('div', { class: 'sm muted', text: F.inr(v / Math.max(1, row.customers)) + ' per customer' }) : h('div', { class: 'g-bar ' + (leak ? 'amber' : ''), style: 'height:12px' }, h('i', { style: `width:${Math.max(2, Math.pow(v / mx, 0.35) * 100)}%` }))),
            h('div', { class: 'num', style: 'width:92px;text-align:right;font-weight:600', text: isRev ? F.inr(v) : F.c(v) }),
            h('div', { class: 'xs', style: 'width:150px;text-align:right', }, cv == null ? '' : isRev ? '' : [F.pct(cv * 100, cv < 0.1 ? 2 : 1), blend(i) ? h('span', { class: 'muted', text: ' vs ' + F.pct(blend(i) * 100, blend(i) < 0.1 ? 2 : 1) + ' avg' }) : null], leak ? G.badge('Biggest leak', 'amber') : null)); });
        const w = st[worst];
        return G.card('Impressions → Clicks → Landing visits → Signups → Activated → Customers → Revenue', 'Bar length is volume (compressed scale). Conversion is compared with the average of all campaigns.', h('div', null, rows, rel[worst] < 0.85 ? h('div', { class: 'g-ai g-mt16' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'Where it leaks'), h('p', { text: `${st[worst - 1][0]} → ${w[0]} converts at ${F.pct(conv(st, worst) * 100, 1)} against ${F.pct(blend(worst) * 100, 1)} across campaigns. Fix this step before adding budget.` })) : h('div', { class: 'g-ai g-mt16' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'Funnel is healthy'), h('p', { text: 'No step converts materially below the campaign average.' })), h('div', { class: 'xs muted g-mt8', text: 'Landing visits are estimated from the account-wide click → visit rate.' })));
      }
      function channelTab(row, det) {
        const at = det ? G.J(det.attribution) : [], ch = {}; G.byRange('channels').forEach((c) => (ch[c.channel] = c));
        const rows = at.map((a) => Object.assign({}, a, { cac: (ch[a.source] || {}).cac, roas: (ch[a.source] || {}).roas }));
        const tb = G.table({ source: 'campaign_detail', key: ['source'], id: (r) => r.source, sort: { k: 'customers', dir: -1 }, empty: G.empty('≋', 'No channel data', 'Channels appear once the campaign has attributed customers.'), cols: [{ k: 'source', label: 'Channel', first: 1, nofield: true, f: (r) => h('b', { text: r.source }) }, { k: 'customers', label: 'Customers', cls: 'r num', nofield: true, f: (r) => F.n(r.customers) }, { k: 'share', label: 'Contribution', nofield: true, f: (r) => h('div', { class: 'g-meter' }, h('span', { class: 'num', text: r.share + '%' }), G.pbar(r.share * 1.6)) }, { k: 'cac', label: 'Channel CAC', cls: 'r num', nofield: true, f: (r) => (r.cac ? F.inrF(r.cac) : '—') }, { k: 'roas', label: 'Channel ROAS', cls: 'r num', nofield: true, f: (r) => (r.roas ? F.x(r.roas) : '—') }] });
        tb.el.removeAttribute('data-source'); tb.set(rows);
        const best = rows.slice().sort((a, b) => (b.roas || 0) - (a.roas || 0))[0];
        return h('div', { class: 'g-gap16' }, h('div', { class: 'g-card pad0' }, tb.el), best ? h('div', { class: 'g-ai' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'Channel read'), h('p', { text: `${best.source} has the best return in this campaign (${best.roas ? F.x(best.roas) : '—'} ROAS). Shift budget toward it before adding spend elsewhere.` }), h('div', { class: 'g-row' }, G.btn('Model a shift', () => G.go('channels', { sim: true }), 'sm'), G.btn('Open Channels', () => G.go('channels'), 'sm'))) : null);
      }
      function radarTab(row) {
        const sg = G.byRange('signals').sort((a, b) => a.order - b.order), key = (row.cid || '').toLowerCase(), nm = (row.name || '').toLowerCase().replace('wispr flow — ', '');
        const rel = sg.filter((x) => (JSON.stringify([x.go_opts, x.inv_opts]) + x.what + x.evidence).toLowerCase().includes(key) || (nm && (x.what + x.evidence).toLowerCase().includes(nm)) || (row.chs || []).some((c) => (x.what + x.evidence).includes(c) && c !== 'Organic'));
        const list = rel.length ? rel.slice(0, 4) : sg.slice(0, 2);
        return h('div', { class: 'g-gap16' }, h('div', { class: 'sm muted', text: rel.length ? rel.length + ' signal' + (rel.length === 1 ? '' : 's') + ' connected to this campaign.' : 'No signal is specific to this campaign. Showing the top account-level signals.' }), h('div', { class: 'g-grid' }, list.map((x) => h('div', { style: 'grid-column:span 6;min-width:0' }, G.signalCard(x, { refresh: draw })))), G.btn('Open GTM Radar', () => G.go('radar'), 'sm'));
      }
      function actionsTab(row, det) {
        const rc = G.campRec(G.byRange('campaigns').filter((c) => c.clicks != null))(row), items = [];
        if (det) items.push([det.rec_title, det.rec_reason + ' ' + det.rec_impact, 'Apply', () => G.confirm({ title: det.rec_title, text: det.rec_text, detail: det.rec_impact, confirm: 'Apply recommendation', onConfirm: () => { S.applied[row.cid] = true; G.logDecision({ title: det.rec_title, reason: det.rec_reason, expected: det.rec_impact, kind: 'budget' }); draw(); } })]);
        items.push([rc.label + ' this campaign', rc.why, rc.label === 'Scale' ? 'Simulate' : 'Open Forecast', () => (rc.label === 'Scale' ? G.simModal({ frm: 'Meta', moves: [{ to: 'Creators', amount: 60000 }], title: 'Simulate scaling' }) : G.go('forecast', { pick: rc.label === 'Reduce' ? 'cut-10' : 'base' }))]);
        items.push(['Run a creative or landing-page test', 'Turn the weakest funnel step into a measurable experiment.', 'Create experiment', () => G.go('experiments', { create: true, prefill: { name: row.name + ' — funnel fix', hypothesis: 'Improving the weakest funnel step lifts signups at the same spend.', primary: 'Signups', scope: 'growth' } })]);
        items.push(['Follow up with campaign leads', 'High-intent leads from this campaign are waiting for a touch.', 'Open leads', () => G.go('leads', { filter: 'followup' })]);
        return h('div', { class: 'g-gap8' }, items.map(([t, why, btn, fn], i) => h('div', { class: 'g-card' }, h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('div', { style: 'min-width:0' }, h('div', { class: 'xs muted', text: 'ACTION ' + (i + 1) }), h('b', { text: t }), h('div', { class: 'sm muted', text: why })), G.btn(btn, fn, i === 0 ? 'pri' : '')))));
      }

      function tab(t, row, det) {
        const cid = row.cid;
        if (t === 'funnel') return G.safe(() => funnelTab(row));
        if (t === 'channels') return channelTab(row, det);
        if (t === 'radar') return radarTab(row);
        if (t === 'actions') return actionsTab(row, det);
        const loadingCard = () => G.card(null, null, G.skel(4, 24));
        if (t === 'overview' || t === 'performance') {
          if (!det) return loadingCard();
          const perf = G.J(det.perf), box = h('div', { class: 'g-chart', style: 'min-height:240px' });
          const sel = { m: ['signups'] };
          const togg = h('div', { class: 'g-pill-row g-mb8' });
          const mm = [['spend', 'Spend'], ['signups', 'Signups'], ['revenue', 'Revenue']];
          const redraw = () => {
            const idx = sel.m.length > 1;
            const ser = sel.m.map((k) => { const raw = perf.map((p) => p[k]); const b = d3.mean(raw.slice(0, 3)) || 1; return { k, name: mm.find((x) => x[0] === k)[1], color: G.palette_colors[k], raw, data: perf.map((p, i) => [new Date(p.date), idx ? raw[i] / b * 100 : raw[i]]) }; });
            G.mk(box, 'campaign_detail', 'perf', { id: cid });
            G.line(box, { series: ser, height: 240, zero: !idx, yFmt: (v) => (idx ? String(Math.round(v)) : sel.m[0] === 'signups' ? F.c(v) : F.inr(v)), tipFmt: (v, s) => (s.k === 'signups' ? F.n(v) : F.inrF(v)) });
          };
          mm.forEach(([k, l]) => togg.append(h('button', { class: 'g-chip' + (sel.m.includes(k) ? ' on' : ''), 'data-k': k, type: 'button', onclick: () => { const on = sel.m.includes(k); if (on && sel.m.length === 1) return; sel.m = on ? sel.m.filter((x) => x !== k) : sel.m.concat(k); togg.querySelectorAll('.g-chip').forEach((c) => c.classList.toggle('on', sel.m.includes(c.dataset.k))); redraw(); } }, h('i', { style: 'background:' + G.palette_colors[k] }), l)));
          const out = h('div', { class: 'g-gap16' });
          const chartCard = G.card('Daily performance', 'Last 30 days · ' + row.name, h('div', null, togg, box));
          const top = (det.attribution && G.J(det.attribution)[0]) || null;
          const why = G.card('Why it is performing this way', 'Diagnosis', h('div', { class: 'g-gap8' },
            h('p', { text: top ? `${top.source} produced ${top.share}% of this campaign’s customers (${top.customers}).` : 'No attributed customers yet.' }),
            h('p', { class: 'sm', style: 'color:var(--g-ink-2)', text: `Signup → activation is ${F.pct(row.activation)} (${F.d(row.d_activation)} vs previous period). CAC is ${F.inrF(row.cac)} against a blended ₹3,617.` }),
            h('p', { class: 'sm muted', text: 'Budget: ' + F.inr(row.spend) + ' spent of ' + F.inr(row.budget) + ' monthly.' }), G.pbar(Math.min(100, row.spend / row.budget * 100), row.spend / row.budget > .9 ? 'amber' : '')));
          out.append(h('div', { class: 'g-grid' }, h('div', { class: 's8' }, chartCard), h('div', { class: 's4' }, why)));
          setTimeout(redraw, 0);
          if (t === 'performance') {
            const tb = G.table({ source: 'campaign_detail', key: ['date'], id: (r) => r.date, sort: { k: 'date', dir: -1 }, cols: [{ k: 'date', label: 'Date', first: 1, nofield: true, f: (r) => F.date(r.date) }, { k: 'spend', label: 'Spend', cls: 'r num', nofield: true, f: (r) => F.inrF(r.spend) }, { k: 'signups', label: 'Signups', cls: 'r num', nofield: true, f: (r) => F.n(r.signups) }, { k: 'revenue', label: 'Revenue', cls: 'r num', nofield: true, f: (r) => F.inrF(r.revenue) }, { k: 'cpa', label: 'Spend / signup', cls: 'r num', nofield: true, sv: (r) => r.spend / Math.max(1, r.signups), f: (r) => F.inrF(r.spend / Math.max(1, r.signups)) }] });
            tb.el.removeAttribute('data-source'); tb.set(perf.map((p) => Object.assign({ id: p.date }, p)));
            out.append(G.card('Daily breakdown', 'Sort any column. Last 30 days.', h('div', null, tb.el)));
          }
          return out;
        }
        if (t === 'audience') {
          if (!det) return loadingCard();
          return G.card('Audience segments', 'Who signs up, and how well each segment converts', h('div', { class: 'g-gap8' }, G.J(det.audience).map((a) => h('div', null, h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('b', { text: a.segment }), h('span', { class: 'sm num' }, F.n(a.signups) + ' signups · ' + a.share + '% of audience · ' + F.pct(a.conv, 1) + ' click → signup')), G.pbar(a.share * 2.2)))));
        }
        if (t === 'creatives') {
          const rows = G.rows('creatives'); if (!rows) return loadingCard();
          const mine = rows.filter((r) => r.range === S.range && r.campaign === cid);
          const tb = G.table({ source: 'creatives', key: ['range', 'num'], id: (r) => r.num, sort: { k: 'signups', dir: -1 }, empty: G.empty('▣', 'No creatives in this campaign yet', 'Upload or link a creative to start tracking CTR and CAC.'), cols: [{ k: 'name', label: 'Creative', first: 1, f: (r) => G.nm(r.name, r.ref + ' · ' + r.format) }, { k: 'channel', label: 'Channel' }, { k: 'spend', label: 'Spend', cls: 'r num', f: (r) => F.inr(r.spend) }, { k: 'ctr', label: 'CTR', cls: 'r num', f: (r) => F.pct(r.ctr, 2) }, { k: 'signups', label: 'Signups', cls: 'r num', f: (r) => F.n(r.signups) }, { k: 'cac', label: 'CAC', cls: 'r num', f: (r) => F.inrF(r.cac) }, { k: 'status', label: 'Status', f: (r) => G.statusBd(r.status) }] });
          tb.set(mine); return h('div', { class: 'g-card pad0' }, tb.el);
        }
        if (t === 'creators') {
          const rows = G.rows('creators'); if (!rows) return loadingCard();
          const mine = rows.filter((r) => r.range === S.range && r.campaign === cid);
          const tb = G.table({ source: 'creators', key: ['range', 'key'], id: (r) => r.key, sort: { k: 'score', dir: -1 }, onRow: (r) => G.go('creators', { open: r.key }), empty: G.empty('✦', 'No creators assigned to this campaign', 'Add creators to measure them by signups, activation and revenue.', G.btn('Find creators', () => G.go('creators'), 'pri')), cols: [{ k: 'handle', label: 'Creator', first: 1, f: (r) => G.nm(r.handle, r.platform + ' · ' + r.niche) }, { k: 'views', label: 'Views', cls: 'r num', f: (r) => F.c(r.views) }, { k: 'signups', label: 'Signups', cls: 'r num', f: (r) => F.n(r.signups) }, { k: 'cac', label: 'CAC', cls: 'r num', f: (r) => F.inrF(r.cac) }, { k: 'roi', label: 'ROI', cls: 'r num', f: (r) => F.x(r.roi) }, { k: 'score', label: 'Impact score', f: (r) => G.score(r.score, r.score >= 50 ? '' : r.score >= 25 ? 'amber' : 'red') }] });
          tb.set(mine); return h('div', { class: 'g-card pad0' }, tb.el);
        }
        if (t === 'leads') {
          const rows = G.rows('leads'); if (!rows) return loadingCard();
          const mine = rows.filter((r) => r.campaign === cid);
          const tb = G.table({ source: 'leads', key: ['id'], sort: { k: 'score', dir: -1 }, onRow: (r) => G.go('leads', { open: r.id }), empty: G.empty('◉', 'No leads from this campaign yet', 'Leads appear once visitors show buying intent.'), cols: [{ k: 'name', label: 'Lead', first: 1, f: (r) => G.nm(r.name, r.company) }, { k: 'intent', label: 'Intent', f: (r) => G.badge(r.intent, r.intent === 'Very High' ? 'dark' : r.intent === 'High' ? 'green' : r.intent === 'Medium' ? 'amber' : '') }, { k: 'score', label: 'Score', cls: 'r num' }, { k: 'stage', label: 'Stage' }, { k: 'next_action', label: 'Next action' }] });
          tb.set(mine); return h('div', null, h('div', { class: 'g-card pad0' }, tb.el), h('div', { class: 'g-mt8' }, G.btn('Open all leads', () => G.go('leads'))));
        }
        if (t === 'attribution') {
          if (!det) return loadingCard();
          const at = G.J(det.attribution);
          return G.card('Where this campaign’s customers came from', 'Customers by source (data-driven model, last 30 days)', h('div', { class: 'g-gap8' }, at.map((a) => h('div', null, h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('b', { text: a.source }), h('span', { class: 'sm num', text: a.customers + ' customers · ' + a.share + '%' })), G.pbar(a.share * 1.6)))), G.btn('Open Attribution', () => G.go('attribution')));
        }
        if (t === 'experiments') {
          const rows = G.rows('experiments'); if (!rows) return loadingCard();
          const mine = rows.filter((r) => r.campaign === cid);
          if (!mine.length) return G.card(null, null, G.empty('◇', 'No experiments on this campaign', 'Turn an idea into a measurable test.', G.btn('Create experiment', () => G.go('experiments', { create: true }), 'pri')));
          return h('div', { class: 'g-two' }, mine.map((e) => h('div', { class: 'g-card' }, h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('b', { text: e.name }), G.statusBd(e.status)), h('p', { class: 'sm muted g-mt8', text: e.hypothesis }), h('div', { class: 'g-meter g-mt8' }, h('span', { text: e.confidence + '% confidence' }), G.pbar(e.confidence)), G.btn('Open', () => G.go('experiments', { open: e.id }), 'sm g-mt8'))));
        }
        if (t === 'activity') {
          if (!det) return loadingCard();
          return G.card('Campaign activity', null, h('div', null, G.J(det.activity).map((a) => h('div', { class: 'g-tl', style: 'cursor:default' }, h('div', { class: 'tm', text: F.clock(a.mins_ago) }), h('div', null, h('div', { text: a.text }), h('div', { class: 'xs muted', text: a.kind + ' · ' + F.ago(a.mins_ago) }))))));
        }
        return h('div');
      }

      function draw() { view.replaceChildren(f.open ? detailView() : listView()); G.updateChrome(); }
      let lastKey = '';
      function update() {
        const key = S.range + '|' + f.open;
        // charts and tables are rebuilt on every data change; keep scroll position of the list stable
        draw();
      }
      return { update };
    },
  });
})();
