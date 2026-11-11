/* =====================================================================
   Conexión
   ===================================================================== */
function send(line) {
  if (!S.conn) return;
  log('tx', line);
  S.conn.write(line).catch(e => log('err', 'No se pudo enviar: ' + e.message));
}
function setConnUI() {
  const c = S.conn, pill = $('#connPill');
  document.body.dataset.conn = c ? c.kind : 'off';
  pill.dataset.state = c ? (c.kind === 'demo' ? 'demo' : 'on') : 'off';
  $('#connText').textContent = c ? (c.kind === 'demo' ? 'Demo' : 'Conectado') : 'Sin conexión';
  $('#btnConnect').textContent = c && c.kind === 'serial' ? 'Desconectar' : 'Conectar';
  $('#btnConnect').classList.toggle('primary', !(c && c.kind === 'serial'));
  $('#btnDemo').style.display = c ? 'none' : '';
  $('#baud').disabled = !!c;
  $('#btnConnect').disabled = !!c && c.kind === 'demo';
  updateControls();
  if (typeof ctOnConn === 'function') ctOnConn();
}

async function connectSerial() {
  if (!('serial' in navigator)) {
    toast('Usa Chrome o Edge de escritorio.', 7000); return;
  }
  try {
    const port = await navigator.serial.requestPort();
    const baud = +$('#baud').value;
    await port.open({ baudRate: baud });
    const writer = port.writable.getWriter(), enc = new TextEncoder();
    S.conn = { kind: 'serial', port, writer, baud, write: l => writer.write(enc.encode(l + '\n')) };
    S.lastMs = null; S.cfgKnown = false; setConnUI();
    log('info', `Puerto abierto (${baud})`);
    readLoop(port);
    setTimeout(() => send('GET'), 1800);                // el Arduino se reinicia al abrir el puerto
    setTimeout(() => { if (S.conn && !S.cfgKnown) send('GET'); }, 3500);
  } catch (e) {
    if (e.name === 'NotFoundError') return;             // el usuario cerró el selector
    log('err', 'No se pudo abrir el puerto: ' + e.message);
    toast('No se pudo abrir el puerto. Cierra el Monitor Serie.', 7000);
  }
}
async function readLoop(port) {
  const dec = new TextDecoder(); let buf = '';
  while (port.readable && S.conn && S.conn.port === port) {
    const reader = port.readable.getReader(); S.conn.reader = reader;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
      }
    } catch (e) { log('err', 'Lectura interrumpida: ' + e.message); }
    finally { reader.releaseLock(); }
    if (!S.conn || S.conn.port !== port) break;
  }
  if (S.conn && S.conn.port === port) { toast('Conexión perdida.'); await disconnect(); }
}
async function disconnect() {
  const c = S.conn; if (!c) return; S.conn = null;
  if (c.kind === 'serial') {
    try { await c.reader?.cancel(); } catch {}
    await new Promise(r => setTimeout(r, 60));
    try { c.writer.releaseLock(); } catch {}
    try { await c.port.close(); } catch {}
  } else c.sim.stop();
  setConnUI();
}
function startDemo() {
  const sim = new Sim(l => onLine(l));
  sim.speed = +$('#demoSpeed').value;
  S.conn = { kind: 'demo', sim, baud: 0, write: async l => sim.write(l) };
  S.lastMs = null; S.cfgKnown = false; setConnUI();
  Object.keys(FIELDS).forEach(k => inputOf(k).value = '');
  setTimeout(() => send('GET'), 250);
}
$('#btnConnect').addEventListener('click', () => (S.conn && S.conn.kind === 'serial') ? disconnect() : (S.conn ? null : connectSerial()));
$('#btnDemo').addEventListener('click', startDemo);
$('#btnDemoOff').addEventListener('click', disconnect);
$('#demoSpeed').addEventListener('change', e => { if (S.conn?.kind === 'demo') S.conn.sim.speed = +e.target.value; });
$('#btnDoor').addEventListener('click', () => { if (S.conn?.kind === 'demo') { S.conn.sim.T -= 3; log('info', 'Demo: puerta abierta'); } });
if ('serial' in navigator) navigator.serial.addEventListener('disconnect', () => { if (S.conn?.kind === 'serial') { toast('Cable desconectado.'); disconnect(); } });
else { const b = $('#banner'); b.textContent = 'Sin Web Serial: usa Chrome o Edge. La demo funciona en cualquier navegador.'; b.classList.add('show'); }

setInterval(() => {                                           // aviso si dejan de llegar datos
  if (!S.conn) return;
  const stale = Date.now() - S.lastRx > (S.cfg.INTERVAL / (S.conn.kind === 'demo' ? S.conn.sim.speed : 1)) * 3 + 2500;
  const pill = $('#connPill');
  if (S.conn.kind === 'serial') { pill.dataset.state = stale ? 'warn' : 'on'; $('#connText').textContent = stale ? 'Sin datos' : 'Conectado'; }
}, 1000);
