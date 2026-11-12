/* =====================================================================
   Simulador de la incubadora (modo demo)
   ===================================================================== */
class Sim {
  constructor(emit) {
    this.emit = emit; this.speed = 10;
    this.cfg = { ...DEFAULT_CFG, MODESRC: 1, SPSRC: 1, MODE: 1 };
    this.T = 24; this.h = 0; this.ms = 0; this.out = false; this.hystOn = false;
    this.winStart = -1; this.timeOn = 0; this.soft = false; this.lastPrint = -1e9;
    this.pot = 37.5; this.errPct = 0; this.duty = 0; this.alarm = false; this.pv = 24; this.sp = 37.5;
    this.timer = setInterval(() => { for (let i = 0; i < this.speed; i++) this.step(50); }, 50);
    setTimeout(() => { this.emit('INFO INCUBADORA v2 (demo)'); this.printCfg(); }, 80);
  }
  stop() { clearInterval(this.timer); }
  gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.08; }
  printCfg() {
    const c = this.cfg;
    this.emit(`C,MODE=${c.MODE},MODESRC=${c.MODESRC},SPSRC=${c.SPSRC},SP=${c.SP.toFixed(2)},MARGIN=${c.MARGIN.toFixed(2)},PERIOD=${c.PERIOD},SPAN=${c.SPAN.toFixed(2)},ADCFS=${c.ADCFS.toFixed(2)},TMAX=${c.TMAX.toFixed(2)},INTERVAL=${c.INTERVAL},RELAY=${this.soft ? 1 : 0}`);
  }
  write(line) {
    const l = line.trim(), c = this.cfg;
    setTimeout(() => {
      if (l === 'GET') this.printCfg();
      else if (l === 'SAVE') this.emit('OK SAVE');
      else if (l === 'DEFAULTS') { this.cfg = { ...DEFAULT_CFG, MODESRC: 1, SPSRC: 1 }; this.emit('OK DEFAULTS'); this.printCfg(); }
      else if (l.startsWith('ESTOP ')) { this.estop = +l.slice(6) !== 0; if (this.estop) { this.soft = false; this.hystOn = false; this.out = false; } this.winStart = -1; this.emit(this.estop ? 'INFO PARO DE EMERGENCIA ACTIVO' : 'INFO PARO REARMADO'); }
      else if (l.startsWith('RELAY ')) { this.soft = +l.slice(6) !== 0; this.emit('OK RELAY'); }
      else if (l.startsWith('SET ')) {
        const [, key, val] = l.split(/\s+/); const v = parseFloat(val); const K = (key || '').toUpperCase();
        const R = { MODE:[0,2], SP:[0,60], MARGIN:[0,50], PERIOD:[500,600000], SPAN:[0.5,100], ADCFS:[5,200], TMAX:[20,60], INTERVAL:[100,60000], MODESRC:[0,1e9], SPSRC:[0,1e9] };
        if (!(K in R) || !isFinite(v) || v < R[K][0] || v > R[K][1]) this.emit('ERR valor o clave invalida: ' + K);
        else { c[K] = (K === 'MODESRC' || K === 'SPSRC') ? (v > 0 ? 1 : 0) : v; if (K === 'PERIOD') this.winStart = -1; this.emit('OK ' + K); }
      } else this.emit('ERR comando desconocido');
    }, 10);
  }
  step(dt) {
    const c = this.cfg; this.ms += dt;
    // planta: resistencia con inercia + aire con constante de tiempo de 5 min
    this.h += ((this.out ? 1 : 0) - this.h) * dt / 10000;
    this.T += ((22 + 40 * this.h) - this.T) * dt / 300000;
    this.pv = this.T + this.gauss();
    this.sp = c.SPSRC === 1 ? c.SP : this.pot;
    const e = this.sp - this.pv;
    this.errPct = Math.min(100, Math.max(0, e * 100 / c.SPAN));
    const mode = c.MODESRC === 1 ? c.MODE : 1;
    if (mode !== this.lastMode) { this.hystOn = false; this.winStart = -1; this.lastMode = mode; }
    let out = false;
    if (mode === 1) {
      const band = c.MARGIN / 100 * this.sp;
      if (this.pv < this.sp - band) this.hystOn = true; else if (this.pv > this.sp + band) this.hystOn = false;
      out = this.hystOn; this.duty = out ? 100 : 0;
    } else if (mode === 2) {
      if (this.winStart < 0 || this.ms - this.winStart >= c.PERIOD) { this.winStart = this.ms; this.timeOn = c.PERIOD * this.errPct / 100; }
      out = (this.ms - this.winStart) < this.timeOn; this.duty = this.errPct;
    } else { out = this.soft; this.duty = out ? 100 : 0; }
    this.alarm = this.pv >= c.TMAX; if (this.alarm || this.estop) { out = false; this.hystOn = false; }
    this.out = out;
    if (this.ms - this.lastPrint >= c.INTERVAL) {
      this.lastPrint = this.ms;
      this.emit(`T,${Math.round(this.ms)},${this.sp.toFixed(2)},${this.pv.toFixed(2)},${this.errPct.toFixed(1)},${out ? 1 : 0},${mode},${this.duty.toFixed(1)},${this.alarm ? 1 : 0},${this.estop ? 1 : 0}`);
    }
  }
}
