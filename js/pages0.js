(function () {
  'use strict';
  /* Shared decision helpers: simulation, evidence, growth status, drill-downs, priorities. */
  const G = window.G, h = G.h, S = G.S, F = G.F;
  const EFF = { Creators: 0.8, Referral: 0.65 };
  const MONTH = '30d';

  G.chan30 = () => { const o = {}; (G.rows('channels') || []).filter((r) => r.range === MONTH).forEach((r) => (o[r.channel] = r)); return o; };

  /* Move spend between channels at each channel's own rate per rupee. The destination gets a diminishing-returns haircut. */
  G.sim = (moves) => {
    const ch = G.chan30(), names = Object.keys(ch);
    const tot = (k) => d3.sum(names, (n) => ch[n][k] || 0);
    const base = { spend: tot('spend'), signups: tot('signups'), customers: tot('customers'), revenue: tot('revenue'), leads: tot('leads') };
    const next = Object.assign({}, base);
    (moves || []).forEach((m) => {
      const s = ch[m.frm], d = ch[m.to]; if (!s || !d || !m.amount || !s.spend || !d.spend) return;
      const A = Math.min(m.amount, s.spend), e = EFF[m.to] || 0.9;
      ['signups', 'customers', 'revenue', 'leads'].forEach((k) => { next[k] += A * (d[k] / d.spend * e - s[k] / s.spend); });
    });
    const fin = (o) => Object.assign(o, { cac: o.spend / Math.max(1, o.customers), roas: o.revenue / Math.max(1, o.spend) });
    return { base: fin(base), next: fin(next) };
  };

  const ROWS = [['Spend', 'spend', F.inr, 0], ['Signups', 'signups', F.n, 1], ['Qualified leads', 'leads', F.n, 1], ['Customers', 'customers', F.n, 1], ['Revenue', 'revenue', F.inr, 1], ['CAC', 'cac', F.inrF, -1], ['ROAS', 'roas', F.x, 1]];
  G.simTable = (r) => h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['Per month', 'Current', 'After shift', 'Change'].map((t, i) => h('th', { class: i ? 'r' : '', text: t })))),
    h('tbody', null, ROWS.map(([l, k, fm, dir]) => {
      const a = r.base[k], b = r.next[k], d = b - a, pct = a ? d / a * 100 : 0;
      const good = dir === 0 ? null : dir > 0 ? d > 0 : d < 0;
      return h('tr', { class: 'row' }, h('td', { text: l }), h('td', { class: 'r num', text: fm(a) }), h('td', { class: 'r num', style: 'font-weight:600', text: fm(b) }),
        h('td', { class: 'r num' }, Math.abs(pct) < 0.05 ? h('span', { class: 'muted', text: '—' }) : h('span', { class: 'dl ' + (good == null ? 'flat' : good ? 'up' : 'down'), text: (d > 0 ? '+' : '−') + Math.abs(pct).toFixed(1) + '%' })));
    })));

  /* Interactive "what happens if" model for one or two budget moves from a single source channel. */
  G.simModal = (o) => {
    const ch = G.chan30(), spendable = Object.keys(ch).filter((n) => ch[n].spend > 0);
    const st = { frm: o.frm || 'Meta', moves: (o.moves || []).map((m) => ({ to: m.to, amount: m.amount })) };
    const out = h('div'), ctl = h('div', { class: 'g-gap8' }), note = h('div', { class: 'sm' });
    function draw() {
      const r = G.sim(st.moves.map((m) => ({ frm: st.frm, to: m.to, amount: m.amount })));
      out.replaceChildren(G.simTable(r));
      const dc = r.next.customers - r.base.customers, dr = r.next.revenue - r.base.revenue;
      note.replaceChildren(h('b', { text: 'Expected: ' }), `${dc >= 0 ? '+' : '−'}${Math.abs(dc).toFixed(0)} customers and ${dr >= 0 ? '+' : '−'}${F.inr(Math.abs(dr))} revenue per month at the same total spend. Assumes the destination converts at ${Math.round((EFF[st.moves[0] && st.moves[0].to] || 0.9) * 100)}% of its current rate.`);
    }
    function controls() {
      ctl.replaceChildren(h('div', { class: 'g-row' }, h('span', { class: 'sm', text: 'Take budget from' }), G.sel(spendable, st.frm, (v) => { st.frm = v; st.moves.forEach((m) => { if (m.to === v) m.to = spendable.find((x) => x !== v); m.amount = Math.min(m.amount, ch[v].spend); }); controls(); draw(); }, 'Source channel')),
        ...st.moves.map((m) => { const val = h('b', { class: 'num', text: F.inrF(m.amount) });
          const rng = h('input', { type: 'range', min: 0, max: Math.round(ch[st.frm].spend), step: 5000, value: m.amount, 'aria-label': 'Amount to shift to ' + m.to, style: 'flex:1;min-width:140px;accent-color:var(--g-em)', oninput: () => { m.amount = +rng.value; val.textContent = F.inrF(m.amount); draw(); } });
          return h('div', { class: 'g-row', style: 'flex-wrap:nowrap' }, h('span', { class: 'sm', style: 'min-width:60px', text: 'Shift to' }), G.sel(spendable.filter((n) => n !== st.frm), m.to, (v) => { m.to = v; draw(); }, 'Destination channel'), rng, val); }));
    }
    controls(); draw();
    return G.modal({ title: o.title || 'Simulate budget shift', sub: 'Nothing changes until you apply it. Based on the last 30 days.', wide: true, body: h('div', { class: 'g-gap16' }, ctl, out, note),
      actions: (c) => [G.btn('Close', c), G.btn('Apply shift', () => { c(); const t = st.moves.filter((m) => m.amount).map((m) => F.inrF(m.amount) + ' → ' + m.to).join(', ') || 'no change'; S.applied['sim-' + st.frm] = true; const rr = G.sim(st.moves.map((m) => ({ frm: st.frm, to: m.to, amount: m.amount }))), dcc = rr.next.customers - rr.base.customers; G.logDecision({ title: 'Moved budget from ' + st.frm + ': ' + t, reason: o.title || 'Budget simulation', expected: (dcc >= 0 ? '+' : '−') + Math.abs(Math.round(dcc)) + ' customers a month', metric: 'customers', kind: 'budget' }); o.onApply && o.onApply(st); }, 'pri')] });
  };

  /* Static projection (for recommendations that are not budget moves). */
  G.projModal = (s) => G.modal({ title: 'Simulate: ' + s.action, sub: 'Projected result before you apply anything.', body: h('div', { class: 'g-gap16' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, h('th', { text: 'Metric' }), h('th', { class: 'r', text: 'Projected' }))), h('tbody', null, (s.proj || []).map(([a, b]) => h('tr', { class: 'row' }, h('td', { text: a }), h('td', { class: 'r num', style: 'font-weight:600', text: b }))))), h('div', { class: 'sm' }, h('b', { text: 'Expected: ' }), s.expected, ' · ', h('b', { text: s.conf + '% confidence' }))),
    actions: (c) => [G.btn('Close', c), G.btn('Apply recommendation', () => { c(); G.signalAct(s); }, 'pri')] });

  /* "Why this recommendation?" */
  G.evidenceDrawer = (ev, foot) => {
    const col = (c) => h('div', { class: 'g-card', style: 'flex:1 1 180px' }, h('b', { text: c.title }), h('div', { class: 'g-gap8 g-mt8' }, c.rows.map(([k, v]) => h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('span', { class: 'sm muted', text: k }), h('b', { class: 'num', text: String(v) })))));
    return G.drawer({ title: 'Why this recommendation?', sub: ev.rec, body: h('div', { class: 'g-gap16' },
      h('div', null, h('div', { class: 'g-sig-k', text: 'Recommendation' }), h('div', { style: 'font-size:17px;font-weight:600', text: '→ ' + ev.rec })),
      h('div', null, h('div', { class: 'g-sig-k', text: 'Evidence' }), h('div', { class: 'g-row g-mt8', style: 'align-items:stretch' }, col(ev.a), ev.b ? col(ev.b) : null)),
      h('div', null, h('div', { class: 'g-sig-k', text: 'Observed pattern' }), h('p', { style: 'margin:4px 0 0', text: ev.pattern })),
      h('div', null, h('div', { class: 'g-sig-k', text: 'Expected result' }), h('p', { style: 'margin:4px 0 0', text: ev.result }))), footer: foot });
  };

  G.investigate = (sg) => {
    const ev = G.J(sg.ev) || {}, cause = G.J(sg.cause) || [], pg = { campaigns: 'Campaigns', creators: 'Creators', channels: 'Channels & Ads', content: 'Content', leads: 'Leads', pipeline: 'Pipeline', attribution: 'Attribution', experiments: 'Experiments', forecast: 'Forecast' };
    const h = G.h, card = (c) => c && c.rows ? h('div', { class: 'g-card', style: 'padding:12px;min-width:0' }, h('b', { text: c.title }), h('div', { class: 'g-gap8 g-mt8' }, c.rows.map(([k, v]) => h('div', { class: 'g-row sm', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('span', { class: 'muted', text: k }), h('b', { class: 'num', text: v }))))) : null;
    const inv = G.J(sg.inv_opts || '{}');
    return G.drawer({ title: 'Investigate', sub: sg.what, body: h('div', { class: 'g-gap16' },
      h('div', null, h('div', { class: 'g-sig-k', text: 'Supporting metrics' }), h('div', { class: 'g-two g-mt8' }, card(ev.a), card(ev.b))),
      h('div', null, h('div', { class: 'g-sig-k', text: 'What caused it' }), h('ul', { class: 'g-ul g-mt8' }, cause.map((c) => h('li', { text: c })))),
      ev.pattern ? h('div', null, h('div', { class: 'g-sig-k', text: 'Observed pattern' }), h('p', { class: 'sm', text: ev.pattern })) : null,
      h('div', null, h('div', { class: 'g-sig-k', text: 'Investigation path' }), h('div', { class: 'g-row g-mt8' }, G.btn('1 · Open ' + (pg[sg.inv] || sg.inv), () => G.go(sg.inv, inv), 'sm'), sg.go !== sg.inv ? G.btn('2 · Open ' + (pg[sg.go] || sg.go), () => G.go(sg.go, G.J(sg.go_opts || '{}')), 'sm') : null, G.btn('Confirm cause in Attribution', () => G.go('attribution'), 'sm')))) });
  };
  G.signalFor = (order, R) => (G.rows('signals') || []).find((s) => s.range === (R || S.range) && s.order === order);

  /* Global growth status from open Radar signals. */
  G.growthStatus = () => {
    const sg = (G.rows('signals') || []).filter((s) => s.range === S.range && !S.done[s.id] && !S.dismissed[s.id]);
    const risks = sg.filter((s) => s.cat === 'risk').length, leaks = sg.filter((s) => s.cat === 'leaking').length;
    if (!(G.rows('signals') || []).length) return { label: G.WS.mode() === 'empty' ? 'Connect data' : 'No signals yet', tone: '', n: 0 };
    return risks ? { label: 'Needs attention', tone: 'amber', n: risks + leaks } : { label: 'Healthy', tone: 'green', n: leaks };
  };
  G.afterAction = () => { G.updateChrome && G.updateChrome(); };

  /* Drill from a Growth Health dimension straight to what is causing it. */
  G.dimDrill = (dim) => {
    const R = S.range, chs = G.byRange('channels'), cps = G.byRange('campaigns').filter((c) => c.status !== 'Draft'), crs = G.byRange('creators');
    const low = (arr, k, n, asc) => arr.slice().sort((a, b) => (asc ? a[k] - b[k] : b[k] - a[k])).slice(0, n);
    const sets = {
      Activation: [['Channels', low(chs.filter((c) => c.spend > 0), 'activation', 3, true).map((c) => [c.channel, F.pct(c.activation) + ' activation', 'channels', {}])], ['Campaigns', low(cps, 'activation', 2, true).map((c) => [c.name, F.pct(c.activation) + ' activation', 'campaigns', { open: c.cid }])], ['Creators', low(crs, 'activation', 2, true).map((c) => [c.handle, F.pct(c.activation) + ' activation', 'creators', { open: c.key }])], ['Content', (G.rows('content_compare') || []).filter((c) => c.activation_rate).sort((a, b) => a.activation_rate - b.activation_rate).slice(0, 2).map((c) => [c.format, F.pct(c.activation_rate) + ' activation', 'content', {}])]],
      Acquisition: [['Channels', low(chs, 'd_signups', 3, true).map((c) => [c.channel, F.d(c.d_signups) + ' signups', 'channels', {}])], ['Campaigns', low(cps, 'd_signups', 2, true).map((c) => [c.name, F.d(c.d_signups) + ' signups', 'campaigns', { open: c.cid }])]],
      Conversion: [['Channels', low(chs.filter((c) => c.visitors), 'visitor_to_customer', 3, true).map((c) => [c.channel, F.pct(c.visitor_to_customer, 2) + ' visitor → customer', 'channels', {}])], ['Campaigns', low(cps, 'ctr', 2, true).map((c) => [c.name, F.pct(c.ctr, 2) + ' CTR', 'campaigns', { open: c.cid }])]],
      Revenue: [['Channels', low(chs.filter((c) => c.spend > 0), 'roas', 3, true).map((c) => [c.channel, F.x(c.roas) + ' ROAS', 'channels', {}])], ['Campaigns', low(cps, 'roas', 2, true).map((c) => [c.name, F.x(c.roas) + ' ROAS', 'campaigns', { open: c.cid }])]],
      Retention: [['Pipeline', [['Stalled deals', 'Deals idle more than 7 days', 'pipeline', { stalled: true }]]], ['Leads', [['High-intent leads waiting', 'No contact in 3+ days', 'leads', { filter: 'followup' }]]]],
    };
    const groups = sets[dim] || (dim === 'Efficiency' ? sets.Revenue : sets.Activation);
    return G.drawer({ title: 'What is driving ' + dim + '?', sub: 'The weakest contributors in ' + G.RL[R].toLowerCase() + ', with a path to each.', body: h('div', { class: 'g-gap16' }, groups.map(([t, items]) => h('div', null, h('div', { class: 'g-sig-k', text: t }), h('div', { class: 'g-gap8 g-mt8' }, items.map(([n, v, pg, op]) => h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('div', { style: 'min-width:0' }, h('div', { text: n }), h('div', { class: 'xs muted', text: v })), G.btn('Open', () => G.go(pg, op), 'sm'))))))) });
  };

  /* Map a KPI's driver sentence to the place its data lives. */
  G.driverTarget = (k) => {
    const t = (k.insight || '') + ' ' + (k.metric || '');
    if (/lead/i.test(k.metric)) return ['leads', {}];
    if (/Creator/.test(t)) return ['creators', {}];
    if (/Referral|Google|Meta|Instagram|LinkedIn|Reddit/.test(t)) return ['channels', {}];
    if (/campaign/i.test(t)) return ['campaigns', {}];
    return ['channels', {}];
  };

  /* ---------- Today's growth priorities ---------- */
  G.priorityCards = (R, refresh) => {
    const pri = (G.rows('priorities') || []).filter((p) => p.range === R).sort((a, b) => a.rank - b.rank);
    const ch = {}; G.byRange('channels').forEach((c) => (ch[c.channel] = c));
    const cz = G.byRange('creatives'), c14 = cz.find((c) => c.num === 14), c18 = cz.find((c) => c.num === 18);
    const waiting = (G.rows('leads') || []).map((l) => Object.assign({}, l, (S.local.lead || {})[l.id] || {})).filter((l) => l.waiting);
    const done = (p) => !!S.done[p.id];
    const mk = (p) => {
      let o;
      if (p.type === 'shift' || p.type === 'referral') {
        const pm = G.J(p.params), r = G.sim([{ frm: pm.frm, to: pm.to, amount: pm.amount }]), A = ch[pm.frm], B = ch[pm.to];
        const dl = r.next.leads - r.base.leads;
        o = { title: `Shift budget from ${pm.frm} → ${pm.to}`, bullets: [`${pm.frm} ROAS: ${F.x(A.roas)}`, `${pm.to} ROAS: ${F.x(B.roas)}`, `Recommended shift: ${F.inrF(pm.amount)}/month`, `Expected impact: +${Math.round(dl)} qualified leads/month`],
          btns: [['Simulate', () => G.simModal({ frm: pm.frm, moves: [{ to: pm.to, amount: pm.amount }], title: `Simulate: ${pm.frm} → ${pm.to}` })], ['Apply recommendation', () => G.confirm({ title: `Shift ${F.inrF(pm.amount)} from ${pm.frm} to ${pm.to}?`, text: `Expected: +${Math.round(r.next.customers - r.base.customers)} customers and +${F.inr(r.next.revenue - r.base.revenue)} revenue per month.`, detail: 'The change is queued for approval in Campaigns. You can undo it.', confirm: 'Apply', onConfirm: () => { S.done[p.id] = true; G.logDecision({ title: 'Shifted ' + F.inrF(pm.amount) + ' from ' + pm.frm + ' to ' + pm.to, reason: 'Today’s growth plan', expected: '+' + Math.round(r.next.customers - r.base.customers) + ' customers a month', metric: 'customers', amount: pm.amount, kind: 'budget' }); refresh(); } }), 'pri'], ['View evidence', () => { const s = G.signalFor(p.type === 'shift' ? 0 : 4, R); s && G.evidenceDrawer(G.J(s.ev)); }]] };
      } else if (p.type === 'creative') {
        o = { title: 'Pause Creative #14', bullets: [`CTR ${F.d(c14.d_ctr).replace('+', '↑').replace('−', '↓')}`, `Creative #18: ${F.pct(c18.ctr, 1)} CTR`, `Creative #14: ${F.pct(c14.ctr, 1)} CTR`, `Similar spend (${F.inr(c14.spend)} vs ${F.inr(c18.spend)})`],
          btns: [['Apply', () => G.confirm({ title: 'Pause creative #14?', text: 'Pause “' + c14.name + '” and move its daily budget to creative #18.', detail: 'You can resume it any time.', confirm: 'Pause and shift', onConfirm: () => { S.done[p.id] = true; G.logDecision({ title: 'Paused Creative #14 and moved its budget to #18', reason: 'CTR on creative #14 is falling', expected: 'Prevent projected signup loss', kind: 'creative' }); refresh(); } }), 'pri'], ['Investigate', () => G.go('channels')], ['View evidence', () => { const s = G.signalFor(6, R); s && G.evidenceDrawer(G.J(s.ev)); }]] };
      } else if (p.type === 'leads') {
        o = { title: `Follow up with ${waiting.length} high-intent leads`, bullets: ['Visited pricing', 'No contact in 3+ days', waiting[0] ? `Top lead: ${waiting[0].name}, ${waiting[0].company} (${waiting[0].score}/100)` : 'All caught up'], btns: [['Open leads', () => G.go('leads', { filter: 'followup' }), 'pri']] };
      } else {
        const a = G.signalFor(2, R);
        o = { title: 'Fix activation on paid-social cohorts', bullets: [a ? a.what : 'Activation is the weakest stage', 'Meta and X cohorts activate below 50%', 'Each +1 point ≈ +84 activated users/month'], btns: [['Create experiment', () => G.expModal({ name: 'Shorter first-dictation onboarding', scope: 'growth', hyp: 'A shorter first-dictation flow will lift signup → activation on Meta and X cohorts.', metric: 'Signup → activation rate' }), 'pri'], ['Investigate', () => G.dimDrill('Activation')], ['View evidence', () => { const s = G.signalFor(2, R); s && G.evidenceDrawer(G.J(s.ev)); }]] };
      }
      return o;
    };
    return pri.map((p) => {
      const o = mk(p), d = done(p);
      return h('div', { class: 'g-pri' + (d ? ' done' : '') },
        h('div', { class: 'g-pri-n', text: String(p.rank).padStart(2, '0') }),
        h('div', { class: 'g-pri-b' }, h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('div', { class: 'g-pri-t', text: o.title }), h('div', { class: 'g-row', style: 'gap:6px' }, d ? G.badge('Applied', 'green') : null, G.badge(p.confidence + '% confidence', p.confidence >= 85 ? 'green' : ''))),
          h('ul', { class: 'g-pri-l' }, o.bullets.map((b) => h('li', { text: b }))),
          h('div', { class: 'g-row g-mt8' }, d ? [G.btn('Undo', () => { S.done[p.id] = false; refresh(); }, 'sm')] : o.btns.map(([l, fn, c]) => G.btn(l, fn, 'sm ' + (c || ''))))));
    });
  };
})();
