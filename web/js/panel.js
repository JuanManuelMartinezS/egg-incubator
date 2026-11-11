/* =====================================================================
   Configuración: formulario
   ===================================================================== */
const inputOf = k => $('#f-' + k);
const shown = k => +(S.cfg[k] * FIELDS[k].f).toFixed(FIELDS[k].dec + 2);
const typed = k => parseFloat(inputOf(k).value);
const isDirty = k => { const v = typed(k); return isFinite(v) && Math.abs(v - shown(k)) > 1e-6; };
const dirtyKeys = () => Object.keys(FIELDS).filter(isDirty);

function setField(k) { inputOf(k).value = shown(k).toFixed(FIELDS[k].dec); }
function applyCfg(upd) {
  const wasDirty = {}; Object.keys(FIELDS).forEach(k => wasDirty[k] = isDirty(k));
  Object.assign(S.cfg, upd);
  Object.keys(FIELDS).forEach(k => { if (!wasDirty[k] || !inputOf(k).value) setField(k); });
  $('#spRange').value = typed('SP') || S.cfg.SP;
  refreshForm();
}
function refreshForm() {
  const dk = dirtyKeys();
  Object.keys(FIELDS).forEach(k => $(`.fld[data-key="${k}"]`).classList.toggle('dirty', dk.includes(k)));
  const n = dk.length, b = $('#dirtyN'); b.hidden = n === 0; b.textContent = n;
  $('#btnApply').disabled = !S.conn || n === 0;
  updatePreviews(); updateControls();
}

function updateControls() {
  const live = !!S.conn, c = S.cfg, eff = S.last ? S.last.mode : c.MODE;
  // segmentados
  $$('.seg').forEach(seg => {
    const k = seg.dataset.key;
    const locked = !live || (k === 'MODE' && c.MODESRC === 0);
    seg.classList.toggle('locked', locked);
    $$('button', seg).forEach(b => {
      const v = +b.dataset.v;
      const active = (k === 'MODE' && c.MODESRC === 0) ? v === eff : v === c[k];
      b.setAttribute('aria-checked', active); b.disabled = !live || (k === 'MODE' && c.MODESRC === 0);
      b.classList.toggle('live', locked && active);
    });
  });
  // setpoint
  const spOk = live && c.SPSRC === 1;
  inputOf('SP').disabled = !spOk; $('#spRange').disabled = !spOk; $$('#spChips button').forEach(b => b.disabled = !spOk);
  // manual
  const manOk = live && c.MODESRC === 1 && eff === 0;
  const rb = $('#relayBtn'); rb.disabled = !manOk;
  rb.setAttribute('aria-pressed', !!c.RELAY && manOk);
  $('#relayBtnTxt').textContent = (c.RELAY && manOk) ? 'Encendida' : 'Apagada';
  ['btnRead', 'btnSave', 'btnDefaults'].forEach(id => $('#' + id).disabled = !live);
  $('#btnApply').disabled = !live || dirtyKeys().length === 0;
}

function updatePreviews() {
  const c = S.cfg;
  const sp = c.SPSRC === 1 ? (typed('SP') || c.SP) : (S.last?.sp ?? c.SP);
  const m = isFinite(typed('MARGIN')) ? typed('MARGIN') : c.MARGIN;
  const band = sp * m / 100;
  $('#hystPreview').innerHTML = `<b>${fmt(sp - band, 2)}</b> – <b>${fmt(sp + band, 2)} °C</b>`;
  const span = isFinite(typed('SPAN')) ? typed('SPAN') : c.SPAN;
  const per = isFinite(typed('PERIOD')) ? typed('PERIOD') : c.PERIOD / 1000;
  const e = S.last ? Math.max(0, S.last.sp - S.last.pv) : 1;
  const pct = Math.min(100, e * 100 / span), on = per * pct / 100;
  $('#pwmPreview').innerHTML = `<b>${fmt(100 / span, 1)} %/°C</b> · ahora <b>${fmt(on, 1)} s</b> de <b>${fmt(per, 0)} s</b>`;
}

/* ---- eventos del formulario ---- */
$$('.inp input').forEach(i => i.addEventListener('input', () => {
  if (i.id === 'f-SP' && isFinite(typed('SP'))) $('#spRange').value = typed('SP');
  refreshForm();
}));
$$('.inp input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter' && S.conn) applyKeys(dirtyKeys()); }));
$('#spRange').addEventListener('input', e => { inputOf('SP').value = (+e.target.value).toFixed(2); refreshForm(); });
$('#spRange').addEventListener('change', () => applyKeys(['SP']));
$('#spChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  inputOf('SP').value = (+b.dataset.sp).toFixed(2); $('#spRange').value = b.dataset.sp; refreshForm(); applyKeys(['SP']);
});
$$('.seg').forEach(seg => seg.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled || !S.conn) return;
  const k = seg.dataset.key, v = +b.dataset.v;
  send(`SET ${k} ${v}`); S.cfg[k] = v;
  if (k === 'MODESRC' || k === 'MODE') S.cfg.RELAY = 0;
  updateControls(); setTimeout(() => send('GET'), 120);
}));
$('#relayBtn').addEventListener('click', () => {
  const v = S.cfg.RELAY ? 0 : 1; S.cfg.RELAY = v; send('RELAY ' + v); updateControls();
});

async function applyKeys(keys) {
  if (!S.conn || !keys.length) return;
  for (const k of keys) {
    const v = typed(k), F = FIELDS[k];
    if (!isFinite(v) || v < F.min || v > F.max) { toast(`Rango: ${F.min} a ${F.max}`); setField(k); continue; }
    send(`SET ${k} ${Math.round(v / F.f * 1000) / 1000}`);
    await new Promise(r => setTimeout(r, 40));
  }
  send('GET');
}
$('#btnApply').addEventListener('click', () => applyKeys(dirtyKeys()));
$('#btnRead').addEventListener('click', () => { Object.keys(FIELDS).forEach(k => setField(k)); send('GET'); });
$('#btnSave').addEventListener('click', () => { send('SAVE'); toast('Guardado.'); });
$('#btnDefaults').addEventListener('click', () => { send('DEFAULTS'); Object.keys(FIELDS).forEach(k => inputOf(k).value = ''); });
