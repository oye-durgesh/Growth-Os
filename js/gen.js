(function () {
  'use strict';
  /* Deterministic synthetic-data generator.
     Produces canonical records (the same shape a CSV import produces) so demo
     workspaces, simulated connectors and sample CSVs all share one pipeline. */
  const G = window.G;
  const END = '2026-10-27';
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let a = typeof seed === 'string' ? hash(seed) : seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  G.hash = hash; G.rng = rng;
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  G.addDays = addDays; G.END = END;

  /* Channel economics per profile: share of budget, CPM, CTR %, click→signup %, activation %, signup→customer %, ACV */
  const CH = {
    saas: {
      brand: 'Loop', scale: 0.3,
      ch: { 'Google Ads': [.34, 380, 3.1, 6.2, 58, 3.9, 9500, 2.6], Meta: [.24, 190, 1.0, 3.1, 42, 1.6, 8200, 1.2], LinkedIn: [.10, 1100, .65, 5.0, 61, 5.2, 12500, 1.9], Referral: [.06, 420, 3.2, 12, 74, 11, 9800, 7.5], Creators: [.14, 150, 2.0, 8.4, 56, 5.5, 8800, 4.2], Organic: [0, 0, 2.2, 5.6, 63, 4.6, 9500], Reddit: [.12, 260, 1.7, 3.8, 52, 2.4, 8400, 1.4] },
      camps: [['Product-led Launch', { 'Google Ads': 3, Meta: 2, Organic: 2, Reddit: 1 }], ['Creator Partnerships', { Creators: 4, Referral: 1 }], ['Retargeting', { Meta: 3, 'Google Ads': 1 }], ['Founder Content', { LinkedIn: 3, Organic: 1, Reddit: 1 }], ['Referral Program', { Referral: 4 }]],
      creators: [['@SaaSSundays', 'YouTube', 86000, 'Tech reviews'], ['@BuildWithNeha', 'Instagram', 41000, 'Founders'], ['@ShipItDaily', 'YouTube Shorts', 212000, 'Indie hackers'], ['@NoCodeNitin', 'YouTube', 33000, 'Productivity'], ['@TeamStackTips', 'LinkedIn', 58000, 'Remote work'], ['@ViralVikas', 'Instagram', 640000, 'Lifestyle'], ['@ProductWithPriya', 'YouTube', 27000, 'Founders']],
      ext: { hv: 5, li: 3 }, crt: ['Free plan, no card', 'Set up in 5 minutes', 'Ship faster with Loop', 'Loop vs spreadsheets', 'Team workspace demo', 'Customer story: Fable Labs'],
      content: [['Loop in 60 seconds', 'YouTube', 'Demo video'], ['Why we ditched spreadsheets', 'LinkedIn', 'Founder story'], ['Loop vs the old way', 'YouTube', 'Product tutorial'], ['Launch week recap', 'X', 'Announcement'], ['Teams that ship weekly', 'Instagram', 'Customer story'], ['5 workflows to automate', 'YouTube', 'Product tutorial'], ['Introducing Loop 2.0', 'LinkedIn', 'Announcement']],
    },
    b2b: {
      brand: 'Acme', scale: 1.9,
      ch: { 'Google Ads': [.36, 520, 2.6, 4.4, 66, 5.8, 74000, 3.1], LinkedIn: [.30, 1300, .62, 3.6, 70, 6.5, 96000, 2.2], Meta: [.08, 210, .8, 1.9, 44, 1.8, 52000, .9], 'Content Syndication': [.10, 640, .9, 3.1, 61, 3.2, 68000, 1.6], Referral: [.05, 520, 2.8, 9.0, 77, 12, 88000, 8.5], Creators: [.04, 160, 1.7, 5.2, 58, 3.4, 61000, 3.4], Organic: [0, 0, 1.9, 4.8, 68, 6.2, 78000], X: [.07, 230, .7, 1.7, 46, 1.4, 48000, .8] },
      camps: [['Enterprise ABM', { LinkedIn: 4, 'Google Ads': 2, Organic: 1 }], ['Demand Gen Search', { 'Google Ads': 5, Organic: 2 }], ['Webinar Series', { 'Content Syndication': 3, LinkedIn: 2, Organic: 1 }], ['Partner Referral', { Referral: 4, Creators: 1 }], ['Brand Awareness', { Meta: 3, X: 2, Creators: 1 }]],
      creators: [['@CFOWeekly', 'LinkedIn', 94000, 'Founders'], ['@OpsGuruRavi', 'YouTube', 52000, 'Remote work'], ['@SaaSMetricsMaya', 'LinkedIn', 38000, 'Tech reviews'], ['@GrowthGossip', 'X', 410000, 'Lifestyle'], ['@B2BBytes', 'YouTube', 29000, 'Dev tutorials'], ['@RevOpsRohit', 'LinkedIn', 17000, 'Productivity']],
      ext: { hv: 3, li: 2 }, crt: ['Cut month-end close by 40%', 'See Acme in 15 minutes', 'ROI calculator', 'Case study: Northwind', 'Book a live demo', 'Ops teams: stop the spreadsheets'],
      content: [['Month-end close, automated', 'LinkedIn', 'Demo video'], ['The CFO playbook', 'LinkedIn', 'Founder story'], ['Acme product tour', 'YouTube', 'Product tutorial'], ['Q3 product release', 'X', 'Announcement'], ['Northwind case study', 'LinkedIn', 'Customer story'], ['Ops efficiency benchmark 2026', 'LinkedIn', 'Research report']],
    },
    ecom: {
      brand: 'Kora', scale: 1.1,
      ch: { Meta: [.30, 180, 1.6, 2.4, 70, 22, 1900, 2.4], Instagram: [.22, 160, 1.4, 2.2, 66, 20, 1800, 2.0], 'Google Ads': [.22, 330, 3.4, 4.0, 72, 26, 2100, 3.4], Creators: [.10, 130, 2.6, 4.6, 74, 24, 2300, 4.8], YouTube: [.08, 150, 1.0, 2.0, 62, 14, 1800, 1.7], Referral: [.04, 300, 3.0, 7.0, 82, 30, 2200, 7.2], Organic: [0, 0, 2.4, 3.8, 70, 24, 2000], TikTok: [.04, 110, 1.9, 1.6, 55, 10, 1600, 1.2] },
      camps: [['Festive Sale', { Meta: 4, Instagram: 3, 'Google Ads': 3 }], ['New Collection', { Instagram: 3, Creators: 3, YouTube: 1 }], ['Retargeting', { Meta: 3, 'Google Ads': 2 }], ['Refer a Friend', { Referral: 3, Organic: 1 }], ['TikTok Trial', { TikTok: 4 }]],
      creators: [['@StyleByAnaya', 'Instagram', 310000, 'Lifestyle'], ['@HomeWithHarsh', 'YouTube', 120000, 'Lifestyle'], ['@ThriftTanvi', 'Instagram', 48000, 'Lifestyle'], ['@ReelsRiyaR', 'Instagram', 880000, 'Lifestyle'], ['@GiftGuruGaurav', 'YouTube Shorts', 66000, 'Lifestyle']],
      ext: { hv: 7, li: 4 }, crt: ['Festive — flat 30% off', 'Free shipping over ₹999', 'New arrivals', 'Customer reviews reel', 'Bundle & save', 'Last chance: ends tonight'],
      content: [['Festive haul', 'Instagram', 'Demo video'], ['Styling 5 ways', 'Instagram', 'Product tutorial'], ['Unboxing the new collection', 'YouTube', 'Demo video'], ['Sale announcement', 'X', 'Announcement'], ['Customer stories', 'Instagram', 'Customer story'], ['Gift guide 2026', 'YouTube', 'Product tutorial']],
    },
  };
  G.PROFILES = { saas: 'SaaS Growth Demo', b2b: 'B2B GTM Demo', ecom: 'E-commerce Growth Demo', wispr: 'Wispr Flow — India GTM' };
  const NAMES = ['Aarav Shah', 'Diya Menon', 'Rohan Gupta', 'Meera Nair', 'Kabir Singh', 'Ananya Rao', 'Vikram Iyer', 'Ishita Bose', 'Arjun Reddy', 'Sneha Kulkarni', 'Nikhil Jain', 'Pooja Desai', 'Rahul Verma', 'Tanya Kapoor', 'Siddharth Joshi', 'Neha Pillai', 'Aditya Malhotra', 'Kavya Srinivasan', 'Yash Agarwal', 'Riya Chatterjee', 'Manish Tiwari', 'Shruti Bhat', 'Karan Mehra', 'Lavanya Krishnan', 'Harsh Vora', 'Aisha Khan', 'Dev Patel', 'Ira Banerjee'];
  const COMPANIES = ['Northwind Labs', 'Blue Orchard', 'Fable Systems', 'Quanta Retail', 'Helio Health', 'Marlow & Co', 'Stackwise', 'Lumen Logistics', 'Pinecone Foods', 'Atlas Fintech', 'Orbit Studios', 'Saffron Labs', 'Kite Analytics', 'Nimbus Cloud', 'Vega Mobility', 'Cobalt Edu', 'Zephyr Apparel', 'Redwood Ventures'];
  const STAGES = ['New', 'Contacted', 'Qualified', 'Meeting', 'Opportunity', 'Customer'];
  const DEAL_STAGES = ['New', 'Contacted', 'Qualified', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Lost'];
  const OWNERS = ['Shreya Pillai', 'Aarav Mehta', 'Rohan Iyer', 'Meera Kapoor', 'Diya Nair'];

  function days(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(addDays(END, -i)); return out; }
  const dow = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();

  /* Ad rows for a set of channels. `only` restricts to some channels (simulated connectors). */
  G.genAds = (prof, only, span) => {
    const P = CH[prof]; if (!P) return [];
    const R = rng(prof + '-ads'), rows = [], ds = days(span || 90), carry = {};
    const totalMonthly = 1255000 * P.scale; // monthly paid budget
    const campW = P.camps.map(([n, w]) => [n, w]);
    // weight each campaign-channel pair
    const chWeight = {}; campW.forEach(([n, w]) => Object.keys(w).forEach((c) => (chWeight[c] = (chWeight[c] || 0) + w[c])));
    Object.keys(P.ch).forEach((c) => {
      if (only && !only.includes(c)) return;
      const [share, cpm, ctr, su, act, cust, acv, roasT] = P.ch[c];
      const creatives = (c === 'Meta' || c === 'Google Ads' || c === 'Instagram' || c === 'LinkedIn') ? 3 : 1;
      campW.forEach(([cn, w], ci) => {
        if (!w[c]) return;
        const frac = w[c] / chWeight[c];
        for (let k = 0; k < creatives; k++) {
          const creative = creatives > 1 ? P.crt[(hash(cn + c) + k) % P.crt.length] : '';
          const cShare = creatives > 1 ? [0.5, 0.3, 0.2][k] : 1;
          const ctrMul = creatives > 1 ? [1.0, 1.25, 0.8][k] : 1;
          // one creative on the largest paid channel is fatiguing: CTR falls over the last 3 weeks
          const fatigue = (c === (P.ext.fat || Object.keys(P.ch)[0]) && ci === 0 && k === 0 && creatives > 1);
          ds.forEach((d, di) => {
            const ck = cn + '|' + c + '|' + k;
            const wk = [0.78, 1.04, 1.1, 1.08, 1.06, 1.0, 0.85][dow(d)];
            const trend = 1 + 0.0016 * (di - (ds.length - 1) / 2);
            const n = 0.86 + R() * 0.28;
            const base = share > 0 ? totalMonthly * share * frac * cShare / 30 : 0;
            const spend = Math.round(base * wk * trend * n);
            const organicLevel = share === 0 ? (totalMonthly * 0.00003 * frac * cShare) : 0;
            const f = fatigue ? (di > ds.length - 22 ? Math.max(0.5, 1 - (di - (ds.length - 22)) * 0.025) : 1) : 1;
            const impressions = spend > 0 ? Math.round(cpm ? spend / cpm * 1000 : spend * 40) : Math.round(organicLevel * 1000 * wk * n);
            const clicks = Math.round(impressions * (ctr / 100) * ctrMul * f * (0.93 + R() * 0.14));
            const visitors = Math.round(clicks * (0.74 + R() * 0.08));
            const cr = (carry[ck] = carry[ck] || { s: 0, a: 0, c: 0, l: 0 });
            const takeInt = (key, v) => { cr[key] += v; const i = Math.floor(cr[key]); cr[key] -= i; return i; };
            const signups = takeInt('s', clicks * (su / 100) * (0.92 + R() * 0.16));
            const activated = Math.min(signups, takeInt('a', signups * (act / 100) * (0.93 + R() * 0.14)));
            const customers = takeInt('c', roasT && spend > 0 ? spend * roasT / acv * (0.8 + R() * 0.4) : signups * (cust / 100) * (0.8 + R() * 0.4));
            const revenue = Math.round(customers * acv * (0.88 + R() * 0.24));
            const leadsN = takeInt('l', signups * 0.14);
            rows.push({ date: d, campaign: cn, channel: c, creative: creative || undefined, spend, impressions, clicks, visitors, signups, activated, customers, revenue, leads: leadsN });
          });
        }
      });
    });
    return rows;
  };

  G.genCreators = (prof) => {
    const P = CH[prof]; if (!P) return [];
    const R = rng(prof + '-cr'), out = [];
    const arche = P.creators.map((c, i) => (i === 2 || (prof === 'ecom' && i === 3) ? 'viral' : i === 1 ? 'small' : 'normal'));
    P.creators.forEach(([handle, platform, followers, niche], i) => {
      const a = arche[i];
      const reach = followers * (0.2 + R() * 0.12);
      const views = Math.round(reach * (a === 'viral' ? 1.6 : 1));
      const ctr = a === 'viral' ? 0.8 : a === 'small' ? 3.9 : 1.5 + R() * 1.4;
      const clicks = Math.round(views * ctr / 100);
      const su = a === 'viral' ? 2.6 : a === 'small' ? 11 : 6 + R() * 4;
      const signups = Math.round(clicks * su / 100);
      const activated = Math.round(signups * (a === 'viral' ? 0.43 : 0.6 + R() * 0.12));
      const acv = Object.values(P.ch)[0][6];
      const customers = Math.round(signups * (a === 'viral' ? 0.018 : a === 'small' ? 0.075 : 0.04 + R() * 0.02));
      const spend = Math.round((a === 'viral' ? 62000 : a === 'small' ? 14000 : 26000 + R() * 20000) * P.scale);
      out.push({ creator: handle, platform, campaign: P.camps[1 % P.camps.length][0], followers, views, clicks, signups, activated, customers, spend, revenue: Math.round(customers * acv * (0.9 + R() * 0.2)) });
    });
    return out;
  };

  G.genLeads = (prof, n) => {
    const P = CH[prof]; if (!P) return [];
    const R = rng(prof + '-lead'), out = [], srcs = Object.keys(P.ch);
    for (let i = 0; i < (n || 34); i++) {
      const name = NAMES[(i * 7 + hash(prof)) % NAMES.length], company = COMPANIES[(i * 5 + hash(prof)) % COMPANIES.length];
      const stage = STAGES[Math.min(5, Math.floor(Math.pow(R(), 1.7) * 6))];
      const score = Math.round(Math.min(98, 30 + R() * 60 + (stage === 'New' || stage === 'Contacted' ? 8 : 0)));
      const camp = P.camps[Math.floor(R() * P.camps.length)][0];
      out.push({ name, company, email: name.toLowerCase().replace(/ /g, '.') + '@' + company.toLowerCase().replace(/[^a-z]/g, '') + '.example', source: srcs[Math.floor(R() * srcs.length)], campaign: camp, stage, score, signup_date: addDays(END, -Math.floor(R() * 55)), owner: OWNERS[i % OWNERS.length], value: Math.round((12 + R() * 90) * 1000 * P.scale), last_activity_days: stage === 'Customer' ? 2 : Math.floor(R() * 9), pricing_visits: score > 70 ? 1 + Math.floor(R() * 4) : Math.floor(R() * 2) });
    }
    return out.filter((l, i, a) => a.findIndex((x) => x.email === l.email) === i);
  };

  G.genDeals = (prof) => {
    const P = CH[prof]; if (!P) return [];
    const R = rng(prof + '-deal'), out = [], srcs = Object.keys(P.ch);
    COMPANIES.slice(0, 16).forEach((co, i) => {
      const stage = DEAL_STAGES[Math.min(7, Math.floor(Math.pow(R(), 1.3) * 8))];
      const last = stage === 'Won' || stage === 'Lost' ? 3 : Math.floor(R() * 14);
      out.push({ company: co + (i > 11 ? ' ' + (i - 10) : ''), value: Math.round((18 + R() * 140) * 1000 * P.scale), stage, owner: OWNERS[i % OWNERS.length], probability: { New: 10, Contacted: 15, Qualified: 30, Meeting: 45, Proposal: 60, Negotiation: 80, Won: 100, Lost: 0 }[stage], source: srcs[Math.floor(R() * srcs.length)], campaign: P.camps[i % P.camps.length][0], contact: NAMES[(i * 3) % NAMES.length], last_activity_days: last });
    });
    return out;
  };

  G.genContent = (prof) => {
    const P = CH[prof]; if (!P) return [];
    const R = rng(prof + '-cnt'), out = [], cr = P.creators;
    P.content.forEach(([title, platform, type], i) => {
      const demo = type === 'Demo video' || type === 'Product tutorial';
      const views = Math.round((18000 + R() * 90000) * (type === 'Announcement' ? 1.4 : 1));
      const clicks = Math.round(views * (demo ? 0.027 : 0.017) * (0.85 + R() * 0.3));
      const signups = Math.round(clicks * (demo ? 0.095 : 0.07));
      const activated = Math.round(signups * (demo ? 0.66 : 0.5));
      const customers = Math.round(signups * (demo ? 0.05 : 0.03));
      const acv = Object.values(P.ch)[0][6];
      out.push({ title, platform, creator: cr[i % cr.length][0], type, date: addDays(END, -Math.floor(R() * 75)), views, engagement: +(3 + R() * 6).toFixed(1), clicks, signups, activated, customers, revenue: Math.round(customers * acv), cost: Math.round(8000 * P.scale * (0.6 + R())) });
    });
    return out;
  };

  /* Public: a full canonical pool for a demo profile. */
  G.gen = (prof, o) => {
    if (!CH[prof]) prof = 'saas';
    const pool = { ad: G.genAds(prof), creator: G.genCreators(prof), lead: G.genLeads(prof), customer: [], pipeline: G.genDeals(prof), revenue: [], content: G.genContent(prof), custom: [] };
    pool.__brand = CH[prof].brand;
    return pool;
  };

  /* ---------- simulated connectors ---------- */
  G.CONNECTORS = [
    { group: 'Advertising', items: [
      { id: 'meta', name: 'Meta Ads', kind: 'ad', channels: ['Meta', 'Instagram'], uses: 'Spend, impressions, clicks, CTR, conversions, campaign, ad set, creative' },
      { id: 'gads', name: 'Google Ads', kind: 'ad', channels: ['Google Ads'], uses: 'Spend, impressions, clicks, CTR, conversions, campaign, creative' },
      { id: 'lia', name: 'LinkedIn Ads', kind: 'ad', channels: ['LinkedIn'], uses: 'Spend, impressions, clicks, conversions, campaign' },
      { id: 'tt', name: 'TikTok Ads', kind: 'ad', channels: ['TikTok', 'X'], uses: 'Spend, impressions, clicks, conversions, creative' }] },
    { group: 'Analytics', items: [
      { id: 'ga4', name: 'Google Analytics', kind: 'analytics', channels: ['Organic', 'Referral'], uses: 'Sessions, signups, organic and referral traffic' },
      { id: 'web', name: 'Website / Product analytics', kind: 'analytics', channels: ['Organic'], uses: 'Visitors, signups, activation events' }] },
    { group: 'CRM', items: [
      { id: 'hubspot', name: 'HubSpot', kind: 'lead', uses: 'Leads, stages, owners, deals' },
      { id: 'sfdc', name: 'Salesforce', kind: 'lead', uses: 'Leads, opportunities, owners' },
      { id: 'csv-crm', name: 'CSV upload', kind: 'csv', csvType: 'lead', uses: 'Any lead or pipeline export' }] },
    { group: 'Content & Creator', items: [
      { id: 'yt', name: 'YouTube', kind: 'content', uses: 'Video views, clicks, content performance' },
      { id: 'ig', name: 'Instagram', kind: 'content', uses: 'Reels and posts, reach, engagement' },
      { id: 'x', name: 'X', kind: 'content', uses: 'Posts, impressions, link clicks' },
      { id: 'li', name: 'LinkedIn', kind: 'content', uses: 'Posts, impressions, link clicks' },
      { id: 'cr-csv', name: 'Creator campaign CSV', kind: 'csv', csvType: 'creator', uses: 'Creator views, clicks, signups and payouts' }] },
    { group: 'Revenue', items: [
      { id: 'stripe', name: 'Stripe', kind: 'revenue', uses: 'Payments, customers, revenue by source' },
      { id: 'crm-rev', name: 'CRM revenue data', kind: 'revenue', uses: 'Closed-won revenue by source' },
      { id: 'rev-csv', name: 'CSV upload', kind: 'csv', csvType: 'revenue', uses: 'Revenue and customers by channel and date' }] },
  ];
  G.connectorById = (id) => { let f = null; G.CONNECTORS.forEach((g) => g.items.forEach((i) => { if (i.id === id) f = i; })); return f; };

  /* Deterministic rows for a simulated connector. `prof` decides the business behind the account. */
  G.simulate = (cn, prof) => {
    prof = prof || 'b2b';
    if (cn.kind === 'ad') return { type: 'ad', rows: G.genAds(prof, cn.channels).map((r) => Object.assign({}, r)) };
    if (cn.kind === 'analytics') return { type: 'ad', rows: G.genAds(prof, cn.channels).map((r) => Object.assign({}, r, { spend: 0, creative: undefined })) };
    if (cn.kind === 'creator') return { type: 'creator', rows: G.genCreators(prof) };
    if (cn.kind === 'lead') return { type: cn.id === 'sfdc' ? 'pipeline' : 'lead', rows: cn.id === 'sfdc' ? G.genDeals(prof) : G.genLeads(prof) };
    if (cn.kind === 'content') return { type: 'content', rows: G.genContent(prof).filter((_, i) => i % 5 === (hash(cn.id) % 5) || i % 2 === 0) };
    if (cn.kind === 'revenue') {
      const ads = G.genAds(prof); const m = {};
      ads.forEach((r) => { const k = r.date + '|' + r.channel; m[k] = m[k] || { date: r.date, channel: r.channel, customers: 0, revenue: 0 }; m[k].customers += r.customers; m[k].revenue += r.revenue; });
      return { type: 'revenue', rows: Object.values(m) };
    }
    return { type: 'ad', rows: [] };
  };

  /* Sum creative-level rows into one row per day, campaign and channel. */
  G.collapseAds = (rows) => {
    const m = {}, nums = ['spend', 'impressions', 'clicks', 'visitors', 'signups', 'activated', 'customers', 'revenue', 'leads'];
    rows.forEach((r) => { const k = r.date + '|' + r.campaign + '|' + r.channel; if (!m[k]) { m[k] = { date: r.date, campaign: r.campaign, channel: r.channel }; nums.forEach((n) => (m[k][n] = 0)); } nums.forEach((n) => (m[k][n] += r[n] || 0)); });
    return Object.values(m);
  };

  /* Sample CSV text for the "Download sample CSV" links. */
  G.sampleCsv = (type) => {
    const T = G.TYPES[type]; if (!T) return '';
    const prof = 'b2b';
    let rows;
    if (type === 'ad') rows = G.collapseAds(G.genAds(prof).filter((r) => r.date >= addDays(END, -13))).slice(0, 60);
    else if (type === 'creator') rows = G.genCreators(prof);
    else if (type === 'lead') rows = G.genLeads(prof, 20);
    else if (type === 'pipeline') rows = G.genDeals(prof);
    else if (type === 'content') rows = G.genContent(prof);
    else if (type === 'revenue') rows = G.simulate({ kind: 'revenue' }, prof).rows.filter((r) => r.date >= addDays(END, -6));
    else if (type === 'customer') rows = G.genLeads(prof, 12).map((l) => ({ name: l.name, company: l.company, source: l.source, campaign: l.campaign, date: l.signup_date, revenue: l.value }));
    else rows = [{ metric: 'example', value: 1 }];
    const cols = type === 'custom' ? ['metric', 'value'] : Object.keys(T.fields).map((k) => T.fields[k][2][0]);
    const keys = type === 'custom' ? cols : Object.keys(T.fields);
    const body = rows.map((r) => { const o = {}; keys.forEach((k, i) => (o[cols[i]] = r[k])); return o; });
    return G.csv.stringify(cols, body);
  };

  /* A messy sample used by the guided demo upload so validation has something real to flag. */
  G.messyCsv = () => {
    const ads = G.collapseAds(G.genAds('b2b'));
    const cols = ['date', 'campaign_name', 'channel', 'spend', 'impressions', 'clicks', 'signups', 'activated', 'customers', 'revenue'];
    const R = rng('messy');
    const body = ads.map((r, i) => ({ date: r.date, campaign_name: r.campaign, channel: r.channel, spend: r.spend, impressions: r.impressions, clicks: r.clicks, signups: r.signups, activated: r.activated, customers: r.customers, revenue: r.revenue }));
    body.forEach((r, i) => { if (i % 53 === 7) r.campaign_name = ''; if (i % 71 === 11) r.revenue = ''; if (i % 197 === 3) r.spend = 'n/a'; });
    for (let i = 0; i < 4; i++) body.push(Object.assign({}, body[10 + i * 3]));
    return G.csv.stringify(cols, body);
  };
})();
