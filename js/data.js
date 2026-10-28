(function () {
  'use strict';
  /* ===================================================================
     Growth OS data layer
     Imported data → normalized records → growth metrics → (engine) Radar.
     Every page reads datasets through G.rows(); this file decides which
     dataset the active workspace sees: the Wispr Flow base, a generated
     demo workspace, data derived from the user's imports, or nothing.
     =================================================================== */
  const G = window.G, S = G.S;
  const RAW = G.rows;
  G.rawRows = RAW;
  const LS = 'growthos.v3';

  /* ---------- workspace store ---------- */
  const DEFAULT = () => ({
    active: 'wispr', theme: '', objective: null,
    list: [
      { id: 'wispr', name: 'Wispr Flow', sub: 'India GTM', base: 'wispr', demo: true, company: { name: 'Wispr Flow', product: 'Wispr Flow', website: 'wisprflow.ai', industry: 'Voice productivity software', market: 'India', audience: 'Knowledge workers, founders, developers and students', channels: 'Creators, Google Ads, Referral, LinkedIn', revenueTarget: 7500000, signupTarget: 9600, activationTarget: 65, cacTarget: 3500, growthTarget: 15 }, imports: [], sources: {}, rev: 0 },
      { id: 'acme', name: 'Acme', sub: 'Production', base: null, demo: false, company: { name: 'Acme', product: 'Acme Platform', website: 'acme.example', industry: 'B2B SaaS', market: 'India + US', audience: 'Mid-market operations teams', channels: 'Google Ads, LinkedIn', revenueTarget: 4000000, signupTarget: 2000, activationTarget: 55, cacTarget: 12000, growthTarget: 10 }, imports: [], sources: {}, rev: 0 },
      { id: 'startup', name: 'Startup Demo', sub: 'Seed-stage SaaS', base: 'saas', demo: true, company: { name: 'Startup Demo', product: 'Loop', website: 'loop.example', industry: 'SaaS', market: 'Global', audience: 'Small teams', channels: 'Google Ads, Meta, Referral', revenueTarget: 1200000, signupTarget: 3000, activationTarget: 45, cacTarget: 2500, growthTarget: 12 }, imports: [], sources: {}, rev: 0 },
    ],
  });
  let ST = DEFAULT();
  try {
    const x = JSON.parse(localStorage.getItem(LS) || 'null');
    if (x && x.list && x.list.length) { ST = x; }
  } catch (e) { /* storage unavailable */ }
  const persist = () => {
    try {
      // imported rows can be large: store the workspace list without them if the payload is too big
      let s = JSON.stringify(ST);
      if (s.length > 2.5e6) { const lite = JSON.parse(s); lite.list.forEach((w) => (w.imports = [])); s = JSON.stringify(lite); }
      localStorage.setItem(LS, s);
    } catch (e) { /* ignore */ }
  };
  G.WS = {
    st: () => ST,
    active: () => ST.list.find((w) => w.id === ST.active) || ST.list[0],
    list: () => ST.list,
    save: persist,
    set(id) { if (!ST.list.find((w) => w.id === id)) return; ST.active = id; S.done = {}; S.dismissed = {}; S.applied = {}; S.local.lead = {}; S.local.dealStage = {}; S.local.dealDone = {}; S.local.exps = []; S.local.drafts = []; S.local.newDeals = []; bump(); persist(); },
    add(o) {
      const id = (o.name || 'workspace').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + (ST.list.length + 1);
      const w = { id, name: o.name, sub: o.sub || 'New workspace', base: null, demo: false, company: Object.assign({ name: o.name, product: o.name, website: '', industry: o.type || 'SaaS', market: 'India', audience: '', channels: '', revenueTarget: 0, signupTarget: 0, activationTarget: 60, cacTarget: 0, growthTarget: 10 }, o.company || {}), imports: [], sources: {}, rev: 0 };
      ST.list.push(w); persist(); return w;
    },
    mode(w) { w = w || G.WS.active(); return w.demo && w.base ? 'demo' : w.imports.length ? 'live' : 'empty'; },
    setDemo(on) { const w = G.WS.active(); w.demo = !!on; S.done = {}; S.dismissed = {}; bump(); persist(); },
    loadDemo(base) { const w = G.WS.active(); w.base = base; w.demo = true; S.done = {}; S.dismissed = {}; bump(); persist(); },
    objective() { return G.WS.active().objective || null; },
    setTheme(t) { ST.theme = t; applyTheme(); persist(); },
  };
  function applyTheme() { try { (G.app || document.querySelector('.g-app')).setAttribute('data-theme', ST.theme || 'dark'); } catch (e) { /* ignore */ } }
  G.applyTheme = applyTheme;

  /* ---------- cache ---------- */
  let ver = 0, cache = {}, cacheKey = '';
  const keyNow = () => ST.active + '|' + G.WS.mode() + '|' + (G.WS.active().base || '') + '|' + G.WS.active().rev + '|' + ver;
  function bump() { ver++; cache = {}; G.__sig = null; }
  G.wsBump = bump;

  const BASE_ONLY_RAW = ['ask']; // datasets rebuilt by the engine for every workspace
  const EMPTY_IDS = ['campaigns', 'channels', 'creators', 'creatives', 'leads', 'deals', 'content', 'content_compare', 'kpis', 'funnel', 'health', 'drivers', 'series', 'attribution', 'attr_journey', 'influence', 'scenarios', 'forecast_actual', 'forecast_kpis', 'goals', 'creator_kpis', 'creator_detail', 'lead_kpis', 'pipeline_kpis', 'pipeline_radar', 'campaign_detail', 'experiments', 'insights', 'reports', 'activity', 'notifications', 'datasources', 'actions', 'opportunities', 'radar_changes', 'signals', 'priorities', 'ask'];

  G.rows = (id) => {
    const w = G.WS.active(), mode = G.WS.mode(w);
    if (G.__inEngine) return RAW(id);
    const k = keyNow();
    if (k !== cacheKey) { cache = {}; cacheKey = k; }
    if (id in cache) return cache[id];
    let out;
    if (id === 'workspace') out = wsRows();
    else if (id === 'settings') out = settingsRows(RAW(id));
    else if (id === 'suggestions' || id === 'team' || id === 'alert_rules') out = RAW(id);
    else if (mode === 'empty') out = EMPTY_IDS.includes(id) ? [] : RAW(id);
    else if (id === 'signals' || id === 'priorities' || id === 'ask' || id === 'insights') {
      if (!G.engine) out = RAW(id);
      else {
        const base = RAW('channels'); if (!base) return null;
        out = G.engine.get(id, mode);
        if (id === 'insights' && mode === 'demo' && w.base === 'wispr') out = RAW('insights');
      }
    } else if (mode === 'demo' && w.base === 'wispr') out = brand(RAW(id), w);
    else if (mode === 'demo') out = G.derived(w, 'demo')[id] !== undefined ? G.derived(w, 'demo')[id] : [];
    else if (mode === 'live') { const d = G.derived(w, 'live'); out = d[id] !== undefined ? d[id] : []; }
    else out = RAW(id);
    if (out == null && !G.rawReady()) return null;
    cache[id] = out;
    return out;
  };
  G.rawReady = () => { const x = RAW('channels'); return !!x; };

  function brand(rows, w) { return rows; }
  function wsRows() {
    return G.WS.list().map((w, i) => ({ id: w.id, kind: w.id === ST.active ? 'workspace' : 'alt', name: w.name, detail: w.sub + ' · ' + srcCount(w) + ' sources', plan: 'Growth' })).concat([{ id: 'me', kind: 'user', name: 'Aarav Mehta', detail: 'Head of Growth', plan: 'aarav@wisprflow.example' }]);
  }
  function settingsRows(base) {
    if (!base) return base;
    const w = G.WS.active();
    return base.map((r) => (r.id === 'ws-name' ? Object.assign({}, r, { value: w.name }) : r));
  }
  const srcCount = (w) => (G.WS.mode(w) === 'demo' ? (w.base === 'wispr' ? 9 : 7) : w.imports.length);
  G.srcCount = srcCount;

  /* ---------- CSV parsing ---------- */
  G.csv = {
    parse(text) {
      text = String(text || '').replace(/^﻿/, '');
      const rows = []; let row = [], f = '', q = false;
      const delim = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : (text.split('\n')[0].match(/\t/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
        else if (c === '"') q = true;
        else if (c === delim) { row.push(f); f = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
        else f += c;
      }
      row.push(f); if (row.some((x) => x !== '')) rows.push(row);
      if (!rows.length) return { cols: [], rows: [] };
      const cols = rows[0].map((c) => c.trim());
      const body = rows.slice(1).map((r) => { const o = {}; cols.forEach((c, i) => (o[c] = (r[i] == null ? '' : r[i]).trim())); return o; });
      return { cols, rows: body };
    },
    stringify(cols, rows) { const e = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return [cols.join(',')].concat(rows.map((r) => cols.map((c) => e(r[c])).join(','))).join('\n'); },
  };

  /* ---------- data types and Growth OS fields ---------- */
  const N = 'num', D = 'date', T = 'text';
  const TYPES = {
    ad: { label: 'Campaign performance', alt: 'Ad performance', desc: 'Spend, clicks, signups and revenue by campaign, channel and day.', required: ['campaign', 'spend'], key: ['date', 'campaign', 'channel', 'creative'],
      fields: { date: ['Date', D, ['date', 'day', 'reporting starts', 'report date']], campaign: ['Campaign name', T, ['campaign', 'campaign name', 'campaign_name', 'campaignname']], channel: ['Channel', T, ['channel', 'platform', 'source', 'network', 'medium']], creative: ['Creative / ad', T, ['creative', 'ad name', 'ad_name', 'ad', 'creative name']], spend: ['Spend', N, ['spend', 'amount spent', 'cost', 'amount spent (inr)', 'ad spend']], impressions: ['Impressions', N, ['impressions', 'impr', 'views']], clicks: ['Clicks', N, ['clicks', 'link clicks', 'link_clicks']], visitors: ['Landing visits', N, ['visitors', 'sessions', 'landing visits', 'landing page views']], signups: ['Signups', N, ['signups', 'sign ups', 'sign_ups', 'registrations', 'conversions', 'leads']], activated: ['Activated users', N, ['activated', 'activations', 'activated users']], customers: ['Customers', N, ['customers', 'purchases', 'paid', 'new customers', 'conversions_paid']], revenue: ['Revenue', N, ['revenue', 'purchase value', 'sales', 'mrr', 'conversion value']] } },
    creator: { label: 'Creator performance', desc: 'Views, clicks, signups and revenue per creator.', required: ['creator', 'views'], key: ['creator', 'campaign'],
      fields: { creator: ['Creator', T, ['creator', 'creator name', 'handle', 'influencer', 'name']], platform: ['Platform', T, ['platform', 'network', 'channel']], campaign: ['Campaign', T, ['campaign', 'campaign name']], followers: ['Reach / followers', N, ['followers', 'reach', 'subscribers', 'audience']], views: ['Views', N, ['views', 'impressions', 'plays']], clicks: ['Clicks', N, ['clicks', 'link clicks']], signups: ['Signups', N, ['signups', 'sign ups', 'registrations']], activated: ['Activated users', N, ['activated', 'activations']], customers: ['Customers', N, ['customers', 'purchases']], spend: ['Payout / spend', N, ['spend', 'payout', 'fee', 'cost']], revenue: ['Revenue', N, ['revenue', 'sales']] } },
    lead: { label: 'Leads', desc: 'People who showed interest, with stage and intent.', required: ['name'], key: ['email', 'name', 'company'],
      fields: { name: ['Lead name', T, ['name', 'lead name', 'full name', 'contact', 'contact name']], company: ['Company', T, ['company', 'account', 'organization', 'organisation']], email: ['Email', T, ['email', 'email address']], source: ['Source', T, ['source', 'channel', 'lead source', 'utm_source']], campaign: ['Campaign', T, ['campaign', 'utm_campaign']], stage: ['Stage', T, ['stage', 'status', 'lifecycle stage']], score: ['Intent score', N, ['score', 'intent', 'lead score', 'intent score']], signup_date: ['Signup date', D, ['signup date', 'created', 'created date', 'date', 'created_at']], owner: ['Owner', T, ['owner', 'assigned to', 'rep']], value: ['Estimated value', N, ['value', 'estimated value', 'deal value', 'amount']], last_activity_days: ['Days since last activity', N, ['last activity days', 'days since contact', 'last_activity_days', 'idle days']], pricing_visits: ['Pricing page visits', N, ['pricing visits', 'pricing_visits', 'pricing page views']] } },
    customer: { label: 'Customers', desc: 'Paying customers with revenue and source.', required: ['revenue'], key: ['company', 'name', 'date'],
      fields: { name: ['Customer name', T, ['name', 'customer', 'customer name']], company: ['Company', T, ['company', 'account']], source: ['Source', T, ['source', 'channel', 'utm_source']], campaign: ['Campaign', T, ['campaign']], date: ['Signup date', D, ['date', 'created', 'signup date', 'first payment']], revenue: ['Revenue', N, ['revenue', 'amount', 'mrr', 'value']] } },
    pipeline: { label: 'Pipeline', desc: 'Open deals with value and stage.', required: ['company', 'value'], key: ['company', 'stage', 'value'],
      fields: { company: ['Company', T, ['company', 'deal', 'deal name', 'account', 'opportunity']], value: ['Deal value', N, ['value', 'amount', 'deal value', 'acv']], stage: ['Stage', T, ['stage', 'deal stage', 'status']], owner: ['Owner', T, ['owner', 'rep', 'assigned to']], probability: ['Probability %', N, ['probability', 'win probability', 'prob']], source: ['Source', T, ['source', 'channel', 'lead source']], campaign: ['Campaign', T, ['campaign']], contact: ['Contact', T, ['contact', 'contact name']], last_activity_days: ['Days since last activity', N, ['last activity days', 'idle days', 'days in stage', 'last_days']] } },
    revenue: { label: 'Revenue', desc: 'Revenue and customers by channel and date.', required: ['revenue'], key: ['date', 'channel', 'campaign'],
      fields: { date: ['Date', D, ['date', 'day', 'created']], channel: ['Channel', T, ['channel', 'source', 'utm_source']], campaign: ['Campaign', T, ['campaign']], customers: ['New customers', N, ['customers', 'new customers', 'count']], revenue: ['Revenue', N, ['revenue', 'amount', 'mrr', 'gross volume']] } },
    content: { label: 'Content performance', desc: 'Posts and videos with views, signups and revenue.', required: ['title', 'views'], key: ['title', 'date', 'platform'],
      fields: { title: ['Content title', T, ['title', 'content', 'post', 'video title', 'name']], platform: ['Platform', T, ['platform', 'channel', 'network']], creator: ['Creator', T, ['creator', 'author', 'handle']], type: ['Content type', T, ['type', 'format', 'content type']], date: ['Published date', D, ['date', 'published', 'published date', 'posted']], views: ['Views', N, ['views', 'impressions', 'plays']], engagement: ['Engagement %', N, ['engagement', 'engagement rate']], clicks: ['Clicks', N, ['clicks']], signups: ['Signups', N, ['signups', 'sign ups', 'conversions']], activated: ['Activated users', N, ['activated']], customers: ['Customers', N, ['customers']], revenue: ['Revenue', N, ['revenue']], cost: ['Cost', N, ['cost', 'spend', 'fee']] } },
    custom: { label: 'Custom data', desc: 'Any other table. Stored with the workspace; not used by dashboards yet.', required: [], key: [], fields: {} },
  };
  G.TYPES = TYPES;
  const ORDER = ['ad', 'creator', 'lead', 'customer', 'pipeline', 'revenue', 'content', 'custom'];
  G.TYPE_ORDER = ORDER;

  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  G.imp = {
    suggest(type, cols) {
      const f = TYPES[type].fields, used = {}, map = {};
      Object.keys(f).forEach((k) => {
        const syn = f[k][2].map(norm).concat([norm(k), norm(f[k][0])]);
        const hit = cols.find((c) => !used[c] && syn.includes(norm(c))) || cols.find((c) => !used[c] && syn.some((s) => s.length > 3 && norm(c).includes(s)));
        if (hit) { map[k] = hit; used[hit] = 1; }
      });
      return map;
    },
    guessType(cols) {
      const best = ORDER.filter((t) => t !== 'custom').map((t) => [t, Object.keys(G.imp.suggest(t, cols)).length / Math.max(3, Object.keys(TYPES[t].fields).length) + (TYPES[t].required.every((r) => G.imp.suggest(t, cols)[r]) ? 0.4 : 0)]).sort((a, b) => b[1] - a[1]);
      return best[0][1] > 0.35 ? best[0][0] : 'ad';
    },
    num(v) {
      if (v == null || v === '') return null;
      let s = String(v).trim().replace(/[₹$,\s%]/g, '');
      let m = 1;
      if (/(cr|crore)$/i.test(s)) { m = 1e7; s = s.replace(/(cr|crore)$/i, ''); } else if (/(l|lakh|lac)$/i.test(s)) { m = 1e5; s = s.replace(/(l|lakh|lac)$/i, ''); } else if (/k$/i.test(s)) { m = 1e3; s = s.slice(0, -1); } else if (/m$/i.test(s)) { m = 1e6; s = s.slice(0, -1); }
      const n = Number(s);
      return isFinite(n) && s !== '' ? n * m : NaN;
    },
    date(v) {
      if (v == null || v === '') return null;
      const s = String(v).trim();
      let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
      m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
      if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
      const t = Date.parse(s);
      return isNaN(t) ? NaN : new Date(t).toISOString().slice(0, 10);
    },
    /* Map and validate raw rows. Nothing is dropped silently: every problem is counted. */
    validate(type, parsed, map) {
      const T_ = TYPES[type], f = T_.fields, out = [], issues = {}, add = (k, n) => (issues[k] = (issues[k] || 0) + (n || 1));
      const seen = new Set(); let dup = 0;
      parsed.rows.forEach((r) => {
        const rec = {}; let bad = false;
        Object.keys(f).forEach((k) => {
          const col = map[k]; if (!col) return;
          const raw = r[col];
          if (raw === '' || raw == null) return;
          if (f[k][1] === N) { const v = G.imp.num(raw); if (Number.isNaN(v)) { add('Non-numeric ' + f[k][0].toLowerCase()); if (T_.required.includes(k)) bad = true; } else rec[k] = v; }
          else if (f[k][1] === D) { const v = G.imp.date(raw); if (Number.isNaN(v)) add('Unreadable ' + f[k][0].toLowerCase()); else rec[k] = v; }
          else rec[k] = String(raw).trim();
        });
        T_.required.forEach((k) => { if (!map[k] || rec[k] == null || rec[k] === '') { bad = true; add('Missing ' + f[k][0].toLowerCase()); } });
        if (bad) { return; }
        if (type === 'ad') {
          if (!rec.channel) { rec.channel = guessChannel(rec.campaign) || 'Unassigned'; }
          ['spend', 'impressions', 'clicks', 'signups', 'revenue', 'customers'].forEach((k) => { if (rec[k] != null && rec[k] < 0) { add('Negative ' + f[k][0].toLowerCase()); rec[k] = 0; } });
        }
        const key = T_.key.length ? T_.key.map((k) => rec[k] == null ? '' : rec[k]).join('|') : null;
        if (key) { if (seen.has(key)) { dup++; return; } seen.add(key); }
        out.push(rec);
      });
      if (dup) add('Duplicate records', dup);
      const total = parsed.rows.length, valid = out.length;
      const reqMapped = T_.required.filter((k) => map[k]).length, fieldsMapped = Object.keys(map).filter((k) => map[k]).length;
      const missingOptional = Object.keys(f).filter((k) => !map[k] && !T_.required.includes(k)).map((k) => f[k][0]);
      return { total, valid: out, nValid: valid, invalid: total - valid - dup, dup, issues, pct: total ? Math.round(valid / total * 100) : 0, fieldsMapped, fieldsTotal: Object.keys(f).length, reqMapped, missingOptional, missingRequired: T_.required.filter((k) => !map[k]).map((k) => f[k][0]) };
    },
    /* Commit validated rows to the active workspace. */
    commit(wsId, type, name, records, meta) {
      const w = G.WS.list().find((x) => x.id === wsId) || G.WS.active();
      const imp = Object.assign({ id: 'imp' + Date.now() + Math.floor(Math.random() * 1000), type, name, rows: records, at: Date.now(), count: records.length }, meta || {});
      if (type === 'custom') imp.rows = records.slice(0, 500);
      w.imports.push(imp); w.rev = (w.rev || 0) + 1; bump(); persist(); return imp;
    },
    remove(wsId, impId) { const w = G.WS.list().find((x) => x.id === wsId); if (!w) return; w.imports = w.imports.filter((i) => i.id !== impId); w.rev = (w.rev || 0) + 1; bump(); persist(); },
  };
  const CH_HINT = [['google', 'Google Ads'], ['meta', 'Meta'], ['facebook', 'Meta'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['twitter', 'X'], [' x ', 'X'], ['reddit', 'Reddit'], ['creator', 'Creators'], ['referral', 'Referral'], ['organic', 'Organic'], ['search', 'Google Ads']];
  function guessChannel(c) { const s = ' ' + String(c || '').toLowerCase() + ' '; const h = CH_HINT.find(([k]) => s.includes(k)); return h ? h[1] : null; }
  G.guessChannel = guessChannel;

  /* ---------- derived dataset cache ---------- */
  const dcache = {};
  G.derived = (w, mode) => {
    const k = w.id + '|' + mode + '|' + w.base + '|' + w.rev + '|' + ver;
    if (dcache[k]) return dcache[k];
    Object.keys(dcache).forEach((x) => delete dcache[x]);
    const pool = poolFor(w, mode);
    G.__inEngine = true;
    let out;
    try { out = G.derive(pool, { ws: w, mode }); } finally { G.__inEngine = false; }
    dcache[k] = out; return out;
  };
  function poolFor(w, mode) {
    if (mode === 'demo') return G.gen(w.base, { name: w.company.name || w.name });
    const P = { ad: [], creator: [], lead: [], customer: [], pipeline: [], revenue: [], content: [], custom: [] };
    w.imports.forEach((i) => { (P[i.type] = P[i.type] || []).push(...i.rows); });
    P.__imports = w.imports;
    return P;
  }
  G.poolFor = poolFor;

  /* ---------- appearance ---------- */
  applyTheme();
  setTimeout(applyTheme, 0);
})();
