/*
  Control de incubadora de codorniz - firmware con interfaz serial
  ----------------------------------------------------------------
  Mantiene los 3 modos del circuito original (Manual, Histéresis, PWM) y los
  mismos pines, pero ahora:
    - No hay delay(): el lazo corre libre y responde a la interfaz en todo momento.
    - Todos los parámetros se cambian por serial (115200 baudios) y se pueden
      guardar en EEPROM para que sobrevivan a un reinicio.
    - Los interruptores DIP siguen funcionando. Desde la interfaz se elige quién
      manda: "HW" (DIP / potenciómetro) o "SW" (la interfaz).
    - Límite de seguridad por sobretemperatura (TMAX): corta el relé en cualquier modo.

  Protocolo (una línea por mensaje, terminada en \n)
    Arduino -> PC
      T,<ms>,<sp>,<pv>,<err%>,<salida>,<modo>,<duty%>,<alarma>,<estop>   telemetría
      C,CLAVE=valor,CLAVE=valor,...                               configuración actual
      OK <CLAVE>   |   ERR <motivo>   |   INFO <texto>
    PC -> Arduino
      GET                  responde con la línea C,...
      SET <CLAVE> <valor>  cambia un parámetro (ver lista abajo)
      SAVE                 guarda la configuración en EEPROM
      DEFAULTS             restaura valores de fábrica (no los guarda)
      RELAY <0|1>          relé manual por software (solo modo MANUAL con MODESRC=SW)
      ESTOP <0|1>          1 = paro de emergencia: apaga la salida en cualquier modo hasta ESTOP 0

  Claves
    MODE      0 manual, 1 histéresis, 2 PWM          (solo si MODESRC=1)
    MODESRC   0 interruptores DIP, 1 interfaz
    SPSRC     0 potenciómetro A0, 1 valor de la interfaz
    SP        setpoint en °C cuando SPSRC=1
    MARGIN    margen de histéresis, % del setpoint
    PERIOD    periodo del PWM en ms
    SPAN      rango proporcional en °C: error de SPAN grados = 100 % de salida
    ADCFS     °C que representa el fondo de escala (1023) de los sensores
    TMAX      temperatura de corte de seguridad en °C
    INTERVAL  cada cuántos ms se envía telemetría
*/

#include <EEPROM.h>

// ---------- Pines (idénticos al circuito original) ----------
const int redLED           = 7;
const int pinPV            = A1;
const int pinSP            = A0;
const int pinBoton         = 2;
const int pinRele          = 5;
const int pinVentilador    = 6;  // se enciende junto con el relé
const int pinDipAutoManual = 3;  // DIP SW 1  (LOW = automático)
const int pinDipHystPWM    = 4;  // DIP SW 2  (HIGH = histéresis, LOW = PWM)

// ---------- Configuración persistente ----------
struct Config {
  uint16_t magic;
  uint8_t  mode;      // 0 manual, 1 histéresis, 2 PWM
  uint8_t  modeSrc;   // 0 DIP, 1 interfaz
  uint8_t  spSrc;     // 0 potenciómetro, 1 interfaz
  float    sp;
  float    margin;    // % del setpoint
  float    span;      // °C = 100 % de salida en PWM
  float    adcfs;     // °C a fondo de escala
  float    tmax;      // °C corte de seguridad
  uint32_t period;    // ms
  uint32_t interval;  // ms
};

const uint16_t CFG_MAGIC = 0xE601;
Config cfg;

void setDefaults() {
  cfg.magic    = CFG_MAGIC;
  cfg.mode     = 1;
  cfg.modeSrc  = 0;      // por defecto mandan los DIP, como en el circuito original
  cfg.spSrc    = 0;      // por defecto manda el potenciómetro
  cfg.sp       = 37.5;
  cfg.margin   = 2.0;
  cfg.span     = 37.0;
  cfg.adcfs    = 50.0;
  cfg.tmax     = 40.0;
  cfg.period   = 10000;
  cfg.interval = 1000;
}

// ---------- Estado ----------
float valuePV = 0, valueSP = 0, valueError = 0, errorPercent = 0;
float dutyPercent = 0;
bool  relayOn = false;
bool  alarm = false;
bool  softRelay = false;     // relé manual pedido por la interfaz
bool  estop = false;         // paro de emergencia pedido por la interfaz (se queda activo hasta ESTOP 0)
bool  hystOn = false;        // estado de la histéresis
uint8_t lastMode = 255;
unsigned long windowStart = 0;
unsigned long timeOnMs = 0;
unsigned long lastPrint = 0;
unsigned long lastRead = 0;

String rxLine;

// ---------- Utilidades ----------
float readAnalogC(int pin) {
  long acc = 0;
  for (int i = 0; i < 8; i++) acc += analogRead(pin);   // promedio para reducir ruido
  return (acc / 8.0) * cfg.adcfs / 1023.0;
}

void applyOutput(bool on) {
  relayOn = on;
  digitalWrite(pinRele, on ? HIGH : LOW);
  digitalWrite(pinVentilador, on ? HIGH : LOW);
  digitalWrite(redLED, on ? HIGH : LOW);
}

uint8_t effectiveMode() {
  if (cfg.modeSrc == 1) return cfg.mode;
  bool autoMode = (digitalRead(pinDipAutoManual) == LOW);
  bool hyst     = (digitalRead(pinDipHystPWM) == HIGH);
  if (!autoMode) return 0;
  return hyst ? 1 : 2;
}

void printConfig() {
  Serial.print(F("C,MODE="));     Serial.print(cfg.mode);
  Serial.print(F(",MODESRC="));   Serial.print(cfg.modeSrc);
  Serial.print(F(",SPSRC="));     Serial.print(cfg.spSrc);
  Serial.print(F(",SP="));        Serial.print(cfg.sp, 2);
  Serial.print(F(",MARGIN="));    Serial.print(cfg.margin, 2);
  Serial.print(F(",PERIOD="));    Serial.print(cfg.period);
  Serial.print(F(",SPAN="));      Serial.print(cfg.span, 2);
  Serial.print(F(",ADCFS="));     Serial.print(cfg.adcfs, 2);
  Serial.print(F(",TMAX="));      Serial.print(cfg.tmax, 2);
  Serial.print(F(",INTERVAL="));  Serial.print(cfg.interval);
  Serial.print(F(",RELAY="));     Serial.println(softRelay ? 1 : 0);
}

void printTelemetry(uint8_t mode) {
  Serial.print(F("T,"));
  Serial.print(millis());              Serial.print(',');
  Serial.print(valueSP, 2);            Serial.print(',');
  Serial.print(valuePV, 2);            Serial.print(',');
  Serial.print(errorPercent, 1);       Serial.print(',');
  Serial.print(relayOn ? 1 : 0);       Serial.print(',');
  Serial.print(mode);                  Serial.print(',');
  Serial.print(dutyPercent, 1);        Serial.print(',');
  Serial.print(alarm ? 1 : 0);         Serial.print(',');
  Serial.println(estop ? 1 : 0);
}

// ---------- Comandos ----------
bool setParam(const String &key, float v) {
  if      (key == "MODE")     { if (v < 0 || v > 2) return false; cfg.mode = (uint8_t)v; }
  else if (key == "MODESRC")  { cfg.modeSrc = v > 0 ? 1 : 0; }
  else if (key == "SPSRC")    { cfg.spSrc   = v > 0 ? 1 : 0; }
  else if (key == "SP")       { if (v < 0 || v > 60) return false; cfg.sp = v; }
  else if (key == "MARGIN")   { if (v < 0 || v > 50) return false; cfg.margin = v; }
  else if (key == "PERIOD")   { if (v < 500 || v > 600000) return false; cfg.period = (uint32_t)v; windowStart = 0; }
  else if (key == "SPAN")     { if (v < 0.5 || v > 100) return false; cfg.span = v; }
  else if (key == "ADCFS")    { if (v < 5 || v > 200) return false; cfg.adcfs = v; }
  else if (key == "TMAX")     { if (v < 20 || v > 60) return false; cfg.tmax = v; }
  else if (key == "INTERVAL") { if (v < 100 || v > 60000) return false; cfg.interval = (uint32_t)v; }
  else return false;
  return true;
}

void handleLine(String line) {
  line.trim();
  if (line.length() == 0) return;

  if (line == "GET") {
    printConfig();
  } else if (line == "SAVE") {
    EEPROM.put(0, cfg);
    Serial.println(F("OK SAVE"));
  } else if (line == "DEFAULTS") {
    setDefaults();
    Serial.println(F("OK DEFAULTS"));
    printConfig();
  } else if (line.startsWith("ESTOP ")) {
    estop = line.substring(6).toInt() != 0;
    if (estop) { softRelay = false; hystOn = false; applyOutput(false); }   // corta ya, sin esperar al lazo
    windowStart = 0;
    Serial.println(estop ? F("INFO PARO DE EMERGENCIA ACTIVO") : F("INFO PARO REARMADO"));
  } else if (line.startsWith("RELAY ")) {
    softRelay = line.substring(6).toInt() != 0;
    Serial.println(F("OK RELAY"));
  } else if (line.startsWith("SET ")) {
    int sp = line.indexOf(' ', 4);
    if (sp < 0) { Serial.println(F("ERR formato: SET CLAVE valor")); return; }
    String key = line.substring(4, sp);
    key.toUpperCase();
    float v = line.substring(sp + 1).toFloat();
    if (setParam(key, v)) { Serial.print(F("OK ")); Serial.println(key); }
    else                  { Serial.print(F("ERR valor o clave invalida: ")); Serial.println(key); }
  } else {
    Serial.println(F("ERR comando desconocido"));
  }
}

void pollSerial() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n') { handleLine(rxLine); rxLine = ""; }
    else if (c != '\r' && rxLine.length() < 64) rxLine += c;
  }
}

// ---------- Lecturas ----------
void readTemp() {
  valuePV = readAnalogC(pinPV);
  valueSP = (cfg.spSrc == 1) ? cfg.sp : readAnalogC(pinSP);

  valueError = valueSP - valuePV;
  errorPercent = (valueError * 100.0) / cfg.span;
  if (errorPercent < 0.0)   errorPercent = 0.0;
  if (errorPercent > 100.0) errorPercent = 100.0;
}

// ---------- Estrategias de control ----------
bool controlHyst() {
  float band = (cfg.margin / 100.0) * valueSP;
  if (valuePV < valueSP - band)      hystOn = true;
  else if (valuePV > valueSP + band) hystOn = false;
  dutyPercent = hystOn ? 100.0 : 0.0;
  return hystOn;
}

bool controlPWM() {
  unsigned long now = millis();
  if (windowStart == 0 || now - windowStart >= cfg.period) {
    windowStart = now;                                     // nueva ventana: recalcula el tiempo en ON
    timeOnMs = (unsigned long)(cfg.period * (errorPercent / 100.0));
  }
  dutyPercent = errorPercent;
  return (now - windowStart) < timeOnMs;
}

bool controlManual() {
  if (cfg.modeSrc == 1) return softRelay;
  return digitalRead(pinBoton) == LOW;                     // botón con INPUT_PULLUP: LOW = presionado
}

// ---------- Arduino ----------
void setup() {
  Serial.begin(115200);
  pinMode(redLED, OUTPUT);
  pinMode(pinRele, OUTPUT);
  pinMode(pinVentilador, OUTPUT);
  pinMode(pinDipAutoManual, INPUT_PULLUP);
  pinMode(pinDipHystPWM, INPUT_PULLUP);
  pinMode(pinBoton, INPUT_PULLUP);
  applyOutput(false);

  EEPROM.get(0, cfg);
  if (cfg.magic != CFG_MAGIC) setDefaults();

  Serial.println(F("INFO INCUBADORA v2"));
  printConfig();
}

void loop() {
  pollSerial();

  unsigned long now = millis();
  if (now - lastRead >= 50) {           // lectura y control ~20 veces por segundo
    lastRead = now;
    readTemp();

    uint8_t mode = effectiveMode();
    if (mode != lastMode) {             // al cambiar de técnica se parte desde apagado
      hystOn = false;
      windowStart = 0;
      lastMode = mode;
    }

    bool out = false;
    switch (mode) {
      case 1:  out = controlHyst();   break;
      case 2:  out = controlPWM();    break;
      default: out = controlManual(); dutyPercent = out ? 100.0 : 0.0; break;
    }

    alarm = (valuePV >= cfg.tmax);
    if (alarm || estop) { out = false; hystOn = false; }
    if (estop) softRelay = false;
    applyOutput(out);

    if (now - lastPrint >= cfg.interval) {
      lastPrint = now;
      printTelemetry(mode);
    }
  }
}
