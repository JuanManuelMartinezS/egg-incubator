/* =====================================================================
   Lecturas en pantalla
   ===================================================================== */
function updateReadouts() {
  const s = S.last; if (!s) return;
  $('#pv').textContent = fmt(s.pv, 1);
  $('#spv').textContent = fmt(s.sp, 2);
  const e = s.sp - s.pv;
  $('#errc').textContent = fmtSigned(e, 2);
  const chip = $('#relayChip'); chip.classList.toggle('on', !!s.out);
  $('#relayTxt').textContent = s.out ? 'Encendida' : 'Apagada';
  $('#modeTxt').textContent = MODES[s.mode] ?? '--';
  $('#alarm').classList.toggle('show', !!s.alarm);

  // riel de temperatura
  const c = s.sp, half = 4, min = c - half, max = c + half;
  const pct = v => Math.min(100, Math.max(0, (v - min) / (max - min) * 100));
  $('#railMin').textContent = fmt(min, 1); $('#railMax').textContent = fmt(max, 1);
  $('#railSp').style.left = pct(c) + '%';
  const pvEl = $('#railPv'); pvEl.style.left = pct(s.pv) + '%'; pvEl.classList.toggle('off', s.pv < min || s.pv > max);
  const bandHalf = s.mode === 1 ? c * S.cfg.MARGIN / 100 : S.tol;
  const b = $('#railBand'); b.style.left = pct(c - bandHalf) + '%'; b.style.width = (pct(c + bandHalf) - pct(c - bandHalf)) + '%';
  updatePreviews(); updateControls();
}
