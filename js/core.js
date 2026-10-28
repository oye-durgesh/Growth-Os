(function () {
  'use strict';
  const G = (window.G = {});
  const app = document.getElementById('g-app');
  G.app = app;
  const S = (G.S = { page: 'home', range: '30d', t0: Date.now(), flt: {}, local: {}, done: {}, unread: null, liveEvents: [], dismissed: {}, applied: {} });

  /* ---------- DOM helper ---------- */
  function h(tag, a, ...kids) {
    const e = document.createElement(tag);
    if (a) for (const k of Object.keys(a)) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  }
  G.h = h;
  G.clear = (el) => el.replaceChildren();
  const enc = (v) => String(v).replace(/%/g, '%25').replace(/&/g, '%26').replace(/=/g, '%3D');
  G.mk = (el, src, field, where) => {
    el.dataset.source = src;
    if (field) el.dataset.field = field;
    if (where) el.dataset.where = Object.keys(where).map((k) => k + '=' + enc(where[k])).join('&');
    return el;
  };
  G.initials = (n) => String(n || '?').replace('@', '').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  G.J = (v) => { if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return v; } } return v; };

  /* ---------- data ---------- */
  G.rows = (id) => {
    const d = dash.data(id);
    if (!d || d.status !== 'ok') return null;
    const x = d.data, arr = Array.isArray(x) ? x : (x && x.rows) || [];
    if (!normCache.has(arr)) {
      // nested lists/objects can arrive as JSON text: parse them once so pages always get real arrays/objects
      normCache.set(arr, arr.map((r) => { if (!r || typeof r !== 'object') return r; const o = {}; for (const k of Object.keys(r)) { const v = r[k]; o[k] = typeof v === 'string' && (v[0] === '[' || v[0] === '{') ? G.J(v) : v; } return o; }));
    }
    return normCache.get(arr);
  };
  const normCache = new WeakMap();
  G.st = (ids) => {
    let w = 'ok';
    for (const id of ids) {
      const s = dash.data(id).status;
      if (s === 'loading') w = 'loading';
      else if (s !== 'ok') return 'error';
    }
    return w;
  };
  G.R = (id, f) => (G.rows(id) || []).filter(f || (() => true));
  G.byRange = (id) => G.R(id, (r) => r.range === S.range);
  G.one = (id, f) => (G.rows(id) || []).find(f);

  /* ---------- formats ---------- */
  const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const F = (G.F = {
    n: (v) => (v == null || isNaN(v) ? '—' : inr0.format(Math.round(v))),
    c: (v) => { if (v == null) return '—'; const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M'; if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K'; return String(Math.round(v)); },
    inr: (v) => { if (v == null || isNaN(v)) return '—'; const a = Math.abs(v), s = v < 0 ? '−' : ''; if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2) + 'Cr'; if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(1) + 'L'; return s + '₹' + inr0.format(Math.round(a)); },
    inrF: (v) => (v == null ? '—' : '₹' + inr0.format(Math.round(v))),
    pct: (v, d) => (v == null ? '—' : Number(v).toFixed(d == null ? 1 : d) + '%'),
    x: (v) => (v == null ? '—' : Number(v).toFixed(1) + '×'),
    d: (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%'),
    val: (unit, v) => (unit === 'inr' ? F.inr(v) : unit === 'pct' ? F.pct(v, 2) : unit === 'x' ? F.x(v) : unit === 'days' ? v + ' days' : F.n(v)),
    mins: (m) => m + (Date.now() - S.t0) / 60000,
    ago: (m) => { m = F.mins(m); if (m < 1) return 'just now'; if (m < 60) return Math.round(m) + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' hr ago'; return Math.round(m / 1440) + 'd ago'; },
    clock: (m) => new Date(Date.now() - F.mins(m) * 60000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase(),
    day: (m) => { const d = new Date(Date.now() - F.mins(m) * 60000), t = new Date(); const diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); },
    date: (iso) => d3.utcFormat('%b %-d')(new Date(iso)),
  });
  G.RL = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' };
  G.RN = { '7d': 7, '30d': 30, '90d': 90 };
  G.dl = (v, good, suffix) => {
    if (v == null) return h('span', { class: 'dl flat', text: '—' });
    const up = v > 0.04, down = v < -0.04;
    let cls = 'flat';
    if (up || down) { if (good === null) cls = 'flat'; else cls = up === (good !== false) ? 'up' : 'down'; }
    return h('span', { class: 'dl ' + cls, text: (up ? '▲ ' : down ? '▼ ' : '') + Math.abs(v).toFixed(1) + (suffix == null ? '%' : suffix) });
  };
  G.tone = (v, good) => (v == null || Math.abs(v) < 0.04 ? 'flat' : (v > 0) === (good !== false) ? 'up' : 'down');

  /* ---------- tooltip ---------- */
  const tipEl = h('div', { class: 'g-tip', style: 'display:none' });
  app.append(tipEl);
  G.tip = {
    show(e, c) {
      tipEl.replaceChildren(c && c.nodeType ? c : document.createTextNode(String(c)));
      tipEl.style.display = 'block';
      const r = app.getBoundingClientRect(), w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
      let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      if (x + w > r.width - 8) x = e.clientX - r.left - w - 14;
      if (x < 8) x = 8;
      if (y + hh > r.height - 8) y = e.clientY - r.top - hh - 14;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    },
    hide() { tipEl.style.display = 'none'; },
  };
  G.hover = (el, content) => {
    el.addEventListener('mousemove', (e) => G.tip.show(e, typeof content === 'function' ? content() : content));
    el.addEventListener('mouseleave', G.tip.hide);
    return el;
  };

  /* ---------- sparkline ---------- */
  G.spark = (vals, o) => {
    o = o || {}; const w = o.w || 96, hh = o.h || 28;
    vals = (vals || []).map(Number);
    const svg = d3.create('svg').attr('viewBox', `0 0 ${w} ${hh}`).attr('width', w).attr('height', hh).style('max-width', '100%').attr('aria-hidden', 'true');
    if (vals.length > 1) {
      const x = d3.scaleLinear([0, vals.length - 1], [1, w - 1]);
      const lo = d3.min(vals), hi = d3.max(vals), pad = (hi - lo) * 0.15 || 1;
      const y = d3.scaleLinear([lo - pad, hi + pad], [hh - 2, 2]);
      const col = o.tone === 'down' ? 'var(--g-red)' : o.tone === 'flat' ? 'var(--g-ink-3)' : 'var(--g-em)';
      svg.append('path').attr('d', d3.area().x((d, i) => x(i)).y0(hh).y1((d) => y(d))(vals)).style('fill', col).style('opacity', 0.1);
      svg.append('path').attr('d', d3.line().x((d, i) => x(i)).y((d) => y(d))(vals)).style('fill', 'none').style('stroke', col).attr('stroke-width', 1.5).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
    }
    return svg.node();
  };

  /* ---------- line chart ---------- */
  G.line = (box, cfg) => {
    box.replaceChildren();
    const W = box.clientWidth || 640, H = cfg.height || 260;
    const ser = cfg.series.filter((s) => s.data && s.data.length);
    if (!ser.length) return;
    const fmt = cfg.yFmt || ((v) => F.c(v));
    const all = ser.flatMap((s) => s.data);
    const ymax = d3.max(all, (d) => d[1]) * 1.08 || 1, ymin = cfg.zero === false ? d3.min(all, (d) => d[1]) * 0.95 : 0;
    const maxLab = d3.max(d3.scaleLinear([ymin, ymax], [0, 1]).ticks(4).map((t) => fmt(t).length)) || 3;
    const m = { t: 8, r: 12, b: 24, l: Math.max(34, maxLab * 6.4 + 12) };
    const x = d3.scaleUtc(d3.extent(all, (d) => d[0]), [m.l, W - m.r]);
    const y = d3.scaleLinear([ymin, ymax], [H - m.b, m.t]).nice(4);
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H).attr('role', 'img').attr('aria-label', cfg.label || 'Line chart');
    const gg = svg.append('g').attr('class', 'grid');
    y.ticks(4).forEach((t) => {
      gg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t));
      svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').text(fmt(t));
    });
    const xt = x.ticks(Math.max(2, Math.floor(W / 96))), xf = d3.utcFormat('%b %-d');
    xt.forEach((t) => svg.append('text').attr('x', x(t)).attr('y', H - 6).attr('text-anchor', 'middle').text(xf(t)));
    if (cfg.band) {
      const b = cfg.band;
      svg.append('path').attr('d', d3.area().x((d) => x(d[0])).y0((d) => y(d[1])).y1((d) => y(d[2]))(b.data)).style('fill', 'var(--g-em)').style('opacity', 0.12);
    }
    if (cfg.splitAt) { svg.append('line').attr('x1', x(cfg.splitAt)).attr('x2', x(cfg.splitAt)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--g-ink-3)').attr('stroke-dasharray', '3 3'); svg.append('text').attr('x', x(cfg.splitAt) + 6).attr('y', m.t + 10).text('Projected →'); }
    ser.forEach((s) => {
      const ln = d3.line().x((d) => x(d[0])).y((d) => y(d[1]));
      svg.append('path').attr('d', ln(s.data)).style('fill', 'none').style('stroke', s.color).attr('stroke-width', s.w || 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('stroke-dasharray', s.dash || null);
      if (cfg.endLabels !== false) { const l = s.data[s.data.length - 1]; if (s.label) svg.append('text').attr('x', Math.min(W - 4, x(l[0]) + 4)).attr('y', y(l[1]) + 4).attr('text-anchor', 'end').style('fill', s.color).text(''); }
    });
    const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--g-ink-3)').style('opacity', 0).attr('stroke-dasharray', '2 3');
    const dots = ser.map((s) => svg.append('circle').attr('r', 3.5).style('fill', s.color).style('opacity', 0));
    const bis = d3.bisector((d) => d[0]).center;
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).style('fill', 'transparent')
      .on('mousemove', (e) => {
        const px = d3.pointer(e)[0], dt = x.invert(px);
        const first = ser[0].data, i = Math.max(0, Math.min(first.length - 1, bis(first, dt)));
        const d0 = first[i][0];
        rule.attr('x1', x(d0)).attr('x2', x(d0)).style('opacity', 1);
        const tip = h('div', null, h('div', { class: 'muted', text: d3.utcFormat('%a, %b %-d')(d0) }));
        ser.forEach((s, k) => {
          const j = Math.max(0, Math.min(s.data.length - 1, bis(s.data, dt))), d = s.data[j];
          dots[k].attr('cx', x(d[0])).attr('cy', y(d[1])).style('opacity', 1);
          tip.append(h('div', { class: 'r' }, h('span', null, h('i', { style: `display:inline-block;width:8px;height:8px;border-radius:2px;background:${s.color};margin-right:6px` }), s.name), h('b', { text: (cfg.tipFmt || fmt)(s.raw ? s.raw[j] : d[1], s) })));
        });
        if (cfg.tipExtra) { const ex = cfg.tipExtra(d0, i); if (ex) tip.append(ex); }
        G.tip.show(e, tip);
      })
      .on('mouseleave', () => { rule.style('opacity', 0); dots.forEach((d) => d.style('opacity', 0)); G.tip.hide(); });
  };

  /* ---------- table ---------- */
  G.table = (cfg) => {
    const wrap = h('div', { class: 'g-tw', style: cfg.maxH ? `max-height:${cfg.maxH}px` : null });
    let rows = [], sort = cfg.sort || null; const open = new Set();
    const idf = cfg.id || ((r) => r.id);
    const sv = (c, r) => (c.sv ? c.sv(r) : r[c.k]);
    function render() {
      if (!rows.length) { wrap.replaceChildren(cfg.empty ? (cfg.empty.nodeType ? cfg.empty : G.empty('∅', cfg.empty, '')) : G.empty('∅', 'Nothing to show', 'Try adjusting your filters.')); return; }
      const t = h('table', { class: 'g-tbl' });
      if (cfg.source) { t.setAttribute('data-source', cfg.source); t.setAttribute('data-row-key', cfg.key.join(',')); }
      const tr = h('tr');
      cfg.cols.forEach((c) => {
        const th = h('th', {
          class: (c.cls || '') + (c.hide ? ' hide-' + c.hide : ''), text: c.label, scope: 'col',
          'aria-sort': sort && sort.k === c.k ? (sort.dir > 0 ? 'ascending' : 'descending') : null,
          onclick: () => { sort = { k: c.k, dir: sort && sort.k === c.k ? -sort.dir : c.first || -1 }; render(); },
        });
        if (cfg.source && !c.nofield) th.setAttribute('data-field', c.field || c.k);
        tr.append(th);
      });
      const body = h('tbody');
      let data = rows.slice();
      if (sort) {
        const c = cfg.cols.find((x) => x.k === sort.k);
        if (c) data.sort((a, b) => { const x = sv(c, a), y = sv(c, b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.dir; });
      }
      data.forEach((r, ri) => {
        const rid = idf(r);
        const trw = h('tr', { class: 'row' + (cfg.onRow ? ' click' : '') + (cfg.rowCls ? ' ' + (cfg.rowCls(r) || '') : '') });
        if (cfg.source) trw.setAttribute('data-key', cfg.key.map((k) => encodeURIComponent(r[k])).join(','));
        cfg.cols.forEach((c, ci) => {
          const v = c.f ? c.f(r, ri) : r[c.k];
          const td = h('td', { class: (c.cls || '') + (c.hide ? ' hide-' + c.hide : '') });
          if (ci === 0 && cfg.expand) td.append(h('span', { class: 'g-caret' + (open.has(rid) ? ' o' : ''), role: 'button', 'aria-label': 'Expand row', tabindex: '0', text: '▸', onclick: (e) => { e.stopPropagation(); open.has(rid) ? open.delete(rid) : open.add(rid); render(); }, onkeydown: (e) => { if (e.key === 'Enter') e.target.click(); } }));
          td.append(v == null ? '—' : v.nodeType ? v : document.createTextNode(String(v)));
          trw.append(td);
        });
        if (cfg.onRow) trw.addEventListener('click', (e) => { if (e.target.closest('button,a,input,select,label,.g-caret')) return; cfg.onRow(r); });
        body.append(trw);
        if (cfg.expand && open.has(rid)) body.append(h('tr', { class: 'x' }, h('td', { colspan: String(cfg.cols.length) }, cfg.expand(r))));
      });
      t.append(h('thead', null, tr), body);
      wrap.replaceChildren(t);
    }
    return { el: wrap, set(r) { rows = r || []; render(); } };
  };

  /* ---------- controls ---------- */
  G.sel = (opts, val, on, label) => {
    const s = h('select', { class: 'g-select', 'aria-label': label || 'Select', onchange: () => on(s.value) });
    opts.forEach((o) => { const v = typeof o === 'string' ? o : o.v, l = typeof o === 'string' ? o : o.l; s.append(h('option', { value: v, text: l })); });
    s.value = val;
    return s;
  };
  G.seg = (opts, val, on) => {
    const wrap = h('div', { class: 'g-seg', role: 'group' });
    const set = (v) => wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    opts.forEach((o) => { const v = typeof o === 'string' ? o : o.v, l = typeof o === 'string' ? o : o.l; wrap.append(h('button', { type: 'button', 'data-v': v, text: l, onclick: () => { set(v); on(v); } })); });
    set(val); wrap.set = set;
    return wrap;
  };
  G.search = (ph, on, val) => { const i = h('input', { class: 'g-input', type: 'search', placeholder: ph, 'aria-label': ph, oninput: () => on(i.value) }); if (val) i.value = val; return i; };
  G.btn = (label, on, cls) => h('button', { class: 'g-btn ' + (cls || ''), type: 'button', onclick: on, text: label });
  G.tabs = (opts, val, on) => {
    const w = h('div', { class: 'g-tabs', role: 'tablist' });
    opts.forEach((o) => w.append(h('button', { type: 'button', role: 'tab', 'data-v': o.v, class: o.v === val ? 'on' : '', text: o.l, onclick: () => { w.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === o.v)); on(o.v); } })));
    return w;
  };
  G.badge = (t, tone) => h('span', { class: 'bd ' + (tone || ''), text: t });
  G.score = (v, tone) => h('span', { class: 'g-score-b' }, h('b', { class: 'num', text: v }), h('span', { class: 'g-bar ' + (tone || '') }, h('i', { style: `width:${Math.max(2, Math.min(100, v))}%` })));
  G.pbar = (pct, tone) => h('div', { class: 'g-bar ' + (tone || '') }, h('i', { style: `width:${Math.max(2, Math.min(100, pct))}%` }));
  G.card = (title, sub, body, right, cls) => h('section', { class: 'g-card ' + (cls || '') }, (title || right) && h('div', { class: 'g-card-h' }, h('div', null, title && h('h3', { text: title }), sub && h('div', { class: 'g-sub', text: sub })), right && h('div', { class: 'r' }, right)), body);
  G.sec = (t, s, r) => (r ? h('div', { class: 'g-sec g-row', style: 'justify-content:space-between;align-items:flex-end' }, h('div', null, h('h2', { text: t }), s && h('p', { text: s })), r) : h('div', { class: 'g-sec' }, h('h2', { text: t }), s && h('p', { text: s })));
  G.empty = (ic, t, s, btn) => h('div', { class: 'g-empty' }, h('div', { class: 'ic', text: ic }), h('b', { text: t }), s && h('div', { text: s }), btn && h('div', { class: 'g-mt8' }, btn));
  G.skel = (n, hgt) => h('div', { class: 'g-gap8' }, Array.from({ length: n || 3 }, () => h('div', { class: 'g-skel', style: `height:${hgt || 20}px` })));
  G.errBox = (ids) => h('div', { class: 'g-card g-err' }, h('div', { class: 'g-card-h' }, h('div', null, h('h3', { text: 'We couldn’t load this view' }), h('div', { class: 'g-sub', text: 'One of the connected sources failed to respond. Your data is safe; nothing was changed.' }))),
    h('div', { class: 'g-row' }, G.btn('Retry', () => ids.forEach((i) => dash.refresh(i)), 'pri'), G.btn('Open Data sources', () => G.go('settings', { sec: 'sources' }))));
  G.insight = (ins, extra) => h('div', { class: 'g-ai' }, h('div', { class: 'tag' }, h('span', { class: 'g-dot' }), 'Radar insight'), h('div', { class: 't', text: ins.title }), h('p', { class: 'muted', style: 'color:var(--g-ink-2)', text: ins.text }),
    ins.bullets && ins.bullets.length ? h('ul', null, G.J(ins.bullets).map((b) => h('li', { text: b }))) : null, ins.evidence && G.J(ins.evidence).length ? h('div', { class: 'g-ev' }, G.J(ins.evidence).map((e) => h('div', null, h('small', { text: e[0] }), h('b', { text: e[1] })))) : null, extra);

  /* ---------- overlays ---------- */
  const ovl = h('div', { class: 'g-ovl' }, h('div', { class: 'g-ovl-in' }));
  app.prepend(ovl);
  const layer = ovl.firstChild;
  const toasts = h('div', { class: 'g-toasts' });
  layer.append(toasts);
  const stack = [];
  G.layer = layer;
  function vh() { app.style.setProperty('--g-vh', Math.max(480, window.innerHeight) + 'px'); }
  vh(); window.addEventListener('resize', vh);
  function mount(node, backdropClose, onClose) {
    vh();
    const bd = h('div', { class: 'g-backdrop', onclick: backdropClose ? () => close() : null });
    const wrap = h('div', { style: 'position:absolute;inset:0' }, bd, node);
    layer.insertBefore(wrap, toasts);
    const item = { wrap, close };
    stack.push(item);
    function close() { const i = stack.indexOf(item); if (i < 0) return; stack.splice(i, 1); wrap.remove(); if (onClose) onClose(); }
    return item;
  }
  G.closeTop = () => { const t = stack[stack.length - 1]; if (t) { t.close(); return true; } return false; };
  G.closeAll = () => { while (stack.length) stack[stack.length - 1].close(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) { e.preventDefault(); G.closeTop(); } });
  G.modal = (o) => {
    let it;
    const body = h('div', { class: 'g-dr-b' }, o.body);
    const node = h('div', { class: 'g-modal' + (o.wide ? ' wide' : ' ') + (o.cls ? ' ' + o.cls : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
      h('div', { class: 'g-dr-h' }, h('div', null, h('h3', { text: o.title }), o.sub && h('div', { class: 'g-sub', text: o.sub })), h('button', { class: 'g-btn ghost sm', style: 'margin-left:auto', 'aria-label': 'Close', onclick: () => it.close(), text: '✕' })),
      body, o.actions ? h('div', { class: 'g-dr-f' }, o.actions(() => it.close())) : null);
    it = mount(node, true, o.onClose);
    const f = node.querySelector('input,textarea,select,button.pri'); if (f) setTimeout(() => f.focus(), 30);
    return it;
  };
  G.confirm = (o) => G.modal({ title: o.title, body: h('div', { class: 'g-gap8' }, h('p', { text: o.text }), o.detail && h('p', { class: 'muted sm', text: o.detail })),
    actions: (close) => [G.btn('Cancel', close), G.btn(o.confirm || 'Confirm', () => { close(); o.onConfirm && o.onConfirm(); }, o.danger ? 'danger' : 'pri')] });
  G.drawer = (o) => {
    let it;
    const node = h('aside', { class: 'g-drawer' + (o.side === 'left' ? ' left' : ''), role: 'dialog', 'aria-label': o.title },
      o.side === 'left' ? null : h('div', { class: 'g-dr-h' }, h('div', { style: 'min-width:0' }, h('h3', { text: o.title }), o.sub && h('div', { class: 'g-sub', text: o.sub })), h('button', { class: 'g-btn ghost sm', style: 'margin-left:auto', 'aria-label': 'Close', onclick: () => it.close(), text: '✕' })),
      h('div', { class: o.side === 'left' ? 'g-side' : 'g-dr-b', style: o.side === 'left' ? 'position:static;height:100%' : null }, o.body),
      o.footer ? h('div', { class: 'g-dr-f' }, o.footer(() => it.close())) : null);
    it = mount(node, true, o.onClose);
    return it;
  };
  G.toast = (msg, o) => {
    o = o || {};
    const t = h('div', { class: 'g-toast g-fade ' + (o.tone || ''), role: 'status' }, h('span', { text: o.tone === 'bad' ? '⚠' : '✓' }), h('span', { text: msg }), o.action ? h('button', { text: o.action.label, onclick: () => { o.action.fn(); t.remove(); } }) : null);
    toasts.append(t);
    setTimeout(() => t.remove(), o.ms || 5200);
  };
  G.form = (fields) => {
    const els = {}; const box = h('div');
    fields.forEach((f) => {
      let inp;
      if (f.type === 'select') inp = G.sel(f.opts, f.val || (typeof f.opts[0] === 'string' ? f.opts[0] : f.opts[0].v), () => {}, f.label);
      else if (f.type === 'textarea') { inp = h('textarea', { class: 'g-input', placeholder: f.ph || '' }); inp.value = f.val || ''; }
      else { inp = h('input', { class: 'g-input', type: f.type || 'text', placeholder: f.ph || '' }); inp.value = f.val == null ? '' : f.val; }
      inp.id = 'gf-' + f.k; if (f.type === 'select') inp.style.width = '100%';
      els[f.k] = inp;
      box.append(h('div', { class: 'g-field' }, h('label', { for: 'gf-' + f.k, text: f.label }), inp, f.hint && h('div', { class: 'xs muted', text: f.hint })));
    });
    return { el: box, get: () => Object.fromEntries(Object.keys(els).map((k) => [k, els[k].value])), els };
  };
  G.copy = (text, ok) => {
    const done = () => G.toast(ok || 'Copied to clipboard');
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fb); return; } } catch (e) { /* fall through */ }
    fb();
    function fb() { try { const ta = h('textarea', { style: 'position:absolute;left:-9999px' }); ta.value = text; app.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) { G.toast('Copy is blocked in this view — select the text manually', { tone: 'bad' }); } }
  };
  G.download = (name, text, mime) => {
    try { const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' })); const a = h('a', { href: url, download: name }); app.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); G.toast('Downloaded ' + name); }
    catch (e) { G.toast('Download is blocked in this view', { tone: 'bad' }); }
  };
  /* simple popover that closes on outside click; anchor must be position:relative */
  G.popover = (anchor, build) => {
    let pop = null;
    const close = () => { if (pop) { pop.remove(); pop = null; document.removeEventListener('click', away, true); } };
    function away(e) { if (pop && !pop.contains(e.target) && !anchor.contains(e.target)) close(); }
    return {
      toggle() { if (pop) return close(); pop = h('div', { class: 'g-pop', role: 'menu' }, build(close)); anchor.append(pop); setTimeout(() => document.addEventListener('click', away, true), 0); },
      close,
    };
  };

  /* ---------- page registry ---------- */
  G.pages = {};
  G.page = (id, def) => { G.pages[id] = def; };
  G.pf = (id, defaults) => { if (!S.flt[id]) S.flt[id] = Object.assign({}, defaults); return S.flt[id]; };
  G.head = (eyebrow, title, sub, right) => h('div', { class: 'g-phead' }, h('div', { style: 'min-width:0' }, eyebrow && h('div', { class: 'g-eyebrow', text: eyebrow }), h('h1', { text: title }), sub && h('div', { class: 'g-sub', text: sub })), right && h('div', { class: 'g-phead-r' }, right));
  G.rangeSel = () => G.sel(Object.keys(G.RL).map((k) => ({ v: k, l: G.RL[k] })), S.range, (v) => { S.range = v; G.rerender(); }, 'Date range');
  G.kpiCard = (r, o) => {
    o = o || {};
    const good = r.metric === 'spend' ? null : r.good_up;
    const tone = G.tone(r.delta, good);
    const src = o.src || 'kpis', wh = o.where || { range: r.range, metric: r.metric }, fl = r.f || {};
    const card = h('div', { class: 'g-card kpi' + (o.big ? ' big' : '') });
    const val = G.mk(h('span', { class: 'v num', text: F.val(r.unit, r.value) }), src, fl.value || 'value', wh);
    const dl = G.mk(G.dl(r.delta, good), src, fl.delta || 'delta', wh);
    const d = h('div', { class: 'd' }, dl);
    if (r.prev != null) d.append(G.mk(h('span', { class: 'muted num', text: 'vs ' + F.val(r.unit, r.prev) + ' prev' }), src, fl.prev || 'prev', wh));
    else if (r.sub) d.append(h('span', { class: 'muted', text: r.sub }));
    card.append(h('div', { class: 'l', text: r.label }), h('div', { class: 'v' }, val), d);
    if (r.spark) card.append(G.spark(G.J(r.spark), { w: o.big ? 160 : 112, h: o.big ? 36 : 26, tone }));
    if (r.insight && (o.big || o.driver)) card.append(h('div', { class: 'g-sig-k', style: 'margin-top:8px', text: 'Primary driver' }), G.mk(h('div', { class: 'why', text: r.insight }), src, 'insight', wh));
    if (o.driver && r.insight && G.driverTarget) { const tg = G.driverTarget(r); card.append(h('button', { class: 'g-link', type: 'button', onclick: () => G.go(tg[0], tg[1]), text: 'See drivers →' })); }
    if (r.insight) G.hover(card, () => h('div', null, h('b', { text: r.label }), h('div', { style: 'margin-top:4px', text: r.insight })));
    return card;
  };
  G.kpiStrip = (rows, cls) => h('div', { class: 'g-grid' }, rows.map((r) => h('div', { class: (cls || 's3') + ' keep' }, G.kpiCard(r, { src: r.__src, where: r.__where }))));
})();
