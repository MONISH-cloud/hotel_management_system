// Injected into each page by record.mjs: captions, highlight rings, a fake cursor and fades.
(() => {
  if (window.__wt) return;
  const css = document.createElement('style');
  css.textContent = `
    nextjs-portal { display: none !important; }
    html { scroll-behavior: auto !important; }
    #__wt_root { position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 2147483000; pointer-events: none; }
    .__wt_ring { position: absolute; border: 2.5px solid #e6c88a; border-radius: 16px; box-shadow: 0 0 0 6px rgba(230,200,138,.16), 0 0 38px rgba(230,200,138,.35); }
    .__wt_ring.amber { border-color: #f0a65c; box-shadow: 0 0 0 6px rgba(240,166,92,.16), 0 0 38px rgba(240,166,92,.35); }
    .__wt_lbl { position: absolute; white-space: nowrap; font: 600 14px/1 Manrope, var(--font-manrope), system-ui, sans-serif; color: #17130b; background: #e6c88a;
      padding: 8px 12px; border-radius: 999px; box-shadow: 0 8px 24px rgba(0,0,0,.45); letter-spacing: .01em; }
    .__wt_lbl.amber { background: #f0a65c; }
    #__wt_cap { position: fixed; left: 28px; bottom: 24px; max-width: 1080px; z-index: 2147483001; pointer-events: none;
      background: rgba(11,12,15,.9); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(230,200,138,.28); border-radius: 18px; padding: 16px 22px 17px; box-shadow: 0 24px 60px rgba(0,0,0,.55);
      font-family: Manrope, var(--font-manrope), system-ui, sans-serif; color: #efe8da; }
    #__wt_cap .ch { font-size: 11.5px; letter-spacing: .26em; text-transform: uppercase; color: #d6b679; font-weight: 700; }
    #__wt_cap .row { display: flex; align-items: center; gap: 12px; margin-top: 9px; }
    #__wt_cap .t { font-size: 22px; font-weight: 700; letter-spacing: -.005em; }
    #__wt_cap .b { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 6px 10px; border-radius: 999px; white-space: nowrap; }
    #__wt_cap .b.solves { color: #8fe0ae; background: rgba(127,211,160,.12); border: 1px solid rgba(127,211,160,.45); }
    #__wt_cap .b.gap { color: #f3b273; background: rgba(240,166,92,.12); border: 1px solid rgba(240,166,92,.5); }
    #__wt_cap .b.feature { color: #e6c88a; background: rgba(230,200,138,.1); border: 1px solid rgba(230,200,138,.45); }
    #__wt_cap .s { font-size: 15px; line-height: 1.5; color: #b9b2a5; margin-top: 8px; }
    #__wt_cap.side { left: 24px; bottom: auto; top: 50%; transform: translateY(-50%); max-width: 350px; }
    #__wt_cap.side .row { flex-direction: column; align-items: flex-start; }
    #__wt_cap.side .t { font-size: 24px; line-height: 1.2; }
    #__wt_fade { position: fixed; inset: 0; background: #0a0b0e; z-index: 2147483003; pointer-events: none; opacity: 0; }
    #__wt_cur { position: fixed; left: 0; top: 0; z-index: 2147483002; pointer-events: none; width: 30px; height: 30px; display: none; filter: drop-shadow(0 3px 6px rgba(0,0,0,.6)); }
    #__wt_cur .ripple { position: absolute; left: -18px; top: -18px; width: 36px; height: 36px; border-radius: 50%; border: 2.5px solid #e6c88a; opacity: 0; }
    #__wt_cur.down .ripple { opacity: 1; }
  `;
  document.head.appendChild(css);
  const root = Object.assign(document.createElement('div'), { id: '__wt_root' });
  const cap = Object.assign(document.createElement('div'), { id: '__wt_cap' });
  const fadeEl = Object.assign(document.createElement('div'), { id: '__wt_fade' });
  const cur = Object.assign(document.createElement('div'), { id: '__wt_cur' });
  cur.innerHTML = '<div class="ripple"></div><svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.5L9.5 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  cap.style.display = 'none';
  document.body.append(root, cap, cur, fadeEl);
  let curPos = { x: innerWidth * 0.62, y: innerHeight * 0.55 };

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const own = (e) => norm([...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '));
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function find(t) {
    let el;
    if (t.sel) el = [...document.querySelectorAll(t.sel)].filter(visible)[t.nth || 0];
    else {
      const all = [...document.body.querySelectorAll('*')].filter((e) => !e.closest('#__wt_root,#__wt_cap,#__wt_cur') && visible(e));
      let c = all.filter((e) => own(e) === t.t);
      if (!c.length) c = all.filter((e) => norm(e.textContent) === t.t && ![...e.children].some((ch) => norm(ch.textContent) === t.t));
      if (!c.length) c = all.filter((e) => norm(e.textContent).includes(t.t) && ![...e.children].some((ch) => norm(ch.textContent).includes(t.t)));
      if (t.anchor) {
        // the match closest above another element (e.g. the "Room total" on the same card as the first "Pay balance")
        const a = find(t.anchor);
        const at = a ? a.getBoundingClientRect().top : Infinity;
        c = c.filter((e) => e.getBoundingClientRect().top <= at).sort((p, q) => q.getBoundingClientRect().top - p.getBoundingClientRect().top);
      }
      el = c[t.nth || 0];
    }
    for (let i = 0; el && i < (t.up || 0); i++) el = el.parentElement;
    return el || null;
  }
  function box(t) {
    const el = find(t); if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, cx: r.left + scrollX + r.width / 2, cy: r.top + scrollY + r.height / 2 };
  }

  window.__wt = {
    box: (ts) => box(ts[0]),
    boxes: (ts) => ts.map(box),
    clear: () => { root.innerHTML = ''; },
    highlight(ts) {
      root.innerHTML = '';
      for (const t of ts) {
        const b = box(t); if (!b) continue;
        const pad = t.pad ?? 8;
        const ring = Object.assign(document.createElement('div'), { className: '__wt_ring ' + (t.tone || '') });
        Object.assign(ring.style, { left: b.x - pad + 'px', top: b.y - pad + 'px', width: b.w + pad * 2 + 'px', height: b.h + pad * 2 + 'px' });
        root.appendChild(ring);
        if (t.label) {
          const l = Object.assign(document.createElement('div'), { className: '__wt_lbl ' + (t.tone || ''), textContent: t.label });
          root.appendChild(l);
          const above = b.y - scrollY > 56 || t.below === false;
          l.style.left = Math.max(8, Math.min(b.x - pad, document.documentElement.clientWidth - l.offsetWidth - 12)) + 'px';
          l.style.top = (above && t.below !== true ? b.y - pad - l.offsetHeight - 10 : b.y + b.h + pad + 10) + 'px';
        }
      }
      root.style.opacity = 0;
    },
    hlOpacity: (o) => { root.style.opacity = o; },
    caption(c) {
      cap.style.display = c.title ? '' : 'none'; cap.classList.toggle('side', !!c.side);
      cap.innerHTML = `<div class="ch">${esc(c.chapter)}</div>
        <div class="row">${c.badge ? `<span class="b ${c.badge}">${{ solves: '✓ Solves', gap: '✕ Not there yet', feature: '★ Feature' }[c.badge]}${c.tag ? ' · ' + esc(c.tag) : ''}</span>` : ''}<span class="t">${esc(c.title)}</span></div>
        ${c.text ? `<div class="s">${esc(c.text)}</div>` : ''}`;
    },
    fade: (o) => { fadeEl.style.opacity = o; },
    cursor: (show) => { cur.style.display = show ? 'block' : 'none'; cur.style.transform = `translate(${curPos.x}px, ${curPos.y}px)`; },
    cursorPos: () => curPos,
    moveCursor: (x, y) => { curPos = { x, y }; cur.style.transform = `translate(${x}px, ${y}px)`; },
    press: (d) => cur.classList.toggle('down', d),
    click: (t) => { const el = find(t); if (el) el.click(); return !!el; },
  };
})();
