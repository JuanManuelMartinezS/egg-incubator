/* =====================================================================
   Gráficas
   ===================================================================== */
let drawPending = false;
function requestDraw() { if (!drawPending) { drawPending = true; requestAnimationFrame(() => { drawPending = false; drawAll(); }); } }

function viewRange() {
  const d = S.data; if (!d.length) return null;
  const end0 = S.paused ? S.pausedEnd : d[d.length - 1].t;
  let start = S.win ? Math.max(end0 - S.win * 1000, d[0].t) : d[0].t, end = end0;
  if (end - start < 10000) end = start + 10000;
  return { start, end };
}
function prep(cv) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
function palette() {
  return { pv: css('--pv'), sp: css('--sp'), heat: css('--heat'), ok: css('--ok'), alarm: css('--alarm'), ink: css('--ink'), ink2: css('--ink-2'), muted: css('--muted'), line: css('--line'), soft: css('--line-soft'), surface: css('--surface'), mono: css('--mono'), sans: css('--sans') };
}
function withAlpha(hex, a) { // acepta #rrggbb
  const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function drawTimeAxis(ctx, P, g, y) {
  const range = g.end - g.start;
  const step = TSTEPS.find(s => range / s <= Math.max(3, g.pw / 90)) || TSTEPS[TSTEPS.length - 1];
  ctx.font = `11px ${P.mono}`; ctx.fillStyle = P.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let t = Math.ceil(g.start / step) * step; t <= g.end; t += step) {
    const x = g.x(t); ctx.fillText(fmtT(t, step < 60000), x, y);
    ctx.strokeStyle = P.soft; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, g.top); ctx.lineTo(x, g.bottom); ctx.stroke();
  }
}
function yTicks(min, max, n) { const st = niceStep(max - min, n), out = []; for (let v = Math.ceil(min / st) * st; v <= max + 1e-9; v += st) out.push(+v.toFixed(6)); return { st, out }; }
function drawYAxis(ctx, P, g, ticks, dec) {
  ctx.font = `11px ${P.mono}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ticks.out.forEach(v => {
    const y = g.y(v); ctx.strokeStyle = P.soft; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.left, y); ctx.lineTo(g.right, y); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.fillText(v.toFixed(dec).replace('-', '−'), g.left - 8, y);
  });
}
function crosshair(ctx, P, g) {
  if (S.hoverT == null || S.hoverT < g.start || S.hoverT > g.end) return;
  const x = g.x(S.hoverT); ctx.strokeStyle = P.ink2; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(x, g.top); ctx.lineTo(x, g.bottom + (g.extra || 0)); ctx.stroke(); ctx.setLineDash([]);
}

function drawMain() {
  const cv = $('#cvMain'), { ctx, w, h } = prep(cv), P = palette(), R = viewRange();
  if (!R) { ctx.fillStyle = P.muted; ctx.font = `14px ${P.sans}`; ctx.textAlign = 'center'; ctx.fillText('Sin datos', w / 2, h / 2); S.geo.main = null; return; }
  const d = S.data, i0 = Math.max(0, lowerBound(d, R.start) - 1), i1 = Math.min(d.length, lowerBound(d, R.end + 1));
  const ml = 50, mr = 14, mt = 14, strip = 16, gap = 10, mb = 24;
  const left = ml, right = w - mr, top = mt, bottom = h - mb - strip - gap, stripTop = h - mb - strip;
  const pw = right - left;
  // rango Y
  let lo = Infinity, hi = -Infinity;
  for (let i = i0; i < i1; i++) { const s = d[i]; lo = Math.min(lo, s.pv, s.sp, s.lo ?? Infinity); hi = Math.max(hi, s.pv, s.sp, s.hi ?? -Infinity); }
  if (S.ideal && lo < 40 && hi > 34) { lo = Math.min(lo, 37.2); hi = Math.max(hi, 37.8); }
  let pad = Math.max((hi - lo) * 0.12, 0.4); lo -= pad; hi += pad;
  if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }
  const g = { left, right, top, bottom, pw, start: R.start, end: R.end, lo, hi, extra: strip + gap,
    x: t => left + (t - R.start) / (R.end - R.start) * pw, y: v => bottom - (v - lo) / (hi - lo) * (bottom - top) };
  S.geo.main = g;
  const ticks = yTicks(lo, hi, 6);
  drawYAxis(ctx, P, g, ticks, ticks.st < 1 ? (ticks.st < 0.1 ? 2 : 1) : 0);
  drawTimeAxis(ctx, P, g, h - mb + 6);

  ctx.save(); ctx.beginPath(); ctx.rect(left, top - 4, pw, bottom - top + 8); ctx.clip();
  // zona ideal
  if (S.ideal) {
    const y1 = g.y(37.8), y2 = g.y(37.2);
    ctx.fillStyle = withAlpha(P.ok, .13); ctx.fillRect(left, y1, pw, y2 - y1);
    ctx.strokeStyle = withAlpha(P.ok, .55); ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, y1); ctx.lineTo(right, y1); ctx.moveTo(left, y2); ctx.lineTo(right, y2); ctx.stroke(); ctx.setLineDash([]);
  }
  // alarma
  for (let i = i0, run = null; i <= i1; i++) {
    const on = i < i1 && d[i].alarm;
    if (on && run === null) run = d[i].t;
    if (!on && run !== null) { ctx.fillStyle = withAlpha(P.alarm, .16); ctx.fillRect(g.x(run), top, g.x(d[Math.min(i, d.length - 1)].t) - g.x(run), bottom - top); run = null; }
  }
  // banda de histéresis
  for (let i = i0; i < i1;) {
    if (d[i].lo == null) { i++; continue; }
    let j = i; while (j + 1 < i1 && d[j + 1].lo != null && d[j + 1].seg === d[i].seg) j++;
    const st = Math.max(1, Math.ceil((j - i) / (pw * 1.5)));
    ctx.beginPath(); ctx.moveTo(g.x(d[i].t), g.y(d[i].hi));
    for (let k = i; k <= j; k += st) ctx.lineTo(g.x(d[k].t), g.y(d[k].hi));
    ctx.lineTo(g.x(d[j].t), g.y(d[j].hi)); ctx.lineTo(g.x(d[j].t), g.y(d[j].lo));
    for (let k = j; k >= i; k -= st) ctx.lineTo(g.x(d[k].t), g.y(d[k].lo));
    ctx.lineTo(g.x(d[i].t), g.y(d[i].lo)); ctx.closePath();
    ctx.fillStyle = withAlpha(P.sp, .16); ctx.fill();
    ctx.strokeStyle = withAlpha(P.sp, .5); ctx.lineWidth = 1; ctx.stroke();
    i = j + 1;
  }
  // líneas
  const line = (key, color, width, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(dash || []);
    const st = Math.max(1, Math.floor((i1 - i0) / (pw * 2)));
    ctx.beginPath(); let pen = false, prev = null;
    for (let i = i0; i < i1; i += st) {
      const s = d[i];
      if (prev && (s.seg !== prev.seg || s.t - prev.t > 45000 + st * 2000)) pen = false;
      const x = g.x(s.t), y = g.y(s[key]);
      if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
      prev = s;
    }
    ctx.stroke(); ctx.setLineDash([]);
  };
  line('sp', P.sp, 2, [6, 4]);
  line('pv', P.pv, 2.25);
  ctx.restore();

  // marcadores de cambio de técnica
  ctx.font = `500 11px ${P.sans}`; ctx.textBaseline = 'top'; let lastLabelX = -1e9;
  for (let i = Math.max(1, i0 + 1); i < i1; i++) {
    if (d[i].mode !== d[i - 1].mode && d[i].seg === d[i - 1].seg) {
      const x = g.x(d[i].t); ctx.strokeStyle = P.ink2; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, stripTop + strip); ctx.stroke(); ctx.setLineDash([]);
      if (x - lastLabelX > 80) {
        const txt = MODES[d[i].mode], tw = ctx.measureText(txt).width + 12, tx = Math.min(x + 4, right - tw);
        ctx.fillStyle = P.surface; ctx.strokeStyle = P.line; ctx.beginPath(); ctx.roundRect(tx, top + 2, tw, 18, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.fillText(txt, tx + 6, top + 6); lastLabelX = x;
      }
    }
  }
  // tira de la resistencia
  ctx.fillStyle = P.soft; ctx.beginPath(); ctx.roundRect(left, stripTop, pw, strip, 4); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(left, stripTop, pw, strip, 4); ctx.clip(); ctx.fillStyle = P.heat;
  {
    let run = null;
    const endRun = k => { const xa = g.x(d[run].t), xb = g.x(d[k].t); ctx.fillRect(xa, stripTop, Math.max(1.2, xb - xa), strip); run = null; };
    for (let i = i0; i < i1; i++) {
      const on = d[i].out, brk = i > i0 && d[i].seg !== d[i - 1].seg;
      if (run !== null && (brk || !on)) endRun(brk ? i - 1 : i);
      if (on && run === null) run = i;
    }
    if (run !== null) endRun(i1 - 1);
  }
  ctx.restore();
  ctx.font = `11px ${P.sans}`; ctx.fillStyle = P.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('Resist.', left - 8, stripTop + strip / 2);

  // cursor
  crosshair(ctx, P, g);
  if (S.hoverT != null && S.hoverT >= R.start && S.hoverT <= R.end) {
    const s = nearest(S.hoverT);
    if (s) [[s.sp, P.sp], [s.pv, P.pv]].forEach(([v, c]) => { ctx.beginPath(); ctx.arc(g.x(s.t), g.y(v), 4.5, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = P.surface; ctx.lineWidth = 2; ctx.stroke(); });
  }
}

function drawErr() {
  const cv = $('#cvErr'), { ctx, w, h } = prep(cv), P = palette(), R = viewRange();
  if (!R) { S.geo.err = null; return; }
  const d = S.data, i0 = Math.max(0, lowerBound(d, R.start) - 1), i1 = Math.min(d.length, lowerBound(d, R.end + 1));
  const left = 50, right = w - 14, top = 8, bottom = h - 24, pw = right - left;
  let lo = 0, hi = 0;
  for (let i = i0; i < i1; i++) { const e = d[i].sp - d[i].pv; lo = Math.min(lo, e); hi = Math.max(hi, e); }
  const pad = Math.max((hi - lo) * .12, .2); lo -= pad; hi += pad;
  const g = { left, right, top, bottom, pw, start: R.start, end: R.end, lo, hi, x: t => left + (t - R.start) / (R.end - R.start) * pw, y: v => bottom - (v - lo) / (hi - lo) * (bottom - top) };
  S.geo.err = g;
  const ticks = yTicks(lo, hi, 3); drawYAxis(ctx, P, g, ticks, ticks.st < 1 ? 1 : 0); drawTimeAxis(ctx, P, g, h - 18);
  const y0 = g.y(0);
  ctx.save(); ctx.beginPath(); ctx.rect(left, top, pw, bottom - top); ctx.clip();
  const st = Math.max(1, Math.floor((i1 - i0) / (pw * 2)));
  [[1, P.heat], [-1, P.pv]].forEach(([sign, col]) => {       // relleno arriba/abajo del cero
    ctx.beginPath(); ctx.moveTo(g.x(d[i0].t), y0);
    for (let i = i0; i < i1; i += st) { const e = d[i].sp - d[i].pv; ctx.lineTo(g.x(d[i].t), g.y(sign > 0 ? Math.max(0, e) : Math.min(0, e))); }
    ctx.lineTo(g.x(d[i1 - 1].t), y0); ctx.closePath(); ctx.fillStyle = withAlpha(col, .28); ctx.fill();
  });
  ctx.strokeStyle = P.ink2; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.beginPath();
  let pen = false, prev = null;
  for (let i = i0; i < i1; i += st) { const s = d[i], x = g.x(s.t), y = g.y(s.sp - s.pv); if (prev && s.seg !== prev.seg) pen = false; if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y); prev = s; }
  ctx.stroke();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, y0); ctx.lineTo(right, y0); ctx.stroke();
  ctx.restore();
  ctx.font = `11px ${P.sans}`; ctx.fillStyle = P.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('PV bajo SP', left + 6, top + 3);
  ctx.textBaseline = 'bottom'; ctx.fillText('PV sobre SP', left + 6, bottom - 3);
  crosshair(ctx, P, g);
}

function nearest(t) {
  const d = S.data; if (!d.length) return null; const i = lowerBound(d, t);
  if (i <= 0) return d[0]; if (i >= d.length) return d[d.length - 1];
  return (t - d[i - 1].t < d[i].t - t) ? d[i - 1] : d[i];
}

function drawAll() {
  drawMain(); drawErr();
  const now = performance.now(); if (now - (drawAll.last || 0) > 500) { drawAll.last = now; renderCompare(); if (document.body.classList.contains('tableview')) renderTable(); }
}

/* ---- cursor y tooltip, sincronizado entre las dos gráficas ---- */
function bindHover(wrapId, key) {
  const wrap = $(wrapId), cv = $('canvas', wrap), tip = $('#tip');
  cv.addEventListener('pointermove', e => {
    const g = S.geo[key]; if (!g) return;
    const x = e.clientX - cv.getBoundingClientRect().left;
    if (x < g.left || x > g.right) { S.hoverT = null; tip.style.display = 'none'; requestDraw(); return; }
    S.hoverT = g.start + (x - g.left) / g.pw * (g.end - g.start);
    const s = nearest(S.hoverT); if (!s) return;
    S.hoverT = s.t;
    const e2 = s.sp - s.pv;
    tip.innerHTML = `<div class="t">${fmtT(s.t, true)}${S.paused ? ' · vista en pausa' : ''}</div>
      <div class="r"><span>Temperatura</span><b>${fmt(s.pv, 2)} °C</b></div>
      <div class="r"><span>Setpoint</span><b>${fmt(s.sp, 2)} °C</b></div>
      <div class="r"><span>Error</span><b>${fmtSigned(e2, 2)} °C</b></div>
      <div class="r"><span>Resistencia</span><b>${s.out ? 'encendida' : 'apagada'}</b></div>
      <div class="r"><span>Técnica</span><b style="font-family:var(--sans)">${MODES[s.mode]}</b></div>`;
    tip.style.display = 'block';
    const box = $('#chartMain').getBoundingClientRect(), px = g.x(s.t) + 8;
    const tw = tip.offsetWidth; tip.style.left = (px + tw + 16 > box.width ? px - tw - 24 : px + 8) + 'px'; tip.style.top = '12px';
    requestDraw();
  });
  cv.addEventListener('pointerleave', () => { S.hoverT = null; tip.style.display = 'none'; requestDraw(); });
}
bindHover('#chartMain', 'main'); bindHover('#chartErr', 'err');
new ResizeObserver(() => requestDraw()).observe($('.stage'));
