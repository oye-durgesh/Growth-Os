(function () {
  'use strict';
  /* Analytics model + chart kit.
     G.an(R) is the single normalized model every chart reads: it is built only from
     G.rows() for the active workspace, so every number reconciles with the KPI cards.
     Nothing in here is hard-coded to a company. */
  const G = window.G, h = G.h, S = G.S, F = G.F;
  const sum = (a, f) => (a || []).reduce((s, x) => s + (+(typeof f === 'function' ? f(x) : x[f]) || 0), 0);
  const div = (a, b) => (b ? a / b : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r0 = Math.round;
  const EFFN = { Creators: 0.8, Referral: 0.65 };

  /* ---------- colours: restrained, no blue. Creators (the hero) take the brand green. ---------- */
  const CH_COL = { Creators: 'var(--g-em)', 'Google Ads': '#b8923f', Meta: '#b5654d', Instagram: '#c47f98', LinkedIn: '#7d8f68', X: '#8e9490', YouTube: '#b8524a', Reddit: '#cf9540', Organic: '#7fc6a4', Referral: '#a9c64a', Direct: '#6c746f' };
  const FALL = ['#9a8f6a', '#a77b9a', '#6f8f86', '#c4a27a', '#8b7a6a'];
  const colCache = {};
  G.chCol = (n) => CH_COL[n] || colCache[n] || (colCache[n] = FALL[Object.keys(colCache).length % FALL.length]);

  /* ---------- model ---------- */
  const cache = new WeakMap();
  const STG = [['impr', 'Impressions'], ['clicks', 'Clicks'], ['visitors', 'Landing visits'], ['signups', 'Signups'], ['activated', 'Activated users'], ['leads', 'Qualified leads'], ['customers', 'Customers'], ['revenue', 'Revenue']];
  G.STG = STG;

  function build(R) {
    const pick = (id) => (G.rows(id) || []).filter((r) => r.range === R);
    const chs = pick('channels');
    if (!chs.length) return { R, empty: true, ch: [], camps: [], cr: [], funnel: [], tot: {}, prev: {}, kp: {} };
    const kp = {}; pick('kpis').forEach((k) => (kp[k.metric] = k));
    const T = (k) => sum(chs, k);
    const tot = { spend: T('spend'), impr: T('impressions'), clicks: T('clicks'), visitors: T('visitors'), signups: T('signups'), activated: T('activated'), leads: T('leads'), customers: T('customers'), revenue: T('revenue') };
    const pv = (m, cur) => { const k = kp[m]; if (!k) return null; if (k.prev != null) return k.prev; return k.delta != null ? cur / (1 + k.delta / 100) : null; };
    const prev = { spend: pv('spend', tot.spend), impr: pv('impr', tot.impr), clicks: pv('clicks', tot.clicks), visitors: pv('visitors', tot.visitors), signups: pv('signups', tot.signups), activated: pv('activated', tot.activated), leads: pv('leads', tot.leads), customers: pv('customers', tot.customers), revenue: pv('revenue', tot.revenue) };
    tot.cac = div(tot.spend, tot.customers); tot.roas = div(tot.revenue, tot.spend); tot.ctr = div(tot.clicks, tot.impr) * 100;
    prev.cac = div(prev.spend, prev.customers); prev.roas = div(prev.revenue, prev.spend);
    /* channels */
    const ch = chs.map((c) => {
      const o = Object.assign({}, c, { name: c.channel });
      o.impr = c.impressions || 0; o.visitors = c.visitors || 0; o.leads = c.leads || 0; o.activated = c.activated || 0;
      o.ctr = div(o.clicks, o.impr) != null ? o.clicks / o.impr * 100 : c.ctr; o.cpc = div(o.spend, o.clicks);
      o.act = div(o.activated, o.signups) != null ? o.activated / o.signups * 100 : null;
      o.srate = div(o.signups, o.visitors) != null ? o.signups / o.visitors * 100 : null;
      o.cac = o.spend > 0 && o.customers ? o.spend / o.customers : null; o.roas = o.spend > 0 ? o.revenue / o.spend : null;
      o.col = G.chCol(o.name);
      return o;
    }).sort((a, b) => b.revenue - a.revenue);
    ch.forEach((o) => { ['signups', 'activated', 'customers', 'revenue', 'spend', 'clicks'].forEach((k) => (o['sh_' + k] = div(o[k], tot[k]) || 0)); });
    /* previous-period revenue per channel: estimated from each channel's own signup and ROAS change, scaled so it sums to the reported previous total */
    if (prev.revenue != null) {
      const raw = ch.map((o) => o.revenue / (1 + clamp((o.d_signups || 0) / 100 + (o.d_roas || 0) / 200, -0.5, 0.8)));
      const sc = prev.revenue / (sum(raw, (x) => x) || 1);
      ch.forEach((o, i) => (o.prevRev = raw[i] * sc));
    }
    const camps = pick('campaigns').filter((c) => c.status !== 'Draft').map((c) => Object.assign({}, c, { name: c.name, key: c.cid, sh_revenue: div(c.revenue, tot.revenue) || 0, cpc: div(c.spend, c.clicks), col: null }));
    const cr = pick('creators').map((c) => Object.assign({}, c, { key: c.key, name: c.handle || c.name, sh_revenue: div(c.revenue, tot.revenue) || 0 }));
    /* funnel */
    const funnel = STG.map(([k, label], i) => {
      const value = tot[k], pr = prev[k];
      const o = { key: k, label, value, prev: pr, delta: pr ? (value / pr - 1) * 100 : null };
      if (i) { const pk = STG[i - 1][0]; o.from = pk; if (k === 'revenue') { o.conv = div(value, tot.customers); o.prevConv = div(pr, prev.customers); o.arpc = true; } else { o.conv = div(value, tot[pk]) * 100; o.prevConv = prev[pk] ? div(pr, prev[pk]) * 100 : null; o.drop = 100 - o.conv; } }
      return o;
    });
    return { R, empty: false, ch, camps, cr, funnel, tot, prev, kp };
  }
  G.an = (R) => {
    R = R || S.range;
    const key = G.rows('channels') || [];
    let m = cache.get(key); if (!m) cache.set(key, (m = {}));
    return m[R] || (m[R] = build(R));
  };
  G.anChannel = (R, name) => (G.an(R).ch.find((c) => c.name === name));

  /* ---------- targets (from the company settings / goals; sensible defaults otherwise) ---------- */
  G.targets = () => {
    const w = G.WS.active(), c = w.company || {}, a = G.an('30d');
    const goals = G.rows('goals') || [], g = (re) => goals.find((x) => re.test(x.name || ''));
    const cg = g(/CAC/i);
    const r50 = (v) => Math.round(v / 50) * 50;
    return {
      cac: c.cacTarget || (cg && cg.target) || (a.prev.cac ? r50(a.prev.cac * 0.9) : null),
      revenue: c.revenueTarget || (a.tot.revenue ? r0(a.tot.revenue * 1.2 / 1e5) * 1e5 : null),
      signups: c.signupTarget || null,
    };
  };

  /* month-end revenue projection from the daily series */
  G.monthProj = () => {
    const ser = G.rows('series') || []; if (ser.length < 8) return null;
    const last = ser[ser.length - 1].date, ym = last.slice(0, 7), dt = new Date(last + 'T00:00:00Z');
    const dim = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate(), day = dt.getUTCDate();
    const mtd = sum(ser.filter((r) => r.date.slice(0, 7) === ym), 'revenue'), avg7 = sum(ser.slice(-7), 'revenue') / 7;
    return { mtd, avg7, left: dim - day, proj: mtd + avg7 * (dim - day), month: dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }) };
  };

  /* ---------- per-entity daily series that sum exactly to the entity's period totals ---------- */
  const norm = (a) => { const s = sum(a, (x) => x) || 1; return a.map((x) => x / s); };
  const tiltW = (w, rel) => { const n = w.length; return norm(w.map((x, i) => x * (1 + clamp(rel || 0, -0.6, 0.6) * ((n > 1 ? i / (n - 1) : 0.5) - 0.5) * 2 * 0.5))); };
  G.anTS = (kind, name, R) => {
    R = R || S.range;
    const ser = (G.rows('series') || []).slice(-G.RN[R]); if (!ser.length) return [];
    const a = G.an(R), n = ser.length, dates = ser.map((r) => new Date(r.date + 'T00:00:00Z'));
    if (kind === 'all') {
      const ctrAll = div(a.tot.clicks, a.tot.impr) || 0.016;
      return ser.map((r, i) => ({ date: dates[i], impr: ctrAll ? r.clicks / ctrAll : 0, clicks: r.clicks, visitors: r.traffic, spend: r.spend, signups: r.signups, activated: r.activated, customers: r.customers, revenue: r.revenue }));
    }
    const e = kind === 'channel' ? a.ch.find((c) => c.name === name) : a.camps.find((c) => c.key === name);
    if (!e) return [];
    let dCtr = e.d_ctr, dAct = e.d_activation;
    if (kind === 'campaign') { const cs = (e.chs || []).map((n) => a.ch.find((c) => c.name === n)).filter(Boolean), wsum = sum(cs, 'spend') || 1; dCtr = sum(cs, (c) => (c.d_ctr || 0) * c.spend) / wsum; }
    const w = (k) => norm(ser.map((r) => +r[k] || 0));
    const wc = w('clicks'), wv = w('traffic'), ws = w('spend'), wsg = w('signups'), wcu = w('customers'), wr = w('revenue');
    const impr = wc.map((x) => x * (e.impr || e.impressions || 0));
    const clicks = tiltW(wc, (dCtr || 0) / 100).map((x) => x * (e.clicks || 0));
    const visitors = wv.map((x) => x * (e.visitors || 0));
    const spend = ws.map((x) => x * (e.spend || 0));
    const signups = tiltW(wsg, (e.d_signups || 0) / 100).map((x) => x * (e.signups || 0));
    const wact = tiltW(norm(signups), (dAct || 0) / 100), activated = wact.map((x) => x * (e.activated || 0));
    const customers = tiltW(wcu, -(e.d_cac || 0) / 100).map((x) => x * (e.customers || 0));
    const revenue = tiltW(wr, (e.d_roas || 0) / 100).map((x) => x * (e.revenue || 0));
    return ser.map((r, i) => ({ date: dates[i], impr: impr[i], clicks: clicks[i], visitors: visitors[i], spend: spend[i], signups: signups[i], activated: activated[i], customers: customers[i], revenue: revenue[i] }));
  };
  G.METRICS = {
    ctr: { l: 'CTR', fm: (v) => F.pct(v, 2), good: 1, f: (a) => div(a.clicks, a.impr) * 100 },
    cpc: { l: 'CPC', fm: F.inrF, good: -1, f: (a) => div(a.spend, a.clicks) },
    srate: { l: 'Signup rate', fm: (v) => F.pct(v, 2), good: 1, f: (a) => div(a.signups, a.visitors) * 100 },
    act: { l: 'Activation rate', fm: (v) => F.pct(v, 1), good: 1, f: (a) => div(a.activated, a.signups) * 100 },
    cac: { l: 'CAC', fm: F.inrF, good: -1, f: (a) => div(a.spend, a.customers) },
    roas: { l: 'ROAS', fm: F.x, good: 1, f: (a) => div(a.revenue, a.spend) },
  };
  /* rolling-window metric series: [[Date, value], ...] */
  G.metricSeries = (rows, key, win) => {
    const M = G.METRICS[key], out = [];
    rows.forEach((r, i) => {
      const lo = Math.max(0, i - (win || 1) + 1), w = rows.slice(lo, i + 1), acc = {};
      ['impr', 'clicks', 'visitors', 'spend', 'signups', 'activated', 'customers', 'revenue'].forEach((k) => (acc[k] = sum(w, k)));
      const v = M.f(acc); if (v != null && isFinite(v)) out.push([r.date, v]);
    });
    return out;
  };
  G.winFor = (R) => (R === '7d' ? 3 : 7);

  /* ---------- chart kit ---------- */
  const CH = (G.ch = {});
  const svgBox = (box, H) => { const W = box.clientWidth || 640; box.replaceChildren(); return { W, svg: d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H) }; };
  const axisT = (svg, x, y, txt, anc, extra) => svg.append('text').attr('x', x).attr('y', y).attr('text-anchor', anc || 'middle').attr('class', 'ax').text(txt);

  /* funnel: one row per stage; click selects. */
  CH.funnel = (stages, o) => {
    o = o || {};
    const mx = Math.max(...stages.map((s) => s.value || 0)) || 1;
    const head = h('div', { class: 'g-fn-r hd' }, h('span', { text: 'Stage' }), h('span'), h('span', { class: 'r', text: 'Volume' }), h('span', { class: 'r', text: 'From previous' }), h('span', { class: 'r', text: 'Drop-off' }), h('span', { class: 'r', text: 'vs previous period' }));
    return h('div', { class: 'g-fn', role: 'list' }, head, stages.map((s0, i) => {
      const s = Object.assign({}, s0); ['conv', 'drop', 'delta', 'prev'].forEach((k) => { if (s[k] != null && !Number.isFinite(s[k])) s[k] = null; });
      const w = s.arpc ? clamp(100 * Math.pow((stages[i - 1].value || 1) / mx, 0.3), 3, 100) : clamp(100 * Math.pow((s.value || 0) / mx, 0.3), 3, 100);
      const leak = o.leakKeys && o.leakKeys.includes(s.key);
      return h('button', { class: 'g-fn-r' + (o.sel === s.key ? ' on' : '') + (leak ? ' leak' : '') + (s.arpc ? ' out' : ''), type: 'button', role: 'listitem', 'aria-pressed': o.sel === s.key, onclick: () => o.onPick && o.onPick(s.key),
        onmousemove: (e) => G.tip.show(e, h('div', null, h('b', { text: s.label }), h('div', { class: 'r' }, h('span', { text: 'Volume' }), h('b', { text: s.fmt(s.value) })), s.prev != null ? h('div', { class: 'r' }, h('span', { text: 'Previous period' }), h('b', { text: s.fmt(s.prev) })) : null, s.conv != null ? h('div', { class: 'r' }, h('span', { text: s.arpc ? 'Revenue per customer' : 'Conversion' }), h('b', { text: s.arpc ? F.inrF(s.conv) : F.pct(s.conv, s.conv < 10 ? 2 : 1) })) : null, h('div', { class: 'xs muted', text: 'Click for the drivers of this stage' }))), onmouseleave: G.tip.hide },
        h('span', { class: 'lab', text: s.label }), h('span', { class: 'bar' }, h('i', { style: 'width:' + w + '%' })), h('span', { class: 'val num r', text: s.fmt(s.value) }),
        h('span', { class: 'cv num r', text: s.conv == null ? '—' : s.arpc ? F.inrF(s.conv) + '/cust.' : F.pct(s.conv, s.conv < 10 ? 2 : 1) }),
        h('span', { class: 'dr num r' + (leak ? ' leak' : ''), text: s.drop == null ? '—' : F.pct(s.drop, 1) }), h('span', { class: 'r' }, G.dl(s.delta, s.good !== false)));
    }));
  };

  /* stacked columns. o: {buckets:[{label,vals}], keys, color, fmt, onPick, tip(key,bucket), height} */
  CH.stack = (box, o) => {
    const H = o.height || 260, { W, svg } = svgBox(box, H), m = { t: 8, r: 8, b: 26, l: 46 };
    const B = o.buckets, tots = B.map((b) => sum(o.keys, (k) => b.vals[k] || 0)), ymax = (d3.max(tots) || 1) * 1.06;
    const x = d3.scaleBand(B.map((_, i) => i), [m.l, W - m.r]).padding(0.22), y = d3.scaleLinear([0, ymax], [H - m.b, m.t]).nice(4);
    y.ticks(4).forEach((t) => { svg.append('line').attr('class', 'gl').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)); axisT(svg, m.l - 6, y(t) + 4, o.fmt(t), 'end'); });
    const every = Math.ceil(B.length / Math.max(2, Math.floor((W - m.l) / 64)));
    B.forEach((b, i) => { if (i % every === 0 || i === B.length - 1) axisT(svg, x(i) + x.bandwidth() / 2, H - 8, b.label); });
    B.forEach((b, i) => {
      let acc = 0;
      o.keys.forEach((k) => {
        const v = b.vals[k] || 0; if (!v) return;
        const y1 = y(acc + v), y0 = y(acc); acc += v;
        svg.append('rect').attr('x', x(i)).attr('width', x.bandwidth()).attr('y', y1).attr('height', Math.max(0.5, y0 - y1 - 0.6)).attr('rx', 1.5).style('fill', o.color(k)).attr('class', 'seg').style('cursor', 'pointer')
          .on('mousemove', (e) => G.tip.show(e, o.tip(k, b, i))).on('mouseleave', G.tip.hide).on('click', () => o.onPick && o.onPick(k));
      });
    });
  };

  /* donut with a centre label. items: [{key,label,value,color,muted}] */
  CH.donut = (box, items, o) => {
    const H = o.height || 230, W = Math.min(box.clientWidth || 260, 300), R = Math.min(W, H) / 2 - 4, tot = sum(items, 'value') || 1;
    box.replaceChildren();
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).style('max-width', '100%').attr('role', 'img').attr('aria-label', o.label || 'Donut chart');
    const g = svg.append('g').attr('transform', `translate(${W / 2},${H / 2})`);
    const pie = d3.pie().sort(null).value((d) => d.value).padAngle(0.012)(items), arc = d3.arc().innerRadius(R * 0.62).outerRadius(R), arcOn = d3.arc().innerRadius(R * 0.6).outerRadius(R + 4);
    g.selectAll('path').data(pie).join('path').attr('d', (d) => (d.data.key === o.sel ? arcOn(d) : arc(d))).style('fill', (d) => d.data.color).style('opacity', (d) => (o.sel && d.data.key !== o.sel ? 0.55 : 1)).style('cursor', 'pointer').attr('class', 'seg')
      .on('mousemove', (e, d) => G.tip.show(e, h('div', null, h('b', { text: d.data.label }), h('div', { class: 'r' }, h('span', { text: 'Revenue' }), h('b', { text: F.inr(d.data.value) })), h('div', { class: 'r' }, h('span', { text: 'Share' }), h('b', { text: F.pct(d.data.value / tot * 100, 1) })))))
      .on('mouseleave', G.tip.hide).on('click', (e, d) => o.onPick && o.onPick(d.data.key));
    g.append('text').attr('class', 'dn-v').attr('text-anchor', 'middle').attr('y', 2).text(o.centerV);
    g.append('text').attr('class', 'dn-l').attr('text-anchor', 'middle').attr('y', 20).text(o.centerL);
  };

  /* horizontal bars sorted by a metric. rows:[{key,name,value,sub,color,tag}] */
  CH.hbar = (rows, o) => {
    const mx = Math.max(...rows.map((r) => Math.abs(r.value || 0)), 1e-9);
    return h('div', { class: 'g-hb' }, rows.map((r) => h('button', { class: 'g-hb-r', type: 'button', onclick: () => o.onPick && o.onPick(r.key),
      onmousemove: (e) => o.tip && G.tip.show(e, o.tip(r)), onmouseleave: G.tip.hide },
    h('span', { class: 'n' }, h('b', { text: r.name }), r.sub ? h('small', { text: r.sub }) : null),
    h('span', { class: 'b' }, h('i', { style: `width:${Math.max(1.5, Math.abs(r.value || 0) / mx * 100)}%;background:${r.color || 'var(--g-ink-3)'}` })),
    h('span', { class: 'v num', text: o.fmt(r.value) }), r.tag || h('span'))));
  };

  /* waterfall. steps:[{key,label,value,kind:'start'|'end'|'delta'}]; the running total is carried by the chart. */
  CH.waterfall = (box, steps, o) => {
    const H = o.height || 270, { W, svg } = svgBox(box, H), m = { t: 22, r: 8, b: 44, l: 8 };
    let run = 0; const bars = steps.map((s) => { if (s.kind === 'delta') { const a = run; run += s.value; return Object.assign({}, s, { a, b: run }); } run = s.value; return Object.assign({}, s, { a: 0, b: s.value }); });
    const lo = d3.min(bars, (b) => Math.min(b.a, b.b)), hi = d3.max(bars, (b) => Math.max(b.a, b.b));
    const base = Math.max(0, lo - (hi - lo) * 0.9), y = d3.scaleLinear([base, hi * 1.04], [H - m.b, m.t]);
    const x = d3.scaleBand(bars.map((_, i) => i), [m.l, W - m.r]).padding(0.28);
    bars.forEach((b, i) => {
      const y0 = y(Math.max(b.a, b.b)), y1 = y(Math.min(b.a, b.b)), up = b.kind === 'delta' && b.value >= 0;
      const col = b.kind === 'delta' ? (up ? 'var(--g-em)' : 'var(--g-red)') : 'var(--g-ink-3)';
      svg.append('rect').attr('x', x(i)).attr('width', x.bandwidth()).attr('y', y0).attr('height', Math.max(2, y1 - y0)).attr('rx', 2).style('fill', col).style('opacity', b.kind === 'delta' ? 0.9 : 0.75).style('cursor', 'pointer').attr('class', 'seg')
        .on('mousemove', (e) => G.tip.show(e, o.tip ? o.tip(b) : b.label)).on('mouseleave', G.tip.hide).on('click', () => o.onPick && o.onPick(b));
      if (i < bars.length - 1) svg.append('line').attr('class', 'gl').attr('x1', x(i) + x.bandwidth()).attr('x2', x(i + 1)).attr('y1', y(b.b)).attr('y2', y(b.b)).style('stroke-dasharray', '2 2');
      svg.append('text').attr('x', x(i) + x.bandwidth() / 2).attr('y', y0 - 6).attr('text-anchor', 'middle').attr('class', 'wf-v').text(b.kind === 'delta' ? (b.value >= 0 ? '+' : '−') + o.fmt(Math.abs(b.value)) : o.fmt(b.value));
      const words = String(b.label).split(' ');
      const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' '), line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
      axisT(svg, x(i) + x.bandwidth() / 2, H - 26, line1); if (line2) axisT(svg, x(i) + x.bandwidth() / 2, H - 13, line2);
    });
  };

  /* scatter with four labelled quadrants. pts:[{key,name,x,y,r,tone}] */
  CH.scatter = (box, pts, o) => {
    const H = o.height || 340, { W, svg } = svgBox(box, H), m = { t: 18, r: 18, b: 44, l: 54 };
    if (pts.length < 2) { box.replaceChildren(G.empty('◌', 'Not enough data to plot', 'This chart needs at least two items with views and customers.')); return; }
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x = d3.scaleLinear([0, d3.max(xs) * 1.12], [m.l, W - m.r]).nice(), y = d3.scaleLinear([0, Math.max(1, d3.max(ys)) * 1.18], [H - m.b, m.t]).nice();
    const rs = d3.scaleSqrt([0, d3.max(pts, (p) => p.r) || 1], [5, 22]);
    const mx = d3.median(xs), my = d3.median(ys);
    y.ticks(4).forEach((t) => { svg.append('line').attr('class', 'gl').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)); axisT(svg, m.l - 6, y(t) + 4, F.c(t), 'end'); });
    x.ticks(5).forEach((t) => axisT(svg, x(t), H - 26, F.c(t)));
    axisT(svg, (m.l + W - m.r) / 2, H - 8, o.xl); svg.append('text').attr('class', 'ax').attr('transform', `translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(o.yl);
    svg.append('line').attr('class', 'ref').attr('x1', x(mx)).attr('x2', x(mx)).attr('y1', m.t).attr('y2', H - m.b);
    svg.append('line').attr('class', 'ref').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(my)).attr('y2', y(my));
    const ql = (t, ax, ay, anc) => svg.append('text').attr('class', 'ql').attr('x', ax).attr('y', ay).attr('text-anchor', anc).text(t);
    ql(o.q.tl, m.l + 6, m.t + 11, 'start'); ql(o.q.tr, W - m.r - 4, m.t + 11, 'end'); ql(o.q.bl, m.l + 6, H - m.b - 6, 'start'); ql(o.q.br, W - m.r - 4, H - m.b - 6, 'end');
    const placed = [];
    pts.slice().sort((a, b) => b.r - a.r).forEach((p) => {
      const cx = x(p.x), cy = y(p.y), rad = rs(p.r), col = p.tone === 'good' ? 'var(--g-em)' : p.tone === 'bad' ? 'var(--g-red)' : p.tone === 'warn' ? 'var(--g-amber)' : 'var(--g-ink-3)';
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', rad).style('fill', col).style('fill-opacity', 0.26).style('stroke', col).attr('stroke-width', 1.6).style('cursor', 'pointer').attr('class', 'seg')
        .on('mousemove', (e) => G.tip.show(e, o.tip(p))).on('mouseleave', G.tip.hide).on('click', () => o.onPick && o.onPick(p.key));
      let ty = cy - rad - 4; while (placed.some((q) => Math.abs(q[0] - cx) < 64 && Math.abs(q[1] - ty) < 11)) ty -= 11; placed.push([cx, ty]);
      if (ty > m.t + 14) svg.append('text').attr('class', 'pt').attr('x', cx).attr('y', ty).attr('text-anchor', 'middle').text(p.name);
    });
  };

  /* 2×2 matrix. cells: {tl,tr,bl,br} each {title, sub, items:[{key,label,detail}]} */
  CH.matrix = (cells, o) => {
    const cell = (k, tone) => h('div', { class: 'g-mx-c ' + tone }, h('div', { class: 'g-mx-t' }, h('b', { text: cells[k].title }), h('small', { text: cells[k].sub })),
      h('div', { class: 'g-mx-i' }, cells[k].items.length ? cells[k].items.map((i) => h('button', { class: 'g-mx-chip', type: 'button', onclick: () => o.onPick(i.key), onmousemove: (e) => G.tip.show(e, i.tip), onmouseleave: G.tip.hide }, h('i', { style: 'background:' + (i.color || 'var(--g-ink-3)') }), i.label)) : h('span', { class: 'xs muted', text: 'None' })));
    return h('div', { class: 'g-mx' }, h('div', { class: 'g-mx-corner' }), h('div', { class: 'g-mx-h', text: 'Low CAC' }), h('div', { class: 'g-mx-h', text: 'High CAC' }),
      h('div', { class: 'g-mx-v', text: 'High revenue' }), cell('tl', 'good'), cell('tr', 'warn'), h('div', { class: 'g-mx-v', text: 'Low revenue' }), cell('bl', 'neutral'), cell('br', 'bad'));
  };

  /* ---------- Radar link: every major chart can raise a SIGNAL → IMPACT → CAUSE → ACTION → EXPECTED strip ---------- */
  G.chartInsight = (o) => {
    if (!o) return null;
    const cell = (k, v, cls) => h('div', { class: 'ci-c ' + (cls || '') }, h('small', { text: k }), h('div', { text: v }));
    return h('div', { class: 'g-ci' }, h('div', { class: 'g-ci-h' }, h('span', { class: 'g-dot ' + (o.tone || '') }), h('b', { text: 'GTM Radar read' }), o.conf ? h('span', { class: 'xs muted', text: 'Confidence ' + o.conf + '%' }) : null),
      h('div', { class: 'g-ci-g' }, cell('SIGNAL', o.signal, 'sg'), cell('IMPACT', o.impact), cell('CAUSE', o.cause), cell('ACTION', o.action, 'ac'), cell('EXPECTED RESULT', o.expected, 'ex')),
      h('div', { class: 'g-row g-mt8' }, o.investigate ? G.btn('Investigate', o.investigate, 'sm') : null, o.simulate ? G.btn('Simulate', o.simulate, 'sm') : null, o.apply ? G.btn('Apply', o.apply, 'sm pri') : null, G.btn('Open in Radar', () => G.go('radar'), 'sm ghost')));
  };
  /* Apply = log a decision (nothing external changes — everything is simulated and labelled so) */
  G.applyInsight = (o) => G.confirm({ title: 'Apply this recommendation?', text: o.action, detail: 'Expected result: ' + o.expected + '. Growth OS records the decision and tracks the real result against this expectation. Nothing changes in your ad accounts.', confirm: 'Apply & log decision', onConfirm: () => { G.logDecision({ title: o.action, reason: o.signal, expected: o.expected, metric: o.metric || '', amount: o.amount, kind: o.kind || 'chart' }); } });

  G.sum = sum; G.div = div; G.clamp = clamp;
})();
