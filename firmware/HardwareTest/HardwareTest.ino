/*
 * ============================================================
 *  SugarDry IoT — Hardware Test Sketch (No Library Required)
 *  Test SSR1 (GPIO32), SSR2 (GPIO33), Alarm Relay (GPIO25)
 * ============================================================
 *  Ketik perintah di Serial Monitor (baud 115200) lalu Enter:
 *    1 → SSR1 ON      2 → SSR1 OFF
 *    3 → SSR2 ON      4 → SSR2 OFF
 *    5 → Alarm ON     6 → Alarm OFF
 *    7 → Semua ON     8 → Semua OFF
 *    9 → Auto Test    ? → Menu
 * ============================================================
 */

#define SSR1_PIN    32
#define SSR2_PIN    33
#define ALARM_PIN   25    // Active LOW!
#define LED_PIN     2

bool ssr1 = false, ssr2 = false, alarmOn = false;

void setup() {
  // ALARM: matikan dulu sebelum pinMode (cegah relay nyala saat boot)
  digitalWrite(ALARM_PIN, HIGH);
  pinMode(ALARM_PIN, OUTPUT);
  digitalWrite(ALARM_PIN, HIGH);   // HIGH = relay OFF (active LOW)

  pinMode(SSR1_PIN, OUTPUT);  digitalWrite(SSR1_PIN, LOW);
  pinMode(SSR2_PIN, OUTPUT);  digitalWrite(SSR2_PIN, LOW);
  pinMode(LED_PIN,  OUTPUT);  digitalWrite(LED_PIN, LOW);

  Serial.begin(115200);
  delay(300);
  printMenu();
}

void loop() {
  // LED heartbeat
  static unsigned long t = 0;
  if (millis() - t > 500) { t = millis(); digitalWrite(LED_PIN, !digitalRead(LED_PIN)); }

  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    Serial.println(">> " + cmd);

    if      (cmd == "1") { ssr1 = true;    digitalWrite(SSR1_PIN, HIGH); printStatus(); }
    else if (cmd == "2") { ssr1 = false;   digitalWrite(SSR1_PIN, LOW);  printStatus(); }
    else if (cmd == "3") { ssr2 = true;    digitalWrite(SSR2_PIN, HIGH); printStatus(); }
    else if (cmd == "4") { ssr2 = false;   digitalWrite(SSR2_PIN, LOW);  printStatus(); }
    else if (cmd == "5") { alarmOn = true; digitalWrite(ALARM_PIN, LOW); printStatus(); }  // LOW = ON
    else if (cmd == "6") { alarmOn = false;digitalWrite(ALARM_PIN, HIGH);printStatus(); }  // HIGH = OFF
    else if (cmd == "7") {
      ssr1 = ssr2 = alarmOn = true;
      digitalWrite(SSR1_PIN, HIGH); digitalWrite(SSR2_PIN, HIGH); digitalWrite(ALARM_PIN, LOW);
      printStatus();
    }
    else if (cmd == "8") {
      ssr1 = ssr2 = alarmOn = false;
      digitalWrite(SSR1_PIN, LOW); digitalWrite(SSR2_PIN, LOW); digitalWrite(ALARM_PIN, HIGH);
      printStatus();
    }
    else if (cmd == "9") autoTest();
    else if (cmd == "?") printMenu();
    else Serial.println("Perintah tidak dikenal. Ketik ? untuk menu.");
  }
}

void autoTest() {
  Serial.println("\n=== AUTO TEST DIMULAI ===");
  Serial.println("[1/6] SSR1 ON...");    digitalWrite(SSR1_PIN, HIGH);  delay(2000);
  Serial.println("[2/6] SSR1 OFF...");   digitalWrite(SSR1_PIN, LOW);   delay(1000);
  Serial.println("[3/6] SSR2 ON...");    digitalWrite(SSR2_PIN, HIGH);  delay(2000);
  Serial.println("[4/6] SSR2 OFF...");   digitalWrite(SSR2_PIN, LOW);   delay(1000);
  Serial.println("[5/6] ALARM ON (sirine bunyi 2 detik)...");
  digitalWrite(ALARM_PIN, LOW);   delay(2000);
  Serial.println("[6/6] ALARM OFF...");  digitalWrite(ALARM_PIN, HIGH); delay(500);
  ssr1 = ssr2 = alarmOn = false;
  Serial.println("=== AUTO TEST SELESAI ===\n");
  printStatus();
}

void printStatus() {
  Serial.println("--- STATUS SAAT INI ---");
  Serial.println("SSR1  (GPIO32) : " + String(ssr1    ? "ON  [3.3V]" : "OFF [0V]"));
  Serial.println("SSR2  (GPIO33) : " + String(ssr2    ? "ON  [3.3V]" : "OFF [0V]"));
  Serial.println("ALARM (GPIO25) : " + String(alarmOn ? "ON  [0V-ActiveLow]" : "OFF [3.3V-ActiveLow]"));
  Serial.println("-----------------------\n");
}

void printMenu() {
  Serial.println("\n=== SugarDry Hardware Test ===");
  Serial.println("1/2 → SSR1 ON/OFF  (GPIO32)");
  Serial.println("3/4 → SSR2 ON/OFF  (GPIO33)");
  Serial.println("5/6 → Alarm ON/OFF (GPIO25, Active LOW)");
  Serial.println("7   → Semua ON");
  Serial.println("8   → Semua OFF");
  Serial.println("9   → Auto Test");
  Serial.println("?   → Menu ini");
  Serial.println("==============================\n");
}
