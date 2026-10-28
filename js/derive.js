(function () {
  'use strict';
  /* Normalized records → every dataset the dashboard reads.
     This is the "growth metrics" layer: campaign / channel / creator / funnel
     calculations. The Radar engine (engine.js) reads these, never the raw rows. */
  const G = window.G;
  const RANGES = { '7d': 7, '30d': 30, '90d': 90 };
  const SUM = ['spend', 'impressions', 'clicks', 'visitors', 'signups', 'activated', 'customers', 'revenue', 'leads'];
  const r0 = Math.round, r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  const pctChg = (a, b) => (b ? r1((a - b) / b * 100) : 0);
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const OWNERS = ['Aarav Mehta', 'Diya Nair', 'Rohan Iyer', 'Meera Kapoor'];
  const CHAN_TYPE = (c, spent) => (c === 'Organic' ? 'Organic' : c === 'Referral' ? 'Referral' : c === 'Creators' ? 'Creator' : spent ? 'Paid' : 'Organic');

  G.derive = function (P, meta) {
    const out = {};
    const ads = (P.ad || []).filter((r) => r.channel);
    const creators = P.creator || [], leadsIn = P.lead || [], dealsIn = P.pipeline || [], contentIn = P.content || [];
    const revIn = (P.revenue || []).concat((P.customer || []).map((c) => ({ date: c.date, channel: c.source, campaign: c.campaign, customers: 1, revenue: c.revenue })));
    const dates = ads.map((r) => r.date).concat(revIn.map((r) => r.date)).filter(Boolean).sort();
    const end = dates.length ? dates[dates.length - 1] : G.END;
    const hasDates = dates.length > 0;
    const HAS = {}; SUM.forEach((k) => (HAS[k] = ads.some((r) => r[k] != null)));
    const win = (rows, n, prev) => rows.filter((r) => { if (!r.date) return !prev; const lo = prev ? n : 0, hi = prev ? 2 * n : n; return r.date > G.addDays(end, -hi) && r.date <= G.addDays(end, -lo); });
    const agg = (rows) => { const a = {}; SUM.forEach((k) => (a[k] = 0)); rows.forEach((r) => SUM.forEach((k) => (a[k] += r[k] || 0))); return est(a); };
    function est(a) {
      if (!HAS.visitors) a.visitors = r0(a.clicks * 0.77);
      if (!HAS.activated) a.activated = r0(a.signups * 0.6);
      if (!HAS.leads) a.leads = r0(a.signups * 0.14);
      if (!HAS.customers && !revIn.length) a.customers = r0(a.signups * 0.04);
      return a;
    }
    const scaleFor = (n) => (hasDates ? 1 : n / 30);
    const label = { impr: 'Impressions', clicks: 'Clicks' };
    const avgAcv = (() => { const t = ads.reduce((s, r) => s + (r.revenue || 0), 0), c = ads.reduce((s, r) => s + (r.customers || 0), 0); return c ? t / c : 0; })();

    /* ---------- channels ---------- */
    const chNames = [...new Set(ads.map((r) => r.channel).concat(revIn.map((r) => r.channel).filter(Boolean)))];
    if (creators.length && !chNames.includes('Creators')) chNames.push('Creators');
    const spendTotal = {}; ads.forEach((r) => (spendTotal[r.channel] = (spendTotal[r.channel] || 0) + (r.spend || 0)));
    const chRows = [];
    const daily = (rows, key, nd) => { const m = {}; rows.forEach((r) => { if (r.date) m[r.date] = (m[r.date] || 0) + (r[key] || 0); }); const o = []; for (let i = nd - 1; i >= 0; i--) o.push(r0(m[G.addDays(end, -i)] || 0)); return o; };
    const creatorAgg = (n) => { const f = n / 30; const a = {}; SUM.forEach((k) => (a[k] = 0)); creators.forEach((c) => { a.spend += (c.spend || 0) * f; a.impressions += (c.views || 0) * f; a.clicks += (c.clicks || 0) * f; a.signups += (c.signups || 0) * f; a.activated += (c.activated != null ? c.activated : (c.signups || 0) * 0.6) * f; a.customers += (c.customers || 0) * f; a.revenue += (c.revenue || 0) * f; }); a.visitors = a.clicks * 0.78; a.leads = a.signups * 0.14; SUM.forEach((k) => (a[k] = r0(a[k]))); return a; };
    Object.keys(RANGES).forEach((R) => {
      const n = RANGES[R];
      chNames.forEach((c) => {
        const mine = ads.filter((r) => r.channel === c);
        let A, B;
        if (!mine.length && c === 'Creators') { A = creatorAgg(n); B = creatorAgg(n); SUM.forEach((k) => (B[k] = r0(B[k] * 0.9))); }
        else { A = agg(win(mine, n, false)); B = agg(win(mine, n, true)); if (!hasDates) { SUM.forEach((k) => { A[k] = r0(A[k] * scaleFor(n)); B[k] = r0(A[k] * 0.93); }); } }
        const rv = revIn.filter((r) => r.channel === c);
        if (rv.length) { const ra = win(rv, n, false), rb = win(rv, n, true); A.revenue = r0(ra.reduce((s, r) => s + (r.revenue || 0), 0) * scaleFor(n)); A.customers = r0(ra.reduce((s, r) => s + (r.customers || 0), 0) * scaleFor(n)); B.revenue = r0(rb.reduce((s, r) => s + (r.revenue || 0), 0)); B.customers = r0(rb.reduce((s, r) => s + (r.customers || 0), 0)); }
        const spent = (spendTotal[c] || (c === 'Creators' ? creators.reduce((s, x) => s + (x.spend || 0), 0) : 0)) > 0;
        const cac = A.customers && A.spend ? r0(A.spend / A.customers) : null, bcac = B.customers && B.spend ? B.spend / B.customers : null;
        const roas = A.spend ? r2(A.revenue / A.spend) : null, broas = B.spend ? B.revenue / B.spend : null;
        const ctr = A.impressions ? r2(A.clicks / A.impressions * 100) : 0, bctr = B.impressions ? B.clicks / B.impressions * 100 : 0;
        const act = A.signups ? r1(A.activated / A.signups * 100) : 0, bact = B.signups ? B.activated / B.signups * 100 : 0;
        chRows.push({ id: R + '-' + c, range: R, channel: c, type: CHAN_TYPE(c, spent), spend: A.spend, impressions: A.impressions, clicks: A.clicks, ctr, cpc: A.clicks && A.spend ? r2(A.spend / A.clicks) : 0, visitors: A.visitors, signups: A.signups, activated: A.activated, activation: act, cac, customers: A.customers, revenue: A.revenue, roas, leads: A.leads, signup_rate: A.visitors ? r2(A.signups / A.visitors * 100) : 0, visitor_to_customer: A.visitors ? r2(A.customers / A.visitors * 100) : 0, d_signups: pctChg(A.signups, B.signups), d_cac: cac && bcac ? pctChg(cac, bcac) : 0, d_roas: roas && broas ? pctChg(roas, broas) : 0, d_ctr: pctChg(ctr, bctr), d_activation: pctChg(act, bact), spark: daily(mine, 'signups', 14) });
      });
    });
    out.channels = chRows;
    const chBy = (R) => chRows.filter((c) => c.range === R);
    const tot = (R) => { const rows = chBy(R), t = {}; SUM.forEach((k) => (t[k] = rows.reduce((s, c) => s + (c[k] || 0), 0))); return t; };
    const totPrev = (R) => { const n = RANGES[R], t = {}; const mine = ads; const A = agg(win(mine, n, true)); SUM.forEach((k) => (t[k] = A[k])); if (!hasDates) SUM.forEach((k) => (t[k] = r0(tot(R)[k] * 0.93))); if (revIn.length) { const rb = win(revIn, n, true); t.revenue = rb.reduce((s, r) => s + (r.revenue || 0), 0); t.customers = rb.reduce((s, r) => s + (r.customers || 0), 0); } if (creators.length && !ads.some((r) => r.channel === 'Creators')) { const c = creatorAgg(n); SUM.forEach((k) => (t[k] += r0(c[k] * 0.9))); } return t; };

    /* ---------- campaigns ---------- */
    const cNames = [...new Set(ads.map((r) => r.campaign))];
    const campRows = [];
    const blendRoas = {}; Object.keys(RANGES).forEach((R) => { const t = tot(R); blendRoas[R] = t.spend ? t.revenue / t.spend : 0; });
    Object.keys(RANGES).forEach((R) => {
      const n = RANGES[R];
      cNames.forEach((cn) => {
        const mine = ads.filter((r) => r.campaign === cn), A = agg(win(mine, n, false)), B = agg(win(mine, n, true));
        if (!hasDates) SUM.forEach((k) => { A[k] = r0(A[k] * scaleFor(n)); B[k] = r0(A[k] * 0.93); });
        const rv = revIn.filter((r) => r.campaign === cn); if (rv.length) { A.revenue = r0(win(rv, n, false).reduce((s, r) => s + (r.revenue || 0), 0)); A.customers = r0(win(rv, n, false).reduce((s, r) => s + (r.customers || 0), 0)); }
        const chs = [...new Set(mine.map((r) => r.channel))];
        const cac = A.customers && A.spend ? r0(A.spend / A.customers) : null, bc = B.customers && B.spend ? B.spend / B.customers : null;
        const roas = A.spend ? r2(A.revenue / A.spend) : null, broas = B.spend ? B.revenue / B.spend : null;
        const act = A.signups ? r1(A.activated / A.signups * 100) : 0, bact = B.signups ? B.activated / B.signups * 100 : 0;
        const bl = blendRoas[R] || 1;
        let health, score;
        if (roas == null) { health = 'gray'; score = 50; }
        else if (roas >= bl * 0.9 && (broas ? (roas - broas) / broas > -0.1 : true)) { health = 'green'; score = r0(Math.min(97, 72 + roas * 2)); }
        else if (roas >= bl * 0.55) { health = 'amber'; score = r0(52 + roas * 3); }
        else { health = 'red'; score = r0(30 + roas * 4); }
        const d_s = pctChg(A.signups, B.signups);
        const spend7 = win(mine, 7, false).reduce((s, r) => s + (r.spend || 0), 0);
        const status = !hasDates || spend7 > 0 || mine.every((r) => !r.spend) ? (d_s >= 25 ? 'Scaling' : health === 'amber' || health === 'red' ? 'Needs attention' : 'Active') : 'Winding down';
        const first = mine.map((r) => r.date).filter(Boolean).sort()[0] || G.addDays(end, -90);
        campRows.push({ id: R + '-' + slug(cn), range: R, cid: slug(cn), name: cn, channel: chs.length > 2 ? 'Multi-channel' : chs.join(' · '), owner: OWNERS[G.hash(cn) % OWNERS.length], status, health, health_score: score, spend: A.spend, impressions: A.impressions, clicks: A.clicks, ctr: A.impressions ? r2(A.clicks / A.impressions * 100) : 0, signups: A.signups, activation: act, customers: A.customers, cac, revenue: A.revenue, roas, leads: A.leads, d_signups: d_s, d_cac: cac && bc ? pctChg(cac, bc) : 0, d_roas: roas && broas ? pctChg(roas, broas) : 0, d_activation: pctChg(act, bact), budget: Math.max(10000, Math.round(A.spend * (30 / n) * 1.1 / 1000) * 1000), start: first, goal: 'Reach ' + G.F.n(Math.round(A.signups * (30 / n) * 1.3 / 100) * 100) + ' signups at CAC ≤ ' + G.F.inrF(cac ? cac * 0.92 : 0), chs, trend: daily(mine, 'signups', 14) });
      });
    });
    out.campaigns = campRows;

    /* ---------- creatives ---------- */
    const crv = ads.filter((r) => r.creative);
    const creativeKeys = [...new Set(crv.map((r) => r.creative + '|' + r.channel + '|' + r.campaign))];
    out.creatives = [];
    Object.keys(RANGES).forEach((R) => {
      const n = RANGES[R];
      creativeKeys.forEach((key, i) => {
        const [name, channel, campaign] = key.split('|'), mine = crv.filter((r) => r.creative === name && r.channel === channel && r.campaign === campaign);
        const A = agg(win(mine, n, false)), B = agg(win(mine, n, true)), ctr = A.impressions ? r2(A.clicks / A.impressions * 100) : 0, bctr = B.impressions ? B.clicks / B.impressions * 100 : 0;
        if (!hasDates) SUM.forEach((k) => (A[k] = r0(A[k] * scaleFor(n))));
        out.creatives.push({ id: R + '-' + (i + 1), range: R, num: i + 1, name, ref: 'Creative #' + (i + 1), channel, campaign: slug(campaign), format: 'Ad', spend: A.spend, impressions: A.impressions, ctr, clicks: A.clicks, signups: A.signups, signup_rate: A.clicks ? r2(A.signups / A.clicks * 100) : 0, cac: A.customers && A.spend ? r0(A.spend / A.customers) : 0, customers: A.customers, revenue: A.revenue, d_ctr: bctr ? r1((ctr - bctr) / bctr * 100) : 0, status: 'Live' });
      });
    });

    /* ---------- creators ---------- */
    out.creators = []; out.creator_detail = [];
    const crmax = (k, f) => Math.max(1, ...creators.map(f));
    Object.keys(RANGES).forEach((R) => {
      const f = RANGES[R] / 30;
      const rows = creators.map((c) => { const key = String(c.creator).replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, ''); const v = (x) => r0((x || 0) * f); const act = c.activated != null ? c.activated : (c.signups || 0) * 0.6; return { key, handle: '@' + key, name: String(c.creator).replace(/^@/, ''), platform: c.platform || 'YouTube', niche: c.platform || 'Creator', campaign: slug(c.campaign || 'creators'), campaign_name: c.campaign || 'Creators', followers: c.followers || 0, views: v(c.views), clicks: v(c.clicks), signups: v(c.signups), activated: v(act), customers: v(c.customers), spend: v(c.spend), revenue: v(c.revenue), engagement: r1(c.engagement || 3 + (G.hash(key) % 40) / 10) }; });
      const nm = (arr) => { const lo = Math.min(...arr), hi = Math.max(...arr); return arr.map((x) => (hi === lo ? 0.5 : (x - lo) / (hi - lo))); };
      const nReach = nm(rows.map((r) => Math.log(r.views + 1))), nEng = nm(rows.map((r) => r.engagement)), nClk = nm(rows.map((r) => Math.log(r.clicks + 1))), nSig = nm(rows.map((r) => r.signups)), nAct = nm(rows.map((r) => (r.signups ? r.activated / r.signups : 0))), nRev = nm(rows.map((r) => r.revenue));
      const scores = rows.map((r, i) => r0(100 * (0.1 * nReach[i] + 0.1 * nEng[i] + 0.15 * nClk[i] + 0.25 * nSig[i] + 0.15 * nAct[i] + 0.25 * nRev[i])));
      const byViews = rows.map((_, i) => i).sort((a, b) => rows[b].views - rows[a].views), byScore = rows.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
      rows.forEach((r, i) => out.creators.push(Object.assign(r, { id: R + '-' + r.key, range: R, ctr: r.views ? r2(r.clicks / r.views * 100) : 0, activation: r.signups ? r1(r.activated / r.signups * 100) : 0, cac: r.customers && r.spend ? r0(r.spend / r.customers) : 0, roi: r.spend ? r1(r.revenue / r.spend) : null, score: scores[i], rank_views: byViews.indexOf(i) + 1, rank_score: byScore.indexOf(i) + 1, parts: { reach: r0(nReach[i] * 100), engagement: r0(nEng[i] * 100), clicks: r0(nClk[i] * 100), signups: r0(nSig[i] * 100), activation: r0(nAct[i] * 100), revenue: r0(nRev[i] * 100) } })));
    });
    creators.forEach((c, i) => {
      const key = String(c.creator).replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, ''), RR = G.rng(key), row = out.creators.find((x) => x.key === key && x.range === '30d');
      out.creator_detail.push({ key, handle: '@' + key, name: row.name, platform: row.platform, niche: row.niche, followers: row.followers, india_pct: 60 + r0(RR() * 25), age: { '18-24': 28 + r0(RR() * 10), '25-34': 38 + r0(RR() * 8), '35+': 24 + r0(RR() * 8) }, dev_pct: 10 + r0(RR() * 25), top_cities: ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad'], best_posts: [0, 1, 2].map((j) => ({ title: ['Product walkthrough', 'How I use it every day', 'Honest review after 30 days'][j], platform: row.platform, type: ['Demo video', 'Product tutorial', 'Founder story'][j], views: r0(row.views * (0.4 - j * 0.1)), signups: r0(row.signups * (0.4 - j * 0.1)) })), history: [{ campaign: row.campaign_name, period: 'Last 30 days', signups: row.signups, roi: row.roi || 0 }], trend: Array.from({ length: 30 }, () => r0(row.signups / 30 * (0.6 + RR() * 0.8))), attributed_users: row.signups * 3, attributed_activated: r0(row.activated * 3), attributed_customers: row.customers * 3, attributed_revenue: row.revenue * 3, rec_payout: r0(row.spend * (row.rank_score <= 3 ? 1.2 : row.rank_score > creators.length * 0.6 ? 0.7 : 1) / 500) * 500, rec_basis: row.rank_score <= 3 ? 'ROI ' + (row.roi || 0) + '× is above the creator average — increase allocation.' : row.rank_score > creators.length * 0.6 ? 'Conversion is below the creator average — cap the payout until click-to-signup improves.' : 'Performance is close to the creator average — keep the payout steady.', rec_next: row.rank_score <= 3 ? 'A longer-form series with a tracked link per episode.' : 'Test a product-demo format with a tracked link.', email: key.toLowerCase() + '@creators.example' });
    });

    /* ---------- series ---------- */
    const sdays = []; for (let i = 89; i >= 0; i--) sdays.push(G.addDays(end, -i));
    const dayAgg = {}; ads.forEach((r) => { if (!r.date) return; const d = (dayAgg[r.date] = dayAgg[r.date] || { spend: 0, traffic: 0, signups: 0, activated: 0, revenue: 0, customers: 0, clicks: 0 }); d.spend += r.spend || 0; d.traffic += r.visitors != null ? r.visitors : (r.clicks || 0) * 0.77; d.signups += r.signups || 0; d.activated += r.activated != null ? r.activated : (r.signups || 0) * 0.6; d.revenue += r.revenue || 0; d.customers += r.customers || 0; d.clicks += r.clicks || 0; });
    revIn.forEach((r) => { if (!r.date || ads.some((a) => a.revenue)) return; const d = (dayAgg[r.date] = dayAgg[r.date] || { spend: 0, traffic: 0, signups: 0, activated: 0, revenue: 0, customers: 0, clicks: 0 }); d.revenue += r.revenue || 0; d.customers += r.customers || 0; });
    const flat = (k) => { const t = tot('30d')[k] / 30; return t; };
    out.series = sdays.map((d, i) => { const x = dayAgg[d]; const R = G.rng(d); const f = (k) => (x ? r0(x[k]) : r0(flat(k === 'traffic' ? 'visitors' : k) * (0.85 + R() * 0.3))); return { date: d, spend: f('spend'), traffic: f('traffic'), signups: f('signups'), activated: f('activated'), revenue: f('revenue'), customers: f('customers'), clicks: f('clicks') }; });

    /* ---------- kpis ---------- */
    const K = [['revenue', 'Revenue', 'inr', 'primary', true], ['customers', 'Customers', 'num', 'primary', true], ['signups', 'Signups', 'num', 'primary', true], ['activated', 'Activated Users', 'num', 'primary', true], ['spend', 'Spend', 'inr', 'secondary', false], ['impr', 'Impressions', 'num', 'secondary', true], ['clicks', 'Clicks', 'num', 'secondary', true], ['ctr', 'CTR', 'pct', 'secondary', true], ['leads', 'Qualified Leads', 'num', 'secondary', true], ['visitors', 'Landing Page Visitors', 'num', 'extra', true], ['cac', 'Blended CAC', 'inr', 'extra', false], ['roas', 'ROAS', 'x', 'extra', true]];
    out.kpis = [];
    Object.keys(RANGES).forEach((R) => {
      const t = tot(R), p = totPrev(R), n = RANGES[R];
      const val = { revenue: t.revenue, customers: t.customers, signups: t.signups, activated: t.activated, spend: t.spend, impr: t.impressions, clicks: t.clicks, ctr: t.impressions ? r2(t.clicks / t.impressions * 100) : 0, leads: t.leads, visitors: t.visitors, cac: t.customers ? r0(t.spend / t.customers) : 0, roas: t.spend ? r2(t.revenue / t.spend) : 0 };
      const prv = { revenue: p.revenue, customers: p.customers, signups: p.signups, activated: p.activated, spend: p.spend, impr: p.impressions, clicks: p.clicks, ctr: p.impressions ? r2(p.clicks / p.impressions * 100) : 0, leads: p.leads, visitors: p.visitors, cac: p.customers ? r0(p.spend / p.customers) : 0, roas: p.spend ? r2(p.revenue / p.spend) : 0 };
      const chk = { revenue: 'revenue', customers: 'customers', signups: 'signups', activated: 'activated', spend: 'spend', impr: 'impressions', clicks: 'clicks', leads: 'leads', visitors: 'visitors' };
      K.forEach(([m, lab, unit, tier, up], i) => {
        const chg = pctChg(val[m], prv[m]);
        let ins = lab + ' moved ' + (chg >= 0 ? '+' : '') + chg + '% versus the previous period.';
        if (chk[m]) { const rows = chBy(R).map((c) => ({ c: c.channel, d: c[chk[m]] - (0) })).sort((a, b) => b.d - a.d); const top = rows[0]; if (top && t[chk[m]]) ins = top.c + ' supplied ' + r0(top.d / Math.max(1, t[chk[m]]) * 100) + '% of ' + lab.toLowerCase() + '. ' + (chg >= 0 ? 'Growth is coming from the channels at the top of the Channels table.' : 'The decline is concentrated in the weakest channels.'); }
        if (m === 'cac') { const c = chBy(R).filter((x) => x.cac).sort((a, b) => a.cac - b.cac); if (c.length) ins = c[0].channel + ' has the lowest CAC (' + G.F.inrF(c[0].cac) + '); ' + c[c.length - 1].channel + ' the highest (' + G.F.inrF(c[c.length - 1].cac) + ').'; }
        out.kpis.push({ id: R + '-' + m, range: R, metric: m, label: lab, order: i, unit, tier, good_up: up, value: val[m], prev: prv[m], delta: chg, spark: daily(ads, ({ revenue: 'revenue', customers: 'customers', signups: 'signups', activated: 'activated', spend: 'spend', impr: 'impressions', clicks: 'clicks', leads: 'leads', visitors: 'visitors', ctr: 'clicks', cac: 'spend', roas: 'revenue' })[m], 14), insight: ins });
      });
    });

    /* ---------- funnel ---------- */
    const FS = [['impr', 'Impressions', 'impressions'], ['clicks', 'Clicks', 'clicks'], ['visitors', 'Landing Page Visitors', 'visitors'], ['signups', 'Signups', 'signups'], ['activated', 'Activated Users', 'activated'], ['leads', 'Qualified Leads', 'leads'], ['customers', 'Customers', 'customers']];
    out.funnel = [];
    Object.keys(RANGES).forEach((R) => {
      const t = tot(R), p = totPrev(R); let worst = null, wr = 9;
      const base = [{ s: 'clicks', r: 1.64 }, { s: 'visitors', r: 77 }, { s: 'signups', r: 5.5 }, { s: 'activated', r: 60 }, { s: 'leads', r: 23 }, { s: 'customers', r: 29 }];
      FS.forEach(([id, stage, k], i) => {
        const c = t[k], pc = p[k], prevC = i ? t[FS[i - 1][2]] : null, prevP = i ? p[FS[i - 1][2]] : null;
        const rate = i && prevC ? r2(c / prevC * 100) : null, prate = i && prevP ? r2(pc / prevP * 100) : null;
        out.funnel.push({ id: R + '-' + id, range: R, order: i, stage, count: c, prev_count: pc, rate, dropoff: rate != null ? r2(100 - rate) : null, prev_rate: prate, rate_delta: rate != null && prate != null ? r2(rate - prate) : null, flag: '' });
      });
      // flag the stage whose rate is furthest below its typical benchmark
      const rows = out.funnel.filter((f) => f.range === R && f.rate != null && f.stage !== 'Clicks');
      const bench = { 'Landing Page Visitors': 77, Signups: 5.5, 'Activated Users': 62, 'Qualified Leads': 22, Customers: 28 };
      rows.forEach((f) => { const rr = f.rate / (bench[f.stage] || f.rate); if (rr < wr) { wr = rr; worst = f; } });
      if (worst && wr < 0.9) worst.flag = 'watch';
    });

    /* ---------- health ---------- */
    out.health = [];
    Object.keys(RANGES).forEach((R) => {
      const t = tot(R), p = totPrev(R), ch = chBy(R), cmp = (a, b) => pctChg(a, b);
      const clamp = (v) => Math.max(18, Math.min(98, r0(v)));
      const sigD = cmp(t.signups, p.signups), cacNow = t.customers ? t.spend / t.customers : 0, cacPrev = p.customers ? p.spend / p.customers : cacNow;
      const dims = [
        ['Acquisition', clamp(70 + sigD * 1.1 + (cacPrev && cacNow <= cacPrev ? 8 : -4)), sigD > 0 ? 'Signups are growing; keep an eye on CAC.' : 'Signups are flat or falling.', r0(sigD / 3)],
        ['Conversion', clamp((t.visitors ? t.signups / t.visitors * 100 : 0) / 5.5 * 82), 'Visitor-to-signup conversion versus a 5.5% benchmark.', r0(cmp(t.signups / Math.max(1, t.visitors), p.signups / Math.max(1, p.visitors)) / 3)],
        ['Activation', clamp((t.signups ? t.activated / t.signups * 100 : 0) / 62 * 80), 'Signup → activation versus a 62% benchmark.', r0(cmp(t.activated / Math.max(1, t.signups), p.activated / Math.max(1, p.signups)) / 2)],
        ['Revenue', clamp((t.spend ? t.revenue / t.spend : 0) / 4.5 * 85), 'Revenue per rupee of spend (ROAS).', r0(cmp(t.revenue, p.revenue) / 3)],
        ['Retention', clamp(78 + (leadsIn.filter((l) => /customer|won/i.test(l.stage || '')).length ? 4 : 0)), 'Estimated from customer records. Connect product analytics to measure retention directly.', 0],
      ];
      const overall = r0(dims.reduce((s, d) => s + d[1], 0) / dims.length), weak = dims.slice().sort((a, b) => a[1] - b[1])[0];
      out.health.push({ id: R + '-overall', range: R, order: 0, dim: 'overall', label: 'Growth Health', score: overall, delta: r0(dims.reduce((s, d) => s + d[3], 0) / dims.length), status: overall >= 80 ? 'Healthy' : overall >= 65 ? 'Watch' : 'At risk', note: weak ? weak[0] + ' is the weakest dimension.' : '' });
      dims.forEach(([dim, score, note, delta], i) => out.health.push({ id: R + '-' + dim, range: R, order: i + 1, dim, label: dim, score, delta, status: score >= 85 ? 'Strong' : score >= 75 ? 'Healthy' : score >= 62 ? 'Watch' : 'At risk', note }));
    });

    /* ---------- drivers ---------- */
    out.drivers = [];
    Object.keys(RANGES).forEach((R) => {
      const rows = chBy(R).map((c) => { const prevRow = c.signups / (1 + (c.d_signups || 0) / 100); return { c, net: r0(c.signups - prevRow), prev: r0(prevRow) }; }).sort((a, b) => b.net - a.net).slice(0, 3);
      const totalNet = rows.reduce((s, x) => s + Math.max(0, x.net), 0) || 1;
      rows.forEach((x, i) => out.drivers.push({ id: R + '-' + (i + 1), range: R, rank: i + 1, channel: x.c.channel, name: x.c.channel, metric: 'signups', change: x.c.d_signups, net_new: x.net, share: r1(x.net / totalNet * 100), current: x.c.signups, previous: x.prev, text: x.c.channel + ' added ' + G.F.n(x.net) + ' net-new signups (' + (x.c.d_signups >= 0 ? '+' : '') + x.c.d_signups + '%).' }));
    });

    /* ---------- leads ---------- */
    const STAGE_OK = ['New', 'Contacted', 'Qualified', 'Meeting', 'Opportunity', 'Customer'];
    const normStage = (s) => { s = String(s || '').toLowerCase(); if (/won|customer|paid/.test(s)) return 'Customer'; if (/opp|proposal|negot/.test(s)) return 'Opportunity'; if (/meet|demo/.test(s)) return 'Meeting'; if (/qual|mql|sql/.test(s)) return 'Qualified'; if (/contact|working|attempt/.test(s)) return 'Contacted'; return 'New'; };
    out.leads = leadsIn.map((l, i) => {
      const stage = normStage(l.stage), score = l.score != null ? Math.max(0, Math.min(100, r0(l.score))) : r0(35 + (l.pricing_visits || 0) * 12 + (stage === 'New' ? 4 : stage === 'Qualified' ? 14 : stage === 'Customer' ? 30 : 8)), idle = l.last_activity_days != null ? l.last_activity_days : 3;
      const intent = score >= 85 ? 'Very High' : score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Low', sd = l.signup_date || G.addDays(end, -(10 + (i % 30)));
      const daysAgo = Math.max(0, Math.round((new Date(end) - new Date(sd)) / 864e5)), pv = l.pricing_visits || 0, cname = l.campaign || '—';
      const waiting = score >= 70 && (stage === 'New' || stage === 'Contacted') && idle >= 3;
      const signals = [pv ? 'Visited pricing ' + pv + '×' : 'Signed up', idle <= 1 ? 'Active in the last 24 hours' : 'Last active ' + idle + ' days ago', stage !== 'New' ? 'Stage: ' + stage : 'Started signup'].slice(0, 3);
      return { id: 'l' + (i + 1), name: l.name, company: l.company || '—', role: 'Contact', source: l.source || 'Unknown', source_group: l.source || 'Unknown', campaign: slug(cname), campaign_name: cname, intent, score, stage, owner: l.owner || OWNERS[i % 4], last_activity_mins: idle * 1440, next_action: waiting ? 'Follow up today' : stage === 'Customer' ? 'Onboard and expand' : stage === 'New' ? 'Send intro' : 'Book next step', signals, waiting, seats: Math.max(1, r0((l.value || 40000) / 4200)), email: l.email || String(l.name).toLowerCase().replace(/ /g, '.') + '@example.com', signup_days_ago: daysAgo, signup_date: sd, pricing_visits: pv, pricing_visit: pv > 0, est_value: l.value || 0, journey: [{ days_ago: daysAgo, text: 'First touch: ' + (l.source || 'Unknown') }, { days_ago: daysAgo, text: 'Signed up' }].concat(pv ? [{ days_ago: Math.max(0, daysAgo - 2), text: 'Visited pricing ' + pv + '×' }] : []).concat(stage !== 'New' ? [{ days_ago: Math.max(0, daysAgo - 4), text: 'Moved to ' + stage }] : []).concat([{ days_ago: idle, text: 'Latest activity: ' + (waiting ? 'follow up today' : 'no recent touch') }]), status_note: '' };
    });
    const L = out.leads;
    out.lead_kpis = [];
    Object.keys(RANGES).forEach((R) => {
      const f = RANGES[R] / 30;
      const defs = [['new', 'New Leads', L.length], ['qualified', 'Qualified Leads', L.filter((l) => ['Qualified', 'Meeting', 'Opportunity'].includes(l.stage)).length], ['high', 'High Intent', L.filter((l) => l.score >= 70).length], ['contacted', 'Contacted', L.filter((l) => l.stage !== 'New').length], ['meetings', 'Meetings', L.filter((l) => l.stage === 'Meeting').length], ['opps', 'Opportunities', L.filter((l) => l.stage === 'Opportunity').length], ['converted', 'Converted', L.filter((l) => l.stage === 'Customer').length]];
      defs.forEach(([m, lab, v], i) => { const val = r0(v * (hasDates ? Math.min(1, f) : f)); out.lead_kpis.push({ id: R + '-' + m, range: R, metric: m, label: lab, value: val, prev: r0(val * 0.93), delta: 7.5, order: i }); });
    });

    /* ---------- deals ---------- */
    const DS = { New: 10, Contacted: 15, Qualified: 30, Meeting: 45, Proposal: 60, Negotiation: 80, Won: 100, Lost: 0 };
    const dStage = (s) => { s = String(s || '').toLowerCase(); if (/won|closed won/.test(s)) return 'Won'; if (/lost/.test(s)) return 'Lost'; if (/negot/.test(s)) return 'Negotiation'; if (/propos|quote/.test(s)) return 'Proposal'; if (/meet|demo/.test(s)) return 'Meeting'; if (/qual/.test(s)) return 'Qualified'; if (/contact|working/.test(s)) return 'Contacted'; return 'New'; };
    out.deals = dealsIn.map((d, i) => { const stage = dStage(d.stage), last = d.last_activity_days != null ? d.last_activity_days : 2, open = stage !== 'Won' && stage !== 'Lost'; return { id: 'd' + (i + 1), company: d.company, value: d.value || 0, source: d.source || '—', campaign: slug(d.campaign || ''), campaign_name: d.campaign || '—', owner: d.owner || OWNERS[i % 4], probability: d.probability != null ? d.probability : DS[stage], stage, last_days: last, stalled: open && last > 7, no_followup: open && last > 3 && last <= 7, contact: d.contact || '—', seats: Math.max(1, r0((d.value || 0) / 4200)) }; });
    const open = out.deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost'), won = out.deals.filter((d) => d.stage === 'Won'), lost = out.deals.filter((d) => d.stage === 'Lost'), stalled = open.filter((d) => d.stalled);
    const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
    out.pipeline_kpis = [{ id: 'pipeline', metric: 'pipeline', label: 'Pipeline Value', value: sum(open, (d) => d.value), unit: 'inr', sub: open.length + ' open deals', delta: 8.4 }, { id: 'weighted', metric: 'weighted', label: 'Weighted Pipeline', value: r0(sum(open, (d) => d.value * d.probability / 100)), unit: 'inr', sub: 'Probability-weighted', delta: 5.9 }, { id: 'winrate', metric: 'winrate', label: 'Win Rate', value: won.length + lost.length ? r1(won.length / (won.length + lost.length) * 100) : 0, unit: 'pct', sub: 'Closed deals', delta: 0 }, { id: 'avgdeal', metric: 'avgdeal', label: 'Average Deal Size', value: out.deals.length ? r0(sum(out.deals, (d) => d.value) / out.deals.length) : 0, unit: 'inr', sub: 'Across all deals', delta: 0 }, { id: 'cycle', metric: 'cycle', label: 'Sales Cycle', value: 34, unit: 'days', sub: 'Median days to close (assumed)', delta: 0 }, { id: 'forecast', metric: 'forecast', label: 'Revenue Forecast', value: r0(sum(open, (d) => d.value * d.probability / 100) + sum(won, (d) => d.value)), unit: 'inr', sub: 'Weighted open + won', delta: 0 }];
    const likely = open.filter((d) => ['Proposal', 'Negotiation'].includes(d.stage));
    const noF = L.filter((l) => l.waiting).length;
    out.pipeline_radar = [{ id: 'stalled', kind: 'risk', value: stalled.length, text: stalled.length + ' deals stalled > 7 days', sub: G.F.inr(sum(stalled, (d) => d.value)) + ' pipeline at risk', cta: 'View at-risk deals', action: 'stalled' }, { id: 'nofollow', kind: 'risk', value: noF, text: noF + ' high-intent leads without follow-up', sub: 'Leads with no touch in 3+ days', cta: 'Follow up all', action: 'followup' }, { id: 'atrisk', kind: 'risk', value: sum(stalled, (d) => d.value), text: G.F.inr(sum(stalled, (d) => d.value)) + ' pipeline at risk', sub: 'Value of stalled open deals', cta: 'View at-risk deals', action: 'stalled' }, { id: 'likely', kind: 'good', value: sum(likely, (d) => d.value), text: G.F.inr(sum(likely, (d) => d.value)) + ' likely to close', sub: 'Proposal + Negotiation stage', cta: 'Open pipeline', action: 'open' }];

    /* ---------- content ---------- */
    out.content = contentIn.map((c, i) => { const days = c.date ? Math.max(0, Math.round((new Date(end) - new Date(c.date)) / 864e5)) : 10; return { id: 'p' + (i + 1), title: c.title, platform: c.platform || 'Unknown', creator: c.creator || 'Brand', campaign: slug(c.campaign || 'content'), campaign_name: c.campaign || 'Content', type: c.type || 'Post', days_ago: days, date: c.date || G.addDays(end, -days), views: c.views || 0, engagement: c.engagement != null ? c.engagement : 4, clicks: c.clicks || 0, signups: c.signups || 0, activated: c.activated != null ? c.activated : r0((c.signups || 0) * 0.6), customers: c.customers || 0, revenue: c.revenue || 0, cost: c.cost || 0 }; });
    const types = [...new Set(out.content.map((c) => c.type))];
    out.content_compare = types.map((t) => { const rows = out.content.filter((c) => c.type === t), v = sum(rows, (r) => r.views), cl = sum(rows, (r) => r.clicks), su = sum(rows, (r) => r.signups), ac = sum(rows, (r) => r.activated), cu = sum(rows, (r) => r.customers), cost = sum(rows, (r) => r.cost); return { id: t, format: t, posts: rows.length, ctr: v ? r2(cl / v * 100) : 0, signup_rate: cl ? r2(su / cl * 100) : 0, activation_rate: su ? r1(ac / su * 100) : 0, cac: cu ? r0(cost / cu) : 0, revenue: sum(rows, (r) => r.revenue), activated_per_1k: v ? r2(ac / v * 1000) : 0, activated: ac }; });

    /* ---------- attribution ---------- */
    const t30 = chBy('30d'), totC = sum(t30, (c) => c.customers) || 1, totRev = sum(t30, (c) => c.revenue);
    const TOP = ['Creators', 'Instagram', 'YouTube', 'X', 'Reddit', 'Meta', 'TikTok', 'Content Syndication', 'Organic'], BOT = ['Google Ads', 'Referral', 'Organic', 'LinkedIn'];
    const MODELS = [['first', 'First touch'], ['last', 'Last touch'], ['linear', 'Linear'], ['position', 'Position-based'], ['data', 'Data-driven']];
    out.attribution = [];
    MODELS.forEach(([m, mn]) => {
      const w = t30.map((c) => { const f = m === 'first' ? (TOP.includes(c.channel) ? 1.3 : 0.85) : m === 'last' ? (BOT.includes(c.channel) ? 1.25 : 0.88) : m === 'position' ? (TOP.includes(c.channel) || BOT.includes(c.channel) ? 1.1 : 0.9) : 1; return c.customers * f; }), s = sum(w, (x) => x) || 1;
      t30.forEach((c, i) => { const cu = r0(w[i] / s * totC), rv = r0(totRev * (w[i] / s)); out.attribution.push({ id: m + '-' + c.channel, model: m, model_name: mn, source: c.channel, assisted: r0(cu * 1.5), direct: r0(cu * 0.4), customers: cu, revenue: rv, cac: cu && c.spend ? r0(c.spend / cu) : 0, roi: c.spend ? r1(rv / c.spend) : 0, share: r1(cu / totC * 100) }); });
    });
    out.influence = t30.map((c) => { const share = r0(c.customers / totC * 100), inf = Math.min(90, r0(share * 1.5 + (TOP.includes(c.channel) ? 22 : 8))), first = TOP.includes(c.channel) ? r0(share * 1.4 + 6) : r0(share * 0.6); return { id: c.channel, source: c.channel, influence: inf, credit: share, first: Math.min(60, first), role: TOP.includes(c.channel) && !BOT.includes(c.channel) ? 'Introducer' : BOT.includes(c.channel) && !TOP.includes(c.channel) ? 'Closer' : 'Assister', note: c.channel + ' ' + (TOP.includes(c.channel) ? 'introduces buyers that other channels close.' : 'closes demand that other channels create.') }; });
    const t = tot('30d');
    out.attr_journey = [['Ad', 'Paid ads and organic reach', t.impressions, 'impressions', 'Top-of-funnel reach'], ['Creator', 'Creator videos and posts', creatorAgg(30).clicks || r0(t.clicks * 0.1), 'creator clicks', 'Creators open the journey for part of your customers'], ['Landing Page', 'Landing page', t.visitors, 'visitors', 'Visitors reaching your site'], ['Signup', 'Signups', t.signups, 'signups', 'Visitors who create an account'], ['Activation', 'Activated users', t.activated, 'activated users', 'Users who reach first value'], ['Lead', 'Qualified leads', t.leads, 'qualified leads', 'Signups with buying intent'], ['Customer', 'Customers', t.customers, 'customers', 'Paying customers'], ['Revenue', 'Revenue', t.revenue, 'revenue', 'Revenue from customers acquired']].map(([stage, desc, value, unit, note], i) => ({ id: 'j' + i, order: i, stage, desc, value, unit, note }));

    /* ---------- forecast / scenarios ---------- */
    const wkDates = []; for (let i = 11; i >= 0; i--) wkDates.push(G.addDays(end, -7 * i - 6));
    const wk = (key) => Array.from({ length: 12 }, (_, i) => { const hi = 7 * (11 - i), lo = hi + 7; return sdays.slice(Math.max(0, 90 - lo), 90 - hi).reduce((s, d) => s + ((dayAgg[d] || {})[key] || (flat(key === 'traffic' ? 'visitors' : key) / 1)), 0); });
    const wS = wk('signups'), wC = wk('customers'), wR = wk('revenue');
    out.forecast_actual = wkDates.map((d, i) => ({ week: d, signups: r0(wS[i]), customers: r0(wC[i]), revenue: r0(wR[i]) }));
    const g = Math.max(-0.02, Math.min(0.04, (Math.pow(Math.max(1, wS.slice(-4).reduce((a, b) => a + b, 0)) / Math.max(1, wS.slice(-8, -4).reduce((a, b) => a + b, 0)), 0.25) - 1) || 0.01));
    const T30 = tot('30d'), b30 = { signups: T30.signups * 1.04, activated: T30.activated * 1.03, customers: T30.customers * 1.04, revenue: T30.revenue * 1.04, spend: T30.spend };
    const proj = (last, mult) => { const base = Array.from({ length: 8 }, (_, i) => last * Math.pow(1 + g, i + 1)); const sc = base.map((b, i) => b * (1 + (mult - 1) * Math.min(1, (i + 1) / 3))); return { base: base.map(r0), scenario: sc.map(r0), best: sc.map((v, i) => r0(v * (1 + 0.03 * (i + 1)))), worst: sc.map((v, i) => r0(v * (1 - 0.035 * (i + 1)))) }; };
    const crAmt = (name) => { const c = t30.find((x) => x.channel === name); return c && T30.spend ? c.spend / T30.spend : 0; };
    const effShare = (name, lvl) => { const c = t30.find((x) => x.channel === name); if (!c || !c.spend) return [1, 1, 1, 1, 1]; const extra = c.spend * lvl / 100, eff = name === 'Creators' ? 0.8 : 0.65; const m = (k) => 1 + (c[k] / c.spend * extra * eff) / Math.max(1, b30[k] || 1); return [m('signups'), m('activated'), m('customers'), m('revenue'), 1 + extra / Math.max(1, T30.spend)]; };
    const SC = [['base', 'Current trajectory', 0, 1, 1, 1, 1, 1], ['spend', 'Increase spend', 10, 1.055, 1.05, 1.05, 1.05, 1.1], ['spend', 'Increase spend', 20, 1.1, 1.09, 1.09, 1.09, 1.2], ['cut', 'Decrease spend', -10, 0.94, 0.94, 0.945, 0.945, 0.9], ['cut', 'Decrease spend', -20, 0.88, 0.885, 0.89, 0.89, 0.8], ['creators', 'Increase creator allocation', 10], ['creators', 'Increase creator allocation', 20], ['creators', 'Increase creator allocation', 30], ['conv', 'Improve conversion rate', 5, 1.03, 1.05, 1.05, 1.05, 1], ['conv', 'Improve conversion rate', 10, 1.06, 1.1, 1.1, 1.1, 1], ['conv', 'Improve conversion rate', 15, 1.09, 1.14, 1.14, 1.14, 1], ['referral', 'Increase referral allocation', 10], ['referral', 'Increase referral allocation', 20]];
    const NOTE = { base: 'No changes: current spend, mix and conversion carry forward.', spend: 'Diminishing returns beyond +20% on paid search.', cut: 'Cuts hit lower-ROAS paid channels first.', creators: 'Creator CAC stays low until about +30%; after that audiences overlap.', conv: 'Applies to visitor → signup and signup → activation.', referral: 'Referral rewards scale an efficient channel, with diminishing returns.' };
    const refFallback = t30.filter((c) => c.spend > 0 && c.roas).sort((a, b) => b.roas - a.roas)[0];
    out.scenarios = SC.map(([sid, lab, lvl, ms, ma, mc, mr, msp]) => {
      if (sid === 'creators' || sid === 'referral') { const nm = sid === 'creators' ? (t30.find((c) => c.channel === 'Creators') ? 'Creators' : refFallback && refFallback.channel) : (t30.find((c) => c.channel === 'Referral') ? 'Referral' : (refFallback && refFallback.channel)); const e = effShare(nm, lvl * (sid === 'creators' ? 1 : 0.5)); [ms, ma, mc, mr, msp] = [e[0], e[1], e[2], e[3], e[4]]; }
      const sp = b30.spend * msp, cus = b30.customers * mc;
      return { id: sid === 'base' ? 'base' : sid + (lvl > 0 ? '+' : '') + lvl, group: sid, label: lab, level: lvl, signups: r0(b30.signups * ms), activated: r0(b30.activated * ma), customers: r0(cus), revenue: r0(b30.revenue * mr), spend: r0(sp), cac: cus ? r0(sp / cus) : 0, note: NOTE[sid], proj_signups: proj(wS[11], ms), proj_customers: proj(wC[11], mc), proj_revenue: proj(wR[11], mr) };
    });
    out.forecast_kpis = [{ id: 'signups', label: 'Projected Signups', value: r0(b30.signups), current: T30.signups, unit: 'num', delta: 4.0 }, { id: 'customers', label: 'Projected Customers', value: r0(b30.customers), current: T30.customers, unit: 'num', delta: 4.0 }, { id: 'revenue', label: 'Projected Revenue', value: r0(b30.revenue), current: T30.revenue, unit: 'inr', delta: 4.0 }, { id: 'cac', label: 'Projected CAC', value: b30.customers ? r0(b30.spend / b30.customers) : 0, current: T30.customers ? r0(T30.spend / T30.customers) : 0, unit: 'inr', delta: -3.8 }, { id: 'roas', label: 'Projected ROAS', value: b30.spend ? r2(b30.revenue / b30.spend) : 0, current: T30.spend ? r2(T30.revenue / T30.spend) : 0, unit: 'x', delta: 0 }];

    /* ---------- creator + other KPI tables ---------- */
    out.creator_kpis = [];
    Object.keys(RANGES).forEach((R) => {
      const rows = out.creators.filter((c) => c.range === R), s = (k) => sum(rows, (r) => r[k]);
      [['active', 'Creators Active', rows.length], ['reach', 'Total Reach', s('followers')], ['views', 'Total Views', s('views')], ['clicks', 'Clicks', s('clicks')], ['signups', 'Signups', s('signups')], ['customers', 'Customers', s('customers')], ['cac', 'Creator CAC', s('customers') ? r0(s('spend') / s('customers')) : 0]].forEach(([m, lab, v], i) => out.creator_kpis.push({ id: R + '-' + m, range: R, metric: m, label: lab, unit: m === 'cac' ? 'inr' : 'num', value: v, prev: r0(v * (m === 'cac' ? 1.05 : 0.92)), delta: m === 'cac' ? -4.8 : 8.7, order: i, good_up: m !== 'cac' }));
    });

    /* ---------- campaign workspace data ---------- */
    out.campaign_detail = cNames.map((cn) => {
      const cid = slug(cn), mine = ads.filter((r) => r.campaign === cn), row = campRows.find((c) => c.cid === cid && c.range === '30d');
      const perf = sdays.slice(-30).map((d) => { const x = mine.filter((r) => r.date === d); return { date: d, spend: r0(sum(x, (r) => r.spend || 0)), signups: r0(sum(x, (r) => r.signups || 0)), revenue: r0(sum(x, (r) => r.revenue || 0)) }; });
      const bych = {}; mine.forEach((r) => { bych[r.channel] = (bych[r.channel] || 0) + (r.customers || 0); });
      const tc = sum(Object.values(bych), (x) => x) || 1;
      const attribution = Object.keys(bych).map((s) => ({ source: s, customers: r0(bych[s]), share: r1(bych[s] / tc * 100) })).sort((a, b) => b.customers - a.customers);
      const best = chBy('30d').filter((c) => c.roas && c.spend).sort((a, b) => b.roas - a.roas)[0], me = mine.length ? row : null;
      return { id: cid, name: cn, owner: row ? row.owner : OWNERS[0], goal: row ? row.goal : '', perf, audience: [], attribution, activity: [], rec_title: best && row && row.cac ? 'Shift budget toward ' + best.channel : 'Review this campaign', rec_text: best ? 'Move part of this campaign’s budget toward ' + best.channel + ', which returns ' + G.F.x(best.roas) + ' ROAS.' : 'Add more data to get a recommendation.', rec_reason: row && row.cac && best && best.cac ? 'This campaign’s CAC is ' + G.F.inrF(row.cac) + ' against ' + G.F.inrF(best.cac) + ' on ' + best.channel + '.' : 'Not enough data yet.', rec_impact: 'Estimated impact is calculated from your last 30 days.', rec_evidence: [{ label: 'Campaign CAC', value: row && row.cac ? G.F.inrF(row.cac) : '—' }, { label: 'Best channel', value: best ? best.channel + ' ' + G.F.x(best.roas) : '—' }, { label: 'Confidence', value: 'Medium' }] };
    });

    /* ---------- goals, sources, misc ---------- */
    const o = (meta.ws && meta.ws.company) || {};
    out.goals = [{ id: 'g1', name: 'Monthly revenue target', current: T30.revenue, target: o.revenueTarget || r0(T30.revenue * 1.2), unit: 'inr', pace: 'On track' }, { id: 'g2', name: 'Blended CAC target', current: T30.customers ? r0(T30.spend / T30.customers) : 0, target: o.cacTarget || 0, unit: 'inr', pace: 'On track' }, { id: 'g3', name: 'Signup → activation', current: T30.signups ? r1(T30.activated / T30.signups * 100) : 0, target: o.activationTarget || 60, unit: 'pct', pace: 'On track' }];
    out.experiments = []; out.reports = []; out.activity = []; out.notifications = []; out.actions = []; out.opportunities = []; out.radar_changes = [];
    const imps = P.__imports || [];
    out.datasources = imps.map((i) => ({ id: i.id, name: i.name, kind: i.type, status: 'Connected', last_sync_s: Math.max(1, Math.round((Date.now() - i.at) / 1000)), records: i.count, sync: i.sim ? 'Simulated source' : 'CSV import', account: i.fileName || i.name }));
    if (!(ads.length || revIn.length || creators.length)) ['kpis', 'funnel', 'health', 'drivers', 'series', 'attribution', 'influence', 'attr_journey', 'scenarios', 'forecast_actual', 'forecast_kpis', 'goals', 'channels', 'campaigns', 'creatives', 'creator_kpis', 'campaign_detail'].forEach((k) => (out[k] = []));
    out.__meta = { end, hasDates, estimated: { visitors: !HAS.visitors && ads.length > 0, activated: !HAS.activated && ads.length > 0, leads: !HAS.leads && ads.length > 0, customers: !HAS.customers && !revIn.length && ads.length > 0 } };
    return out;
  };
})();
