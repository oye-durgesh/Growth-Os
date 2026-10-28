(function () {
  'use strict';
  /* Home intelligence (Today in Growth, What changed, Today's plan), the growth
     objective, the Ask command panel and Company setup. All computed from the
     active workspace through G.rows(). */
  const G = window.G, h = G.h, S = G.S, F = G.F;
  const r0 = Math.round;
  const kpiMap = (R) => { const k = {}; (G.rows('kpis') || []).filter((x) => x.range === (R || '30d')).forEach((x) => (k[x.metric] = x)); return k; };

  /* ---------- signal helpers ---------- */
  G.sigTitle = (s) => { const m = /CTR on (.+?) creative #(\d+)/i.exec(s.what || ''); if (m) return 'Fix ' + m[1] + ' Creative #' + m[2]; return String(s.action || s.what || '').replace(/\.$/, ''); };
  const OWN = { campaigns: 'Marketing', channels: 'Marketing', forecast: 'Marketing', attribution: 'Marketing', creators: 'Partnerships', leads: 'Sales', pipeline: 'Sales', experiments: 'Growth', content: 'Content' };
  G.sigOwner = (s) => s.owner || OWN[s.go] || 'Growth';
  G.sigLevel = (s) => s.level || (s.cat === 'risk' || (s.conf || 0) >= 80 ? 'High' : (s.conf || 0) >= 65 ? 'Medium' : 'Low');
  G.sigCta = (s) => s.cta || (s.go === 'leads' ? 'Follow up' : s.go === 'experiments' ? 'Create experiment' : s.cat === 'risk' ? 'Fix now' : s.cat === 'opportunity' ? 'View opportunity' : 'Open campaign');
  G.sigRun = (s) => G.go(s.go, G.J(s.go_opts || '{}'));
  const label = (s) => { const t = s.top || (/^(.+?) (?:returns|is outperforming|acquires|has|converts)/.exec(s.what || '') || [])[1] || ''; return t || 'a new channel'; };

  /* ================= GROWTH OBJECTIVE ================= */
  const OBJ_DEF = { revenue: ['Monthly revenue target', 'inr'], signups: ['Monthly qualified signups', 'num'], activated: ['Activated users', 'num'], cac: ['Blended CAC target', 'inr'], pipeline: ['Pipeline value', 'inr'], activation: ['Signup → activation', 'pct'], market: ['New market objective', 'num'] };
  G.objectiveInfo = () => {
    const w = G.WS.active(), k = kpiMap('30d'), c = w.company || {};
    const o = w.objective || { type: 'revenue', target: c.revenueTarget || (k.revenue ? r0(k.revenue.value * 1.2 / 1e5) * 1e5 : 0), deadline: (G.END || '2026-10-27').slice(0, 8) + '31' };
    const cur = { revenue: k.revenue && k.revenue.value, signups: k.signups && k.signups.value, activated: k.activated && k.activated.value, cac: k.cac && k.cac.value, pipeline: ((G.rows('pipeline_kpis') || []).find((x) => x.metric === 'pipeline') || {}).value, activation: k.signups && k.signups.value ? k.activated.value / k.signups.value * 100 : 0, market: o.current || 0 }[o.type] || 0;
    const low = o.type === 'cac', prog = !o.target ? 0 : low ? (cur ? Math.min(100, o.target / cur * 100) : 0) : Math.min(100, cur / o.target * 100);
    const unit = OBJ_DEF[o.type][1], fm = unit === 'inr' ? (o.type === 'cac' ? F.inrF : F.inr) : unit === 'pct' ? (v) => F.pct(v) : F.n;
    return { type: o.type, name: OBJ_DEF[o.type][0], target: o.target, current: cur, deadline: o.deadline, pct: r0(prog), fm, low, unit };
  };
  G.objectiveModal = () => {
    const o = G.objectiveInfo(), form = G.form([{ k: 'type', label: 'Objective', type: 'select', opts: G.OBJ.map(([v, l]) => ({ v, l })), val: o.type }, { k: 'target', label: 'Target', val: o.target || '', ph: 'e.g. 7500000 or 75L' }, { k: 'current', label: 'Current (only used for “Enter a new market”)', val: '', ph: 'Calculated from your data' }, { k: 'deadline', label: 'Deadline', type: 'date', val: o.deadline }]);
    G.modal({ title: 'Growth objective', sub: 'Growth OS reads the dashboard around this objective.', body: form.el, actions: (close) => [G.btn('Cancel', close), G.btn('Save objective', () => { const v = form.get(), t = G.imp.num(v.target); if (!t || Number.isNaN(t)) return G.toast('Enter a numeric target', { tone: 'bad' }); const cu = G.imp.num(v.current); G.WS.active().objective = { type: v.type, target: t, deadline: v.deadline || o.deadline, current: cu && !Number.isNaN(cu) ? cu : undefined }; G.WS.save(); close(); G.toast('Objective updated'); G.rerender(); }, 'pri')] });
  };
  const fdate = (iso) => { try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch (e) { return iso; } };

  /* ================= HOME INTELLIGENCE ================= */
  function todayCards(R, k) {
    const ser = (G.rows('series') || []).slice(-30), last = ser[ser.length - 1] || {}, avg = ser.length ? ser.reduce((s, r) => s + r.signups, 0) / ser.length : 0;
    const target = r0(avg * 1.15 / 10) * 10 || 0, cur = last.signups || 0, pct = target ? r0(Math.min(100, cur / target * 100)) : 0;
    const gs = G.growthStatus(), sg = (G.rows('signals') || []).filter((s) => s.range === R).sort((a, b) => a.order - b.order).filter((s) => !S.done[s.id] && !S.dismissed[s.id]);
    const pri = sg.find((s) => s.cat === 'risk') || sg[0], opp = sg.find((s) => s.cat === 'opportunity' || s.cat === 'winning');
    const mv = ['signups', 'revenue', 'customers', 'cac'].map((m) => k[m]).filter(Boolean).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    const good = mv ? (mv.metric === 'cac' ? mv.delta <= 0 : mv.delta >= 0) : true;
    const card = (eyebrow, big, mid, foot, cls) => h('div', { class: 'g-card g-tc ' + (cls || '') }, h('div', { class: 'g-eyebrow', text: eyebrow }), big, mid, foot);
    const oppLabel = opp ? (opp.go === 'creators' ? 'View creators' : opp.go === 'channels' ? 'View channels' : 'View opportunity') : '';
    return [
      card('TODAY’S OBJECTIVE', h('div', { class: 'g-tc-t', text: target ? 'Generate ' + F.n(target) + ' qualified signups' : 'Set a signup target' }), h('div', null, h('div', { class: 'g-row', style: 'align-items:baseline;gap:8px;margin:6px 0' }, h('b', { class: 'num', style: 'font-size:22px', text: F.n(cur) + ' / ' + F.n(target) }), h('span', { class: 'muted', text: '· ' + pct + '%' })), G.pbar(pct, pct >= 70 ? '' : 'amber')), h('div', { class: 'xs muted g-mt8', text: 'Latest synced day vs a daily target set 15% above your 30-day average.' })),
      card('TODAY’S GROWTH STATUS', h('div', { class: 'g-row', style: 'gap:8px;margin-top:2px' }, h('span', { class: 'g-dot ' + (gs.tone === 'amber' ? 'amber' : '') }), h('div', { class: 'g-tc-t', text: gs.tone === 'amber' ? 'Needs attention' : 'On track' })), mv ? h('div', { class: 'sm', style: 'margin-top:8px' }, h('b', { text: mv.label + ' ' + (mv.delta >= 0 ? '↑' : '↓') + ' ' + Math.abs(mv.delta).toFixed(1) + '%' }), h('span', { class: 'muted', text: ' vs previous period' })) : null, h('div', { class: 'xs muted g-mt8', text: (gs.n || 0) + ' open Radar signal' + (gs.n === 1 ? '' : 's') + ' · ' + (good ? 'headline metric is moving the right way' : 'headline metric needs a look') })),
      card('TODAY’S PRIORITY', h('div', { class: 'g-tc-t', text: pri ? G.sigTitle(pri) : 'Nothing urgent' }), h('div', { class: 'sm muted', style: 'margin:6px 0', text: pri ? pri.what : 'No at-risk signals right now.' }), pri ? G.btn('Open GTM Radar', () => G.go('radar'), 'sm pri') : null, 'pri'),
      card('TODAY’S OPPORTUNITY', h('div', { class: 'g-tc-t', text: opp ? opp.what : 'No clear opportunity yet' }), h('div', { class: 'sm muted', style: 'margin:6px 0', text: opp ? opp.expected || opp.impact : 'Radar will flag one as soon as it finds it.' }), opp ? G.btn(oppLabel, () => G.sigRun(opp), 'sm') : null, 'opp'),
    ];
  }
  function objectiveRow() {
    const o = G.objectiveInfo();
    return h('div', { class: 'g-card g-obj' }, h('div', { style: 'min-width:0' }, h('div', { class: 'g-eyebrow', text: 'GROWTH OBJECTIVE' }), h('div', { class: 'g-row', style: 'align-items:baseline;gap:10px' }, h('b', { style: 'font-size:17px', text: o.name }), h('span', { class: 'muted sm', text: 'due ' + fdate(o.deadline) }))),
      h('div', { class: 'g-obj-n' }, [['Target', o.fm(o.target)], ['Current', o.fm(o.current)], ['Progress', o.pct + '%']].map(([a, v]) => h('div', null, h('small', { text: a }), h('b', { class: 'num', text: v })))), h('div', { style: 'flex:1 1 140px;min-width:120px' }, G.pbar(o.pct, o.pct >= 70 ? '' : 'amber')), G.btn('Edit', G.objectiveModal, 'sm'));
  }
  function callouts(R) {
    const sg = (G.rows('signals') || []).filter((s) => s.range === R).sort((a, b) => a.order - b.order), out = [];
    const waiting = (G.rows('leads') || []).filter((l) => l.waiting).length;
    const opp = sg.find((s) => s.cat === 'opportunity'), risk = sg.find((s) => s.cat === 'risk');
    if (opp) out.push(['opp', 'Opportunity detected: ' + label(opp), opp.what, 'View opportunity', () => G.sigRun(opp)]);
    if (waiting) out.push(['sales', 'Sales action required', waiting + ' high-intent leads waiting for follow-up', 'Follow up', () => G.go('leads', { filter: 'followup' })]);
    if (risk) out.push(['risk', 'At risk: ' + G.sigTitle(risk), risk.what, 'Open in Radar', () => G.go('radar')]);
    return h('div', { class: 'g-callouts' }, out.map(([c, t, s, cta, fn]) => h('div', { class: 'g-callout ' + c }, h('div', { style: 'min-width:0' }, h('b', { text: t }), h('div', { class: 'xs muted', text: s })), G.btn(cta, fn, 'sm'))));
  }
  function changedItems(R, k) {
    const cand = [];
    const creatives = (G.rows('creatives') || []).filter((c) => c.range === R && c.d_ctr != null), worst = creatives.slice().sort((a, b) => a.d_ctr - b.d_ctr)[0];
    const drv = (G.rows('drivers') || []).filter((d) => d.range === R).sort((a, b) => a.rank - b.rank)[0];
    const add = (id, name, delta, good, valTxt, scope, w, why, todo, goto) => { if (delta == null || !isFinite(delta) || Math.abs(delta) < 1) return; cand.push({ id, name, delta, good, valTxt, scope, score: Math.abs(delta) * (w || 1), why, todo, goto }); };
    if (k.ctr) { const d = worst && worst.d_ctr < k.ctr.delta ? worst.d_ctr : k.ctr.delta; add('ctr', 'CTR', d, d >= 0, null, worst && worst.d_ctr <= -8 ? worst.channel + ' · ' + worst.ref : 'All paid channels', 1.25, d < 0 ? 'Fewer clicks per impression pushes CAC up at the same spend.' : 'More clicks per impression lowers acquisition cost.', d < 0 ? 'Review the creatives with the steepest drop.' : 'Find the winning creative and reuse its hook.', ['channels', {}]); }
    if (k.signups) add('signups', 'Signups', k.signups.delta, k.signups.delta >= 0, null, drv ? 'Led by ' + drv.channel : 'All channels', 1, k.signups.delta >= 0 ? 'Top-of-funnel growth is flowing in — check that it converts.' : 'Fewer signups shrink every downstream stage.', k.signups.delta >= 0 ? 'Confirm which channel drives it before scaling.' : 'Check the channel and campaign breakdown.', ['channels', {}]);
    const ck = (G.rows('creator_kpis') || []).find((x) => x.metric === 'cac' && x.range === R);
    if (ck) add('ccac', 'Creator CAC', ck.delta, ck.delta <= 0, null, 'Creator campaigns', 1, ck.delta <= 0 ? 'Creators are getting cheaper per customer than paid.' : 'Creator efficiency is slipping.', ck.delta <= 0 ? 'Shift budget toward the top creators.' : 'Review payouts for low converters.', ['creators', {}]);
    const pk = (G.rows('pipeline_kpis') || []).find((x) => x.metric === 'pipeline');
    if (pk && pk.value) { const prev = pk.value / (1 + (pk.delta || 0) / 100), abs = pk.value - prev; add('pipe', 'Pipeline', pk.delta, pk.delta >= 0, F.inr(Math.abs(abs)), 'Sales', 1.05, pk.delta >= 0 ? 'More qualified opportunity supports next month’s revenue.' : 'Pipeline coverage is shrinking.', pk.delta >= 0 ? 'Make sure the top deals have owners and next steps.' : 'Add or re-engage opportunities.', ['pipeline', {}]); }
    if (k.revenue) add('rev', 'Revenue', k.revenue.delta, k.revenue.delta >= 0, null, 'All channels', 1.1, k.revenue.delta >= 0 ? 'Revenue is compounding; protect the channels producing it.' : 'Revenue is slipping against the previous period.', 'Open the Forecast and model a fix.', ['forecast', {}]);
    if (k.cac) add('cac', 'CAC', k.cac.delta, k.cac.delta <= 0, null, 'Blended', 1, k.cac.delta <= 0 ? 'Cheaper customers stretch every rupee further.' : 'Each customer now costs more to acquire.', k.cac.delta <= 0 ? 'Keep the mix that produced it.' : 'Find the channel with the steepest rise.', ['channels', {}]);
    return cand.sort((a, b) => b.score - a.score).slice(0, 4);
  }
  function changedCards(R, k) {
    const items = changedItems(R, k);
    if (!items.length) return [G.empty('◌', 'Nothing has moved much', 'Metrics are within 1% of the previous period.')];
    return items.map((c) => h('div', { class: 'g-card g-chg ' + (c.good ? 'up' : 'down') },
      h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('div', null, h('div', { class: 'g-chg-t' }, h('span', { text: c.name + ' ' }), h('b', { text: (c.delta >= 0 ? '↑ ' : '↓ ') + (c.valTxt || Math.abs(Math.round(c.delta)) + '%') })), h('div', { class: 'xs muted', text: c.scope })), G.badge(c.good ? 'Good' : 'Watch', c.good ? 'green' : 'amber')),
      h('div', { class: 'g-chg-r' }, h('div', null, h('small', { text: 'Why it matters' }), h('div', { class: 'sm', text: c.why })), h('div', null, h('small', { text: 'What to do' }), h('div', { class: 'sm', text: c.todo }))),
      h('div', { class: 'g-row g-mt8' }, G.btn('Open in Radar', () => G.go('radar'), 'sm'), h('button', { class: 'g-link', type: 'button', onclick: () => G.go(c.goto[0], c.goto[1]), text: 'See the data' }))));
  }
  function planRows(R, refresh) {
    const plan = G.engine.plan(R);
    if (!plan.length) return [G.empty('✓', 'Nothing to action', 'Radar has no open recommendations right now.')];
    return plan.map((s, i) => {
      const done = !!S.done[s.id];
      return h('div', { class: 'g-plan' + (done ? ' done' : '') },
        h('div', { class: 'g-pri-n', text: String(i + 1).padStart(2, '0') }),
        h('div', { style: 'min-width:0;flex:1' },
          h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:wrap' }, h('div', { class: 'g-pri-t', text: G.sigTitle(s) }), h('div', { class: 'g-row', style: 'gap:6px' }, G.badge('Impact: ' + G.sigLevel(s), G.sigLevel(s) === 'High' ? 'green' : ''), G.badge('Owner: ' + G.sigOwner(s)), done ? G.badge('Done', 'green') : null)),
          h('div', { class: 'sm g-mt8' }, h('b', { text: 'Why: ' }), s.what), s.expected ? h('div', { class: 'sm' }, h('b', { text: 'Expected impact: ' }), s.expected) : null,
          h('div', { class: 'g-row g-mt8' }, done ? G.btn('Undo', () => { S.done[s.id] = false; refresh(); }, 'sm') : [G.btn(G.sigCta(s), () => (s.cat === 'risk' && s.apply && s.go === 'channels' ? G.signalAct(s, refresh) : G.sigRun(s)), 'sm pri'), s.sim ? G.btn('Simulate', () => G.signalSim(s), 'sm') : null, G.btn('Why?', () => G.evidenceDrawer(G.J(s.ev)), 'sm ghost')])));
    });
  }
  G.homeIntel = (R, parts, refresh) => {
    const k = kpiMap(R);
    parts.today.replaceChildren(h('div', { class: 'g-today' }, ...todayCards(R, k)), objectiveRow(), callouts(R));
    parts.changed.replaceChildren(...changedCards(R, k));
    parts.plan.replaceChildren(...planRows(R, refresh));
  };
  G.changedItems = changedItems;
  G.makeReport = (type, period, id) => {
    const R = /30/.test(period) ? '30d' : '7d', k = kpiMap(R), sg = (G.rows('signals') || []).filter((s) => s.range === R).sort((a, b) => a.order - b.order);
    const ln = (m, nm, fm) => k[m] ? nm + ' ' + (fm || F.n)(k[m].value) + ' (' + F.d(k[m].delta) + ' vs previous period)' : null;
    const w = G.WS.active(), ch = changedItems(R, k);
    const pick = (cats) => sg.filter((s) => cats.includes(s.cat));
    return { id: id || 'gen' + Date.now(), type, period, minutes_ago: 0, schedule: 'Not scheduled', recipients: '#growth',
      summary: (k.revenue ? w.name + ' generated ' + F.inr(k.revenue.value) + ' revenue (' + F.d(k.revenue.delta) + ') from ' + F.n(k.customers.value) + ' customers at ' + F.inrF(k.cac.value) + ' blended CAC. ' : '') + (sg[0] ? 'The top Radar signal: ' + sg[0].what : 'Radar has no open signals.'),
      performance: [ln('revenue', 'Revenue', F.inr), ln('signups', 'Signups'), ln('customers', 'Customers'), ln('cac', 'Blended CAC', F.inrF), ln('roas', 'ROAS', F.x)].filter(Boolean),
      changes: ch.map((c) => c.name + ' ' + (c.delta >= 0 ? 'up' : 'down') + ' ' + Math.abs(Math.round(c.delta)) + '% (' + c.scope + ')'),
      wins: pick(['winning']).slice(0, 3).map((s) => s.what), problems: pick(['risk', 'leaking']).slice(0, 4).map((s) => s.what),
      opportunities: pick(['opportunity']).slice(0, 3).map((s) => s.what + (s.expected ? ' — ' + s.expected : '')), actions: sg.slice(0, 4).map((s) => G.sigTitle(s)) };
  };
  G.flowRibbon = () => h('div', { class: 'g-flow' }, G.chain(['DATA', 'INSIGHT', 'GTM DECISION', 'ACTION', 'RESULT'], true));

  /* ================= ASK COMMAND PANEL ================= */
  const QS = [['TODAY', ['What changed today?', 'What should I focus on today?', 'What is today’s growth objective?', 'Which campaign needs attention?', 'Are today’s metrics on track?']], ['CAMPAIGNS', ['Which campaign is performing best?', 'Which campaign is wasting spend?', 'Why did CTR change?', 'Which campaign should I scale?', 'Which campaign should I pause?']], ['GTM', ['What is our strongest GTM channel?', 'Where are we losing users?', 'Which audience should we target next?', 'What GTM opportunity are we missing?', 'What should we test this week?']], ['SALES', ['Which leads need follow-up?', 'What pipeline is at risk?', 'Which opportunities are most likely to close?', 'What is blocking revenue growth?']], ['CREATORS', ['Which creator is driving real revenue?', 'Which creator should get more budget?', 'Which creator has high views but low conversion?']], ['REVENUE', ['What is driving revenue growth?', 'What is our current CAC?', 'What is our ROAS?', 'Are we on track for the revenue target?']]];
  G.QS = QS;
  G.askAnswer = (q) => { const a = G.askMatch(q); return a; };
  G.askPanel = (initial) => {
    let it; const inp = h('input', { type: 'text', placeholder: 'Ask Growth OS anything…', 'aria-label': 'Ask Growth OS', autocomplete: 'off' }), res = h('div', { class: 'res g-ask-res' });
    const node = h('div', { class: 'g-modal g-pal g-askp', role: 'dialog', 'aria-label': 'Ask Growth OS' }, inp, res, h('div', { class: 'g-dr-f xs muted' }, 'Answers are computed from the active workspace · Esc to close'));
    const empty = () => G.WS.mode() === 'empty';
    const index = () => {
      const out = [];
      G.NAV.filter((n) => n.id).concat([{ id: 'ask', l: 'Ask Growth OS' }, { id: 'settings', l: 'Settings' }]).forEach((n) => out.push({ t: 'Page', l: n.l, s: 'Go to page', run: () => G.go(n.id) }));
      (G.rows('campaigns') || []).filter((r) => r.range === '30d').forEach((r) => out.push({ t: 'Campaign', l: r.name, s: r.channel, run: () => G.go('campaigns', { open: r.cid }) }));
      (G.rows('creators') || []).filter((r) => r.range === '30d').forEach((r) => out.push({ t: 'Creator', l: r.handle, s: r.platform, run: () => G.go('creators', { open: r.key }) }));
      (G.rows('leads') || []).forEach((r) => out.push({ t: 'Lead', l: r.name, s: r.company, run: () => G.go('leads', { open: r.id }) }));
      const seen = {}; (G.rows('deals') || []).forEach((r) => { if (!seen[r.company]) { seen[r.company] = 1; out.push({ t: 'Company', l: r.company, s: r.stage + ' · ' + F.inr(r.value), run: () => G.go('pipeline', { open: r.id }) }); } });
      return out;
    };
    function answer(q) {
      inp.value = q; res.replaceChildren();
      const back = h('button', { class: 'g-link', type: 'button', onclick: () => { inp.value = ''; draw(); inp.focus(); }, text: '← All questions' });
      if (empty()) { res.append(h('div', { class: 'g-ans-card' }, back, h('div', { class: 'g-ans-h', text: 'Connect data first' }), h('p', { class: 'sm muted', text: 'Growth OS answers from your own numbers. Connect a source, upload a CSV, or load demo data.' }), h('div', { class: 'g-row' }, G.btn('Connect data', () => { it.close(); G.addDataModal('connect'); }, 'pri'), G.btn('Use demo data', () => { it.close(); G.demoChooser(); })))); return; }
      const a = G.askMatch(q);
      if (!a) { res.append(h('div', { class: 'g-ans-card' }, back, h('div', { class: 'g-ans-h', text: 'I can’t answer that from your data yet.' }), h('p', { class: 'sm muted', text: 'Try one of the suggested questions — each is computed from the active workspace.' }))); return; }
      res.append(G.ansCard(a, back, () => it.close(), q));
    }
    function draw() {
      const q = inp.value.trim(); res.replaceChildren();
      if (!q) {
        QS.forEach(([g, list]) => res.append(h('div', { class: 'g-qg' }, h('div', { class: 'hd', text: g }), list.map((t) => h('button', { class: 'it', type: 'button', onclick: () => answer(t) }, h('span', { text: '◖' }), h('div', { text: t }))))));
        return;
      }
      const ql = q.toLowerCase(), qs = []; QS.forEach(([g, list]) => list.forEach((t) => { if (t.toLowerCase().includes(ql)) qs.push([g, t]); }));
      const cmd = G.parseCmd && G.parseCmd(q);
      if (cmd) res.append(h('div', { class: 'hd', text: 'Command' }), h('button', { class: 'it', type: 'button', onclick: () => { it.close(); cmd.run(); } }, h('span', { text: '⌘' }), h('div', { text: cmd.label })));
      if (qs.length) res.append(h('div', { class: 'hd', text: 'Questions' }), qs.slice(0, 6).map(([g, t]) => h('button', { class: 'it', type: 'button', onclick: () => answer(t) }, h('span', { text: '◖' }), h('div', { text: t }), h('span', { class: 'ty', text: g }))));
      const hits = index().filter((x) => (x.l + ' ' + (x.s || '')).toLowerCase().includes(ql)).slice(0, 6);
      if (hits.length) res.append(h('div', { class: 'hd', text: 'Results' }), hits.map((a) => h('button', { class: 'it', type: 'button', onclick: () => { it.close(); a.run(); } }, h('span', { text: '›' }), h('div', null, h('div', { text: a.l }), a.s && h('div', { class: 'xs muted', text: a.s })), h('span', { class: 'ty', text: a.t }))));
      res.append(h('div', { class: 'hd', text: 'Ask' }), h('button', { class: 'it', type: 'button', onclick: () => answer(q) }, h('span', { text: '◖' }), h('div', { text: 'Ask Growth OS: “' + q + '”' })));
    }
    inp.addEventListener('input', draw);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const q = inp.value.trim(); if (q) answer(q); } });
    G.closeAll(); it = G.modal({ title: 'Ask Growth OS', body: h('div') });
    it.wrap.replaceChildren(h('div', { class: 'g-backdrop', onclick: () => it.close() }), node);
    setTimeout(() => { inp.focus(); if (initial) answer(initial); else draw(); }, 20);
    return it;
  };

  /* ================= COMPANY SETUP (Settings) ================= */
  G.companyPanel = () => {
    const w = G.WS.active(), c = w.company || {};
    const form = G.form([
      { k: 'name', label: 'Company name', val: c.name || w.name }, { k: 'product', label: 'Product name', val: c.product || '' }, { k: 'website', label: 'Website', val: c.website || '' },
      { k: 'industry', label: 'Industry', val: c.industry || '' }, { k: 'market', label: 'Target market', val: c.market || '' }, { k: 'audience', label: 'Primary audience', val: c.audience || '' }, { k: 'channels', label: 'Main acquisition channels', val: c.channels || '', hint: 'Comma separated' },
      { k: 'growthTarget', label: 'Monthly growth target (%)', type: 'number', val: c.growthTarget || '' }, { k: 'revenueTarget', label: 'Revenue target (₹ / month)', type: 'number', val: c.revenueTarget || '' }, { k: 'signupTarget', label: 'Signup target (per month)', type: 'number', val: c.signupTarget || '' }, { k: 'activationTarget', label: 'Activation target (%)', type: 'number', val: c.activationTarget || '' }, { k: 'cacTarget', label: 'CAC target (₹)', type: 'number', val: c.cacTarget || '' }]);
    form.el.classList.add('g-formgrid');
    const num = ['growthTarget', 'revenueTarget', 'signupTarget', 'activationTarget', 'cacTarget'];
    return h('div', { class: 'g-gap16' },
      h('div', { class: 'g-card' }, h('div', { class: 'g-card-h' }, h('div', null, h('h3', { text: 'Company' }), h('div', { class: 'g-sub', text: 'Used for targets, goals and how Radar frames its recommendations.' })), h('div', { class: 'r' }, G.badge(w.name + ' · ' + ({ demo: 'Demo data', live: 'Your data', empty: 'No data' })[G.WS.mode()], G.WS.mode() === 'live' ? 'green' : ''))), form.el,
        h('div', { class: 'g-row g-mt16', style: 'justify-content:space-between' }, h('div', { class: 'g-row' }, G.btn('Import company data', () => G.addDataModal()), G.btn('Use demo data', () => G.demoChooser())), G.btn('Save company', () => { const v = form.get(); Object.keys(v).forEach((k) => { c[k] = num.includes(k) ? (v[k] === '' ? 0 : +v[k]) : v[k]; }); w.company = c; if (v.name.trim()) w.name = v.name.trim(); G.WS.save(); G.wsBump(); G.toast('Company saved'); G.updateChrome(); G.rerender(); }, 'pri'))),
      h('div', { class: 'g-card' }, h('div', { class: 'g-card-h' }, h('div', null, h('h3', { text: 'Growth objective' }), h('div', { class: 'g-sub', text: 'Home and Radar are read around this objective.' })), h('div', { class: 'r' }, G.btn('Edit objective', G.objectiveModal, 'sm'))), (() => { const o = G.objectiveInfo(); return h('div', { class: 'g-obj-n' }, [[o.name, o.fm(o.target)], ['Current', o.fm(o.current)], ['Progress', o.pct + '%'], ['Deadline', fdate(o.deadline)]].map(([a, v]) => h('div', null, h('small', { text: a }), h('b', { class: 'num', text: v })))); })()));
  };
})();
