/* =====================================================================
   Entrada de datos (protocolo del Arduino)
   ===================================================================== */
function onLine(raw) {
  const line = raw.trim();
  if (!line) return;
  S.lastRx = Date.now();
  if (typeof connTestRx === 'function') connTestRx(line);
  if (line.startsWith('T,')) { if (S.logT) log('rx', line); onTelemetry(line); return; }
  if (line.startsWith('C,')) { log('rx', line); onConfig(line); return; }
  log(line.startsWith('ERR') ? 'err' : line.startsWith('INFO') ? 'info' : 'rx', line);
  if (line.startsWith('ERR')) toast(line.slice(4));
}

function onConfig(line) {
  const upd = {};
  line.split(',').slice(1).forEach(kv => {
    const [k, v] = kv.split('='); const n = parseFloat(v);
    if (k in DEFAULT_CFG && isFinite(n)) upd[k] = n;
  });
  applyCfg(upd);
  S.cfgKnown = true;
}

function onTelemetry(line) {
  const p = line.split(',');
  if (p.length < 9) return;
  const [ms, sp, pv, err, out, mode, duty, alarm] = p.slice(1).map(Number);
  if (![ms, sp, pv].every(isFinite)) return;

  if (S.lastMs === null || ms < S.lastMs) {          // sesión nueva o reinicio del Arduino
    S.offset = S.data.length ? S.lastT + 1000 : 0;
    S.msBase = ms; S.seg++;
  }
  S.lastMs = ms;
  const t = S.offset + (ms - S.msBase);
  S.lastT = t;

  const lo = (mode === 1) ? sp * (1 - S.cfg.MARGIN / 100) : null;
  const hi = (mode === 1) ? sp * (1 + S.cfg.MARGIN / 100) : null;
  if (p.length > 9 && Date.now() - (S.estopAt || 0) > 2000) S.estop = Number(p[9]) === 1;   // el Arduino confirma el estado
  const s = { t, w: Date.now(), sp, pv, err, out: out ? 1 : 0, mode, duty, alarm: alarm ? 1 : 0, lo, hi, seg: S.seg };
  S.data.push(s);
  if (S.data.length > MAX_SAMPLES) S.data.splice(0, 5000);
  S.last = s;
  updateReadouts();
  requestDraw();
}
