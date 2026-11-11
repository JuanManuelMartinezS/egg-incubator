/* =====================================================================
   Estado
   ===================================================================== */
const MODES = ['Manual', 'Histéresis', 'PWM'];
const DEFAULT_CFG = { MODE:1, MODESRC:0, SPSRC:0, SP:37.5, MARGIN:2, PERIOD:10000, SPAN:37, ADCFS:50, TMAX:40, INTERVAL:1000, RELAY:0 };
const FIELDS = {            // factor: del valor del equipo al valor mostrado
  SP:       { f:1,      dec:2, min:0,   max:60  },
  MARGIN:   { f:1,      dec:1, min:0,   max:50  },
  PERIOD:   { f:0.001,  dec:1, min:0.5, max:600 },
  SPAN:     { f:1,      dec:1, min:0.5, max:100 },
  TMAX:     { f:1,      dec:1, min:20,  max:60  },
  ADCFS:    { f:1,      dec:1, min:5,   max:200 },
  INTERVAL: { f:0.001,  dec:1, min:0.1, max:60  },
};
const MAX_SAMPLES = 60000;

const S = {
  cfg: { ...DEFAULT_CFG }, cfgKnown: false,
  data: [], seg: 0, offset: 0, msBase: null, lastMs: null, lastT: 0,
  conn: null, last: null, lastRx: 0,
  paused: false, pausedEnd: 0, win: 300, ideal: true, tol: 0.5,
  hoverT: null, geo: {}, logT: false,
};
