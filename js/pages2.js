(function () {
  'use strict';
  const G = window.G, h = G.h, S = G.S, F = G.F;
  const CHANNELS = ['Google Ads', 'Meta', 'Instagram', 'LinkedIn', 'X', 'YouTube', 'Reddit', 'Organic', 'Referral', 'Creators'];
  const matchCh = (s) => { s = String(s || '').toLowerCase().trim(); return CHANNELS.find((c) => c.toLowerCase() === s) || CHANNELS.find((c) => c.toLowerCase().startsWith(s) || s.startsWith(c.toLowerCase().split(' ')[0])) || null; };

  /* =========================== CHANNELS & ADS =========================== */
  G.page('channels', {
    ds: ['channels', 'kpis', 'creatives', 'insights', 'campaigns'],
    build(root, opts) {
      const f = G.pf('channels', { campaign: '', compare: null, showCompare: false });
      if (opts && opts.compare) { const a = matchCh(opts.compare[0]), b = matchCh(opts.compare[1]); f.compare = [a || 'Meta', b || 'Creators']; f.showCompare = true; }
      const sum = h('div', { class: 'g-kpis', style: '--min:170px' }), insBox = h('div'), cmpBox = h('div'), tblBox = h('div'), scat = h('div', { class: 'g-chart', style: 'min-height:320px' }), legend = h('div', { class: 'g-legend g-mt8' }), crTbl = h('div');
      const campSel = h('span'), nextBox = h('div'), nx = G.sx.nextRupee(); nextBox.append(h('div', { class: 'g-mt16' }, nx.el));
      root.append(G.head('Growth', 'Channels & Ads', 'Understand which acquisition channels are actually producing business outcomes.', [G.rangeSel(), G.btn(f.showCompare ? 'Hide comparison' : 'Compare channels', () => { f.showCompare = !f.showCompare; f.compare = f.compare || ['Meta', 'Creators']; update(); }, '')]),
        insBox, nextBox, G.sec('Summary', G.RL[S.range]), sum, cmpBox, G.sec('Channel comparison', 'Expand a row for period-over-period changes.'), h('div', { class: 'g-card pad0' }, tblBox),
        G.sec('Channel efficiency', 'Where traffic is high but conversion is low — and where small channels convert disproportionately well.'),
        G.card('Traffic vs conversion', 'x: landing-page visitors · y: visitor → customer rate · bubble size: spend', h('div', null, scat, legend)),
        G.sec('Ad creative performance', 'Filter by campaign. Creative #14 is flagged on the Radar.'), h('div', { class: 'g-tools' }, campSel), h('div', { class: 'g-card pad0' }, crTbl));

      const tbl = G.table({
        source: 'channels', key: ['range', 'channel'], id: (r) => r.channel, sort: { k: 'revenue', dir: -1 },
        expand: (r) => h('div', { class: 'g-row', style: 'gap:24px;padding:4px 8px' }, h('div', null, h('div', { class: 'xs muted', text: 'Signups trend (14 days)' }), G.spark(G.J(r.spark), { w: 140, h: 36, tone: G.tone(r.d_signups, true) })),
          [['Signups', r.d_signups, true], ['CTR', r.d_ctr, true], ['Activation', r.d_activation, true], ['CAC', r.d_cac, false], ['ROAS', r.d_roas, true]].map(([l, v, g]) => h('div', null, h('div', { class: 'xs muted', text: l + ' vs previous' }), G.dl(v, g))), h('div', { class: 'g-row', style: 'margin-left:auto' }, G.btn('See campaigns', () => G.go('campaigns', { channel: r.channel }), 'sm'), G.btn('Attribution', () => G.go('attribution'), 'sm'))),
        cols: [
          { k: 'channel', label: 'Channel', first: 1, f: (r) => G.nm(r.channel, r.type) },
          { k: 'spend', label: 'Spend', cls: 'r num', f: (r) => (r.spend ? F.inr(r.spend) : '—') },
          { k: 'impressions', label: 'Impressions', cls: 'r num', hide: 'n', f: (r) => F.c(r.impressions) },
          { k: 'ctr', label: 'CTR', cls: 'r num', f: (r) => F.pct(r.ctr, 2) },
          { k: 'cpc', label: 'CPC', cls: 'r num', hide: 'm', f: (r) => (r.cpc ? F.inrF(r.cpc) : '—') },
          { k: 'visitors', label: 'Visitors', cls: 'r num', hide: 'n', f: (r) => F.c(r.visitors) },
          { k: 'signups', label: 'Signups', cls: 'r num', f: (r) => F.n(r.signups) },
          { k: 'activation', label: 'Activation', cls: 'r num', hide: 'm', f: (r) => F.pct(r.activation) },
          { k: 'cac', label: 'CAC', cls: 'r num', f: (r) => (r.cac ? F.inrF(r.cac) : '—') },
          { k: 'customers', label: 'Customers', cls: 'r num', hide: 'm', f: (r) => F.n(r.customers) },
          { k: 'revenue', label: 'Revenue', cls: 'r num', f: (r) => F.inr(r.revenue) },
          { k: 'roas', label: 'ROAS', cls: 'r num', f: (r) => (r.roas ? F.x(r.roas) : '∞') },
        ] });
      tblBox.append(tbl.el);
      const ctbl = G.table({
        source: 'creatives', key: ['range', 'num'], id: (r) => r.num, sort: { k: 'signups', dir: -1 }, empty: G.empty('▣', 'No creatives for this campaign', 'Pick another campaign or date range.'),
        expand: (r) => h('div', { class: 'g-row', style: 'padding:4px 8px;gap:24px' }, h('div', null, h('div', { class: 'xs muted', text: 'CTR vs previous period' }), G.dl(r.d_ctr, true)), h('div', null, h('div', { class: 'xs muted', text: 'Click → signup' }), h('b', { text: F.pct(r.signup_rate, 1) })), h('div', null, h('div', { class: 'xs muted', text: 'Customers' }), h('b', { text: F.n(r.customers) })),
          r.d_ctr < -10 ? G.btn('Pause creative & shift budget', () => G.confirm({ title: 'Pause ' + r.ref + '?', text: 'Pause “' + r.name + '” and move its daily budget to Creative #18.', detail: 'You can resume it any time. Spend on the paused creative stops within minutes.', confirm: 'Pause and shift', onConfirm: () => G.logDecision({ title: 'Paused ' + r.ref + ' on ' + r.channel + ' and moved its budget to Creative #18', reason: r.ref + ' CTR ' + F.d(r.d_ctr), expected: 'Recover the signups lost to falling CTR', kind: 'creative' }) }), 'sm') : G.btn('Duplicate creative', () => G.toast('Duplicated “' + r.name + '” as a draft'), 'sm')),
        cols: [{ k: 'name', label: 'Creative', first: 1, f: (r) => G.nm(r.name, r.ref + ' · ' + r.format, r.d_ctr < -10 ? G.badge('Fatigue', 'red') : null) }, { k: 'channel', label: 'Channel' }, { k: 'spend', label: 'Spend', cls: 'r num', f: (r) => F.inr(r.spend) }, { k: 'impressions', label: 'Impressions', cls: 'r num', hide: 'n', f: (r) => F.c(r.impressions) },
          { k: 'ctr', label: 'CTR', cls: 'r num', f: (r) => h('div', null, h('div', { text: F.pct(r.ctr, 2) }), G.dl(r.d_ctr, true)) }, { k: 'clicks', label: 'Clicks', cls: 'r num', hide: 'm', f: (r) => F.n(r.clicks) }, { k: 'signups', label: 'Signups', cls: 'r num', f: (r) => F.n(r.signups) },
          { k: 'cac', label: 'CAC', cls: 'r num', f: (r) => F.inrF(r.cac) }, { k: 'revenue', label: 'Revenue', cls: 'r num', f: (r) => F.inr(r.revenue) }] });
      crTbl.append(ctbl.el);

      function cmp(rows) {
        if (!f.showCompare) return cmpBox.replaceChildren();
        const names = rows.map((r) => r.channel);
        const a = rows.find((r) => r.channel === f.compare[0]), b = rows.find((r) => r.channel === f.compare[1]);
        const M = [['Spend', 'spend', F.inr, null], ['Impressions', 'impressions', F.c, 1], ['CTR', 'ctr', (v) => F.pct(v, 2), 1], ['CPC', 'cpc', F.inrF, -1], ['Signups', 'signups', F.n, 1], ['Activation', 'activation', F.pct, 1], ['CAC', 'cac', F.inrF, -1], ['Customers', 'customers', F.n, 1], ['Revenue', 'revenue', F.inr, 1], ['ROAS', 'roas', F.x, 1]];
        const t = h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, h('th', { text: 'Metric' }), h('th', { class: 'r', text: f.compare[0] }), h('th', { class: 'r', text: f.compare[1] }))),
          h('tbody', null, M.map(([l, k, fm, dir]) => { const av = a[k], bv = b[k]; const win = dir && av != null && bv != null && av !== bv ? ((av > bv) === (dir > 0) ? 0 : 1) : -1; return h('tr', { class: 'row' }, h('td', { text: l }), h('td', { class: 'r num', style: win === 0 ? 'font-weight:700;color:var(--g-em-d)' : '', text: av == null ? '—' : fm(av) + (win === 0 ? ' ✓' : '') }), h('td', { class: 'r num', style: win === 1 ? 'font-weight:700;color:var(--g-em-d)' : '', text: bv == null ? '—' : fm(bv) + (win === 1 ? ' ✓' : '') })); })));
        const wins = M.filter(([l, k, fm, dir]) => dir && a[k] != null && b[k] != null && a[k] !== b[k]).reduce((acc, [l, k, fm, dir]) => { (a[k] > b[k]) === (dir > 0) ? acc[0]++ : acc[1]++; return acc; }, [0, 0]);
        cmpBox.replaceChildren(h('div', { class: 'g-mt16' }, G.card('Compare channels', `${f.compare[0]} wins ${wins[0]} of ${wins[0] + wins[1]} comparable metrics; ${f.compare[1]} wins ${wins[1]}.`, h('div', null, t),
          h('div', { class: 'g-row' }, G.sel(names, f.compare[0], (v) => { f.compare[0] = v; update(); }, 'First channel'), h('span', { class: 'muted', text: 'vs' }), G.sel(names, f.compare[1], (v) => { f.compare[1] = v; update(); }, 'Second channel'), G.btn('Close', () => { f.showCompare = false; update(); }, 'ghost')))));
      }
      function scatter(rows) {
        scat.replaceChildren();
        rows = rows.filter((r) => r.visitors > 0 && r.customers > 0 && r.spend > 0);
        if (rows.length < 2) { scat.append(G.empty('◌', 'Not enough channels to plot', 'This chart needs at least two channels with spend, visitors and customers.')); return; }
        const W = scat.clientWidth || 640, H = Math.max(300, Math.min(400, W * 0.58)), m = { t: 16, r: 20, b: 44, l: 54 };
        const tv = d3.sum(rows, (r) => r.visitors), tc = d3.sum(rows, (r) => r.customers), ts = d3.sum(rows, (r) => r.spend), trv = d3.sum(rows, (r) => r.revenue);
        const bConv = tc / tv * 100, bCac = ts / tc, bRoas = trv / ts;
        const medV = d3.median(rows, (r) => r.visitors);
        const x = d3.scaleLog([d3.min(rows, (r) => r.visitors) * 0.7, d3.max(rows, (r) => r.visitors) * 1.35], [m.l, W - m.r]);
        const y = d3.scaleLinear([0, d3.max(rows, (r) => r.visitor_to_customer) * 1.2], [H - m.b, m.t]).nice();
        const rs = d3.scaleSqrt([0, d3.max(rows, (r) => r.spend)], [6, 24]);
        const svg = d3.select(scat).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H).attr('role', 'img').attr('aria-label', 'Channel efficiency scatter plot');
        y.ticks(5).forEach((t) => { svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).style('stroke', 'var(--g-line-2)'); svg.append('text').attr('x', m.l - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').style('fill', 'var(--g-ink-3)').attr('font-size', 11).text(t.toFixed(1) + '%'); });
        [5000, 10000, 20000, 40000].filter((t) => t > x.domain()[0] && t < x.domain()[1]).forEach((t) => svg.append('text').attr('x', x(t)).attr('y', H - 26).attr('text-anchor', 'middle').style('fill', 'var(--g-ink-3)').attr('font-size', 11).text(F.c(t)));
        svg.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', H - 8).attr('text-anchor', 'middle').style('fill', 'var(--g-ink-2)').attr('font-size', 11).text('Landing-page visitors (log scale) →');
        svg.append('text').attr('transform', `translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').style('fill', 'var(--g-ink-2)').attr('font-size', 11).text('Visitor → customer rate');
        svg.append('line').attr('x1', x(medV)).attr('x2', x(medV)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--g-line)').attr('stroke-dasharray', '4 4');
        svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(bConv)).attr('y2', y(bConv)).style('stroke', 'var(--g-line)').attr('stroke-dasharray', '4 4');
        const ql = (tx, ax, ay, anc) => svg.append('text').attr('x', ax).attr('y', ay).attr('text-anchor', anc).style('fill', 'var(--g-ink-3)').attr('font-size', 10.5).attr('font-weight', 600).text(tx);
        ql('LOW TRAFFIC · HIGH CONVERSION', m.l + 6, m.t + 10, 'start'); ql('HIGH TRAFFIC · HIGH CONVERSION', W - m.r - 4, m.t + 10, 'end'); ql('LOW TRAFFIC · LOW CONVERSION', m.l + 6, H - m.b - 6, 'start'); ql('HIGH TRAFFIC · LOW CONVERSION', W - m.r - 4, H - m.b - 6, 'end');
        const placed = [];
        rows.slice().sort((a, b) => b.spend - a.spend).forEach((r) => {
          const hiRoi = r.roas == null || r.roas >= bRoas * 1.4, hiCac = r.cac != null && r.cac >= bCac * 1.4;
          const col = hiCac ? 'var(--g-red)' : hiRoi ? 'var(--g-em)' : 'var(--g-ink-3)';
          const cx = x(r.visitors), cy = y(r.visitor_to_customer), rad = r.spend ? rs(r.spend) : 6;
          svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', rad).style('fill', col).style('fill-opacity', 0.28).style('stroke', col).attr('stroke-width', 1.8).attr('stroke-dasharray', r.spend ? null : '3 2').style('cursor', 'pointer')
            .on('mousemove', (e) => G.tip.show(e, h('div', null, h('b', { text: r.channel }), h('div', { class: 'r' }, h('span', { text: 'Visitors' }), h('b', { text: F.n(r.visitors) })), h('div', { class: 'r' }, h('span', { text: 'Visitor → customer' }), h('b', { text: F.pct(r.visitor_to_customer, 2) })), h('div', { class: 'r' }, h('span', { text: 'CAC' }), h('b', { text: r.cac ? F.inrF(r.cac) : '—' })), h('div', { class: 'r' }, h('span', { text: 'ROAS' }), h('b', { text: r.roas ? F.x(r.roas) : '∞ (no spend)' })))))
            .on('mouseleave', G.tip.hide).on('click', () => { f.showCompare = true; f.compare = [f.compare ? f.compare[1] : 'Meta', r.channel]; if (f.compare[0] === f.compare[1]) f.compare[0] = r.channel === 'Meta' ? 'Creators' : 'Meta'; update(); });
          let ty = cy - rad - 5; while (placed.some((p) => Math.abs(p[0] - cx) < 70 && Math.abs(p[1] - ty) < 12)) ty -= 12;
          placed.push([cx, ty]);
          svg.append('text').attr('x', cx).attr('y', ty).attr('text-anchor', 'middle').style('fill', 'var(--g-ink)').attr('font-size', 11).attr('font-weight', 600).text(r.channel);
        });
        legend.replaceChildren(...[['var(--g-em)', 'High ROI (≥ 1.4× blended ROAS) or no spend'], ['var(--g-red)', 'High CAC (≥ 1.4× blended CAC)'], ['var(--g-ink-3)', 'In line with blend']].map(([c, l]) => h('span', null, h('i', { style: 'background:' + c }), l)), h('span', { class: 'muted', text: `Blended: ${F.pct(bConv, 2)} visitor → customer · ${F.inrF(bCac)} CAC · ${F.x(bRoas)} ROAS` }));
      }
      const SHIFTS = [{ frm: 'Meta', to: 'Creators', amount: 60000 }, { frm: 'Meta', to: 'Referral', amount: 25000 }];
      function nextRupee() {
        const ch = G.chan30(), names = Object.keys(ch).filter((n) => ch[n].spend > 0 || SHIFTS.some((m) => m.to === n)), tot = d3.sum(names, (n) => ch[n].spend) || 1;
        const rec = {}; names.forEach((n) => (rec[n] = ch[n].spend)); SHIFTS.forEach((m) => { rec[m.frm] -= m.amount; rec[m.to] += m.amount; });
        const r = G.sim(SHIFTS), dRev = r.next.revenue - r.base.revenue, dCus = r.next.customers - r.base.customers;
        const rows = names.slice().sort((a, b) => ch[b].spend - ch[a].spend).map((n) => ({ n, cur: ch[n].spend, rec: rec[n], roas: ch[n].roas }));
        const mx = d3.max(rows, (x) => Math.max(x.cur, x.rec)) || 1;
        const tb = h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Channel', 'ROAS', 'Current allocation', 'Recommended allocation', 'Change'].map((t, i) => h('th', { class: i > 1 && i < 4 ? '' : i ? 'r' : '', text: t })))),
          h('tbody', null, rows.map((x) => { const d = x.rec - x.cur; return h('tr', { class: 'row' }, h('td', null, h('b', { text: x.n })), h('td', { class: 'r num', text: x.roas ? F.x(x.roas) : '∞' }),
            h('td', null, h('div', { class: 'g-meter' }, h('span', { class: 'num xs', style: 'min-width:92px', text: F.inr(x.cur) + ' · ' + Math.round(x.cur / tot * 100) + '%' }), G.pbar(x.cur / mx * 100, 'gray'))),
            h('td', null, h('div', { class: 'g-meter' }, h('span', { class: 'num xs', style: 'min-width:92px', text: F.inr(x.rec) + ' · ' + Math.round(x.rec / tot * 100) + '%' }), G.pbar(x.rec / mx * 100, ''))),
            h('td', { class: 'r num' }, Math.abs(d) < 1 ? h('span', { class: 'muted', text: '—' }) : h('span', { class: 'dl ' + (d > 0 ? 'up' : 'down'), text: (d > 0 ? '+' : '−') + F.inr(Math.abs(d)) }))); })));
        nextBox.replaceChildren(h('div', { class: 'g-mt16' }, G.card('Where should the next ₹1 go?', 'Last 30 days · same total spend, redistributed by return per rupee', h('div', { class: 'g-gap16' },
          h('div', { class: 'g-ev' }, [['Current expected revenue', F.inr(r.base.revenue) + ' / month'], ['Optimized expected revenue', F.inr(r.next.revenue) + ' / month'], ['Gain', '+' + F.inr(dRev) + ' · +' + Math.round(dCus) + ' customers'], ['CAC after shift', F.inrF(r.next.cac) + ' (now ' + F.inrF(r.base.cac) + ')']].map(([a, b]) => h('div', null, h('small', { text: a }), h('b', { text: b })))),
          h('div', { style: 'overflow-x:auto' }, tb),
          h('div', { class: 'g-row' }, G.btn('Model this shift', () => G.simModal({ frm: 'Meta', moves: SHIFTS.map((m) => ({ to: m.to, amount: m.amount })), title: 'Model this shift' }), 'pri'), G.btn('Why this?', () => G.evidenceDrawer({ rec: 'Move ₹60K to Creators and ₹25K to Referral, from Meta', a: { title: 'Meta', rows: [['ROAS', F.x(ch.Meta.roas)], ['CAC', F.inrF(ch.Meta.cac)], ['Customers', F.n(ch.Meta.customers)]] }, b: { title: 'Creators', rows: [['ROAS', F.x(ch.Creators.roas)], ['CAC', F.inrF(ch.Creators.cac)], ['Customers', F.n(ch.Creators.customers)]] }, pattern: 'Creators and Referral return several times more revenue per rupee than paid social, at lower CAC.', result: `Same total spend: +${F.inr(dRev)} revenue and +${Math.round(dCus)} customers per month.` })))))));
        return r;
      }
      function update() {
        const R = S.range, rows = G.byRange('channels');
        nx.update(); requestAnimationFrame(() => { if (nx.el.isConnected) nx.update(); }); if (opts && opts.sim) { opts.sim = false; G.simModal({ frm: 'Meta', moves: SHIFTS.map((m) => ({ to: m.to, amount: m.amount })), title: 'Model this shift' }); }
        const kp = G.byRange('kpis'); const pick = ['spend', 'clicks', 'cac', 'signups', 'revenue', 'roas'].map((k) => kp.find((x) => x.metric === k)).filter(Boolean);
        sum.replaceChildren(...pick.map((k) => G.kpiCard(k)));
        const ins = (G.rows('insights') || []).find((i) => i.id === 'channels-ai');
        if (ins) insBox.replaceChildren(G.insight(ins, h('div', { class: 'g-row g-mt8' }, G.mk(h('span', { class: 'sm', style: 'flex:1 1 280px', text: ins.reco }), 'insights', 'reco', { id: ins.id }), G.btn(ins.cta, () => G.go('forecast', { pick: 'creators+20' }), 'pri'), G.btn('Compare Meta vs creators', () => { f.showCompare = true; f.compare = ['Meta', 'Creators']; update(); }))));
        tbl.set(rows); cmp(rows); scatter(rows);
        const camps = [{ v: '', l: 'All campaigns' }].concat((G.rows('campaigns') || []).filter((c) => c.range === R).map((c) => ({ v: c.cid, l: c.name })));
        campSel.replaceChildren(G.sel(camps, f.campaign, (v) => { f.campaign = v; update(); }, 'Campaign'), ' ', G.rangeSel());
        ctbl.set((G.rows('creatives') || []).filter((c) => c.range === R && (!f.campaign || c.campaign === f.campaign)));
      }
      return { update };
    },
  });

  /* =========================== CREATORS =========================== */
  G.page('creators', {
    ds: ['creators', 'creator_kpis', 'creator_detail', 'insights'],
    build(root, opts) {
      const f = G.pf('creators', { q: '', platform: '', sortScore: true });
      Object.assign(f, opts || {});
      const kpiBox = h('div', { class: 'g-kpis', style: '--min:150px' }), insBox = h('div'), tblBox = h('div');
      const q = G.search('Search creators', (v) => { f.q = v; fill(); }, f.q);
      const plats = [{ v: '', l: 'All platforms' }].concat(['YouTube', 'YouTube Shorts', 'Instagram', 'X', 'LinkedIn'].map((p) => ({ v: p, l: p })));
      const sortSeg = G.seg([{ v: 'score', l: 'Impact score' }, { v: 'views', l: 'Views' }], f.sortScore ? 'score' : 'views', (v) => { f.sortScore = v === 'score'; fill(); });
      root.append(G.head('Creators & influencers', 'Creator Intelligence', 'Creators are one acquisition source. Judge them by signups, activation and CAC, not views.', [G.rangeSel(), G.btn('Create campaign', () => createCampaign(null), 'pri')]), kpiBox, h('div', { class: 'g-mt16' }, insBox),
        G.sec('Creator performance', 'Ranked by True Creator Performance — not by views. Click a creator for the full profile.'), h('div', { class: 'g-tools' }, q, G.sel(plats, f.platform, (v) => { f.platform = v; fill(); }, 'Platform'), h('span', { class: 'xs muted', text: 'Rank by' }), sortSeg), h('div', { class: 'g-card pad0' }, tblBox));
      const tbl = G.table({
        source: 'creators', key: ['range', 'key'], id: (r) => r.key, onRow: (r) => openCreator(r.key), sort: { k: 'score', dir: -1 },
        expand: (r) => creatorFunnel(r),
        empty: G.empty('✦', 'No creators match', 'Clear the search or platform filter.'),
        cols: [
          { k: 'handle', label: 'Creator', first: 1, f: (r) => G.nm(r.handle, r.platform + ' · views #' + r.rank_views + ' → impact #' + r.rank_score, archBd(r)) },
          { k: 'score', label: 'Impact score', f: (r) => G.score(r.score, r.score >= 50 ? '' : r.score >= 25 ? 'amber' : 'red') },
          { k: 'followers', label: 'Reach', cls: 'r num', hide: 'n', f: (r) => F.c(r.followers) },
          { k: 'views', label: 'Views', cls: 'r num', f: (r) => F.c(r.views) },
          { k: 'clicks', label: 'Clicks', cls: 'r num', f: (r) => F.n(r.clicks) },
          { k: 'signups', label: 'Signups', cls: 'r num', f: (r) => F.n(r.signups) },
          { k: 'activation', label: 'Activation', cls: 'r num', hide: 'm', f: (r) => F.pct(r.activation) },
          { k: 'cac', label: 'CAC', cls: 'r num', f: (r) => (r.cac ? F.inrF(r.cac) : '—') },
          { k: 'customers', label: 'Customers', cls: 'r num', f: (r) => F.n(r.customers) },
          { k: 'revenue', label: 'Revenue', cls: 'r num', hide: 'm', f: (r) => F.inr(r.revenue) },
          { k: 'roi', label: 'ROI', cls: 'r num', hide: 'm', f: (r) => (r.roi == null ? '—' : F.x(r.roi)) },
        ] });
      tblBox.append(tbl.el);
      /* Archetypes: compare reach rank with impact rank within the current range. */
      function arch(r) {
        const all = G.byRange('creators'), n = all.length, rr = 1 + all.filter((x) => x.followers > r.followers).length;
        if (rr <= n / 3 && r.rank_score > n / 2) return 'hr';
        if (rr > n / 2 && r.rank_score <= n / 3) return 'li';
        return '';
      }
      function archBd(r) { const a = arch(r); return a === 'hr' ? G.badge('High reach · low conversion', 'amber') : a === 'li' ? G.badge('Low reach · high impact', 'green') : null; }
      const PARTS = [['signups', 'Signups', 25], ['revenue', 'Revenue', 25], ['clicks', 'Clicks', 15], ['activation', 'Activation', 15], ['reach', 'Reach (views)', 10], ['engagement', 'Engagement', 10]];
      function creatorFunnel(r) {
        const st = [['Views', r.views], ['Clicks', r.clicks], ['Signups', r.signups], ['Activation', r.activated], ['Customers', r.customers], ['Revenue', r.revenue]];
        const prev = (i) => (i && st[i - 1][1] ? st[i][1] / st[i - 1][1] * 100 : null);
        return h('div', { class: 'g-grid', style: 'padding:6px 8px;gap:20px' },
          h('div', { style: 'grid-column:span 7;min-width:0' }, h('div', { class: 'g-sig-k', text: 'Views → Clicks → Signups → Activation → Customers → Revenue' }),
            h('div', { class: 'g-row g-mt8', style: 'gap:6px;align-items:stretch' }, st.map(([l, v], i) => h('div', { class: 'g-jn', style: 'margin:0;flex:1 1 90px;min-width:84px;padding:8px' }, h('div', { class: 'xs muted', text: l }), h('b', { class: 'num', text: l === 'Revenue' ? F.inr(v) : F.c(v) }), h('div', { class: 'xs', style: 'margin-top:4px', text: i && l !== 'Revenue' ? F.pct(prev(i), prev(i) < 10 ? 2 : 1) + ' of ' + st[i - 1][0].toLowerCase() : i ? (r.customers ? F.inr(r.revenue / r.customers) + ' / customer' : '') : '\u00a0' })))),
            h('p', { class: 'sm g-mt8', text: arch(r) === 'hr' ? `${r.handle} brings reach (${F.c(r.followers)}) but only ${F.pct(r.signups / Math.max(1, r.clicks) * 100, 1)} of clicks become signups. Views are not the outcome.` : arch(r) === 'li' ? `${r.handle} has a small audience but converts it: ${F.n(r.signups)} signups at ${r.cac ? F.inrF(r.cac) : '—'} CAC. Rank by impact, not reach.` : `Ranked #${r.rank_score} on impact (by views: #${r.rank_views}).` })),
          h('div', { style: 'grid-column:span 5;min-width:0' }, h('div', { class: 'g-sig-k', text: 'Why this rank' }), h('div', { class: 'g-gap8 g-mt8' }, PARTS.map(([k, l, w]) => h('div', { class: 'g-row', style: 'flex-wrap:nowrap;gap:8px' }, h('span', { class: 'xs', style: 'width:92px;flex:none', text: l + ' · ' + w + '%' }), h('div', { style: 'flex:1' }, G.pbar((r.parts || {})[k] || 0, '')), h('span', { class: 'xs num', style: 'width:24px;text-align:right', text: (r.parts || {})[k] || 0 })))),
            h('div', { class: 'g-row g-mt8' }, G.btn('Full profile', () => openCreator(r.key), 'sm'), G.btn('Create campaign', () => createCampaign(null), 'sm'))));
      }
      function fill() {
        const ql = f.q.toLowerCase();
        const rows = G.byRange('creators').filter((r) => (!ql || (r.handle + r.name + r.niche).toLowerCase().includes(ql)) && (!f.platform || r.platform === f.platform));
        rows.sort((a, b) => (f.sortScore ? a.rank_score - b.rank_score : a.rank_views - b.rank_views));
        tbl.set(rows);
        // keep the chosen "rank by" order by clearing header sort
      }
      function createCampaign(c) {
        const form = G.form([{ k: 'name', label: 'Campaign name', val: c ? 'Creator campaign with ' + c.handle : 'New creator campaign' }, { k: 'budget', label: 'Monthly budget (₹)', type: 'number', val: c ? c.rec_payout : '' }, { k: 'owner', label: 'Owner', type: 'select', opts: ['Diya Nair', 'Aarav Mehta', 'Rohan Iyer', 'Meera Kapoor'] }]);
        G.modal({ title: 'Create campaign', sub: c ? 'Pre-filled from ' + c.handle + '’s recommended next campaign.' : 'Creator-led campaign draft.', body: form.el, actions: (close) => [G.btn('Cancel', close), G.btn('Create draft', () => { const v = form.get(); if (!v.name.trim()) return G.toast('Name the campaign first', { tone: 'bad' }); G.addDraft({ name: v.name.trim(), channel: 'Creators', owner: v.owner, budget: v.budget }); close(); G.toast('Draft campaign created', { action: { label: 'View', fn: () => G.go('campaigns') } }); }, 'pri')] });
      }
      function openCreator(key) {
        const r = G.byRange('creators').find((x) => x.key === key), d = (G.rows('creator_detail') || []).find((x) => x.key === key);
        if (!r || !d) return;
        const age = G.J(d.age), posts = G.J(d.best_posts), hist = G.J(d.history), trend = G.J(d.trend);
        const sec = (t, ...k) => h('div', { class: 'g-dr-sec' }, h('h4', { text: t }), ...k);
        const body = h('div', null,
          h('div', { class: 'g-row g-mb16' }, G.score(r.score, r.score >= 50 ? '' : r.score >= 25 ? 'amber' : 'red'), h('span', { class: 'sm', text: 'True Creator Performance · rank #' + r.rank_score + ' of ' + G.byRange('creators').length + ' (by views: #' + r.rank_views + ')' })),
          h('div', { class: 'g-ev g-mb16' }, [['Views', F.c(r.views)], ['Signups', F.n(r.signups)], ['CAC', r.cac ? F.inrF(r.cac) : '—'], ['ROI', r.roi == null ? '—' : F.x(r.roi)]].map(([a, b]) => h('div', null, h('small', { text: a }), h('b', { text: b })))),
          sec('Audience', h('div', { class: 'g-gap8' }, h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('span', { text: 'India audience' }), h('b', { text: d.india_pct + '%' })), G.pbar(d.india_pct), ['18-24', '25-34', '35+'].map((a) => h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('span', { class: 'sm', text: 'Age ' + a }), h('span', { class: 'sm num', text: age[a] + '%' }))), h('div', { class: 'sm muted', text: 'Developers / knowledge workers: ' + d.dev_pct + '% · Top cities: ' + G.J(d.top_cities).join(', ') }))),
          sec('Content', h('div', { class: 'sm' }, d.platform + ' · ' + d.niche + ' · ' + F.c(d.followers) + ' followers · ' + F.pct(r.engagement) + ' engagement'), h('div', { class: 'sm muted' }, 'Best-performing format: ' + (posts[0] ? posts[0].type : '—'))),
          sec('Campaign history', h('div', { class: 'g-gap8' }, hist.map((x) => h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('div', null, h('b', { text: x.campaign }), h('div', { class: 'xs muted', text: x.period })), h('div', { class: 'sm num', style: 'text-align:right', text: F.n(x.signups) + ' signups · ' + F.x(x.roi) + ' ROI' }))))),
          sec('Performance trend', h('div', { class: 'xs muted', text: 'Daily attributed signups, last 30 days' }), G.spark(trend, { w: 280, h: 48, tone: 'up' })),
          sec('Attributed users', h('div', { class: 'g-ev' }, [['Signups', F.n(d.attributed_users)], ['Activated', F.n(d.attributed_activated)], ['Customers', F.n(d.attributed_customers)]].map(([a, b]) => h('div', null, h('small', { text: a + ' (90d)' }), h('b', { text: b }))))),
          sec('Revenue', h('div', { class: 'g-row', style: 'align-items:baseline' }, h('span', { class: 'num', style: 'font-family:var(--font-anthropic-serif,serif);font-size:28px', text: F.inr(d.attributed_revenue) }), h('span', { class: 'muted sm', text: 'attributed in 90 days' }))),
          sec('Best performing posts', h('div', { class: 'g-gap8' }, posts.map((p) => h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('div', { style: 'min-width:0' }, h('div', { text: p.title }), h('div', { class: 'xs muted', text: p.platform + ' · ' + p.type })), h('div', { class: 'sm num', style: 'text-align:right;white-space:nowrap', text: F.c(p.views) + ' views · ' + p.signups + ' signups' }))))),
          sec('Recommended payout', h('div', { class: 'g-row', style: 'align-items:baseline' }, h('span', { class: 'num', style: 'font-size:22px;font-weight:600', text: F.inrF(d.rec_payout) }), h('span', { class: 'muted sm', text: 'next 30 days (now ' + F.inrF(r.spend) + ')' })), h('p', { class: 'sm', text: d.rec_basis })),
          sec('Recommended next campaign', h('p', { class: 'sm', text: d.rec_next })));
        G.drawer({ title: d.handle, sub: d.name + ' · ' + d.platform, body, footer: (close) => [G.btn('Contact creator', () => contact(d), 'pri'), G.btn('Create campaign', () => { close(); createCampaign(d); }), G.btn('View attribution', () => { close(); G.go('attribution'); })] });
      }
      function contact(d) {
        const form = G.form([{ k: 'to', label: 'To', val: d.email }, { k: 'msg', label: 'Message', type: 'textarea', val: `Hi ${d.name.split(' ')[0]},\n\nYour recent videos drove strong results for Wispr Flow. We’d love to discuss a longer partnership with a performance-based payout (${F.inrF(d.rec_payout)} next 30 days).\n\nAre you free for a quick call this week?\n\nAarav` }]);
        G.modal({ title: 'Contact ' + d.handle, body: form.el, actions: (close) => [G.btn('Cancel', close), G.btn('Send message', () => { close(); G.toast('Message sent to ' + d.handle); }, 'pri')] });
      }
      function update() {
        const R = S.range;
        kpiBox.replaceChildren(...G.byRange('creator_kpis').filter((k) => ['views', 'clicks', 'signups', 'customers', 'cac'].includes(k.metric)).sort((a, b) => a.order - b.order).map((k) => G.kpiCard(k, { src: 'creator_kpis', where: { range: R, metric: k.metric } })));
        const ins = (G.rows('insights') || []).find((i) => i.id === 'creator-tps');
        if (ins) insBox.replaceChildren(h('div', { class: 'g-ai' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'True Creator Performance'), h('div', { class: 't', text: 'Who is generating users, not who is generating views?' }), G.mk(h('p', { style: 'color:var(--g-ink-2)', text: ins.text }), 'insights', 'text', { id: ins.id }), h('ul', null, G.J(ins.bullets).map((b) => h('li', { text: b }))), h('div', { class: 'xs muted g-mt8', text: 'Expand any creator row to see their funnel and why they rank where they do.' })));
        fill();
        if (f.open) { const k = f.open; f.open = null; openCreator(k); }
      }
      return { update };
    },
  });

  /* =========================== CONTENT =========================== */
  G.page('content', {
    ds: ['content', 'content_compare', 'experiments', 'insights', 'creatives'],
    build(root, opts) {
      const f = G.pf('content', { q: '', platform: '', campaign: '', creator: '', type: '', metric: 'ctr' });
      Object.assign(f, opts || {});
      const insBox = h('div'), tblBox = h('div'), cmpBox = h('div'), expBox = h('div');
      const fbox = h('div', { class: 'g-tools' });
      root.append(G.head('Growth', 'Content Intelligence', 'Understand which content actually generates growth.', [G.rangeSel(), G.btn('Create experiment', () => G.expModal({ scope: 'creative' }), 'pri')]), insBox, G.sec('Top performing content', 'Posts published in the selected date range, ranked by signups.'), fbox, h('div', { class: 'g-card pad0' }, tblBox),
        G.sec('Creative comparison', 'Which content formats turn attention into activated users?'), cmpBox, G.sec('Creative experiments', 'A/B tests with winning variations.'), h('div', { class: 'g-card pad0' }, expBox));
      const tbl = G.table({
        source: 'content', key: ['id'], id: (r) => r.id, sort: { k: 'signups', dir: -1 }, empty: G.empty('▣', 'No content in this range', 'Widen the date range or clear a filter.', G.btn('Clear filters', () => { Object.assign(f, { q: '', platform: '', campaign: '', creator: '', type: '' }); build(); })),
        onRow: (r) => G.drawer({ title: r.title, sub: r.type + ' · ' + r.platform, body: h('div', { class: 'g-gap16' }, h('div', { class: 'g-ev' }, [['Views', F.n(r.views)], ['Clicks', F.n(r.clicks)], ['Signups', F.n(r.signups)], ['Activated', F.n(r.activated)], ['Customers', F.n(r.customers)], ['Revenue', F.inr(r.revenue)]].map(([a, b]) => h('div', null, h('small', { text: a }), h('b', { text: b })))), h('p', { class: 'sm', text: `Published ${F.date(r.date)} by ${r.creator} for ${r.campaign_name}. Amplification and fees: ${F.inr(r.cost)}. Cost per customer: ${r.customers ? F.inrF(r.cost / r.customers) : '—'}.` })), footer: (c) => [G.btn('Generate variation', () => { c(); genVar(r); }, 'pri'), G.btn('Duplicate creative', () => { c(); G.toast('Duplicated “' + r.title + '” as a draft'); }), G.btn('Create experiment', () => { c(); G.expModal({ scope: 'creative', name: r.title + ' — variant test' }); })] }),
        cols: [{ k: 'title', label: 'Content', first: 1, f: (r) => G.nm(r.title, r.creator + ' · ' + r.type) }, { k: 'platform', label: 'Platform', hide: 'm' }, { k: 'views', label: 'Views', cls: 'r num', f: (r) => F.c(r.views) }, { k: 'engagement', label: 'Engagement', cls: 'r num', hide: 'm', f: (r) => F.pct(r.engagement) },
          { k: 'ctr', label: 'CTR', cls: 'r num', hide: 'n', f: (r) => F.pct(r.ctr, 2) }, { k: 'signups', label: 'Signups', cls: 'r num', f: (r) => F.n(r.signups) }, { k: 'actr', label: 'Activation', cls: 'r num', hide: 'm', f: (r) => F.pct(r.actr, 1) }, { k: 'customers', label: 'Customers', cls: 'r num', f: (r) => F.n(r.customers) }, { k: 'revenue', label: 'Revenue', cls: 'r num', f: (r) => F.inr(r.revenue) },
          { k: 'impact', label: 'Business impact', f: (r) => h('div', null, G.score(r.impact, r.impact >= 60 ? '' : r.impact >= 30 ? 'amber' : 'red'), h('div', { class: 'xs', style: 'margin-top:4px', text: r.rec })) }] });
      tblBox.append(tbl.el);
      /* Business impact: percentile blend of outcomes (not views). */
      function enrich(rows) {
        const pr = (k) => { const v = rows.map((r) => r[k]).sort((a, b) => a - b); return (x) => (v.length > 1 ? v.filter((y) => y < x).length / (v.length - 1) : 0.5); };
        const base = rows.map((r) => Object.assign({}, r, { ctr: r.views ? r.clicks / r.views * 100 : 0, actr: r.signups ? r.activated / r.signups * 100 : 0 }));
        const P = { s: pr('signups'), a: pr('actr'), r: pr('revenue'), c: pr('ctr'), v: pr('views') };
        const src = base.map((r) => Object.assign(r, {}));
        const withP = src.map((r) => r);
        const pc = (k, fn) => { const v = withP.map((r) => r[k]).sort((a, b) => a - b); return (x) => (v.length > 1 ? v.filter((y) => y < x).length / (v.length - 1) : 0.5); };
        const ps = pc('signups'), pa = pc('actr'), prv = pc('revenue'), pct = pc('ctr'), pv = pc('views');
        return withP.map((r) => {
          const sc = Math.round(100 * (0.3 * ps(r.signups) + 0.2 * pa(r.actr) + 0.3 * prv(r.revenue) + 0.2 * pct(r.ctr)));
          const rec = sc >= 75 ? 'Scale this format' : sc < 25 ? 'Stop producing' : pct(r.ctr) >= 0.67 && sc >= 40 ? 'Replicate this hook' : pv(r.views) >= 0.5 && sc < 50 ? 'Run experiment' : sc >= 50 ? 'Replicate this hook' : 'Run experiment';
          return Object.assign(r, { impact: sc, rec });
        });
      }
      function genVar(r) {
        const out = h('div', { class: 'g-gap8' }, G.skel(3, 44));
        G.modal({ title: 'Generate variation', sub: 'Based on “' + r.title + '”', wide: true, body: out, actions: (c) => [G.btn('Close', c)] });
        setTimeout(() => out.replaceChildren(...['Lead with the result: “I wrote this in 40 seconds.”', 'Open on the problem: “Typing is the slowest part of your day.”', 'Swap the CTA to “Try free for 14 days — no card”.'].map((t, i) => h('div', { class: 'g-card' }, h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('div', null, h('b', { text: 'Variant ' + 'ABC'[i] }), h('div', { class: 'sm', text: t })), G.btn('Run as experiment', () => G.expModal({ name: 'Hook test: ' + r.title.slice(0, 40), hypothesis: 'Variant ' + 'ABC'[i] + ' (' + t + ') will beat the original on CTR and signups.', control: r.title, variant: t, primary: 'CTR', secondary: 'Signups, Activation, CAC', scope: 'creative' }), 'sm'))))), 1100);
      }
      function build() {
        const all = (G.rows('content') || []);
        const opt = (arr, all_) => [{ v: '', l: all_ }].concat(arr.map((x) => ({ v: x, l: x })));
        const u = (k) => [...new Set(all.map((r) => r[k]))].sort();
        fbox.replaceChildren(G.search('Search content', (v) => { f.q = v; fill(); }, f.q), G.rangeSel(), G.sel(opt(u('platform'), 'All platforms'), f.platform, (v) => { f.platform = v; fill(); }, 'Platform'),
          G.sel([{ v: '', l: 'All campaigns' }].concat([...new Set(all.map((r) => r.campaign))].map((c) => ({ v: c, l: all.find((r) => r.campaign === c).campaign_name }))), f.campaign, (v) => { f.campaign = v; fill(); }, 'Campaign'),
          G.sel(opt(u('creator'), 'All creators'), f.creator, (v) => { f.creator = v; fill(); }, 'Creator'), G.sel(opt(u('type'), 'All content types'), f.type, (v) => { f.type = v; fill(); }, 'Content type'));
        fill();
      }
      function fill() {
        const n = G.RN[S.range], ql = f.q.toLowerCase();
        tbl.set(enrich(G.rows('content') || []).filter((r) => r.days_ago < n && (!ql || (r.title + r.creator).toLowerCase().includes(ql)) && (!f.platform || r.platform === f.platform) && (!f.campaign || r.campaign === f.campaign) && (!f.creator || r.creator === f.creator) && (!f.type || r.type === f.type)));
      }
      function compare() {
        const rows = G.rows('content_compare') || [];
        const M = { ctr: ['CTR', (r) => r.ctr, (v) => F.pct(v, 2), 1], signup_rate: ['Signup rate', (r) => r.signup_rate, (v) => F.pct(v, 2), 1], activation_rate: ['Activation rate', (r) => r.activation_rate, (v) => F.pct(v, 1), 1], cac: ['CAC', (r) => r.cac, F.inrF, -1], revenue: ['Revenue', (r) => r.revenue, F.inr, 1] };
        const tabs = G.tabs(Object.keys(M).map((k) => ({ v: k, l: M[k][0] })), f.metric, (v) => { f.metric = v; draw(); });
        const body = h('div', { class: 'g-gap8' });
        function draw() {
          const [lab, get, fmt, dir] = M[f.metric];
          const vals = rows.map((r) => get(r)).filter((v) => v != null), best = dir > 0 ? d3.max(vals) : d3.min(vals), mx = d3.max(vals) || 1;
          body.replaceChildren(...rows.map((r) => { const v = get(r); const isBest = v === best; return h('div', { class: 'g-row', style: 'flex-wrap:nowrap' }, h('div', { style: 'width:min(190px,38%);flex:none' }, h('div', { class: 'sm', style: isBest ? 'font-weight:700' : '', text: r.format }), h('div', { class: 'xs muted', text: r.posts + ' post' + (r.posts === 1 ? '' : 's') })),
            h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'g-bar ' + (isBest ? '' : 'amber'), style: 'height:10px;margin:0;background:var(--g-line-2)' }, h('i', { style: `width:${Math.max(3, v / mx * 100)}%;background:${isBest ? 'var(--g-em)' : 'var(--g-ink-3)'}` }))), G.mk(h('div', { class: 'num', style: 'width:84px;text-align:right;font-weight:' + (isBest ? 700 : 400), text: v == null ? '—' : fmt(v) }), 'content_compare', { ctr: 'ctr', signup_rate: 'signup_rate', activation_rate: 'activation_rate', cac: 'cac', revenue: 'revenue' }[f.metric], { id: r.id })); }),
            h('div', { class: 'xs muted g-mt8', text: dir > 0 ? 'Higher is better. Best is highlighted.' : 'Lower is better. Best is highlighted.' }));
        }
        draw();
        cmpBox.replaceChildren(G.card('Format comparison', 'Last 90 days · Hook A/B from live ad tests', h('div', null, tabs, body)));
      }
      function exps() {
        const rows = (G.rows('experiments') || []).filter((e) => e.scope === 'creative').concat((S.local.exps || []).filter((e) => e.scope === 'creative'));
        const t = G.table({ source: 'experiments', key: ['id'], id: (r) => r.id, onRow: (r) => G.go('experiments', { open: r.id }), cols: [{ k: 'name', label: 'A/B test', first: 1, f: (r) => G.nm(r.name, r.metric) }, { k: 'win', label: 'Winning variation', nofield: true, sv: (r) => (r.variants.length ? 1 : 0), f: (r) => { const v = G.J(r.variants); if (!v.length || r.confidence < 50) return h('span', { class: 'muted', text: 'No winner yet' }); const w = v.slice().sort((a, b) => b.value - a.value)[0]; return h('b', { text: w.name }); } },
          { k: 'confidence', label: 'Confidence', f: (r) => h('div', { class: 'g-meter' }, h('span', { class: 'num', text: r.confidence + '%' }), G.pbar(r.confidence, r.confidence >= 90 ? '' : 'amber')) }, { k: 'impact', label: 'Impact', hide: 'n' }, { k: 'status', label: 'Status', f: (r) => G.statusBd(r.status) }] });
        t.set(rows); expBox.replaceChildren(t.el, h('div', { class: 'g-row', style: 'padding:12px 16px' }, G.btn('Create experiment', () => G.expModal({ scope: 'creative' }), 'pri'), G.btn('Duplicate creative', () => G.toast('Select a post above, then use “Duplicate creative”')), G.btn('Generate variation', () => { const top = (G.rows('content') || [])[0]; if (top) genVar(top); })));
      }
      function update() {
        const ins = (G.rows('insights') || []).find((i) => i.id === 'content-ai');
        if (ins) insBox.replaceChildren(G.insight(ins, h('div', { class: 'g-row g-mt8' }, h('span', { class: 'sm', style: 'flex:1 1 280px', text: ins.reco }), G.btn(ins.cta, () => { const top = (G.rows('content') || []).filter((r) => r.type === 'Demo video')[0]; if (top) genVar(top); }, 'pri'), G.btn('Create experiment', () => G.expModal({ scope: 'creative', name: 'Demo video vs announcement post' })))));
        build(); compare(); exps();
      }
      return { update };
    },
  });
})();
