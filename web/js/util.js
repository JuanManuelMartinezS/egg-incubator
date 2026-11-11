const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* =====================================================================
   Utilidades
   ===================================================================== */
const fmt = (v, d = 1) => (v == null || !isFinite(v)) ? '--' : v.toFixed(d).replace('-', '−');
const fmtSigned = (v, d = 2) => (v == null || !isFinite(v)) ? '--' : (v > 0 ? '+' : '') + v.toFixed(d).replace('-', '−');
function fmtT(ms, forceSec) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  const p = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}${forceSec ? ':' + p(ss) : ''}` : `${p(m)}:${p(ss)}`;
}
function toast(msg, ms = 4200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const lowerBound = (arr, t) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < t) lo = m + 1; else hi = m; } return lo; };
function niceStep(range, target) {
  const raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
const TSTEPS = [1,2,5,10,15,30,60,120,300,600,900,1800,3600,7200,14400,21600].map(x => x * 1000);
