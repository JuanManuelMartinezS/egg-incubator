/* =====================================================================
   Prueba de conexión front → Arduino
   Envía GET y mide el tiempo hasta recibir la línea C,... de respuesta.
   ===================================================================== */
let _ct = null;   // { t0, timer }

function ctSet(k, state, text) {
  const li = document.querySelector(`#ctest li[data-k="${k}"]`);
  li.dataset.s = state; li.querySelector('b').textContent = text;
}

let _ctHide = null;

function connTestRx(line) {
  if (!line.startsWith('C,') || !S.conn) return;
  if (_ct) {
    clearTimeout(_ct.timer);
    ctSet('get', 'ok', Math.round(performance.now() - _ct.t0) + ' ms');
    _ct = null; $('#btnTest').disabled = false;
  } else ctSet('get', 'ok', 'ok');
  if (S.conn.kind === 'serial') {                    // conexión verificada: ocultar la prueba
    ctSet('port', 'ok', `abierto · ${S.conn.baud}`);
    ctSet('tele', 'ok', 'recibiendo');
    clearTimeout(_ctHide);
    _ctHide = setTimeout(() => { $('#testGrp').hidden = true; }, 2500);
  }
}

// llamado desde setConnUI: la prueba solo se muestra mientras no hay conexión serie verificada
function ctOnConn() {
  clearTimeout(_ctHide);
  const c = S.conn;
  $('#testGrp').hidden = !!c && c.kind === 'demo';
  if (c && c.kind === 'serial') { ctSet('port', 'ok', `abierto · ${c.baud}`); ctSet('tele', 'wait', 'esperando…'); ctSet('get', 'wait', 'esperando…'); }
  else if (!c) ['port', 'tele', 'get'].forEach(k => ctSet(k, '', '--'));
}

function runConnTest() {
  const c = S.conn;
  if (!c) { ctSet('port', 'bad', 'cerrado'); ctSet('tele', 'bad', '--'); ctSet('get', 'bad', '--'); toast('Sin conexión.'); return; }
  ctSet('port', 'ok', c.kind === 'demo' ? 'demo' : `abierto · ${c.baud}`);

  const age = S.lastRx ? (Date.now() - S.lastRx) / 1000 : null;
  if (age === null) ctSet('tele', 'bad', 'sin datos');
  else if (age > 5) ctSet('tele', 'bad', `hace ${age.toFixed(1)} s`);
  else ctSet('tele', 'ok', `hace ${age.toFixed(1)} s`);

  if (_ct) clearTimeout(_ct.timer);
  ctSet('get', 'wait', 'esperando…');
  $('#btnTest').disabled = true;
  _ct = { t0: performance.now(), timer: setTimeout(() => {
    ctSet('get', 'bad', 'sin respuesta');
    _ct = null; $('#btnTest').disabled = false;
  }, 3000) };
  send('GET');
}

$('#btnTest').addEventListener('click', runConnTest);
