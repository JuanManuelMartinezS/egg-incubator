// Prueba de pines: enciende y apaga los pines 5 y 6 a la vez cada 2 s
#include <Arduino.h>

const int PIN_1 = 5;
const int PIN_2 = 6;

void setup() {
  pinMode(PIN_1, OUTPUT);
  pinMode(PIN_2, OUTPUT);
}

void loop() {
  // Enciende ambos pines al mismo tiempo
  digitalWrite(PIN_1, HIGH);
  digitalWrite(PIN_2, HIGH);

  // Mantiene el estado por 2 segundos (2000 ms)
  delay(2000);

  // Apaga ambos pines
  digitalWrite(PIN_1, LOW);
  digitalWrite(PIN_2, LOW);

  // Espera 2 segundos antes de repetir el ciclo
  delay(2000);
}
