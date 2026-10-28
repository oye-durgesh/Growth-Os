(function () {
  'use strict';
  const G = window.G, h = G.h, S = G.S, F = G.F;
  const OWNERS = ['Shreya Pillai', 'Aarav Mehta', 'Rohan Iyer', 'Meera Kapoor', 'Diya Nair'];
  const mins = (m) => (m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago');
  const intentTone = (i) => ({ 'Very High': 'dark', High: 'green', Medium: 'amber', Low: '' }[i] || '');
  S.local.lead = S.local.lead || {}; S.local.dealStage = S.local.dealStage || {}; S.local.dealDone = S.local.dealDone || {};
  const ld = (l) => Object.assign({}, l, S.local.lead[l.id] || {});
  const dl_ = (d) => Object.assign({}, d, { stage: S.local.dealStage[d.id] || d.stage }, S.local.dealDone[d.id] ? { stalled: false, no_followup: false, last_days: 0 } : {});

  /* =========================== LEADS =========================== */
  G.page('leads', {
    ds: ['leads', 'lead_kpis'],
    build(root, opts) {
      const f = G.pf('leads', { q: '', src: '', intent: '', stage: '', owner: '', waiting: false, seg: 'all' });
      if (opts && opts.waiting) opts.filter = 'followup';
      if (opts && opts.filter) { f.seg = opts.filter; f.waiting = false; }
      const kpiBox = h('div', { class: 'g-kpis', style: '--min:140px' }), aiBox = h('div'), fbox = h('div', { class: 'g-tools' }), tblBox = h('div'), segBox = h('div');
      root.append(G.head('Revenue', 'Leads', 'Find the leads that are ready for a conversation — before they cool off.', [G.rangeSel(), G.btn('Export CSV', exportCsv)]), kpiBox, h('div', { class: 'g-mt16' }, aiBox), G.sec('All leads', 'Sorted by intent score. Click a lead to see its full journey.'), segBox, fbox, h('div', { class: 'g-card pad0' }, tblBox));
      const tbl = G.table({
        source: 'leads', key: ['id'], id: (r) => r.id, sort: { k: 'score', dir: -1 }, onRow: openLead,
        empty: G.empty('◎', 'No leads match these filters', 'Clear a filter to see more.', G.btn('Clear filters', () => { Object.assign(f, { q: '', src: '', intent: '', stage: '', owner: '', waiting: false, seg: 'all' }); filters(); fill(); })),
        cols: [
          { k: 'name', label: 'Lead', first: 1, f: (r) => G.nm(r.name, r.role + ' · ' + r.company, r.waiting ? G.badge('Waiting', 'amber') : null) },
          { k: 'source_group', label: 'Source', hide: 'm' },
          { k: 'campaign_name', label: 'Campaign', hide: 'n', f: (r) => h('span', { class: 'sm', text: r.campaign_name }) },
          { k: 'score', label: 'Intent score', f: (r) => h('div', { class: 'g-row', style: 'gap:6px;flex-wrap:nowrap' }, G.score(r.score, r.score >= 75 ? '' : r.score >= 50 ? 'amber' : 'red'), G.badge(r.intent, intentTone(r.intent))) },
          { k: 'stage', label: 'Stage' },
          { k: 'last_activity_mins', label: 'Last activity', cls: 'r', hide: 'n', f: (r) => mins(r.last_activity_mins) },
          { k: 'pricing_visits', label: 'Pricing page', hide: 'n', f: (r) => (r.pricing_visit ? G.badge('Visited ' + r.pricing_visits + '×', 'green') : h('span', { class: 'muted sm', text: 'No' })) },
          { k: 'signup_days_ago', label: 'Signed up', hide: 'n', f: (r) => h('span', { class: 'sm', text: r.signup_date }) },
          { k: 'owner', label: 'Owner', hide: 'm', f: (r) => G.ownerAv(r.owner) },
          { k: 'est_value', label: 'Est. value', cls: 'r num', f: (r) => F.inr(r.est_value) },
          { k: 'next_action', label: 'Next action', f: (r) => h('span', { class: 'sm', text: r.next_action }) },
        ] });
      tblBox.append(tbl.el);
      function rowsF() { const q = f.q.toLowerCase(); return (G.rows('leads') || []).map(ld).filter((r) => (!q || (r.name + r.company).toLowerCase().includes(q)) && (!f.src || r.source_group === f.src) && (!f.intent || r.intent === f.intent) && (!f.stage || r.stage === f.stage) && (!f.owner || r.owner === f.owner) && (!f.waiting || r.waiting) && segOk(r)); }
      const SEGS = [['all', 'All'], ['high', 'High intent'], ['followup', 'Needs follow-up'], ['new', 'New'], ['qualified', 'Qualified'], ['converted', 'Converted']];
      function segOk(r) { return { all: true, high: r.score >= 75, followup: r.waiting, new: r.stage === 'New', qualified: ['Qualified', 'Meeting', 'Opportunity'].includes(r.stage), converted: r.stage === 'Customer' }[f.seg || 'all']; }
      function segs() { const all = (G.rows('leads') || []).map(ld); const cnt = (k) => { const x = f.seg; f.seg = k; const n = all.filter(segOk).length; f.seg = x; return n; }; segBox.replaceChildren(G.tabs(SEGS.map((x) => ({ v: x[0], l: x[1] + ' · ' + cnt(x[0]) })), f.seg || 'all', (v) => { f.seg = v; segs(); fill(); })); }
      function fill() { tbl.set(rowsF()); }
      function filters() {
        const all = (G.rows('leads') || []), u = (k) => [...new Set(all.map((r) => r[k]))].sort();
        const op = (a, l) => [{ v: '', l }].concat(a.map((x) => ({ v: x, l: x })));
        fbox.replaceChildren(G.search('Search leads or companies', (v) => { f.q = v; fill(); }, f.q), G.sel(op(u('source_group'), 'All sources'), f.src, (v) => { f.src = v; fill(); }, 'Source'), G.sel(op(['Very High', 'High', 'Medium', 'Low'], 'All intent'), f.intent, (v) => { f.intent = v; fill(); }, 'Intent'), G.sel(op(['New', 'Contacted', 'Qualified', 'Meeting', 'Opportunity', 'Customer'], 'All stages'), f.stage, (v) => { f.stage = v; fill(); }, 'Stage'), G.sel(op(OWNERS, 'All owners'), f.owner, (v) => { f.owner = v; fill(); }, 'Owner'),
          h('label', { class: 'g-row sm', style: 'gap:6px;cursor:pointer' }, h('input', { type: 'checkbox', checked: f.waiting ? '' : null, onchange: (e) => { f.waiting = e.target.checked; fill(); } }), 'Waiting for follow-up'));
        const cb = fbox.querySelector('input[type=checkbox]'); if (cb) cb.checked = !!f.waiting;
      }
      function exportCsv() { const r = rowsF(); G.download('growth-os-leads.csv', ['Name,Company,Source,Intent,Score,Stage,Owner'].concat(r.map((x) => [x.name, x.company, x.source_group, x.intent, x.score, x.stage, x.owner].map((v) => '"' + v + '"').join(','))).join('\n'), 'text/csv'); }
      function assign(l) {
        const form = G.form([{ k: 'owner', label: 'Owner', type: 'select', opts: OWNERS, val: l.owner }]);
        G.modal({ title: 'Assign ' + l.name, body: form.el, actions: (c) => [G.btn('Cancel', c), G.btn('Assign', () => { const o = form.get().owner; S.local.lead[l.id] = Object.assign(S.local.lead[l.id] || {}, { owner: o }); c(); G.toast(l.name + ' assigned to ' + o); fill(); renderAI(); segs(); }, 'pri')] });
      }
      function followUp(l, after) {
        const form = G.form([{ k: 'when', label: 'When', type: 'select', opts: ['Today, 4:00 PM', 'Tomorrow, 11:00 AM', 'In 2 days'], val: 'Today, 4:00 PM' }, { k: 'msg', label: 'Message', type: 'textarea', val: `Hi ${l.name.split(' ')[0]}, saw your team looking at Wispr Flow pricing. Happy to walk through a rollout for ${l.seats || 10} seats — 15 minutes this week?` }]);
        G.modal({ title: 'Schedule follow-up · ' + l.name, body: form.el, actions: (c) => [G.btn('Cancel', c), G.btn('Send & schedule', () => { const v = form.get(); S.local.lead[l.id] = Object.assign(S.local.lead[l.id] || {}, { waiting: false, stage: l.stage === 'New' ? 'Contacted' : l.stage, next_action: 'Follow-up ' + v.when.toLowerCase(), last_activity_mins: 0 }); c(); G.toast('Follow-up scheduled for ' + l.name); fill(); renderAI(); if (after) after(); }, 'pri')] });
      }
      function openLead(r) {
        r = ld(r);
        const sig = r.signals || [];
        G.drawer({ title: r.name, sub: r.role + ' · ' + r.company, body: h('div', null,
          h('div', { class: 'g-row g-mb16' }, G.score(r.score, r.score >= 75 ? '' : 'amber'), G.badge(r.intent + ' intent', intentTone(r.intent)), G.badge(r.stage)),
          h('div', { class: 'g-dr-sec' }, h('h4', { text: 'Journey' }), h('div', { class: 'g-jr' }, (r.journey || []).map((e) => h('div', { class: 'g-jr-i' }, h('span', { class: 'xs muted', text: e.days_ago === 0 ? 'Today' : e.days_ago + ' d ago' }), h('span', { class: 'sm', text: e.text }))))),
          h('div', { class: 'g-dr-sec' }, h('h4', { text: 'Why this score' }), h('ul', { class: 'g-ul' }, sig.map((s) => h('li', { text: s })))),
          h('div', { class: 'g-dr-sec' }, h('h4', { text: 'Details' }), h('div', { class: 'g-gap8 sm' }, [['Source', r.source], ['Campaign', r.campaign_name], ['Owner', r.owner], ['Signed up', r.signup_date], ['Pricing page', r.pricing_visit ? 'Visited ' + r.pricing_visits + '×' : 'Not yet'], ['Est. value', F.inr(r.est_value)], ['Potential seats', r.seats], ['Email', r.email], ['Last activity', mins(r.last_activity_mins)]].map(([a, b]) => h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('span', { class: 'muted', text: a }), h('span', { text: b }))))),
          h('div', { class: 'g-dr-sec' }, h('h4', { text: 'Recommended next action' }), h('p', { class: 'sm', text: r.waiting ? 'High intent and no touch yet. Reaching out within 24 hours roughly doubles reply rates.' : 'Keep momentum: ' + r.next_action.toLowerCase() + '.' }))),
          footer: (c) => [G.btn('Schedule follow-up', () => { c(); followUp(r); }, 'pri'), G.btn('Assign owner', () => { c(); assign(r); }), G.btn('Copy email', () => G.copy(r.email, 'Email copied'))] });
      }
      function renderAI() {
        const all = (G.rows('leads') || []).map(ld), w = all.filter((l) => l.waiting).sort((a, b) => b.score - a.score), top = w.slice(0, 3);
        if (!w.length) return aiBox.replaceChildren(G.card('Follow up now', 'All high-intent leads have been followed up.', G.empty('✓', 'Nothing waiting', 'New high-intent leads will appear here.')));
        const t = top[0];
        aiBox.replaceChildren(h('div', { class: 'g-ai' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'FOLLOW UP NOW'), h('div', { class: 't', text: w.length + ' high-intent leads are waiting for a follow-up.' }),
          h('p', { style: 'color:var(--g-ink-2)', text: `${t.name} (${t.company}) scores ${t.score}/100: ${t.signals.slice(0, 3).join(', ').toLowerCase()}. Contact within 24 hours.` }),
          h('div', { class: 'g-grid g-mt8' }, top.map((l) => h('div', { class: 's4 g-card', style: 'padding:12px;grid-column:span 4' }, h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('b', { text: l.name }), h('b', { class: 'num', text: l.score })), h('div', { class: 'xs muted', text: l.company + ' · ' + l.seats + ' seats' }), h('div', { class: 'xs g-mt8', text: l.signals[0] }), h('div', { class: 'g-row g-mt8' }, G.btn('Follow up', () => followUp(l), 'pri sm'), G.btn('View', () => openLead(l), 'sm'))))),
          h('div', { class: 'g-row g-mt8' }, G.btn('Follow up all ' + w.length, () => G.confirm({ title: 'Follow up with ' + w.length + ' leads?', text: 'Send a personalised intro message to every waiting high-intent lead and assign an owner.', detail: 'Messages use the recommended template and can be edited later in Activity.', confirm: 'Send all', onConfirm: () => { w.forEach((l) => { S.local.lead[l.id] = Object.assign(S.local.lead[l.id] || {}, { waiting: false, next_action: 'Follow-up sent today', last_activity_mins: 0 }); }); G.toast(w.length + ' follow-ups sent'); fill(); renderAI(); } }), 'pri'), G.btn('Show only waiting', () => { f.seg = 'followup'; segs(); fill(); }))));
      }
      function update() {
        kpiBox.replaceChildren(...G.byRange('lead_kpis').sort((a, b) => a.order - b.order).map((k) => G.kpiCard(Object.assign({ good_up: true }, k), { src: 'lead_kpis', where: { range: k.range, metric: k.metric } })));
        renderAI(); segs(); filters(); fill();
      }
      return { update };
    },
  });

  /* =========================== PIPELINE =========================== */
  G.page('pipeline', {
    ds: ['deals', 'pipeline_kpis', 'pipeline_radar'],
    build(root, opts) {
      const f = G.pf('pipeline', { stalled: false, owner: '' });
      if (opts && opts.stalled) f.stalled = true;
      const STAGES = ['New', 'Contacted', 'Qualified', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Lost'];
      const kpiBox = h('div', { class: 'g-kpis', style: '--min:150px' }), radarBox = h('div'), board = h('div', { class: 'g-kanban' });
      const tools = h('div', { class: 'g-tools' });
      root.append(G.head('Revenue', 'Pipeline', 'From qualified conversation to closed revenue. Drag a card to change its stage.', [G.btn('Add deal', addDeal, 'pri')]), kpiBox, G.sec('Pipeline Radar', 'What needs attention right now.'), radarBox, G.sec('Deals'), tools, board);
      const deals = () => (G.rows('deals') || []).concat(S.local.newDeals || []).map(dl_);
      function addDeal() {
        const form = G.form([{ k: 'company', label: 'Company' }, { k: 'value', label: 'Deal value (₹)', type: 'number', val: 50000 }, { k: 'owner', label: 'Owner', type: 'select', opts: OWNERS }]);
        G.modal({ title: 'Add deal', body: form.el, actions: (c) => [G.btn('Cancel', c), G.btn('Add to New', () => { const v = form.get(); if (!v.company.trim()) return G.toast('Enter a company name', { tone: 'bad' }); S.local.newDeals = (S.local.newDeals || []).concat([{ id: 'nd' + Date.now(), company: v.company.trim(), value: +v.value || 0, source: 'Manual', campaign_name: '—', owner: v.owner, probability: 10, stage: 'New', last_days: 0, stalled: false, no_followup: false, contact: '—', seats: 0 }]); c(); G.toast('Deal added'); draw(); }, 'pri')] });
      }
      function moveTo(d, st) {
        if (d.stage === st) return;
        const apply = () => { if (String(d.id).startsWith('nd')) { const x = S.local.newDeals.find((y) => y.id === d.id); x.stage = st; } else S.local.dealStage[d.id] = st; S.local.dealDone[d.id] = true; G.toast(d.company + ' moved to ' + st, { action: { label: 'Undo', fn: () => { if (String(d.id).startsWith('nd')) S.local.newDeals.find((y) => y.id === d.id).stage = d.stage; else S.local.dealStage[d.id] = d.stage; draw(); } } }); draw(); };
        if (st === 'Lost') G.confirm({ title: 'Mark ' + d.company + ' as lost?', text: 'The deal leaves the open pipeline (' + F.inr(d.value) + ').', confirm: 'Mark lost', danger: true, onConfirm: apply }); else apply();
      }
      function openDeal(d) {
        G.drawer({ title: d.company, sub: F.inr(d.value) + ' · ' + d.stage, body: h('div', null, h('div', { class: 'g-ev g-mb16' }, [['Value', F.inr(d.value)], ['Probability', d.probability + '%'], ['Seats', d.seats || '—'], ['Idle', d.last_days + ' days']].map(([a, b]) => h('div', null, h('small', { text: a }), h('b', { text: b })))),
          h('div', { class: 'g-gap8 sm' }, [['Contact', d.contact], ['Owner', d.owner], ['Source', d.source], ['Campaign', d.campaign_name]].map(([a, b]) => h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('span', { class: 'muted', text: a }), h('span', { text: b })))),
          d.stalled ? h('div', { class: 'g-ai g-mt16' }, h('div', { class: 'tag' }, 'Stalled'), h('p', { text: 'No movement for ' + d.last_days + ' days. Deals idle past 7 days close at less than half the usual rate — follow up today.' })) : null),
          footer: (c) => [G.btn('Follow up', () => { S.local.dealDone[d.id] = true; c(); G.toast('Follow-up sent to ' + d.contact); draw(); }, 'pri'), G.btn('Move stage…', () => { c(); const form = G.form([{ k: 's', label: 'Stage', type: 'select', opts: STAGES, val: d.stage }]); G.modal({ title: 'Move ' + d.company, body: form.el, actions: (c2) => [G.btn('Cancel', c2), G.btn('Move', () => { c2(); moveTo(d, form.get().s); }, 'pri')] }); })] });
      }
      function followAll() {
        const t = deals().filter((d) => (d.no_followup || d.stalled) && d.stage !== 'Won' && d.stage !== 'Lost');
        G.confirm({ title: 'Follow up on ' + t.length + ' deals?', text: 'Send a check-in to every stalled deal and every high-intent deal with no recent touch.', confirm: 'Send ' + t.length, onConfirm: () => { t.forEach((d) => { S.local.dealDone[d.id] = true; }); G.toast(t.length + ' follow-ups sent'); draw(); } });
      }
      function draw() {
        const all = deals().filter((d) => !f.owner || d.owner === f.owner), shown = all.filter((d) => !f.stalled || d.stalled);
        const open = all.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost'), stalled = open.filter((d) => d.stalled);
        const live = [['Open pipeline', F.inr(d3.sum(open, (d) => d.value)), open.length + ' open deals'], ['Stalled', stalled.length + ' deals', F.inr(d3.sum(stalled, (d) => d.value)) + ' at risk']];
        tools.replaceChildren(h('label', { class: 'g-row sm', style: 'gap:6px;cursor:pointer' }, h('input', { type: 'checkbox', onchange: (e) => { f.stalled = e.target.checked; draw(); } }), 'Show only stalled deals'), G.sel([{ v: '', l: 'All owners' }].concat(OWNERS.map((o) => ({ v: o, l: o }))), f.owner, (v) => { f.owner = v; draw(); }, 'Owner'), h('span', { class: 'sm muted', text: live.map((x) => x[0] + ': ' + x[1] + ' (' + x[2] + ')').join(' · ') }));
        tools.querySelector('input').checked = !!f.stalled;
        board.replaceChildren(...STAGES.map((st) => {
          const items = shown.filter((d) => d.stage === st), sum = d3.sum(items, (d) => d.value);
          const col = h('div', { class: 'g-kcol' + (st === 'Won' ? ' won' : st === 'Lost' ? ' lost' : '') },
            h('div', { class: 'g-kh' }, h('b', { text: st }), h('span', { class: 'xs muted num', text: items.length + ' · ' + F.inr(sum) })),
            h('div', { class: 'g-kb' }, items.length ? items.map((d) => {
              const c = h('div', { class: 'g-kcard' + (d.stalled ? ' risk' : ''), draggable: 'true', tabindex: '0', onclick: () => openDeal(d), onkeydown: (e) => { if (e.key === 'Enter') openDeal(d); } },
                h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('b', { text: d.company }), h('span', { class: 'num sm', text: F.inr(d.value) })),
                h('div', { class: 'xs muted', text: d.contact + ' · ' + d.owner.split(' ')[0] }), h('div', { class: 'g-row g-mt8', style: 'gap:4px' }, G.badge(d.probability + '%'), d.stalled ? G.badge('Stalled ' + d.last_days + 'd', 'red') : d.no_followup ? G.badge('No follow-up', 'amber') : null));
              c.addEventListener('dragstart', (e) => { try { e.dataTransfer.setData('text/plain', String(d.id)); } catch (x) { /* ignore */ } window.__gdrag = d; c.classList.add('drag'); });
              c.addEventListener('dragend', () => c.classList.remove('drag'));
              return c;
            }) : h('div', { class: 'xs muted', style: 'padding:8px', text: f.stalled ? 'No stalled deals here' : 'No deals' })));
          col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); }); col.addEventListener('dragleave', () => col.classList.remove('over'));
          col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('over'); const d = window.__gdrag; window.__gdrag = null; if (d) moveTo(d, st); });
          return col;
        }));
      }
      function update() {
        kpiBox.replaceChildren(...(G.rows('pipeline_kpis') || []).map((k) => G.kpiCard(Object.assign({ good_up: true }, k), { src: 'pipeline_kpis', where: { id: k.id } })));
        radarBox.replaceChildren(h('div', { class: 'g-grid' }, (G.rows('pipeline_radar') || []).map((r) => h('div', { class: 'g-card', style: 'grid-column:span 3;min-width:0' }, h('div', { class: 'g-row', style: 'gap:6px' }, G.badge(r.kind === 'risk' ? 'Risk' : 'Opportunity', r.kind === 'risk' ? 'red' : 'green')), G.mk(h('div', { style: 'font-weight:600;margin-top:6px', text: r.text }), 'pipeline_radar', 'text', { id: r.id }), h('div', { class: 'sm muted', text: r.sub }), h('div', { class: 'g-mt8' }, G.btn(r.cta, () => { if (r.action === 'followup') G.go('leads', { filter: 'followup' }); else { f.stalled = r.action === 'stalled'; draw(); board.scrollIntoView({ behavior: 'smooth' }); } }, 'sm'), r.action === 'followup' ? G.btn('Follow up all', followAll, 'sm') : null)))));
        draw();
      }
      return { update };
    },
  });

  /* =========================== ATTRIBUTION =========================== */
  G.page('attribution', {
    ds: ['attribution', 'attr_journey', 'influence', 'kpis', 'channels', 'campaigns', 'creators'],
    build(root, opts) {
      const f = G.pf('attribution', { model: 'data', cmp: false, stage: null });
      const MODELS = [['first', 'First touch', 'Credit to the first interaction that introduced the buyer.'], ['last', 'Last touch', 'Credit to the final click before conversion.'], ['linear', 'Linear', 'Equal credit to every touchpoint in the journey.'], ['position', 'Position-based', '40% first, 40% last, 20% shared across the middle.'], ['data', 'Data-driven', 'Credit from a model trained on Wispr Flow conversion paths.']];
      const jBox = h('div'), jDet = h('div', { class: 'g-mt8' }), mBox = h('div'), tBox = h('div'), iBox = h('div', { class: 'g-chart' });
      root.append(G.head('Revenue', 'Attribution', 'Which touchpoints actually create customers — and which just collect the credit.', [G.rangeSel()]), G.sec('Customer journey', 'From first impression to revenue. Click a stage to see where it leaks.'), jBox, jDet, G.sec('Attribution model'), mBox, h('div', { class: 'g-card pad0 g-mt8' }, tBox), G.sec('Influence vs credit', 'Credit is who closes. Influence is who shaped the decision.'), G.card('Influence vs credit by source', 'Share of customers credited vs share of journeys influenced', h('div', null, iBox, h('div', { class: 'g-legend g-mt8' }, h('span', null, h('i', { style: 'background:var(--g-ink-3)' }), 'Credit (last-touch share, %)'), h('span', null, h('i', { style: 'background:var(--g-em)' }), 'Influence (journeys touched, %)')))));
      const tbl = G.table({
        source: 'attribution', key: ['id'], id: (r) => r.id, sort: { k: 'revenue', dir: -1 },
        cols: [{ k: 'source', label: 'Source', first: 1, f: (r) => h('b', { text: r.source }) }, { k: 'assisted', label: 'Assisted conv.', cls: 'r num', hide: 'm', f: (r) => F.n(r.assisted) }, { k: 'direct', label: 'Direct conv.', cls: 'r num', hide: 'm', f: (r) => F.n(r.direct) }, { k: 'customers', label: 'Customers', cls: 'r num', f: (r) => F.n(r.customers) }, { k: 'revenue', label: 'Revenue', cls: 'r num', f: (r) => F.inr(r.revenue) }, { k: 'cac', label: 'CAC', cls: 'r num', f: (r) => (r.cac ? F.inrF(r.cac) : '—') }, { k: 'roi', label: 'ROI', cls: 'r num', f: (r) => (r.roi ? F.x(r.roi) : '∞') }, { k: 'share', label: 'Share', f: (r) => h('div', { class: 'g-meter' }, h('span', { class: 'num', text: r.share + '%' }), G.pbar(r.share * 2.2)) }] });
      tBox.append(tbl.el);
      const STM = { Ad: ['impressions', 'views', 'impressions'], Creator: ['clicks', 'clicks', 'clicks'], 'Landing Page': ['visitors', 'clicks', 'clicks'], Signup: ['signups', 'signups', 'signups'], Activation: ['activated', 'activated', 'activated'], Lead: ['leads', 'signups', 'leads'], Customer: ['customers', 'customers', 'customers'], Revenue: ['revenue', 'revenue', 'revenue'] };
      function stageDetail(js, i) {
        const j = js[i], prev = i ? js[i - 1] : null, fm = (x, v) => (x.unit === 'revenue' ? F.inr(v) : F.c(v));
        const m = STM[j.stage] || ['signups', 'signups', 'signups'];
        const R = (id) => (G.byRange(id) || []).filter((r) => r.range === S.range || !r.range);
        const ch = R('channels').filter((r) => r.channel !== 'Referral' || true), cp = R('campaigns').map((c) => Object.assign({}, c, { activated: Math.round(c.signups * c.activation / 100) })), cr = R('creators');
        const top = (rows, k, label, n) => rows.slice().sort((a, b) => (b[k] || 0) - (a[k] || 0)).slice(0, n || 3).map((r) => [label(r), r[k] || 0, r.revenue || 0]);
        const totRev = d3.sum(ch, (r) => r.revenue) || 1, conv = prev ? j.value / prev.value : 1, drop = prev ? 1 - conv : 0;
        const fmv = (v) => (m[0] === 'revenue' ? F.inr(v) : F.c(v));
        const list = (title, items) => h('div', { class: 'g-card', style: 'padding:12px;min-width:0' }, h('div', { class: 'g-sig-k', text: title }), h('div', { class: 'g-gap8 g-mt8' }, items.length ? items.map(([n, v, rev]) => h('div', { class: 'g-row sm', style: 'justify-content:space-between;flex-wrap:nowrap' }, h('span', { text: n, style: 'min-width:0' }), h('span', { class: 'num' }, h('b', { text: fmv(v) }), h('span', { class: 'muted xs', text: '  ' + Math.round(rev / totRev * 100) + '% of revenue' })))) : [h('span', { class: 'muted sm', text: 'No data for this stage' })]));
        const worst = prev && drop > 0.5 ? `${F.pct ? '' : ''}Only ${(conv * 100).toFixed(1)}% make it from ${prev.stage} to ${j.stage} — the largest leak in this journey.` : prev ? `${(conv * 100).toFixed(1)}% continue from ${prev.stage} to ${j.stage}.` : 'This is the top of the funnel — volume here sets the ceiling for everything below.';
        jDet.replaceChildren(h('div', { class: 'g-card' },
          h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('b', { text: j.stage + ' · stage detail' }), G.btn('Close', () => { f.stage = null; journey(); }, 'sm')),
          h('div', { class: 'g-ev g-mt8' }, [['Volume', fm(j, j.value)], ['Conversion from ' + (prev ? prev.stage : 'start'), prev ? (conv * 100).toFixed(1) + '%' : '—'], ['Drop-off', prev ? (drop * 100).toFixed(1) + '%' : '—'], ['Revenue contribution', F.inr(d3.sum(top(ch, 'revenue', (r) => r.channel, 3), (x) => x[1])) + ' from top 3 sources']].map(([a, b]) => h('div', null, h('small', { text: a }), h('b', { text: b })))),
          h('p', { class: 'sm g-mt8', text: worst }),
          h('div', { class: 'g-grid g-mt8' }, [list('Top sources', top(ch, m[0], (r) => r.channel)), list('Top campaigns', top(cp, m[1], (r) => r.name.replace('Wispr Flow — ', ''))), list('Top creators', top(cr, m[2], (r) => r.handle))].map((c) => h('div', { style: 'grid-column:span 4;min-width:0' }, c))),
          h('div', { class: 'g-row g-mt8' }, G.btn('Open channels', () => G.go('channels'), 'sm'), G.btn('Open creators', () => G.go('creators'), 'sm'), G.btn('Open campaigns', () => G.go('campaigns'), 'sm'))));
      }
      function journey() {
        const js = (G.rows('attr_journey') || []).slice().sort((a, b) => a.order - b.order);
        const fm = (j) => (j.unit === 'revenue' ? F.inr(j.value) : F.c(j.value));
        jBox.replaceChildren(h('div', { class: 'g-card' }, h('div', { class: 'g-journey' }, js.map((j, i) => h('button', { class: 'g-jn click' + (f.stage === j.id ? ' on' : ''), type: 'button', 'aria-pressed': f.stage === j.id ? 'true' : 'false', onclick: () => { f.stage = f.stage === j.id ? null : j.id; journey(); } }, h('div', { class: 'xs muted', text: String(i + 1).padStart(2, '0') }), h('b', { text: j.stage }), G.mk(h('div', { class: 'num', style: 'font-size:18px;font-weight:600', text: fm(j) }), 'attr_journey', 'value', { id: j.id }), h('div', { class: 'xs muted', text: j.unit }), i ? h('div', { class: 'xs', style: 'margin-top:6px', text: (j.value / js[i - 1].value * 100).toFixed(1) + '% of ' + js[i - 1].stage.toLowerCase() }) : h('div', { class: 'xs', style: 'margin-top:6px', text: j.note }))))));
        const k = js.findIndex((j) => j.id === f.stage);
        if (k >= 0) stageDetail(js, k); else jDet.replaceChildren();
      }
      function models() {
        const cur = MODELS.find((m) => m[0] === f.model);
        const rows = (G.rows('attribution') || []).filter((r) => r.model === f.model);
        const top = rows.slice().sort((a, b) => b.revenue - a.revenue)[0], first = (G.rows('attribution') || []).filter((r) => r.model === 'first').sort((a, b) => b.revenue - a.revenue)[0], last = (G.rows('attribution') || []).filter((r) => r.model === 'last').sort((a, b) => b.revenue - a.revenue)[0];
        mBox.replaceChildren(G.tabs(MODELS.map((m) => ({ v: m[0], l: m[1] })), f.model, (v) => { f.model = v; models(); }), h('div', { class: 'g-row g-mt8', style: 'justify-content:space-between' }, h('div', { class: 'sm muted', text: cur[2] }), h('div', { class: 'sm' }, 'Top source: ', h('b', { text: top.source }), ' · ' + F.inr(top.revenue))), first && last && first.source !== last.source ? h('div', { class: 'g-ai g-mt8' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'Why the model matters'), h('p', { text: `${first.source} wins under first touch, ${last.source} under last touch. Judging channels on one model would move budget to the wrong place.` })) : null);
        tbl.set(rows);
      }
      function chart() {
        iBox.replaceChildren();
        const rows = (G.rows('influence') || []).slice().sort((a, b) => b.influence - a.influence);
        const W = iBox.clientWidth || 640, rowH = 34, m = { l: 96, r: 70, t: 6, b: 6 }, H = rows.length * rowH + m.t + m.b;
        const x = d3.scaleLinear([0, Math.max(70, d3.max(rows, (r) => Math.max(r.influence, r.credit)))], [m.l, W - m.r]);
        const svg = d3.select(iBox).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H).attr('role', 'img').attr('aria-label', 'Influence versus credit by source');
        rows.forEach((r, i) => {
          const y = m.t + i * rowH;
          svg.append('text').attr('x', m.l - 8).attr('y', y + 14).attr('text-anchor', 'end').attr('font-size', 12).style('fill', 'var(--g-ink)').text(r.source);
          svg.append('text').attr('x', m.l - 8).attr('y', y + 27).attr('text-anchor', 'end').attr('font-size', 10).style('fill', 'var(--g-ink-3)').text(r.role);
          const g = svg.append('g').style('cursor', 'pointer').on('mousemove', (e) => G.tip.show(e, h('div', null, h('b', { text: r.source + ' · ' + r.role }), h('div', { text: r.note })))).on('mouseleave', G.tip.hide);
          g.append('rect').attr('x', m.l).attr('y', y + 4).attr('height', 11).attr('width', x(r.credit) - m.l).attr('rx', 2).style('fill', 'var(--g-ink-3)');
          g.append('rect').attr('x', m.l).attr('y', y + 17).attr('height', 11).attr('width', x(r.influence) - m.l).attr('rx', 2).style('fill', 'var(--g-em)');
          g.append('text').attr('x', x(r.credit) + 6).attr('y', y + 13).attr('font-size', 10.5).style('fill', 'var(--g-ink-2)').text(r.credit + '%');
          g.append('text').attr('x', x(r.influence) + 6).attr('y', y + 26).attr('font-size', 10.5).style('fill', 'var(--g-ink-2)').text(r.influence + '%');
        });
      }
      function update() { journey(); models(); chart(); }
      return { update };
    },
  });
})();
