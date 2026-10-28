(function () {
  'use strict';
  /* GTM Radar engine: normalized metrics → signals → priorities → Ask answers.
     Nothing here is hard-coded to a company: every sentence is computed from the
     active workspace's metrics (G.derive output, or the Wispr demo dataset). */
  const G = window.G, F = G.F;
  const RS = ['7d', '30d', '90d'], r0 = Math.round;
  const EFF = { Creators: 0.8, Referral: 0.65 };
  const J = JSON.stringify;
  const cache = new WeakMap();
  const x1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

  function source() {
    const w = G.WS.active(), mode = G.WS.mode(w), wd = mode === 'demo' && w.base === 'wispr';
    const D = wd ? null : G.derived(w, mode);
    return { w, mode, wd, D, key: wd ? G.rawRows : D, get: (id) => (wd ? G.rawRows(id) : D[id]) || [] };
  }

  /* spend-shift model on a month of channel rows */
  function shift(chs, frm, to, amt) {
    const s = chs.find((c) => c.channel === frm), d = chs.find((c) => c.channel === to);
    if (!s || !d || !s.spend || !d.spend) return { customers: 0, revenue: 0, leads: 0, signups: 0 };
    const A = Math.min(amt, s.spend), e = EFF[to] || 0.9, o = {};
    ['signups', 'customers', 'revenue', 'leads'].forEach((k) => (o[k] = A * ((d[k] || 0) / d.spend * e - (s[k] || 0) / s.spend)));
    return o;
  }
  const round5k = (v) => Math.max(5000, Math.round(v / 5000) * 5000);

  function buildSignals(S) {
    const out = [], chAll = S.get('channels'), cmpAll = S.get('campaigns'), crAll = S.get('creators'), crvAll = S.get('creatives'), cont = S.get('content_compare'), leads = S.get('leads'), deals = S.get('deals');
    RS.forEach((R) => {
      const list = [];
      const ch = chAll.filter((c) => c.range === R), cmp = cmpAll.filter((c) => c.range === R), cr = crAll.filter((c) => c.range === R), crv = crvAll.filter((c) => c.range === R);
      const m30 = chAll.filter((c) => c.range === '30d');
      const paid = ch.filter((c) => c.spend > 0 && c.customers > 0 && c.cac);
      const totSpend = ch.reduce((s, c) => s + c.spend, 0) || 1;
      const add = (o) => list.push(o);

      /* 1 — best channel vs the rest */
      if (paid.length >= 2) {
        const best = paid.slice().sort((a, b) => b.roas - a.roas)[0], others = paid.filter((c) => c !== best);
        const oSpend = others.reduce((s, c) => s + c.spend, 0), oCust = others.reduce((s, c) => s + c.customers, 0), oRev = others.reduce((s, c) => s + c.revenue, 0);
        const oCac = oCust ? oSpend / oCust : 0, oRoas = oSpend ? oRev / oSpend : 0, ratio = oCac && best.cac ? oCac / best.cac : 0;
        const worst = others.filter((c) => c.spend > 8000).sort((a, b) => a.roas - b.roas)[0];
        if (ratio >= 1.25 && worst) {
          const amt = round5k(worst.spend * 0.25), m = m30.find((c) => c.channel === worst.channel), sh = shift(m30, worst.channel, best.channel, amt * (30 / ({ '7d': 7, '30d': 30, '90d': 90 }[R])) > 0 ? amt : amt);
          const small = best.spend / totSpend < 0.08;
          add({ kind: small ? 'small-roas' : 'best-channel', cat: small ? 'opportunity' : 'winning', score: 100 + (ratio - 1) * 30, owner: 'Marketing', level: 'High', cta: 'View opportunity',
            what: small ? `${best.channel} returns ${F.x(best.roas)} ROAS on only ${r0(best.spend / totSpend * 100)}% of spend.` : `${best.channel} acquires customers ${x1(ratio)}× more efficiently than your other paid channels.`,
            evidence: `${best.channel} CAC ${F.inrF(best.cac)} vs ${F.inrF(oCac)} across the others; ${F.n(best.customers)} customers on ${F.inr(best.spend)}.`,
            impact: `Buying the same ${F.n(best.customers)} customers at the other channels’ CAC would cost about ${F.inr(Math.max(0, (oCac - best.cac) * best.customers))} more.`,
            action: `Shift ${F.inr(amt)} per month from ${worst.channel} to ${best.channel}.`, apply: `Move ${F.inr(amt)} per month from ${worst.channel} to ${best.channel} for the next 30 days?`, go: 'channels', go_opts: {}, inv: 'attribution', inv_opts: {},
            cause: [`Channel: ${best.channel} — ROAS ${F.x(best.roas)} vs ${F.x(oRoas)} for the rest`, `Worst return: ${worst.channel} at ${F.x(worst.roas)} ROAS and ${F.inrF(worst.cac)} CAC`, `${best.channel} holds ${r0(best.spend / totSpend * 100)}% of spend but ${r0(best.customers / (paid.reduce((s, c) => s + c.customers, 0) || 1) * 100)}% of paid-attributed customers`],
            expected: `+${Math.max(0, r0(sh.customers))} customers and +${F.inr(Math.max(0, sh.revenue))} revenue per month from ${F.inr(amt)} shifted`, conf: ratio > 2 ? 86 : 74,
            sim: { moves: [{ frm: worst.channel, to: best.channel, amount: amt }] }, proj: [['Customers / month', '+' + Math.max(0, r0(sh.customers))], ['Qualified leads / month', '+' + Math.max(0, r0(sh.leads))], ['Revenue / month', '+' + F.inr(Math.max(0, sh.revenue))]],
            ev: { rec: `Shift budget from ${worst.channel} to ${best.channel}`, a: { title: worst.channel, rows: [['ROAS', F.x(worst.roas)], ['CAC', F.inrF(worst.cac)], ['Customers', F.n(worst.customers)], ['Activation', F.pct(worst.activation)]] }, b: { title: best.channel, rows: [['ROAS', F.x(best.roas)], ['CAC', F.inrF(best.cac)], ['Customers', F.n(best.customers)], ['Activation', F.pct(best.activation)]] }, pattern: `${best.channel} is generating more customers per rupee than ${worst.channel}.`, result: `Shifting ${F.inr(amt)}/month adds about ${Math.max(0, r0(sh.customers))} customers at the same total spend.` },
            top: best.channel, low: worst.channel, amt });
        }
        /* creators-vs-paid style opportunity when the best channel is not the biggest */
        const big = paid.slice().sort((a, b) => b.spend - a.spend)[0];
        if (big && big !== best && big.roas && best.roas / big.roas >= 1.6 && !list.some((s) => s.kind === 'best-channel' && s.top === best.channel && s.low === big.channel)) {
          const amt = round5k(big.spend * 0.2), sh = shift(m30, big.channel, best.channel, amt);
          add({ top: best.channel, kind: 'outperform', cat: 'opportunity', score: 92 + best.roas / big.roas * 4, owner: 'Marketing', level: 'High', cta: 'View opportunity',
            what: `${best.channel} is outperforming ${big.channel} by ${x1(best.roas - big.roas)}× ROAS.`, evidence: `${best.channel} ${F.x(best.roas)} ROAS vs ${big.channel} ${F.x(big.roas)}; ${big.channel} takes ${r0(big.spend / totSpend * 100)}% of spend.`, impact: `${big.channel} is your biggest budget line but returns ${r0(big.roas / best.roas * 100)}% of ${best.channel}’s ROAS.`,
            action: `Shift budget toward ${best.channel}.`, apply: `Shift ${F.inr(amt)} per month from ${big.channel} to ${best.channel}?`, go: 'forecast', go_opts: {}, inv: 'channels', inv_opts: {}, cause: [`${big.channel}: ${F.inr(big.spend)} spent, ${F.x(big.roas)} ROAS`, `${best.channel}: ${F.inr(best.spend)} spent, ${F.x(best.roas)} ROAS`],
            expected: `+${Math.max(0, r0(sh.customers))} customers per month from ${F.inr(amt)} shifted`, conf: 70, sim: { moves: [{ frm: big.channel, to: best.channel, amount: amt }] }, proj: [['Customers / month', '+' + Math.max(0, r0(sh.customers))], ['Revenue / month', '+' + F.inr(Math.max(0, sh.revenue))]],
            ev: { rec: `Shift budget toward ${best.channel}`, a: { title: big.channel, rows: [['ROAS', F.x(big.roas)], ['CAC', F.inrF(big.cac)], ['Spend', F.inr(big.spend)]] }, b: { title: best.channel, rows: [['ROAS', F.x(best.roas)], ['CAC', F.inrF(best.cac)], ['Spend', F.inr(best.spend)]] }, pattern: `${best.channel} converts spend into revenue more efficiently than ${big.channel}.`, result: 'Modeled on your last 30 days of data.' } });
        }
      }

      /* 2 — content formats */
      const cf = cont.filter((c) => c.activated_per_1k > 0 && c.posts >= 1);
      if (cf.length >= 2) {
        const hi = cf.slice().sort((a, b) => b.activated_per_1k - a.activated_per_1k)[0], lo = cf.slice().sort((a, b) => a.activated_per_1k - b.activated_per_1k)[0], ratio = hi.activated_per_1k / lo.activated_per_1k;
        if (ratio >= 1.3) add({ kind: 'content-format', cat: 'winning', score: 70 + ratio * 4, owner: 'Content', level: 'Medium', cta: 'Open campaign', what: `${hi.format} activate ${x1(ratio)}× more users per 1,000 views than ${lo.format.toLowerCase()}.`, evidence: `${hi.activated_per_1k} vs ${lo.activated_per_1k} activated users per 1K views.`, impact: 'Content that activates is cheaper to scale than content that only earns views.', action: `Brief creators to lead with a ${hi.format.toLowerCase().replace(/s$/, '')}.`, apply: `Update the next creator brief to lead with ${hi.format.toLowerCase()}?`, go: 'content', go_opts: {}, inv: 'content', inv_opts: {}, cause: [`${hi.format}: ${F.pct(hi.ctr, 2)} CTR, ${F.pct(hi.activation_rate)} activation`, `${lo.format}: ${F.pct(lo.ctr, 2)} CTR, ${F.pct(lo.activation_rate)} activation`], expected: `${x1(ratio)}× more activated users per view on new content`, conf: 78, ev: { rec: `Lead with ${hi.format.toLowerCase()}`, a: { title: lo.format, rows: [['Activated / 1K views', String(lo.activated_per_1k)], ['CTR', F.pct(lo.ctr, 2)], ['Posts', String(lo.posts)]] }, b: { title: hi.format, rows: [['Activated / 1K views', String(hi.activated_per_1k)], ['CTR', F.pct(hi.ctr, 2)], ['Posts', String(hi.posts)]] }, pattern: `${hi.format} bring users who activate.`, result: 'Based on tracked content performance.' } });
      }

      /* 3 — weak activation */
      const act = ch.filter((c) => c.signups >= 30 && c.activation > 0), avgAct = act.length ? act.reduce((s, c) => s + c.activated, 0) / Math.max(1, act.reduce((s, c) => s + c.signups, 0)) * 100 : 0;
      const weakAct = act.filter((c) => c.activation < avgAct - 7).sort((a, b) => a.activation - b.activation);
      if (weakAct.length) add({ kind: 'weak-activation', cat: 'leaking', score: 85, owner: 'Product', level: 'High', cta: 'Create experiment', what: `Only ${F.pct(avgAct)} of signups activate; ${weakAct.slice(0, 2).map((c) => c.channel).join(' and ')} fall${weakAct.length === 1 ? 's' : ''} below ${F.pct(Math.round(avgAct - 7))}.`, evidence: weakAct.slice(0, 3).map((c) => `${c.channel} ${F.pct(c.activation)}`).join(' · ') + ` vs ${F.pct(avgAct)} average.`, impact: 'Every activation point lost here is paid for twice: once in acquisition, once in lost revenue.', action: 'Test a shorter first-session onboarding for these cohorts.', apply: 'Create an onboarding experiment for the weak-activation cohorts?', go: 'experiments', go_opts: { create: true, prefill: { name: 'Shorter first-session onboarding', hypothesis: `A shorter first session will lift signup → activation on ${weakAct[0].channel} cohorts.`, primary: 'Signup → activation rate', scope: 'growth' } }, inv: 'channels', inv_opts: {}, cause: weakAct.slice(0, 3).map((c) => `${c.channel}: ${F.pct(c.activation)} activation, ${F.n(c.signups)} signups`), expected: `Each +1 point of activation ≈ +${r0(act.reduce((s, c) => s + c.signups, 0) / 100)} activated users`, conf: 72, ev: { rec: 'Fix activation on weak cohorts', a: { title: weakAct[0].channel, rows: [['Activation', F.pct(weakAct[0].activation)], ['Signups', F.n(weakAct[0].signups)]] }, b: { title: 'Average', rows: [['Activation', F.pct(avgAct)], ['Signups', F.n(act.reduce((s, c) => s + c.signups, 0))]] }, pattern: 'Traffic is arriving but is not reaching first value.', result: 'Activation lifts compound across every channel.' } });

      /* 4 / 5 — creators */
      if (cr.length >= 3) {
        const byV = cr.slice().sort((a, b) => b.views - a.views), medSig = cr.map((c) => c.signups).sort((a, b) => a - b)[Math.floor(cr.length / 2)], medV = cr.map((c) => c.views).sort((a, b) => a - b)[Math.floor(cr.length / 2)];
        const leak = byV.find((c) => c.views > medV * 1.5 && c.signups < medSig && c.views > 0);
        if (leak) add({ kind: 'creator-leak', cat: 'leaking', score: 76, owner: 'Partnerships', level: 'Medium', cta: 'Open campaign', what: `${leak.handle} drives ${F.n(leak.views)} views but only ${F.n(leak.signups)} signups.`, evidence: `${F.pct(leak.ctr, 2)} click-through on ${F.n(leak.views)} views; creator median is ${F.n(medSig)} signups.`, impact: 'Reach without conversion inflates payout without growth.', action: 'Cap the payout until click-to-signup improves.', apply: `Cap ${leak.handle}’s payout?`, go: 'creators', go_opts: { open: leak.key }, inv: 'creators', inv_opts: { open: leak.key }, cause: [`${leak.handle}: ${F.n(leak.views)} views, ${F.n(leak.clicks)} clicks, ${F.n(leak.signups)} signups`, `Creator median: ${F.n(medSig)} signups`], expected: 'Lower creator CAC without losing reach', conf: 66, ev: { rec: `Cap ${leak.handle}’s payout`, a: { title: leak.handle, rows: [['Views', F.n(leak.views)], ['Signups', F.n(leak.signups)], ['Score', String(leak.score)]] }, b: { title: 'Creator median', rows: [['Views', F.n(medV)], ['Signups', F.n(medSig)]] }, pattern: 'Views are high but conversion is low.', result: 'Reduces spend that is not converting.' } });
        const opp = cr.filter((c) => c.views > 0 && c.views <= medV && c.signups > 0).sort((a, b) => b.signups / b.views - a.signups / a.views)[0];
        if (opp && (!leak || opp.key !== leak.key)) add({ kind: 'creator-opp', cat: 'opportunity', score: 74, owner: 'Partnerships', level: 'Medium', cta: 'View opportunity', what: `${opp.handle} converts ${F.pct(opp.signups / opp.views * 100, 2)} of views into signups with a smaller audience.`, evidence: `${F.n(opp.signups)} signups from ${F.n(opp.views)} views; ROI ${opp.roi ? F.x(opp.roi) : '—'}.`, impact: 'Smaller creators with strong conversion are the cheapest reach to scale.', action: 'Offer a longer partnership with performance-based payout.', apply: `Offer ${opp.handle} a performance-based partnership?`, go: 'creators', go_opts: { open: opp.key }, inv: 'creators', inv_opts: { open: opp.key }, cause: [`${opp.handle}: ${F.pct(opp.signups / opp.views * 100, 2)} view → signup`, `Median creator view → signup is lower`], expected: 'More signups at a below-average CAC', conf: 64, ev: { rec: `Scale ${opp.handle}`, a: { title: opp.handle, rows: [['Views', F.n(opp.views)], ['Signups', F.n(opp.signups)], ['Score', String(opp.score)]] }, b: { title: 'Median', rows: [['Views', F.n(medV)], ['Signups', F.n(medSig)]] }, pattern: 'High conversion on a small audience.', result: 'A low-risk place to add budget.' } });
      }

      /* 6 — creative fatigue */
      const fat = crv.filter((c) => c.d_ctr <= -12 && c.spend > 0).sort((a, b) => a.d_ctr - b.d_ctr)[0];
      if (fat) {
        const peer = crv.filter((c) => c.channel === fat.channel && c !== fat).sort((a, b) => b.ctr - a.ctr)[0];
        add({ kind: 'creative-fatigue', cat: 'risk', score: 95, owner: 'Marketing', level: 'High', cta: 'Fix now', what: `CTR on ${fat.channel} ${fat.ref.toLowerCase()} dropped ${Math.abs(r0(fat.d_ctr))}%.`, evidence: `${fat.name}: CTR ${F.pct(fat.ctr, 2)} (${F.d(fat.d_ctr)}) at ${F.inr(fat.spend)} spend.${peer ? ` ${peer.ref} runs ${F.pct(peer.ctr, 2)}.` : ''}`, impact: 'Spend is unchanged, so every impression now buys fewer clicks.', action: peer ? `Pause ${fat.ref} and shift its budget to ${peer.ref}.` : `Refresh ${fat.ref}.`, apply: `Pause ${fat.name} and move its budget${peer ? ' to ' + peer.name : ''}?`, go: 'channels', go_opts: {}, inv: 'channels', inv_opts: {}, cause: [`${fat.name}: CTR ${F.d(fat.d_ctr)} vs the previous period`, 'Spend unchanged — likely creative fatigue'], expected: peer ? `Recovers about ${F.n(r0(fat.clicks * 0.18))} clicks per period` : 'Restores click-through', conf: 80, ev: { rec: `Pause ${fat.ref}`, a: { title: fat.ref, rows: [['CTR', F.pct(fat.ctr, 2)], ['Change', F.d(fat.d_ctr)], ['Spend', F.inr(fat.spend)]] }, b: peer ? { title: peer.ref, rows: [['CTR', F.pct(peer.ctr, 2)], ['Spend', F.inr(peer.spend)]] } : { title: 'Target', rows: [['CTR', 'Back to baseline']] }, pattern: 'CTR fell while spend stayed flat.', result: 'Reallocating restores click volume.' }, creative: fat.id });
        if (peer && peer.ctr > 0 && fat.ctr > 0 && peer.ctr / fat.ctr >= 1.25) add({ kind: 'creative-pair', cat: 'opportunity', score: 60, owner: 'Growth', level: 'Medium', cta: 'Create experiment', what: `${peer.ref} has ${r0((peer.ctr / fat.ctr - 1) * 100)}% higher CTR than ${fat.ref}.`, evidence: `${F.pct(peer.ctr, 2)} vs ${F.pct(fat.ctr, 2)} on ${fat.channel}.`, impact: 'A controlled test confirms which hook to scale.', action: `Create an experiment: ${fat.ref} → ${peer.ref}.`, apply: 'Create this experiment?', go: 'experiments', go_opts: { create: true, prefill: { name: `${fat.ref} → ${peer.ref}`, hypothesis: `Switching from ${fat.ref} to ${peer.ref} will increase CTR.`, control: fat.name, variant: peer.name, primary: 'CTR', secondary: 'Signups, Activation, CAC, Revenue', scope: 'creative' } }, inv: 'channels', inv_opts: {}, cause: [`${peer.name}: ${F.pct(peer.ctr, 2)} CTR`, `${fat.name}: ${F.pct(fat.ctr, 2)} CTR`], expected: 'Higher CTR at the same spend', conf: 62, ev: { rec: 'Run the creative test', a: { title: fat.ref, rows: [['CTR', F.pct(fat.ctr, 2)]] }, b: { title: peer.ref, rows: [['CTR', F.pct(peer.ctr, 2)]] }, pattern: 'Same channel, different creative, different click-through.', result: 'Experiment confirms before scaling.' } });
      }

      /* 7 — campaign with traffic but weak conversion */
      const camps = cmp.filter((c) => c.clicks > 0 && c.spend > 0), rate = (c) => c.signups / c.clicks, medRate = camps.length ? camps.map(rate).sort((a, b) => a - b)[Math.floor(camps.length / 2)] : 0;
      const weakC = camps.filter((c) => rate(c) < medRate * 0.55 && c.clicks > r0(camps.reduce((s, x) => s + x.clicks, 0) / camps.length * 0.8)).sort((a, b) => b.spend - a.spend)[0];
      if (weakC) add({ kind: 'weak-campaign', cat: 'risk', score: 80, owner: 'Marketing', level: 'High', cta: 'Open campaign', what: `${weakC.name} has high traffic but weak conversion.`, evidence: `${F.n(weakC.clicks)} clicks → ${F.n(weakC.signups)} signups (${F.pct(rate(weakC) * 100, 1)} vs ${F.pct(medRate * 100, 1)} typical).`, impact: `${F.inr(weakC.spend)} is buying visits that do not convert.`, action: 'Pause paid amplification and fix the landing page.', apply: `Pause paid amplification on ${weakC.name}?`, go: 'campaigns', go_opts: { open: weakC.cid }, inv: 'campaigns', inv_opts: { open: weakC.cid }, cause: [`${weakC.name}: ${F.pct(rate(weakC) * 100, 1)} click → signup`, `Campaign ROAS ${weakC.roas ? F.x(weakC.roas) : '—'}`], expected: `Recovers up to ${F.inr(r0(weakC.spend * 0.3))} of non-converting spend`, conf: 71, ev: { rec: 'Fix the landing page', a: { title: weakC.name, rows: [['Clicks', F.n(weakC.clicks)], ['Signups', F.n(weakC.signups)], ['Spend', F.inr(weakC.spend)]] }, b: { title: 'Typical campaign', rows: [['Click → signup', F.pct(medRate * 100, 1)]] }, pattern: 'Traffic is there; conversion is not.', result: 'Fixing the page lifts every paid rupee.' } });

      /* 8 / 9 — sales */
      const wait = leads.filter((l) => l.waiting);
      if (wait.length) add({ kind: 'leads-waiting', cat: 'opportunity', score: 90, owner: 'Sales', level: 'High', cta: 'Follow up', what: `${wait.length} high-intent lead${wait.length === 1 ? ' is' : 's are'} waiting for follow-up.`, evidence: `${wait.slice(0, 3).map((l) => l.company).join(', ')}${wait.length > 3 ? ' and more' : ''} — intent ${wait[0].score}+, no touch in 3+ days.`, impact: `About ${F.inr(wait.reduce((s, l) => s + (l.est_value || l.seats * 4200), 0))} of potential contract value is going cold.`, action: 'Follow up today, highest score first.', apply: 'Open the follow-up queue?', go: 'leads', go_opts: { filter: 'followup' }, inv: 'leads', inv_opts: { filter: 'followup' }, cause: [`${wait.length} leads scored 70+ with no recent touch`, 'Several visited pricing'], expected: 'Higher meeting rate from warm leads', conf: 90, ev: { rec: 'Follow up with waiting leads', a: { title: 'Waiting', rows: [['Leads', String(wait.length)], ['Top score', String(wait[0].score)]] }, b: { title: 'Pipeline', rows: [['Open deals', String(deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost').length)]] }, pattern: 'Intent is decaying while the lead waits.', result: 'Fast follow-up is the cheapest conversion lever.' } });
      const stall = deals.filter((d) => d.stalled);
      if (stall.length) add({ kind: 'stalled-deals', cat: 'risk', score: 88, owner: 'Sales', level: 'High', cta: 'Follow up', what: `${stall.length} deal${stall.length === 1 ? '' : 's'} stalled for more than 7 days.`, evidence: `${F.inr(stall.reduce((s, d) => s + d.value, 0))} of pipeline with no activity.`, impact: 'Stalled deals rarely close without a fresh touch.', action: 'Re-engage the stalled deals this week.', apply: 'Open stalled deals?', go: 'pipeline', go_opts: { stalled: true }, inv: 'pipeline', inv_opts: { stalled: true }, cause: stall.slice(0, 3).map((d) => `${d.company}: ${F.inr(d.value)}, ${d.last_days} days idle`), expected: `Protects ${F.inr(stall.reduce((s, d) => s + d.value * d.probability / 100, 0))} of weighted pipeline`, conf: 85, ev: { rec: 'Re-engage stalled deals', a: { title: 'Stalled', rows: [['Deals', String(stall.length)], ['Value', F.inr(stall.reduce((s, d) => s + d.value, 0))]] }, b: { title: 'All open', rows: [['Deals', String(deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost').length)]] }, pattern: 'Idle time is the strongest signal of a lost deal.', result: 'Re-engagement is cheaper than new pipeline.' } });

      list.sort((a, b) => b.score - a.score);
      list.forEach((s, i) => out.push(Object.assign(s, { id: R + '-' + (i + 1), range: R, order: i, go_opts: J(s.go_opts || {}), inv_opts: J(s.inv_opts || {}) })));
    });
    return out;
  }

  /* Home / Radar priorities are the top ranked signals with a diverse set of pages. */
  function buildPriorities(sig) {
    const out = [];
    RS.forEach((R) => {
      const seen = {}; let rank = 0;
      sig.filter((s) => s.range === R).forEach((s) => { const k = s.kind; if (rank >= 5 || seen[k]) return; seen[k] = 1; rank++; out.push({ id: R + '-p' + rank, range: R, rank, type: 'sig', confidence: s.conf || 70, params: J({ sig: s.id }) }); });
    });
    return out;
  }

  /* ---------- Ask: ~33 analyst-style answers computed from the data ---------- */
  function buildAsk(S) {
    const A = [], ch = S.get('channels').filter((c) => c.range === '30d'), cmp = S.get('campaigns').filter((c) => c.range === '30d'), cr = S.get('creators').filter((c) => c.range === '30d'), kp = {}; S.get('kpis').filter((k) => k.range === '30d').forEach((k) => (kp[k.metric] = k));
    const leads = S.get('leads'), deals = S.get('deals'), fun = S.get('funnel').filter((f) => f.range === '30d'), sc = S.get('signals').length ? S.get('signals') : [];
    const sigs = (G.__sigCache && G.__sigCache.get(S.key)) || [];
    const paid = ch.filter((c) => c.spend > 0 && c.customers > 0), byRoas = paid.slice().sort((a, b) => b.roas - a.roas), byCac = paid.slice().sort((a, b) => a.cac - b.cac);
    const camps = cmp.filter((c) => c.spend > 0), cRoas = camps.filter((c) => c.roas != null).sort((a, b) => b.roas - a.roas);
    const goals = S.get('goals')[0], g = S.w.company || {}, wait = leads.filter((l) => l.waiting), stall = deals.filter((d) => d.stalled);
    const open = deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost'), likely = open.filter((d) => ['Proposal', 'Negotiation'].includes(d.stage));
    const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
    const no = (id, q, keys, group, headline, analysis, evidence, reco, go, go_opts, o) => A.push(Object.assign({ id, q, keys, group, headline, analysis, evidence, reco, action: 'Open', toast: '', go, go_opts: go_opts || {}, impact: '' }, o || {}));
    const none = (id, q, keys, group) => no(id, q, keys, group, 'There is not enough data for this yet.', 'Connect or import the relevant data and ask again.', [['Status', 'Needs data']], 'Add data', 'datasources');
    const top = byRoas[0], low = byRoas[byRoas.length - 1], bc = byCac[0], wc = byCac[byCac.length - 1];
    const sig = (k) => sigs.find((s) => s.range === '30d' && s.kind === k);
    const T = (n) => (kp[n] ? kp[n].value : 0), D = (n) => (kp[n] ? kp[n].delta : 0);
    const rev = T('revenue'), target = g.revenueTarget || (goals && goals.target) || r0(rev * 1.2), pct = target ? r0(rev / target * 100) : 0;

    /* TODAY */
    no('t-changed', 'What changed today?', ['changed', 'today', 'what changed', 'new'], 'TODAY', `Signups ${D('signups') >= 0 ? 'rose' : 'fell'} ${Math.abs(r0(D('signups')))}% and CTR moved ${F.d(D('ctr'))} versus the previous period.`, `Revenue is ${F.inr(rev)} (${F.d(D('revenue'))}), customers ${F.n(T('customers'))} (${F.d(D('customers'))}). ${sigs.filter((s) => s.range === '30d').slice(0, 2).map((s) => s.what).join(' ')}`, [['Signups', F.n(T('signups')) + ' (' + F.d(D('signups')) + ')'], ['CTR', F.pct(T('ctr'), 2) + ' (' + F.d(D('ctr')) + ')'], ['Revenue', F.inr(rev) + ' (' + F.d(D('revenue')) + ')'], ['CAC', F.inrF(T('cac')) + ' (' + F.d(D('cac')) + ')']], 'Open the Radar for the full list.', 'radar', {}, { feat: 0 });
    no('t-focus', 'What should I focus on today?', ['focus', 'today', 'priority', 'should i do', 'first'], 'TODAY', sigs[0] ? sigs[0].action : 'Connect data to get a priority.', sigs[0] ? sigs[0].what + ' ' + (sigs[0].impact || '') : '', sigs[0] ? [['Why', sigs[0].what], ['Expected', sigs[0].expected]] : [['Status', 'Needs data']], sigs[0] ? sigs[0].action : 'Add data', 'home', {}, { feat: 1 });
    no('t-objective', 'What is today’s growth objective?', ['objective', 'goal', 'target', 'today'], 'TODAY', `Your objective is ${g.objectiveLabel || 'monthly revenue'} of ${F.inr(target)} — currently ${F.inr(rev)} (${pct}%).`, `At the current run rate you finish the month at about ${F.inr(r0(rev * 1.04))}. ${pct >= 80 ? 'You are on track.' : 'You need to close the gap with the top recommended actions.'}`, [['Target', F.inr(target)], ['Current', F.inr(rev)], ['Progress', pct + '%']], 'Review the plan.', 'home', {}, { feat: 2 });
    const needCamp = camps.slice().sort((a, b) => (a.health_score || 0) - (b.health_score || 0))[0];
    needCamp ? no('t-attention', 'Which campaign needs attention?', ['needs attention', 'attention', 'campaign', 'struggling'], 'TODAY', `${needCamp.name} needs attention: ROAS ${needCamp.roas ? F.x(needCamp.roas) : '—'} and CAC ${needCamp.cac ? F.inrF(needCamp.cac) : '—'}.`, `It carries ${F.inr(needCamp.spend)} of spend with ${F.n(needCamp.customers)} customers. ${needCamp.d_roas < 0 ? 'ROAS fell ' + Math.abs(needCamp.d_roas) + '% versus the previous period.' : ''}`, [['Spend', F.inr(needCamp.spend)], ['ROAS', needCamp.roas ? F.x(needCamp.roas) : '—'], ['CAC', needCamp.cac ? F.inrF(needCamp.cac) : '—']], 'Open the campaign.', 'campaigns', { open: needCamp.cid }) : none('t-attention', 'Which campaign needs attention?', ['needs attention', 'attention'], 'TODAY');
    no('t-track', 'Are today’s metrics on track?', ['on track', 'metrics', 'track'], 'TODAY', pct >= 75 ? 'Yes — you are on track for your objective.' : 'Not yet — you are behind your objective pace.', `Revenue is at ${pct}% of target. Signups ${F.d(D('signups'))}, customers ${F.d(D('customers'))}, CAC ${F.d(D('cac'))} versus the previous period.`, [['Revenue vs target', pct + '%'], ['Signups', F.d(D('signups'))], ['CAC', F.d(D('cac'))]], 'See Forecast.', 'forecast', {});

    /* CAMPAIGNS */
    cRoas.length ? no('c-best', 'Which campaign is performing best?', ['best campaign', 'performing best', 'top campaign', 'best performing'], 'CAMPAIGNS', `${cRoas[0].name} is your best campaign at ${F.x(cRoas[0].roas)} ROAS.`, `It returned ${F.inr(cRoas[0].revenue)} on ${F.inr(cRoas[0].spend)} spend with ${F.n(cRoas[0].customers)} customers at ${cRoas[0].cac ? F.inrF(cRoas[0].cac) : '—'} CAC.`, [['ROAS', F.x(cRoas[0].roas)], ['CAC', cRoas[0].cac ? F.inrF(cRoas[0].cac) : '—'], ['Customers', F.n(cRoas[0].customers)]], 'Consider scaling it.', 'campaigns', { open: cRoas[0].cid }) : none('c-best', 'Which campaign is performing best?', ['best campaign', 'performing best'], 'CAMPAIGNS');
    const waste = cRoas.filter((c) => c.spend > 0).slice(-1)[0];
    waste ? no('c-waste', 'Which campaign is wasting spend?', ['wasting', 'waste', 'worst campaign', 'wasted'], 'CAMPAIGNS', `${waste.name} is the weakest at ${F.x(waste.roas)} ROAS.`, `${F.inr(waste.spend)} produced ${F.inr(waste.revenue)} revenue and ${F.n(waste.customers)} customers. ${waste.cac ? 'CAC is ' + F.inrF(waste.cac) + '.' : ''}`, [['Spend', F.inr(waste.spend)], ['Revenue', F.inr(waste.revenue)], ['ROAS', F.x(waste.roas)]], 'Reduce or pause it.', 'campaigns', { open: waste.cid }) : none('c-waste', 'Which campaign is wasting spend?', ['wasting', 'waste'], 'CAMPAIGNS');
    no('c-ctr', 'Why did CTR change?', ['ctr', 'click through', 'click-through', 'ctr change'], 'CAMPAIGNS', `CTR is ${F.pct(T('ctr'), 2)}, ${F.d(D('ctr'))} versus the previous period.`, sig('creative-fatigue') ? sig('creative-fatigue').evidence + ' ' + sig('creative-fatigue').impact : 'No single creative explains the move; check the channels with the largest impression share.', [['CTR', F.pct(T('ctr'), 2)], ['Change', F.d(D('ctr'))]], sig('creative-fatigue') ? sig('creative-fatigue').action : 'Review creatives by channel.', 'channels', {});
    cRoas.length ? no('c-scale', 'Which campaign should I scale?', ['scale', 'increase budget campaign', 'grow campaign'], 'CAMPAIGNS', `Scale ${cRoas[0].name}.`, `It has the strongest ROAS (${F.x(cRoas[0].roas)}) and ${cRoas[0].d_signups >= 0 ? 'signups are up ' + cRoas[0].d_signups + '%' : 'signups are down ' + Math.abs(cRoas[0].d_signups) + '%'}.`, [['ROAS', F.x(cRoas[0].roas)], ['Signup change', F.d(cRoas[0].d_signups)]], 'Raise its budget in steps of 20%.', 'campaigns', { open: cRoas[0].cid }) : none('c-scale', 'Which campaign should I scale?', ['scale'], 'CAMPAIGNS');
    waste ? no('c-pause', 'Which campaign should I pause?', ['pause', 'stop campaign', 'shut down'], 'CAMPAIGNS', `Pause or cut ${waste.name}.`, `ROAS ${F.x(waste.roas)} is the lowest of ${camps.length} campaigns. ${F.inr(waste.spend)} is better used on ${cRoas[0] ? cRoas[0].name : 'a stronger campaign'}.`, [['ROAS', F.x(waste.roas)], ['Spend', F.inr(waste.spend)]], 'Pause it and reallocate.', 'campaigns', { open: waste.cid }) : none('c-pause', 'Which campaign should I pause?', ['pause'], 'CAMPAIGNS');

    /* GTM */
    top ? no('g-channel', 'What is our strongest GTM channel?', ['strongest', 'best channel', 'gtm channel', 'top channel'], 'GTM', `${top.channel} is your strongest channel at ${F.x(top.roas)} ROAS.`, `CAC ${F.inrF(top.cac)}, ${F.n(top.customers)} customers on ${F.inr(top.spend)}. ${low && low !== top ? low.channel + ' is weakest at ' + F.x(low.roas) + '.' : ''}`, [['ROAS', F.x(top.roas)], ['CAC', F.inrF(top.cac)], ['Customers', F.n(top.customers)]], sig('best-channel') ? sig('best-channel').action : 'Increase its budget.', 'channels', {}) : none('g-channel', 'What is our strongest GTM channel?', ['strongest', 'best channel'], 'GTM');
    const stages = fun.filter((f) => f.rate != null && f.stage !== 'Clicks'), leak = fun.find((f) => f.flag === 'watch') || stages.slice().sort((a, b) => a.rate - b.rate)[0];
    leak ? no('g-lose', 'Where are we losing users?', ['losing users', 'drop-off', 'dropoff', 'leak', 'losing'], 'GTM', `The biggest leak is at ${leak.stage}: only ${F.pct(leak.rate)} continue.`, `${F.pct(leak.dropoff)} drop off at this stage. ${sig('weak-activation') ? sig('weak-activation').evidence : ''}`, stages.map((f) => [f.stage, F.pct(f.rate)]).slice(0, 4), 'Investigate this stage.', 'home', {}) : none('g-lose', 'Where are we losing users?', ['losing users'], 'GTM');
    const aud = cr.slice().sort((a, b) => b.score - a.score)[0];
    no('g-audience', 'Which audience should we target next?', ['audience', 'target next', 'segment', 'who should we target'], 'GTM', aud ? `Look for audiences like ${aud.handle}’s — ${aud.platform} viewers who convert.` : 'Add creator or audience data to answer this.', aud ? `${aud.handle} has the best creator score (${aud.score}) with ${F.n(aud.signups)} signups at ${aud.cac ? F.inrF(aud.cac) : '—'} CAC. Their audience is a proven fit.` : '', aud ? [['Top creator', aud.handle], ['Score', String(aud.score)], ['Signups', F.n(aud.signups)]] : [['Status', 'Needs data']], 'Brief two similar creators.', 'creators', aud ? { open: aud.key } : {});
    const opp = sigs.find((s) => s.range === '30d' && s.cat === 'opportunity');
    no('g-missing', 'What GTM opportunity are we missing?', ['missing', 'opportunity', 'gtm opportunity', 'untapped'], 'GTM', opp ? opp.what : 'No clear missed opportunity in the current data.', opp ? opp.evidence + ' ' + opp.impact : '', opp ? [['Why', opp.what], ['Expected', opp.expected]] : [['Status', 'Nothing flagged']], opp ? opp.action : 'Keep monitoring.', opp ? opp.go : 'radar', opp ? G.J(opp.go_opts) : {});
    const ex = sigs.find((s) => s.range === '30d' && s.go === 'experiments');
    no('g-test', 'What should we test this week?', ['test this week', 'experiment', 'what to test', 'should we test'], 'GTM', ex ? ex.action : 'Test a new hook against your best-performing creative.', ex ? ex.what + ' ' + ex.evidence : 'Use your top creative as the control.', ex ? [['Hypothesis', ex.what]] : [['Next step', 'Create an experiment']], 'Create an experiment.', 'experiments', ex ? G.J(ex.go_opts) : { create: true });

    /* SALES */
    no('s-leads', 'Which leads need follow-up?', ['follow up', 'follow-up', 'leads need', 'which leads'], 'SALES', wait.length ? `${wait.length} high-intent leads are waiting for follow-up.` : 'No high-intent leads are waiting.', wait.length ? wait.slice(0, 3).map((l) => `${l.name} (${l.company}, score ${l.score})`).join('; ') + '.' : 'Every high-intent lead has been touched recently.', wait.slice(0, 3).map((l) => [l.company, 'Score ' + l.score]), 'Open the follow-up queue.', 'leads', { filter: 'followup' });
    no('s-risk', 'What pipeline is at risk?', ['pipeline at risk', 'at risk', 'stalled', 'risk pipeline'], 'SALES', stall.length ? `${F.inr(sum(stall, (d) => d.value))} of pipeline is at risk across ${stall.length} stalled deals.` : 'No stalled deals right now.', stall.slice(0, 3).map((d) => `${d.company} ${F.inr(d.value)} — ${d.last_days} days idle`).join('; '), stall.slice(0, 3).map((d) => [d.company, F.inr(d.value)]), 'Re-engage stalled deals.', 'pipeline', { stalled: true });
    no('s-close', 'Which opportunities are most likely to close?', ['likely to close', 'close', 'closing', 'most likely'], 'SALES', likely.length ? `${F.inr(sum(likely, (d) => d.value))} sits in Proposal and Negotiation.` : 'No deals are at proposal stage yet.', likely.slice(0, 3).map((d) => `${d.company} ${F.inr(d.value)} (${d.probability}%)`).join('; '), likely.slice(0, 3).map((d) => [d.company, F.inr(d.value)]), 'Prioritise these deals.', 'pipeline', {});
    no('s-block', 'What is blocking revenue growth?', ['blocking', 'blocker', 'bottleneck', 'revenue growth'], 'SALES', leak ? `The main blocker is ${leak.stage.toLowerCase()} conversion (${F.pct(leak.rate)}).` : 'No clear blocker yet.', `${stall.length} stalled deals and ${wait.length} waiting leads add friction downstream. ${sig('weak-activation') ? sig('weak-activation').evidence : ''}`, [['Stalled deals', String(stall.length)], ['Waiting leads', String(wait.length)]], 'Clear the sales backlog first.', 'pipeline', {});

    /* CREATORS */
    const crRev = cr.slice().sort((a, b) => b.revenue - a.revenue)[0];
    crRev ? no('r-revenue', 'Which creator is driving real revenue?', ['creator revenue', 'real revenue', 'driving revenue', 'creator is driving'], 'CREATORS', `${crRev.handle} drives the most revenue: ${F.inr(crRev.revenue)}.`, `${F.n(crRev.customers)} customers at ${crRev.cac ? F.inrF(crRev.cac) : '—'} CAC (ROI ${crRev.roi ? F.x(crRev.roi) : '—'}).`, [['Revenue', F.inr(crRev.revenue)], ['Customers', F.n(crRev.customers)], ['Score', String(crRev.score)]], 'Consider a longer partnership.', 'creators', { open: crRev.key }) : none('r-revenue', 'Which creator is driving real revenue?', ['creator revenue'], 'CREATORS');
    const roiTop = cr.filter((c) => c.roi != null).sort((a, b) => b.roi - a.roi)[0];
    roiTop ? no('r-budget', 'Which creator should get more budget?', ['more budget', 'creator budget', 'increase creator'], 'CREATORS', `Give ${roiTop.handle} more budget — ROI ${F.x(roiTop.roi)}.`, `They convert ${F.n(roiTop.signups)} signups and ${F.n(roiTop.customers)} customers on ${F.inr(roiTop.spend)}.`, [['ROI', F.x(roiTop.roi)], ['CAC', roiTop.cac ? F.inrF(roiTop.cac) : '—']], 'Raise their payout cap by 20%.', 'creators', { open: roiTop.key }) : none('r-budget', 'Which creator should get more budget?', ['more budget'], 'CREATORS');
    const lk = sig('creator-leak');
    no('r-leak', 'Which creator has high views but low conversion?', ['high views', 'low conversion', 'views but', 'viral'], 'CREATORS', lk ? lk.what : 'No creator has a large view-to-signup gap.', lk ? lk.evidence + ' ' + lk.impact : '', lk ? [['Action', lk.action]] : [['Status', 'Healthy']], lk ? lk.action : 'Keep monitoring.', 'creators', lk ? G.J(lk.go_opts) : {});

    /* REVENUE */
    const drv = S.get('drivers').filter((d) => d.range === '30d')[0];
    no('v-driving', 'What is driving revenue growth?', ['driving revenue', 'revenue growth', 'driving growth', 'what is driving'], 'REVENUE', `Revenue is ${F.d(D('revenue'))} versus the previous period.`, drv ? drv.text : 'No dominant driver stands out.', [['Revenue', F.inr(rev)], ['Top driver', drv ? drv.channel : '—']], 'Double down on the top driver.', 'home', {});
    no('v-cac', 'What is our current CAC?', ['current cac', 'cac', 'cost to acquire', 'acquisition cost'], 'REVENUE', `Blended CAC is ${F.inrF(T('cac'))} (${F.d(D('cac'))}).`, bc && wc ? `${bc.channel} is lowest at ${F.inrF(bc.cac)}; ${wc.channel} is highest at ${F.inrF(wc.cac)}.` : '', bc ? [['Blended', F.inrF(T('cac'))], ['Best', bc.channel + ' ' + F.inrF(bc.cac)], ['Worst', wc.channel + ' ' + F.inrF(wc.cac)]] : [['Blended', F.inrF(T('cac'))]], 'Move budget toward the lowest-CAC channel.', 'channels', {});
    no('v-roas', 'What is our ROAS?', ['roas', 'return on ad spend', 'return on spend'], 'REVENUE', `Blended ROAS is ${F.x(T('roas'))}.`, top ? `${top.channel} leads at ${F.x(top.roas)}; ${low.channel} trails at ${F.x(low.roas)}.` : '', [['Blended ROAS', F.x(T('roas'))], ['Spend', F.inr(T('spend'))], ['Revenue', F.inr(rev)]], 'Review the Channels table.', 'channels', {});
    no('v-target', 'Are we on track for the revenue target?', ['revenue target', 'on track for', 'hit target', 'target'], 'REVENUE', `You are at ${F.inr(rev)} of a ${F.inr(target)} target (${pct}%).`, pct >= 75 ? 'The run rate reaches the target with modest additional growth.' : 'You need about ' + F.inr(Math.max(0, target - rev)) + ' more; the top recommended actions are the shortest path.', [['Target', F.inr(target)], ['Current', F.inr(rev)], ['Gap', F.inr(Math.max(0, target - rev))]], 'Model scenarios in Forecast.', 'forecast', {});

    /* EXTRA classic questions */
    no('x-signups', 'Why did signups drop?', ['signups drop', 'signups fall', 'signups down', 'signups dropped', 'why did signups'], 'TODAY', `Signups are ${F.d(D('signups'))} versus the previous period.`, S.get('drivers').filter((d) => d.range === '30d').slice(0, 2).map((d) => d.text).join(' '), [['Signups', F.n(T('signups'))], ['Change', F.d(D('signups'))]], 'Check the weakest channel.', 'channels', {});
    no('x-budget', 'Where should we increase budget?', ['increase budget', 'where should we', 'add budget', 'more spend'], 'GTM', top ? `Increase ${top.channel}: it returns ${F.x(top.roas)} ROAS.` : 'Add spend data first.', sig('best-channel') ? sig('best-channel').evidence + ' ' + sig('best-channel').impact : '', top ? [['ROAS', F.x(top.roas)], ['CAC', F.inrF(top.cac)]] : [['Status', 'Needs data']], sig('best-channel') ? sig('best-channel').action : 'Scale the best channel.', 'forecast', {});
    no('x-cac-camp', 'Show me campaigns with high CAC', ['high cac', 'expensive campaigns', 'campaign cac'], 'CAMPAIGNS', cmp.filter((c) => c.cac).length ? `${cmp.filter((c) => c.cac).sort((a, b) => b.cac - a.cac)[0].name} has the highest CAC.` : 'No CAC data.', cmp.filter((c) => c.cac).sort((a, b) => b.cac - a.cac).slice(0, 3).map((c) => `${c.name} ${F.inrF(c.cac)}`).join('; '), cmp.filter((c) => c.cac).sort((a, b) => b.cac - a.cac).slice(0, 3).map((c) => [c.name, F.inrF(c.cac)]), 'Review the highest-CAC campaigns.', 'campaigns', {});
    no('x-best-cac', 'Which campaign has the best CAC?', ['best cac', 'lowest cac', 'cheapest'], 'CAMPAIGNS', cmp.filter((c) => c.cac).length ? `${cmp.filter((c) => c.cac).sort((a, b) => a.cac - b.cac)[0].name} has the lowest CAC at ${F.inrF(cmp.filter((c) => c.cac).sort((a, b) => a.cac - b.cac)[0].cac)}.` : 'No CAC data.', '', cmp.filter((c) => c.cac).sort((a, b) => a.cac - b.cac).slice(0, 3).map((c) => [c.name, F.inrF(c.cac)]), 'Scale it carefully.', 'campaigns', {});
    no('x-new', 'Create a campaign for my audience', ['create a campaign', 'new campaign', 'launch campaign'], 'GTM', 'Start a new campaign from your best-performing channel.', top ? `${top.channel} returns ${F.x(top.roas)} ROAS; start there with a small budget.` : 'Add data first.', [['Suggested channel', top ? top.channel : '—']], 'Open Campaigns.', 'campaigns', { create: true });
    A.forEach((a, i) => { a.keys = J(a.keys); a.evidence = a.evidence; });
    return A;
  }

  function buildInsights(S) {
    const ch = S.get('channels').filter((c) => c.range === '30d'), cr = S.get('creators').filter((c) => c.range === '30d'), cont = S.get('content_compare');
    const paid = ch.filter((c) => c.spend > 0 && c.customers > 0), sorted = paid.slice().sort((a, b) => b.roas - a.roas), top = sorted[0], low = sorted[sorted.length - 1], traffic = ch.slice().sort((a, b) => b.visitors - a.visitors)[0], totV = ch.reduce((s, c) => s + c.visitors, 0) || 1;
    const out = [];
    out.push(top && traffic ? { id: 'channels-ai', page: 'channels', title: top.channel === traffic.channel ? `${top.channel} is both your biggest and your best channel.` : 'Your highest-performing channel is not your highest-traffic channel.', text: `${traffic.channel} brings the most traffic (${F.n(traffic.visitors)} visitors, ${r0(traffic.visitors / totV * 100)}% of total) at ${traffic.roas ? F.x(traffic.roas) : '—'} ROAS. ${top.channel} returns ${F.x(top.roas)} ROAS at ${F.inrF(top.cac)} CAC.`, bullets: sorted.slice(0, 3).map((c) => `${c.channel}: ${F.x(c.roas)} ROAS, ${F.inrF(c.cac)} CAC, ${F.pct(c.activation)} activation.`), reco: low && low !== top ? `Move budget from ${low.channel} toward ${top.channel}.` : '', cta: 'Model this shift', evidence: sorted.slice(0, 4).map((c) => [c.channel + ' ROAS', F.x(c.roas)]) } : { id: 'channels-ai', page: 'channels', title: 'Add spend data to compare channels.', text: 'Once spend and customers are imported, Growth OS ranks channels by return.', bullets: [], reco: '', cta: '', evidence: [] });
    const cs = cr.slice().sort((a, b) => b.views - a.views)[0], cb = cr.slice().sort((a, b) => b.score - a.score)[0];
    out.push({ id: 'creator-tps', page: 'creators', title: 'Why views alone mislead', text: cs && cb ? `${cs.handle} generated ${F.n(cs.views)} views and ${F.n(cs.signups)} signups. ${cb.handle} generated ${F.n(cb.views)} views and ${F.n(cb.signups)} signups, so ${cb.handle} ranks ${cb === cs ? 'first' : 'higher'} (score ${cb.score}).` : 'Add creator data to see a True Creator Performance ranking.', bullets: ['True Creator Performance weights: Reach 10%, Engagement 10%, Clicks 15%, Signups 25%, Activation 15%, Revenue 25%.', 'Each component is normalised across active creators, so a viral post cannot outrank real business impact.'], reco: '', cta: '', evidence: [] });
    const cf = cont.filter((c) => c.activated_per_1k > 0).sort((a, b) => b.activated_per_1k - a.activated_per_1k);
    out.push(cf.length >= 2 ? { id: 'content-ai', page: 'content', title: `${cf[0].format} generate ${x1(cf[0].activated_per_1k / Math.max(0.01, cf[cf.length - 1].activated_per_1k))}× more activated users than ${cf[cf.length - 1].format.toLowerCase()}.`, text: `Per 1,000 views, ${cf[0].format.toLowerCase()} produce ${cf[0].activated_per_1k} activated users vs ${cf[cf.length - 1].activated_per_1k} for ${cf[cf.length - 1].format.toLowerCase()}.`, bullets: cf.slice(0, 3).map((c) => `${c.format}: ${F.pct(c.ctr, 2)} CTR, ${F.pct(c.activation_rate)} activation.`), reco: `Brief the next deliverables as ${cf[0].format.toLowerCase()}.`, cta: 'Generate variation', evidence: cf.slice(0, 2).map((c) => [c.format + ' activated / 1K views', String(c.activated_per_1k)]) } : { id: 'content-ai', page: 'content', title: 'Add content data to compare formats.', text: 'Import content performance to see which format activates users.', bullets: [], reco: '', cta: '', evidence: [] });
    out.push({ id: 'next-experiment', page: 'experiments', title: top ? `Recommended next experiment: scale ${top.channel} by 20%` : 'Recommended next experiment', text: top ? `${top.channel} has the highest ROAS (${F.x(top.roas)}). Test a 20% budget increase against a holdout to confirm returns hold.` : 'Import spend data to get a recommended experiment.', bullets: ['Guardrail: stop if CAC rises above 1.3× the current level.', 'Run against a matched holdout for two weeks.'], reco: 'Create experiment', cta: 'Create experiment', evidence: [] });
    return out;
  }

  function compute(S) {
    const sigs = S.wd ? G.rawRows('signals') || [] : buildSignals(S);
    G.__sigCache = G.__sigCache || new WeakMap(); G.__sigCache.set(S.key, sigs);
    const pri = S.wd ? G.rawRows('priorities') : buildPriorities(sigs);
    S.get = ((get) => (id) => (id === 'signals' ? sigs : get(id)))(S.get);
    let ask = buildAsk(S);
    if (S.wd) {
      const GRP = { 'a-signups': 'TODAY', 'a-creator': 'CREATORS', 'a-driving': 'REVENUE', 'a-cac': 'CAMPAIGNS', 'a-leads': 'SALES', 'a-campaign': 'GTM', 'a-revenue': 'REVENUE', 'b-week': 'TODAY', 'b-cac': 'CAMPAIGNS', 'b-creators': 'CREATORS', 'b-budget': 'GTM', 'c-fall': 'TODAY', 'c-budget': 'GTM', 'c-creator': 'CREATORS', 'c-cac': 'REVENUE', 'c-risk': 'CAMPAIGNS', 'c-today': 'TODAY', 'c-opp': 'GTM' };
      const raw = (G.rawRows('ask') || []).map((a) => Object.assign({}, a, { group: GRP[a.id] || 'GTM', keys: typeof a.keys === 'string' ? a.keys : J(a.keys) }));
      const have = new Set(raw.map((a) => a.q.toLowerCase()));
      ask = ask.filter((a) => !have.has(a.q.toLowerCase())).map((a) => Object.assign(a, { feat: a.feat != null ? a.feat + 20 : null }));
      ask = raw.concat(ask);
    }
    const ins = buildInsights(S);
    return { signals: sigs, priorities: pri, ask, insights: ins };
  }

  G.engine = {
    get(id, mode) {
      const S = source();
      if (!S.wd && !S.D) return [];
      let c = cache.get(S.key);
      if (!c) { c = compute(S); cache.set(S.key, c); }
      return c[id] || [];
    },
    /* Home plan / today cards are generic over signals */
    plan(R) {
      const sg = (G.rows('signals') || []).filter((s) => s.range === R).sort((a, b) => a.order - b.order);
      const seen = {}, out = [];
      sg.forEach((s) => { const k = s.top || (s.go + (s.kind || s.cat)); if (out.length >= 5 || seen[k]) return; seen[k] = 1; out.push(s); });
      return out;
    },
  };
})();
