// Prueba mínima: parpadeo del LED integrado (pin 13 en Uno/Nano/Mega)
// También manda un mensaje por serie cada vez que parpadea.
#include <Arduino.h>

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println(F("LED on"));
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println(F("LED off"));
  delay(500);
}
