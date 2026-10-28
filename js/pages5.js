(function () {
  'use strict';
  /* Company data setup: Data Sources page, Add data, CSV wizard, simulated
     connectors, demo workspaces, onboarding, empty states and data health. */
  const G = window.G, h = G.h, S = G.S, F = G.F;
  const r0 = Math.round;
  S.local.ds = S.local.ds || {};

  const mode = () => G.WS.mode();
  const ws = () => G.WS.active();
  const DEMOS = [['wispr', 'Wispr Flow — India GTM', 'Voice productivity for Indian knowledge workers. Creator-led growth, Google Ads and referral. Default demo.'], ['saas', 'SaaS Growth Demo', 'A seed-stage SaaS with paid search, Meta, creators and a referral program.'], ['b2b', 'B2B GTM Demo', 'An enterprise sales motion: LinkedIn ABM, demand gen, webinars and partner referral.'], ['ecom', 'E-commerce Growth Demo', 'A D2C brand with festive campaigns, Instagram, creators and retargeting.']];
  const profFor = () => { const t = String((ws().company || {}).type || (ws().company || {}).industry || '').toLowerCase(); return /commerce|b2c|retail|d2c/.test(t) ? 'ecom' : /b2b|enterprise/.test(t) ? 'b2b' : /saas|developer|software/.test(t) ? 'saas' : 'b2b'; };

  /* Rebuild every view after the workspace or its data changed. */
  G.refreshAll = (page) => { G.wsBump(); G.WS.save(); S.answer = null; G.updateChrome && G.updateChrome(); G.go(page || S.page); };

  /* ---------- data status chip ---------- */
  G.sourceList = () => {
    const w = ws(), m = mode();
    if (m === 'empty') return [];
    const over = (d) => Object.assign({}, d, S.local.ds[d.id] || {});
    if (m === 'live') return (G.rows('datasources') || []).map((d) => { const o = over(d); return Object.assign(o, { sim: !!(w.imports.find((i) => i.id === d.id) || {}).sim }); });
    if (w.base === 'wispr') return (G.rows('datasources') || []).map((d) => Object.assign(over(d), { demo: true }));
    const ids = ['meta', 'gads', 'ga4', 'hubspot', 'yt', 'ig', 'stripe'], R = G.rng(w.base);
    return ids.map((id) => { const cn = G.connectorById(id); return over({ id, name: cn.name, kind: cn.kind === 'ad' ? 'Ads' : cn.kind === 'analytics' ? 'Analytics' : cn.kind === 'lead' ? 'CRM' : cn.kind === 'content' ? 'Social' : 'Revenue', status: 'Connected', last_sync_s: 20 + r0(R() * 500), records: 8000 + r0(R() * 140000), sync: 'Demo connection · every 15 min', account: cn.name + ' demo account', demo: true }); });
  };
  G.dataStatus = () => {
    const m = mode(), list = G.sourceList(), att = list.filter((d) => d.status === 'Attention' || d.status === 'Paused').length;
    if (m === 'empty') return { label: 'No data connected', tone: 'gray', n: 0, tip: 'Connect your first data source' };
    if (m === 'demo') return { label: 'Demo data · ' + list.length + ' sources', tone: att ? 'amber' : '', n: list.length, tip: 'Simulated demo data. ' + (att ? att + ' demo source' + (att > 1 ? 's' : '') + ' flagged for attention.' : 'No external accounts are connected.') };
    if (att) return { label: att + ' source' + (att > 1 ? 's' : '') + ' need' + (att > 1 ? '' : 's') + ' attention', tone: 'amber', n: list.length, tip: 'Open Data Sources' };
    return { label: 'Live · ' + list.length + ' source' + (list.length === 1 ? '' : 's') + ' connected', tone: '', n: list.length, tip: 'Imported data. Connectors are simulated in this prototype.' };
  };

  /* ---------- data health ---------- */
  G.dataHealth = () => {
    const w = ws(), m = mode();
    const CATS = ['Campaign data', 'Ad spend', 'Creator data', 'Lead data', 'Revenue data', 'Attribution'];
    if (m === 'empty') return { overall: null, rows: CATS.map((c) => ({ name: c, st: 'none', note: 'Not connected' })) };
    if (m === 'demo') {
      const miss = w.base === 'wispr' ? 3 : 1 + (G.hash(w.id) % 3);
      const rows = CATS.map((c) => ({ name: c, st: c === 'Revenue data' ? 'warn' : 'ok', note: c === 'Revenue data' ? 'Missing ' + miss + ' day' + (miss > 1 ? 's' : '') : 'Healthy' }));
      return { overall: w.base === 'wispr' ? 94 : 90 + (G.hash(w.id + 'h') % 6), rows };
    }
    const has = (t) => w.imports.some((i) => i.type === t), ch = G.rows('channels').filter((c) => c.range === '30d'), ser = G.rows('series') || [];
    const ads = w.imports.filter((i) => i.type === 'ad'), adRows = ads.reduce((s, i) => s + i.rows.length, 0), unassigned = ads.reduce((s, i) => s + i.rows.filter((r) => r.channel === 'Unassigned').length, 0);
    const withSpend = ads.reduce((s, i) => s + i.rows.filter((r) => r.spend > 0).length, 0);
    const revOK = ads.some((i) => i.rows.some((r) => r.revenue > 0)) || has('revenue') || has('customer');
    const dates = ads.concat(w.imports.filter((i) => i.type === 'revenue')).reduce((a, i) => a.concat(i.rows.map((r) => r.date).filter(Boolean)), []);
    let missing = 0; if (dates.length > 3) { const set = new Set(dates), end = dates.slice().sort().pop(); for (let i = 0; i < 30; i++) if (!set.has(G.addDays(end, -i))) missing++; }
    const rows = [
      adRows ? (unassigned / adRows > 0.1 ? { name: CATS[0], st: 'warn', note: r0(unassigned / adRows * 100) + '% of rows have no channel' } : { name: CATS[0], st: 'ok', note: 'Healthy' }) : { name: CATS[0], st: 'none', note: 'Not connected' },
      adRows ? (withSpend ? { name: CATS[1], st: 'ok', note: 'Healthy' } : { name: CATS[1], st: 'warn', note: 'No spend values found' }) : { name: CATS[1], st: 'none', note: 'Not connected' },
      has('creator') ? { name: CATS[2], st: 'ok', note: 'Healthy' } : { name: CATS[2], st: 'none', note: 'Not connected' },
      has('lead') || has('customer') ? { name: CATS[3], st: 'ok', note: 'Healthy' } : { name: CATS[3], st: 'none', note: 'Not connected' },
      revOK ? (missing > 2 ? { name: CATS[4], st: 'warn', note: 'Missing ' + missing + ' days' } : { name: CATS[4], st: 'ok', note: 'Healthy' }) : { name: CATS[4], st: 'none', note: 'Not connected' },
      ch.length > 1 && revOK ? { name: CATS[5], st: 'ok', note: 'Healthy' } : { name: CATS[5], st: ch.length ? 'warn' : 'none', note: ch.length ? 'Needs revenue by channel' : 'Not connected' },
    ];
    const live = rows.filter((r) => r.st !== 'none');
    return { overall: live.length ? r0(live.reduce((s, r) => s + (r.st === 'ok' ? 100 : 64), 0) / live.length) : null, rows };
  };

  /* ---------- small UI helpers ---------- */
  const stBadge = (s) => G.badge(s === 'ok' ? '✓ Healthy' : s === 'warn' ? '⚠ Needs review' : 'Not connected', s === 'ok' ? 'green' : s === 'warn' ? 'amber' : '');
  const ago = (s) => (s < 60 ? s + ' seconds ago' : s < 3600 ? r0(s / 60) + ' minutes ago' : s < 86400 ? r0(s / 3600) + ' hours ago' : r0(s / 86400) + ' days ago');
  const chain = (items, small) => h('div', { class: 'g-chain' + (small ? ' sm' : '') }, items.map((t, i) => [h('span', { class: 'g-chain-i', text: t }), i < items.length - 1 ? h('span', { class: 'g-chain-a', text: '→' }) : null]));
  G.chain = chain;
  const stepper = (labels, cur) => h('div', { class: 'g-steps' }, labels.map((l, i) => h('div', { class: 'g-stp' + (i === cur ? ' on' : i < cur ? ' done' : '') }, h('span', { class: 'n', text: i < cur ? '✓' : String(i + 1) }), h('span', { class: 'l', text: l }))));

  /* ================= EMPTY STATES ================= */
  const EMPTY_COPY = {
    home: ['◎', 'Your Growth OS isn’t connected yet.', 'Connect your first data source to start tracking:'],
    campaigns: ['◎', 'No campaigns yet', 'Connect an ad platform or create your first campaign.'],
    channels: ['≋', 'No channel data yet', 'Connect an ad platform or upload channel performance to compare spend, CAC and ROAS.'],
    creators: ['✦', 'No creators yet', 'Add your creator campaigns to measure views → clicks → signups → revenue.'],
    content: ['▣', 'No content data yet', 'Import content performance to see which formats activate users.'],
    leads: ['◉', 'No leads yet', 'Connect your CRM or upload a leads file to see who needs follow-up.'],
    pipeline: ['▥', 'No pipeline yet', 'Add your first opportunity to start forecasting revenue.'],
    attribution: ['⇄', 'No attribution data', 'Connect your acquisition and revenue sources to understand which touchpoints create customers.'],
    radar: ['◌', 'GTM Radar is waiting for data', 'Radar calculates winning, leaking, at-risk and opportunity signals from your data. Connect a source to start.'],
    reports: ['▤', 'No reports yet', 'Reports summarize your growth data. Connect a source or load demo data to generate your first one.'],
    forecast: ['↗', 'Nothing to forecast yet', 'Forecasts and what-if scenarios need spend, signups and revenue history. Connect data to model your next move.'],
  };
  const GATE = { home: 'kpis', campaigns: 'campaigns', channels: 'channels', creators: 'creators', content: 'content', leads: 'leads', pipeline: 'deals', attribution: 'attribution', forecast: 'scenarios', radar: 'channels', reports: 'kpis' };
  G.gate = (page) => {
    const ds = GATE[page]; if (!ds) return null;
    const rows = G.rows(ds); if (rows == null) return null;
    if (rows.length) { if (page !== 'radar') return null; return null; }
    if (page === 'radar' && ((G.rows('leads') || []).length || (G.rows('deals') || []).length)) return null;
    return G.emptyState(page);
  };
  G.emptyState = (page) => {
    const [ic, t, s] = EMPTY_COPY[page] || EMPTY_COPY.home, m = mode(), partial = m === 'live';
    const title = partial && page === 'home' ? 'Add spend or revenue data to unlock the command center' : t;
    const sub = partial && page === 'home' ? 'You’ve connected ' + ws().imports.length + ' source' + (ws().imports.length === 1 ? '' : 's') + ', but the growth overview needs ad spend, signups or revenue. Add one of those to continue.' : s;
    const secondary = { campaigns: ['Add a campaign manually', () => G.manualModal('ad')], creators: ['Add a creator manually', () => G.manualModal('creator')], leads: ['Add a lead manually', () => G.manualModal('lead')], pipeline: ['Add a deal manually', () => G.manualModal('pipeline')] }[page];
    return h('div', { class: 'g-fade g-hero-empty' },
      h('div', { class: 'g-he-ic', text: ic }),
      h('h1', { text: title }), h('p', { class: 'muted', text: sub }),
      page === 'home' ? h('div', { class: 'g-he-chain' }, chain(['Spend', 'Traffic', 'Signups', 'Activation', 'Leads', 'Revenue'])) : null,
      h('div', { class: 'g-row', style: 'justify-content:center;gap:10px;margin-top:20px' }, G.btn('Connect data', () => G.addDataModal('connect'), 'pri'), G.btn('Upload CSV', () => G.csvWizard()), G.btn('Use demo data', () => G.demoChooser())),
      secondary ? h('div', { class: 'g-mt16' }, h('button', { class: 'g-link', type: 'button', onclick: secondary[1], text: secondary[0] })) : null,
      page === 'home' ? h('div', { class: 'g-mt24' }, h('div', { class: 'xs muted', text: 'New company?' }), G.btn('Set up your company', () => G.onboarding(), 'sm')) : null,
      h('div', { class: 'g-he-flow' }, h('div', { class: 'g-eyebrow', text: 'HOW GROWTH OS WORKS' }), chain(['Data', 'Metrics', 'Radar', 'Recommendation', 'Simulation', 'Action', 'Projected outcome'], true)));
  };

  /* ================= DEMO WORKSPACES ================= */
  G.demoChooser = (after) => {
    const cur = ws().base;
    G.modal({ title: 'Load Demo Workspace', sub: 'Realistic, deterministic sample data. Nothing leaves this browser.', wide: true, body: h('div', { class: 'g-gap8' }, DEMOS.map(([id, name, desc]) => h('button', { class: 'g-opt' + (cur === id && mode() === 'demo' ? ' on' : ''), type: 'button', onclick: () => { G.closeAll(); G.WS.loadDemo(id); G.toast(name + ' loaded'); G.refreshAll('home'); after && after(); } },
      h('div', null, h('b', { text: name }), id === 'wispr' ? h('span', { style: 'margin-left:8px' }, G.badge('Default', 'green')) : null, h('div', { class: 'sm muted', text: desc })), h('span', { class: 'muted', text: cur === id && mode() === 'demo' ? 'Active' : 'Load →' })))),
      actions: (c) => [h('span', { class: 'xs muted', style: 'margin-right:auto', text: 'Loads into the active workspace: ' + ws().name }), G.btn('Cancel', c)] });
  };

  /* ================= ADD DATA ================= */
  const EXTRA = { xads: { id: 'xads', name: 'X Ads', kind: 'ad', channels: ['X'], uses: 'Spend, impressions, clicks, conversions, campaign' }, creators: { id: 'creators-api', name: 'Creator campaigns', kind: 'creator', uses: 'Creator views, clicks, signups and payouts' } };
  const PICK = [['meta', 'Meta Ads'], ['gads', 'Google Ads'], ['lia', 'LinkedIn Ads'], ['xads', 'X Ads'], ['ga4', 'Google Analytics'], ['web', 'Website / product analytics'], ['hubspot', 'CRM · HubSpot'], ['stripe', 'Stripe / Revenue'], ['creators', 'Creator campaigns']];
  const cnOf = (id) => EXTRA[id] || G.connectorById(id);
  G.addDataModal = (start) => {
    let it;
    const box = h('div');
    const opt = (ic, t, s, fn) => h('button', { class: 'g-opt big', type: 'button', onclick: fn }, h('span', { class: 'g-opt-ic', text: ic }), h('div', null, h('b', { text: t }), h('div', { class: 'sm muted', text: s })), h('span', { class: 'muted', text: '→' }));
    function home() {
      box.replaceChildren(h('p', { class: 'muted', style: 'margin:0 0 12px', text: 'Choose how you want to bring data into Growth OS.' }), h('div', { class: 'g-gap8' },
        opt('⇄', 'Connect a source', 'Ad platforms, analytics, CRM and revenue tools. Simulated connectors in this prototype.', picker),
        opt('⇪', 'Upload a CSV', 'Upload existing data, map the columns, check it, then import.', () => { it.close(); G.csvWizard(); }),
        opt('✎', 'Enter manually', 'Add a single campaign, creator, lead or deal by hand.', () => { it.close(); G.manualModal(); }),
        opt('◐', 'Use demo data', 'Explore with a realistic company: Wispr Flow, SaaS, B2B or E-commerce.', () => { it.close(); G.demoChooser(); })));
    }
    function picker() {
      box.replaceChildren(h('div', { class: 'g-row g-mb8', style: 'justify-content:space-between' }, h('button', { class: 'g-link', type: 'button', onclick: home, text: '← Back' }), G.badge('Simulated sources', '')),
        h('p', { class: 'sm muted', style: 'margin:0 0 12px', text: 'Connect a source (simulated) — or upload existing data instead. No external accounts are accessed.' }),
        h('div', { class: 'g-srcgrid' }, PICK.map(([id, label]) => h('button', { class: 'g-srccard', type: 'button', onclick: () => { it.close(); G.connectFlow(cnOf(id)); } }, h('b', { text: label }), h('span', { class: 'xs muted', text: 'Connect source' })))),
        h('div', { class: 'g-row g-mt16' }, G.btn('Upload CSV', () => { it.close(); G.csvWizard(); }), G.btn('Enter manually', () => { it.close(); G.manualModal(); }), G.btn('Manual data upload', () => { it.close(); G.csvWizard(); })));
    }
    start === 'connect' ? picker() : home();
    it = G.modal({ title: 'Add your data', sub: 'Connect a source, upload a CSV, or explore with demo data.', body: box, wide: true });
    return it;
  };

  /* ---------- manual entry ---------- */
  const MAN = { ad: ['Campaign', ['campaign', 'channel', 'spend', 'impressions', 'clicks', 'signups', 'customers', 'revenue']], creator: ['Creator', ['creator', 'platform', 'campaign', 'views', 'clicks', 'signups', 'customers', 'spend', 'revenue']], lead: ['Lead', ['name', 'company', 'email', 'source', 'stage', 'score']], pipeline: ['Deal', ['company', 'value', 'stage', 'source', 'owner']] };
  G.manualModal = (type) => {
    type = type || 'ad'; let it; const box = h('div');
    function draw() {
      const T = G.TYPES[type], keys = MAN[type][1], form = G.form(keys.map((k) => ({ k, label: T.fields[k][0] + (T.required.includes(k) ? ' *' : ''), type: T.fields[k][1] === 'num' ? 'number' : 'text', val: k === 'stage' ? (type === 'lead' ? 'New' : 'Proposal') : '' })));
      const sel = G.sel(Object.keys(MAN).map((k) => ({ v: k, l: MAN[k][0] })), type, (v) => { type = v; draw(); }, 'Record type');
      box.replaceChildren(h('div', { class: 'g-field' }, h('label', { text: 'What are you adding?' }), sel), form.el, h('div', { class: 'g-row g-mt16', style: 'justify-content:flex-end' }, G.btn('Cancel', () => it.close()), G.btn('Add record', () => {
        const v = form.get(), rec = {}; let bad = '';
        keys.forEach((k) => { const raw = (v[k] || '').trim(); if (raw === '') { if (T.required.includes(k)) bad = T.fields[k][0]; return; } if (T.fields[k][1] === 'num') { const n = G.imp.num(raw); if (Number.isNaN(n)) bad = T.fields[k][0] + ' must be a number'; else rec[k] = n; } else rec[k] = raw; });
        if (bad) return G.toast(bad.includes('must') ? bad : bad + ' is required', { tone: 'bad' });
        if (type === 'ad') { rec.date = rec.date || G.END; rec.channel = rec.channel || G.guessChannel(rec.campaign) || 'Unassigned'; }
        if (type === 'lead') rec.signup_date = G.END;
        it.close(); finishCommit(type, 'Manual entry', [rec], { manual: true }, () => { G.toast(MAN[type][0] + ' added'); G.refreshAll({ ad: 'campaigns', creator: 'creators', lead: 'leads', pipeline: 'pipeline' }[type]); });
      }, 'pri')));
    }
    draw(); it = G.modal({ title: 'Enter data manually', sub: 'Adds one record to ' + ws().name + '. It appears on the matching page straight away.', body: box }); return it;
  };

  /* Commit rows; a demo workspace switches to your own data so it is visible. */
  function finishCommit(type, name, rows, meta, done) {
    const w = ws(); let was = false;
    if (G.WS.mode() === 'demo') { was = true; w.demo = false; }
    const imp = G.imp.commit(w.id, type, name, rows, meta);
    if (was) G.toast('Demo data turned off so your data shows. You can turn it back on from the top bar.');
    done && done(imp);
    return imp;
  }

  /* ================= SIMULATED CONNECTOR ================= */
  G.connectFlow = (cn, onDone) => {
    if (cn.kind === 'csv') return G.csvWizard({ type: cn.csvType, onDone });
    let it; const box = h('div'); const accounts = [cn.name + ' · Main account', cn.name + ' · India market'];
    let acct = accounts[0];
    const head = (i) => stepper(['Authorize', 'Account', 'Sync', 'Done'], i);
    function s1() {
      box.replaceChildren(head(0), h('div', { class: 'g-card', style: 'margin-top:12px' }, h('div', { class: 'g-row', style: 'justify-content:space-between' }, h('b', { text: cn.name }), G.badge('Simulated source', 'amber')), h('p', { class: 'sm muted', style: 'margin:8px 0 0', text: 'This prototype does not contact ' + cn.name + '. Connecting loads realistic, deterministic sample data so you can see how Growth OS behaves with it.' }), h('div', { class: 'xs muted g-mt8', text: 'Would import: ' + cn.uses })),
        h('div', { class: 'g-row g-mt16', style: 'justify-content:flex-end' }, G.btn('Cancel', () => it.close()), G.btn('Authorize (simulated)', s2, 'pri')));
    }
    function s2() {
      const sel = G.sel(accounts, acct, (v) => (acct = v), 'Account');
      box.replaceChildren(head(1), h('div', { class: 'g-field', style: 'margin-top:12px' }, h('label', { text: 'Choose an account' }), sel, h('div', { class: 'xs muted', text: 'Read-only access. Sample accounts only.' })), h('div', { class: 'g-row g-mt16', style: 'justify-content:flex-end' }, G.btn('Back', s1), G.btn('Start sync', s3, 'pri')));
    }
    function s3() {
      const bar = h('div', { class: 'g-bar' }, h('i', { style: 'width:4%' })), txt = h('div', { class: 'sm muted', text: 'Connecting…' });
      box.replaceChildren(head(2), h('div', { class: 'g-mt16' }, txt, h('div', { class: 'g-mt8' }, bar)));
      const steps = ['Connecting…', 'Pulling the last 90 days…', 'Normalising fields…', 'Checking the data…']; let i = 0;
      const t = setInterval(() => { i++; bar.firstChild.style.width = Math.min(100, i * 26) + '%'; txt.textContent = steps[Math.min(i, steps.length - 1)]; if (i >= 4) { clearInterval(t); s4(); } }, 380);
    }
    function s4() {
      const sim = G.simulate(cn, profFor()), valid = sim.rows.length;
      const dates = sim.rows.map((r) => r.date || r.signup_date).filter(Boolean).sort();
      const prior = ws().imports.filter((i) => i.connector === cn.id).map((i) => i.id); prior.forEach((id) => G.imp.remove(ws().id, id));
      finishCommit(sim.type, cn.name, sim.rows, { sim: true, connector: cn.id, fileName: acct, dateFrom: dates[0], dateTo: dates[dates.length - 1] });
      const camps = new Set(sim.rows.map((r) => r.campaign).filter(Boolean)), chs = new Set(sim.rows.map((r) => r.channel || r.source).filter(Boolean));
      box.replaceChildren(head(3), h('div', { class: 'g-ok' }, h('span', { class: 'g-ok-ic', text: '✓' }), h('div', null, h('b', { text: cn.name + ' connected (simulated)' }), h('div', { class: 'sm muted', text: F.n(valid) + ' rows imported · ' + (dates.length ? dates[0] + ' to ' + dates[dates.length - 1] + ' · ' : '') + '100% valid' }))),
        h('div', { class: 'g-stats g-mt16' }, [['Rows', F.n(valid)], ['Campaigns', camps.size || '—'], ['Channels', chs.size || '—']].map(([k, v]) => h('div', null, h('small', { text: k }), h('b', { text: String(v) })))),
        h('div', { class: 'g-row g-mt16', style: 'justify-content:flex-end' }, G.btn('Connect another', () => { it.close(); G.addDataModal('connect'); }), G.btn('View Growth Dashboard', () => { it.close(); G.refreshAll('home'); onDone && onDone(); }, 'pri')));
    }
    s1(); it = G.modal({ title: 'Connect ' + cn.name, sub: 'Demo connection · no external API is called', body: box }); return it;
  };

  /* ================= CSV WIZARD ================= */
  G.csvWizard = (o) => {
    o = o || {}; let it;
    const st = { step: 0, name: '', parsed: null, type: o.type || null, map: {}, res: null, err: '' };
    const box = h('div'); const LAB = ['Upload', 'Type', 'Map columns', 'Data check', 'Done'];
    const head = () => stepper(LAB, st.step);
    const nav = (back, next, nextLabel, disabled, extra) => h('div', { class: 'g-row g-mt16', style: 'justify-content:space-between' }, back ? G.btn('Back', back) : G.btn('Cancel', () => it.close()), h('div', { class: 'g-row' }, extra || null, next ? h('button', { class: 'g-btn pri', type: 'button', onclick: next, text: nextLabel || 'Continue', disabled: disabled ? true : null }) : null));
    function load(name, text) {
      const parsed = G.csv.parse(text);
      if (!parsed.cols.length || !parsed.rows.length) { st.err = 'We couldn’t find any rows in that file. Check that it is a CSV with a header row.'; return draw(); }
      st.err = ''; st.name = name; st.parsed = parsed; if (!st.type) st.type = G.imp.guessType(parsed.cols); st.suggested = G.imp.guessType(parsed.cols); st.step = 1; draw();
    }
    function s0() {
      const file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv', style: 'display:none', onchange: (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => load(f.name, String(r.result)); r.onerror = () => { st.err = 'That file could not be read.'; draw(); }; r.readAsText(f); } });
      const dz = h('div', { class: 'g-drop', tabindex: '0', role: 'button', 'aria-label': 'Drop a CSV here or choose a file', onclick: () => file.click(), onkeydown: (e) => { if (e.key === 'Enter') file.click(); },
        ondragover: (e) => { e.preventDefault(); dz.classList.add('on'); }, ondragleave: () => dz.classList.remove('on'),
        ondrop: (e) => { e.preventDefault(); dz.classList.remove('on'); const f = e.dataTransfer && e.dataTransfer.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => load(f.name, String(r.result)); r.readAsText(f); } },
        h('div', { class: 'g-drop-ic', text: '⇪' }), h('b', { text: 'Drop CSV here' }), h('div', { class: 'muted sm', text: 'or' }), G.btn('Choose file', (e) => { e.stopPropagation(); file.click(); }, 'pri'), file);
      box.replaceChildren(head(), h('h3', { style: 'margin:16px 0 8px', text: 'Upload your file' }), dz, st.err ? h('div', { class: 'g-warn g-mt8', text: st.err }) : null,
        h('div', { class: 'g-row g-mt16', style: 'justify-content:space-between' }, h('div', { class: 'sm' }, 'Don’t know which format to use? ', h('button', { class: 'g-link', type: 'button', onclick: () => G.download('growthos-sample-' + (st.type || 'ad') + '.csv', G.sampleCsv(st.type || 'ad'), 'text/csv'), text: 'Download sample CSV' })),
          h('button', { class: 'g-link', type: 'button', onclick: () => { st.type = 'ad'; load('sample-campaigns-with-errors.csv', G.messyCsv()); }, text: 'Try a sample file with errors' })), nav(null, null));
    }
    function s1() {
      const ORDER = G.TYPE_ORDER;
      box.replaceChildren(head(), h('div', { class: 'sm muted g-mt8' }, 'File: ', h('b', { text: st.name }), ' · ' + F.n(st.parsed.rows.length) + ' rows · ' + st.parsed.cols.length + ' columns'), h('h3', { style: 'margin:12px 0 8px', text: 'What does this data represent?' }),
        h('div', { class: 'g-typegrid' }, ORDER.map((t) => h('button', { class: 'g-opt' + (st.type === t ? ' on' : ''), type: 'button', onclick: () => { st.type = t; st.map = G.imp.suggest(t, st.parsed.cols); draw(); } }, h('div', null, h('b', { text: t === 'ad' ? 'Campaign / ad performance' : G.TYPES[t].label }), t === st.suggested ? h('span', { style: 'margin-left:8px' }, G.badge('Suggested', 'green')) : null, h('div', { class: 'xs muted', text: G.TYPES[t].desc }))))),
        nav(() => { st.step = 0; draw(); }, () => { st.map = G.imp.suggest(st.type, st.parsed.cols); st.step = 2; draw(); }, 'Continue', !st.type));
    }
    function s2() {
      const T = G.TYPES[st.type], fields = Object.keys(T.fields), cols = st.parsed.cols, colOf = (f) => st.map[f];
      const fieldFor = (c) => fields.find((f) => st.map[f] === c) || '';
      const mapped = Object.keys(st.map).filter((k) => st.map[k]).length, optional = fields.filter((f) => !T.required.includes(f) && !st.map[f]).length, missReq = T.required.filter((f) => !st.map[f]);
      const rows = cols.map((c) => {
        const sel = h('select', { class: 'g-select', 'aria-label': 'Growth OS field for ' + c, onchange: (e) => { fields.forEach((f) => { if (st.map[f] === c) delete st.map[f]; }); if (e.target.value) st.map[e.target.value] = c; draw(); } }, h('option', { value: '', text: '— Ignore this column —' }), fields.map((f) => h('option', { value: f, selected: fieldFor(c) === f ? true : null, text: T.fields[f][0] + (T.required.includes(f) ? ' *' : '') })));
        return h('tr', { class: 'row' }, h('td', null, h('code', { text: c })), h('td', { class: 'muted xs' }, (st.parsed.rows[0] || {})[c] || '—'), h('td', { class: 'muted', text: '→' }), h('td', null, sel), h('td', null, fieldFor(c) ? G.badge('Mapped', 'green') : G.badge('Ignored', '')));
      });
      box.replaceChildren(head(), h('h3', { style: 'margin:16px 0 4px', text: 'Map your columns' }), h('p', { class: 'sm muted', style: 'margin:0 0 8px', text: 'Left: your CSV column. Right: the Growth OS field. We suggested a match for each column we recognised.' }),
        h('div', { class: 'g-tblwrap', style: 'max-height:300px;overflow:auto' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, ['CSV column', 'Example', '', 'Growth OS field', ''].map((t) => h('th', { text: t })))), h('tbody', null, rows))),
        h('div', { class: 'g-row g-mt8', style: 'justify-content:space-between' }, h('b', { text: mapped + ' fields mapped · ' + optional + ' fields optional' }), missReq.length ? h('span', { class: 'g-warn', text: 'Required: ' + missReq.map((f) => T.fields[f][0]).join(', ') }) : G.badge('Required fields mapped', 'green')),
        nav(() => { st.step = 1; draw(); }, () => { st.res = G.imp.validate(st.type, st.parsed, st.map); st.step = 3; draw(); }, 'Continue', missReq.length));
    }
    function s3() {
      const r = st.res, T = G.TYPES[st.type], issues = Object.entries(r.issues);
      const recs = r.valid, dates = recs.map((x) => x.date || x.signup_date).filter(Boolean).sort(), camps = new Set(recs.map((x) => x.campaign).filter(Boolean)), chs = new Set(recs.map((x) => x.channel || x.platform || x.source).filter(Boolean));
      const ok = r.nValid > 0 && !issues.length, none = r.nValid === 0;
      const cols = Object.keys(st.map).filter((k) => st.map[k]).slice(0, 7);
      box.replaceChildren(head(), h('h3', { style: 'margin:16px 0 8px', text: 'Data check' }),
        h('div', { class: 'g-stats' }, [[F.n(r.total) + ' rows detected', ''], [r.pct + '% successfully mapped', ''], [F.n(r.nValid) + ' valid rows ready', '']].map(([v]) => h('div', null, h('b', { text: v })))),
        h('div', { class: 'g-row g-mt8' }, none ? G.badge('No valid rows — fix the mapping', 'red') : ok ? G.badge('✓ Data looks good', 'green') : G.badge('⚠ ' + (r.total - r.nValid) + ' rows will be skipped', 'amber')),
        issues.length ? h('ul', { class: 'g-ul g-mt8' }, issues.map(([k, n]) => h('li', { text: /Duplicate/.test(k) ? n + ' duplicate record' + (n > 1 ? 's' : '') : n + ' row' + (n > 1 ? 's' : '') + ' · ' + k.toLowerCase() }))) : null,
        h('div', { class: 'sm g-mt8 muted' }, [dates.length ? 'Date range ' + dates[0] + ' → ' + dates[dates.length - 1] : 'No dates found', camps.size ? camps.size + ' campaigns' : null, chs.size ? chs.size + ' channels/sources' : null, r.missingOptional.length ? 'Missing optional: ' + r.missingOptional.slice(0, 4).join(', ') + (r.missingOptional.length > 4 ? '…' : '') : 'No optional fields missing', r.dup ? r.dup + ' duplicates removed' : '0 duplicates'].filter(Boolean).join(' · ')),
        h('div', { class: 'g-tblwrap g-mt8', style: 'max-height:180px;overflow:auto' }, h('table', { class: 'g-tbl' }, h('thead', null, h('tr', null, cols.map((k) => h('th', { text: T.fields[k][0] })))), h('tbody', null, recs.slice(0, 6).map((x) => h('tr', { class: 'row' }, cols.map((k) => h('td', { class: 'xs', text: x[k] == null ? '—' : typeof x[k] === 'number' ? F.n(x[k]) : String(x[k]) }))))))),
        h('div', { class: 'g-row g-mt16', style: 'justify-content:space-between' }, G.btn('Fix mapping', () => { st.step = 2; draw(); }), h('div', { class: 'g-row' }, G.btn('Cancel', () => it.close()), h('button', { class: 'g-btn pri', type: 'button', disabled: none ? true : null, onclick: s4, text: issues.length ? 'Import valid rows' : 'Import into Growth OS' }))));
    }
    function s4() {
      const r = st.res, imp = finishCommit(st.type, st.name.replace(/\.[a-z]+$/i, ''), r.valid, { fileName: st.name, map: Object.assign({}, st.map), skipped: r.total - r.nValid, csv: true });
      st.step = 4; const k = {}; (G.rows('kpis') || []).filter((x) => x.range === '30d').forEach((x) => (k[x.metric] = x.value));
      const camps = new Set((G.rows('campaigns') || []).map((c) => c.cid)).size, chs = new Set((G.rows('channels') || []).map((c) => c.channel)).size;
      const items = [['Campaigns', camps], ['Channels', chs], ['Creators', new Set((G.rows('creators') || []).map((c) => c.key)).size], ['Leads', (G.rows('leads') || []).length], ['Customers', k.customers || 0], ['Revenue', k.revenue ? F.inr(k.revenue) : '—']];
      box.replaceChildren(head(), h('div', { class: 'g-ok g-mt16' }, h('span', { class: 'g-ok-ic', text: '✓' }), h('div', null, h('b', { style: 'font-size:18px', text: 'Your growth data is ready.' }), h('div', { class: 'sm muted', text: F.n(r.nValid) + ' rows imported from ' + st.name + (r.total - r.nValid ? ' · ' + (r.total - r.nValid) + ' skipped' : '') }))),
        h('div', { class: 'g-stats six g-mt16' }, items.map(([a, v]) => h('div', null, h('small', { text: a }), h('b', { text: typeof v === 'number' ? F.n(v) : String(v) })))),
        h('div', { class: 'g-row g-mt16', style: 'justify-content:flex-end' }, G.btn('Add more data', () => { it.close(); G.addDataModal(); }), G.btn('Open Growth OS', () => { it.close(); G.refreshAll('home'); o.onDone && o.onDone(); }, 'pri')));
    }
    function draw() { [s0, s1, s2, s3, s4][st.step](); }
    draw(); it = G.modal({ title: 'Upload a CSV', sub: 'Upload → type → map → check → import. Bad rows are never imported silently.', body: box, wide: true });
    return it;
  };

  /* ================= SOURCE DETAIL ================= */
  const AVAIL = { Ads: ['Spend', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'Campaign', 'Ad set', 'Creative'], Analytics: ['Sessions', 'Visitors', 'Signups', 'Activation events', 'Traffic source'], CRM: ['Leads', 'Stages', 'Owners', 'Deals', 'Pipeline value'], Social: ['Posts', 'Views', 'Engagement', 'Link clicks'], Creators: ['Views', 'Clicks', 'Signups', 'Payouts', 'Tracked links'], Revenue: ['Payments', 'Customers', 'Revenue by source'] };
  G.sourceDetail = (d) => {
    const w = ws(), imp = w.imports.find((i) => i.id === d.id), kind = d.kind || 'Ads';
    const cur = Object.assign({}, d, S.local.ds[d.id] || {});
    const cov = imp && imp.dateFrom ? imp.dateFrom + ' — ' + imp.dateTo : imp ? (() => { const ds = imp.rows.map((r) => r.date || r.signup_date).filter(Boolean).sort(); return ds.length ? ds[0] + ' — ' + ds[ds.length - 1] : 'No dates in file'; })() : '1 Aug — 28 Oct 2026';
    const avail = imp ? (imp.map ? Object.keys(imp.map).map((k) => G.TYPES[imp.type].fields[k] ? G.TYPES[imp.type].fields[k][0] : k) : (AVAIL[kind] || AVAIL[imp.type === 'ad' ? 'Ads' : 'CRM'] || [])) : AVAIL[kind] || AVAIL.Ads;
    const label = imp ? (imp.sim ? 'Simulated source' : imp.manual ? 'Manual entry' : 'CSV import') : 'Demo connection';
    const row = (k, v) => h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap;padding:8px 0;border-bottom:1px solid var(--g-line-2)' }, h('span', { class: 'muted', text: k }), h('b', { class: 'num', text: v }));
    let dr;
    const body = h('div', null,
      h('div', { class: 'g-row', style: 'justify-content:space-between' }, G.statusBd(cur.status), G.badge(label, 'amber')),
      h('div', { class: 'g-mt8' }, row('Last synced', cur.syncing ? 'Syncing…' : ago(cur.last_sync_s || 0)), row('Records', F.n(imp ? imp.count : cur.records)), row('Date coverage', cov), row('Account', imp ? imp.fileName || imp.name : cur.account), row('Sync', imp ? (imp.sim ? 'Simulated · manual' : 'One-time import') : cur.sync)),
      h('div', { class: 'g-sig-k g-mt16', text: 'Data available' }), h('div', { class: 'g-row g-mt8' }, avail.map((a) => h('span', { class: 'g-chip on', style: 'cursor:default', text: a }))),
      h('div', { class: 'xs muted g-mt16', text: label === 'Demo connection' ? 'This is a demo connection. No external account is connected.' : 'Prototype: this does not contact an external service.' }));
    dr = G.drawer({ title: d.name, sub: kind + ' · ' + label, body, footer: (close) => [
      G.btn('Disconnect', () => G.confirm({ title: 'Disconnect ' + d.name + '?', text: imp ? 'Its ' + F.n(imp.count) + ' records will be removed from ' + w.name + '.' : 'Demo sources cannot be disconnected. Turn Demo Data off to remove them.', confirm: imp ? 'Disconnect' : 'OK', danger: !!imp, onConfirm: () => { if (imp) { G.imp.remove(w.id, imp.id); close(); G.toast(d.name + ' disconnected'); G.refreshAll(); } } }), 'danger'),
      G.btn('Edit mapping', () => { close(); if (imp && imp.csv) G.toast('Re-upload the file to change its mapping. Your current mapping stays until then.'); else G.toast(imp ? 'Fields are mapped automatically for simulated sources.' : 'Demo sources use the default mapping.'); }),
      G.btn('Sync now', () => { if (imp) { imp.at = Date.now(); } S.local.ds[d.id] = { syncing: true, status: 'Syncing', last_sync_s: 0 }; close(); G.rerender(); setTimeout(() => { S.local.ds[d.id] = { status: 'Connected', last_sync_s: 0, sync: imp ? 'Synced just now (simulated)' : 'Healthy · synced just now' }; G.toast(d.name + ' synced (simulated)'); G.rerender(); }, 900); }, 'pri')] });
    return dr;
  };

  /* ================= DATA SOURCES PAGE ================= */
  G.page('datasources', {
    ds: [],
    build(root, opts) {
      const head = G.head('Setup', 'Data Sources', 'Connect the sources that power your campaigns, attribution, leads and revenue.', [G.btn('+ Add data', () => G.addDataModal(), 'pri')]);
      const body = h('div');
      root.append(head, body);
      function update() {
        const m = mode(), w = ws(), list = G.sourceList(), hl = G.dataHealth(), connected = new Set(w.imports.map((i) => i.connector).filter(Boolean));
        const demoCard = G.card(null, null, h('div', { class: 'g-row', style: 'justify-content:space-between;gap:16px' }, h('div', { style: 'min-width:0;flex:1 1 280px' }, h('div', { class: 'g-eyebrow', text: 'WANT TO EXPLORE FIRST?' }), h('div', { style: 'font-size:17px;font-weight:600', text: 'Use Growth OS Demo Data' }), h('div', { class: 'sm muted', text: 'Load a fully populated company in one click. Wispr Flow — India GTM is the default.' })), h('div', { class: 'g-row' }, G.btn('Load Demo Workspace', () => G.demoChooser(), 'pri'), m === 'demo' ? G.btn('Turn demo off', () => { G.WS.setDemo(false); G.refreshAll(); }) : null)));
        const pipe = G.card('How your data becomes decisions', 'Every Radar insight is computed from the active workspace — nothing is hard-coded.', chain(['Imported data', 'Normalized metrics', 'Campaign / channel / creator calculations', 'GTM Radar', 'Recommendations', 'Simulation', 'Action', 'Updated projected outcome']));
        const empty = m === 'empty' ? G.card(null, null, h('div', { class: 'g-hero-empty', style: 'padding:24px 8px' }, h('h2', { text: 'Your Growth OS isn’t connected yet.' }), h('p', { class: 'muted', text: 'Connect your first data source to start tracking:' }), chain(['Spend', 'Traffic', 'Signups', 'Activation', 'Leads', 'Revenue']), h('div', { class: 'g-row', style: 'justify-content:center;gap:10px;margin-top:16px' }, G.btn('Connect data', () => G.addDataModal('connect'), 'pri'), G.btn('Upload CSV', () => G.csvWizard()), G.btn('Use demo data', () => G.demoChooser())))) : null;
        const health = G.card('DATA HEALTH', hl.overall == null ? 'Connect data to see health' : 'Overall: ' + hl.overall + '%', h('div', null, hl.overall != null ? h('div', { class: 'g-row g-mb8', style: 'align-items:baseline;gap:10px' }, h('span', { class: 'g-score num', text: hl.overall + '%' }), G.pbar(hl.overall, hl.overall >= 90 ? '' : 'amber')) : null, hl.rows.map((r) => h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap;padding:7px 0;border-bottom:1px solid var(--g-line-2)' }, h('span', { text: r.name }), h('span', { class: 'g-row', style: 'gap:8px' }, h('span', { class: 'xs muted', text: r.st === 'none' ? '' : r.note }), stBadge(r.st))))));
        const srcs = G.card('Connected sources', list.length ? list.filter((d) => d.status === 'Connected' || d.status === 'Syncing').length + ' of ' + list.length + ' healthy' : 'Nothing connected yet', list.length ? h('div', null, list.map((d) => h('button', { class: 'g-srcrow', type: 'button', onclick: () => G.sourceDetail(d) }, h('div', { style: 'min-width:0;text-align:left' }, h('b', { text: d.name }), h('div', { class: 'xs muted', text: (d.kind || '') + ' · ' + (d.demo || m === 'demo' ? 'Demo connection' : d.sim ? 'Simulated source' : 'CSV import') + ' · ' + F.n(d.records) + ' records' })), h('div', { class: 'g-row', style: 'gap:8px;flex-wrap:nowrap' }, h('span', { class: 'xs muted', style: 'white-space:nowrap', text: d.syncing ? 'Syncing…' : 'Last sync ' + ago(d.last_sync_s || 0) }), G.statusBd(d.status))))) : G.empty('⛁', 'No sources yet', 'Connect a source or upload a CSV to see it here.', G.btn('+ Add data', () => G.addDataModal(), 'pri')));
        const cat = h('div', null, G.CONNECTORS.map((g) => h('div', { class: 'g-mb16' }, h('div', { class: 'g-sig-k', text: g.group }), h('div', { class: 'g-srcgrid g-mt8' }, g.items.map((cn) => {
          const on = connected.has(cn.id);
          return h('button', { class: 'g-srccard' + (on ? ' on' : ''), type: 'button', onclick: () => (on ? G.sourceDetail(list.find((d) => d.id === cn.id) || { id: cn.id, name: cn.name, kind: 'Ads' }) : G.connectFlow(cn)) }, h('div', { class: 'g-row', style: 'justify-content:space-between;flex-wrap:nowrap;width:100%' }, h('b', { text: cn.name }), on ? G.badge('Connected', 'green') : null), h('span', { class: 'xs muted', style: 'text-align:left', text: cn.uses }), h('span', { class: 'xs', style: 'color:var(--g-em)', text: on ? 'View details' : cn.kind === 'csv' ? 'Upload CSV' : 'Connect (simulated)' }));
        })))));
        body.replaceChildren(h('div', { class: 'g-gap16' }, empty, demoCard, h('div', { class: 'g-grid' }, h('div', { class: 's5' }, health), h('div', { class: 's7' }, srcs)), pipe, G.sec('Connect your growth data', 'Source cards are simulated: connecting loads realistic sample data. No external API is contacted.'), cat));
      }
      update();
      return { update };
    },
  });

  /* ================= ONBOARDING ================= */
  G.onboarding = (opts) => {
    opts = opts || {};
    let it, step = 0; const box = h('div'); const LAB = ['Company', 'Data', 'Growth model', 'Open'];
    const d = { name: opts.name || '', website: '', type: 'SaaS', ws: null, objType: 'revenue', target: '' };
    const nav = (back, next, label, dis) => h('div', { class: 'g-row g-mt16', style: 'justify-content:space-between' }, back ? G.btn('Back', back) : G.btn('Skip for now', () => it.close()), next ? h('button', { class: 'g-btn pri', type: 'button', disabled: dis ? true : null, onclick: next, text: label || 'Continue' }) : null);
    function s0() {
      const form = G.form([{ k: 'name', label: 'Company name', val: d.name, ph: 'e.g. Acme' }, { k: 'website', label: 'Website', val: d.website, ph: 'acme.com' }, { k: 'type', label: 'Company type', type: 'select', opts: ['B2B', 'B2C', 'Developer', 'SaaS', 'E-commerce'], val: d.type }]);
      box.replaceChildren(stepper(LAB, 0), h('div', { class: 'g-hero-empty', style: 'padding:16px 0 8px' }, h('h2', { text: 'Welcome to Growth OS' }), h('p', { class: 'muted', style: 'margin:4px 0 0', text: 'Turn your GTM data into decisions.' })), h('h3', { style: 'margin:12px 0 8px', text: 'Tell us about your company' }), form.el,
        nav(null, () => { const v = form.get(); if (!v.name.trim()) return G.toast('Add your company name first', { tone: 'bad' }); Object.assign(d, v); if (!d.ws) { const w = G.WS.add({ name: d.name.trim(), sub: d.type, type: d.type, company: { website: d.website, type: d.type } }); d.ws = w; } else { d.ws.name = d.name.trim(); d.ws.company.name = d.name.trim(); d.ws.company.website = d.website; d.ws.company.type = d.type; } G.WS.set(d.ws.id); G.wsBump(); G.WS.save(); G.updateChrome && G.updateChrome(); step = 1; draw(); }, 'Continue'));
    }
    function s1() {
      const n = d.ws.imports.length, m = mode();
      box.replaceChildren(stepper(LAB, 1), h('h3', { style: 'margin:16px 0 4px', text: 'Connect your data' }), h('p', { class: 'sm muted', style: 'margin:0 0 12px', text: 'Pick one way to start. You can add more later from Data Sources.' }),
        h('div', { class: 'g-gap8' },
          h('button', { class: 'g-opt big', type: 'button', onclick: () => G.addDataModal('connect') }, h('span', { class: 'g-opt-ic', text: '⇄' }), h('div', null, h('b', { text: 'Connect a source' }), h('div', { class: 'sm muted', text: 'Simulated connectors with realistic sample data' })), h('span', { class: 'muted', text: '→' })),
          h('button', { class: 'g-opt big', type: 'button', onclick: () => G.csvWizard({ onDone: () => { step = 2; draw(); } }) }, h('span', { class: 'g-opt-ic', text: '⇪' }), h('div', null, h('b', { text: 'Upload a CSV' }), h('div', { class: 'sm muted', text: 'Map your columns and check the data before import' })), h('span', { class: 'muted', text: '→' })),
          h('button', { class: 'g-opt big', type: 'button', onclick: () => G.demoChooser(() => { step = 2; draw(); }) }, h('span', { class: 'g-opt-ic', text: '◐' }), h('div', null, h('b', { text: 'Use demo data' }), h('div', { class: 'sm muted', text: 'Explore a fully populated company first' })), h('span', { class: 'muted', text: '→' }))),
        m !== 'empty' ? h('div', { class: 'g-ok g-mt16' }, h('span', { class: 'g-ok-ic', text: '✓' }), h('div', null, h('b', { text: m === 'demo' ? 'Demo data loaded' : n + ' source' + (n === 1 ? '' : 's') + ' connected' }))) : null,
        nav(() => { step = 0; draw(); }, () => { step = 2; draw(); }, m === 'empty' ? 'Continue without data' : 'Continue'));
    }
    function s2() {
      const k = {}; (G.rows('kpis') || []).filter((x) => x.range === '30d').forEach((x) => (k[x.metric] = x.value));
      const chs = (G.rows('channels') || []).filter((c) => c.range === '30d' && (c.spend > 0 || c.signups > 0)).map((c) => c.channel);
      const form = G.form([{ k: 'objType', label: 'Primary growth objective', type: 'select', opts: OBJ.map(([v, l]) => ({ v, l })), val: d.objType }, { k: 'target', label: 'Target (₹ or number)', val: d.target, ph: k.revenue ? 'e.g. ' + F.inr(k.revenue * 1.2) : 'e.g. 5L', hint: 'Optional — you can set this later on Home.' }]);
      box.replaceChildren(stepper(LAB, 2), h('h3', { style: 'margin:16px 0 4px', text: 'Review your growth model' }), h('p', { class: 'sm muted', style: 'margin:0 0 12px', text: 'This is how Growth OS reads ' + d.name + '.' }),
        h('div', { class: 'g-card' }, chain(['Spend ' + (k.spend ? F.inr(k.spend) : '—'), 'Signups ' + (k.signups ? F.n(k.signups) : '—'), 'Activated ' + (k.activated ? F.n(k.activated) : '—'), 'Customers ' + (k.customers ? F.n(k.customers) : '—'), 'Revenue ' + (k.revenue ? F.inr(k.revenue) : '—')], true), h('div', { class: 'sm muted g-mt8', text: chs.length ? 'Channels detected: ' + chs.join(', ') : 'No channels yet — they appear as soon as you import data.' })), h('div', { class: 'g-mt16' }, form.el),
        nav(() => { step = 1; draw(); }, () => { const v = form.get(); d.objType = v.objType; d.target = v.target; const t = G.imp.num(v.target); if (t && !Number.isNaN(t)) G.WS.active().objective = { type: v.objType, target: t, deadline: G.addDays(G.END, 4) }; G.WS.save(); step = 3; draw(); }, 'Continue'));
    }
    function s3() {
      box.replaceChildren(stepper(LAB, 3), h('div', { class: 'g-hero-empty', style: 'padding:24px 0' }, h('div', { class: 'g-he-ic', text: '✓' }), h('h2', { text: 'Your Growth Command Center is ready' }), h('p', { class: 'muted', text: mode() === 'empty' ? 'It will fill in as soon as you connect data. Everything is set up for ' + d.name + '.' : 'Dashboards, GTM Radar and recommendations now use ' + d.name + '’s data.' }), G.btn('Open Growth Command Center', () => { it.close(); G.refreshAll('home'); }, 'pri')));
    }
    function draw() { [s0, s1, s2, s3][step](); }
    draw(); it = G.modal({ title: 'Set up your company', sub: 'Four short steps. Under two minutes.', body: box, wide: true, onClose: () => { G.updateChrome && G.updateChrome(); } });
    return it;
  };
  const OBJ = [['signups', 'Increase qualified signups'], ['activated', 'Increase activated users'], ['cac', 'Reduce CAC'], ['revenue', 'Increase revenue'], ['pipeline', 'Increase pipeline'], ['activation', 'Improve activation'], ['market', 'Enter a new market']];
  G.OBJ = OBJ;
})();
