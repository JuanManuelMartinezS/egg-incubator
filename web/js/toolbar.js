/* =====================================================================
   Barra de herramientas
   ===================================================================== */
$('#winGroup').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.win = +b.dataset.w; $$('#winGroup button').forEach(x => x.setAttribute('aria-pressed', x === b)); requestDraw();
});
$('#btnPause').addEventListener('click', e => {
  S.paused = !S.paused; S.pausedEnd = S.lastT; e.currentTarget.setAttribute('aria-pressed', S.paused);
  e.currentTarget.textContent = S.paused ? 'Reanudar' : 'Pausar'; requestDraw();
});
$('#btnIdeal').addEventListener('click', e => { S.ideal = !S.ideal; e.currentTarget.setAttribute('aria-pressed', S.ideal); $('#legIdeal').style.display = S.ideal ? '' : 'none'; requestDraw(); });
$('#btnTable').addEventListener('click', e => { const on = document.body.classList.toggle('tableview'); e.currentTarget.setAttribute('aria-pressed', on); if (on) renderTable(); });
function renderTable() {
  const R = viewRange(), wrap = $('#tblWrap'); if (!R) { wrap.innerHTML = '<div class="empty" style="padding:14px">Sin datos todavía.</div>'; return; }
  const d = S.data, i0 = lowerBound(d, R.start), rows = d.slice(i0).slice(-150).reverse();
  wrap.innerHTML = `<table><thead><tr><th>Tiempo</th><th>PV °C</th><th>SP °C</th><th>Error °C</th><th>Resistencia</th><th>Técnica</th></tr></thead><tbody>${rows.map(s => `<tr><td>${fmtT(s.t, true)}</td><td>${fmt(s.pv, 2)}</td><td>${fmt(s.sp, 2)}</td><td>${fmtSigned(s.sp - s.pv, 2)}</td><td>${s.out ? 'encendida' : 'apagada'}</td><td>${MODES[s.mode]}</td></tr>`).join('')}</tbody></table>`;
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
$('#btnCsv').addEventListener('click', () => {
  if (!S.data.length) { toast('Sin datos.'); return; }
  const head = 'tiempo_s,hora,setpoint_c,pv_c,error_c,error_pct,resistencia,tecnica,ciclo_pct,alarma\n';
  const body = S.data.map(s => [(s.t / 1000).toFixed(1), new Date(s.w).toISOString(), s.sp, s.pv, (s.sp - s.pv).toFixed(2), s.err, s.out, MODES[s.mode], s.duty, s.alarm].join(',')).join('\n');
  download(`incubadora-${stamp()}.csv`, new Blob([head + body], { type: 'text/csv' }));
});
$('#btnPng').addEventListener('click', () => {
  const a = $('#cvMain'), b = $('#cvErr'), c = document.createElement('canvas'), x = c.getContext('2d');
  c.width = a.width; c.height = a.height + b.height; x.fillStyle = css('--surface'); x.fillRect(0, 0, c.width, c.height);
  x.drawImage(a, 0, 0); x.drawImage(b, 0, a.height); c.toBlob(bl => download(`incubadora-${stamp()}.png`, bl));
});
$('#btnClear').addEventListener('click', () => {
  if (S.data.length && !confirm('¿Borrar los datos?')) return;
  S.data = []; S.last = null; S.offset = 0; S.lastT = 0; S.lastMs = null; S.paused = false; $('#btnPause').setAttribute('aria-pressed', false); $('#btnPause').textContent = 'Pausar'; requestDraw(); renderCompare();
});
