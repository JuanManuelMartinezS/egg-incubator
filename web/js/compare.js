/* =====================================================================
   Comparación de técnicas
   ===================================================================== */
function metricsFor(samples) {
  const m = { time: 0, absE: 0, over: 0, inTol: 0, sw: 0, on: 0, n: 0 };
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (b.seg !== a.seg) continue; const dt = b.t - a.t; if (dt <= 0 || dt > 30000) continue;
    const e = b.sp - b.pv;
    m.time += dt; m.absE += Math.abs(e) * dt; m.over = Math.max(m.over, -e);
    if (Math.abs(e) <= S.tol) m.inTol += dt; if (b.out) m.on += dt; if (b.out !== a.out) m.sw++; m.n++;
  }
  return m;
}
function renderCompare() {
  const R = viewRange(), box = $('#cmp');
  if (!R) { box.innerHTML = '<div class="empty">Sin datos</div>'; return; }
  const d = S.data, i0 = lowerBound(d, R.start), i1 = Math.min(d.length, lowerBound(d, R.end + 1)), win = d.slice(i0, i1);
  const rows = [0, 1, 2].map(md => ({ name: MODES[md], m: metricsFor(win.filter(s => s.mode === md)), md })).filter(r => r.m.time > 0);
  const all = metricsFor(win);
  if (!rows.length) { box.innerHTML = '<div class="empty">Sin datos</div>'; return; }
  const row = (name, m, cls) => `<tr class="${cls || ''}"><td>${name}</td><td>${fmtT(m.time, true)}</td><td>${fmt(m.absE / m.time, 2)} °C</td><td>${fmt(Math.max(0, m.over), 2)} °C</td><td>${fmt(m.inTol / m.time * 100, 0)} %</td><td>${fmt(m.sw / (m.time / 3.6e6), 0)}</td><td>${fmt(m.on / m.time * 100, 0)} %</td></tr>`;
  box.innerHTML = `<table class="cmp"><thead><tr><th>Técnica</th><th>Tiempo</th><th>Error medio</th><th>Máx. sobre SP</th><th>En rango</th><th>Cambios/h</th><th>Potencia</th></tr></thead><tbody>${rows.map(r => row(r.name, r.m)).join('')}${rows.length > 1 ? row('Total', all, 'total') : ''}</tbody></table>`;
}
$('#tol').addEventListener('input', e => { const v = parseFloat(e.target.value); if (v > 0) { S.tol = v; renderCompare(); updateReadouts(); } });
