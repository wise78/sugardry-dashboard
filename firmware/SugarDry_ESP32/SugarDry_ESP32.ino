/*
 * ============================================================
 *  SugarDry IoT — ESP32 Firmware v1.0
 *  Sistem Monitoring & Kontrol Pengering Gula Semut Kelapa
 *  UNSOED × Central Agro Lestari
 * ============================================================
 *
 *  Hardware:
 *    - ESP32 DevKit V1 (WROOM-32, 38 pin)
 *    - 3× MAX31855 + TC Type K (Software SPI)
 *    - 2× SSR Fotek 25DA → NXC-09 → TAKAFAN DE160 250W
 *    - 1× Relay 5V → Sirine 12V (Active LOW)
 *
 *  Libraries (install via Library Manager):
 *    - PubSubClient        by Nick O'Leary    (MQTT)
 *    - Adafruit MAX31855   by Adafruit        (Thermocouple)
 *    - ArduinoJson         by Benoit Blanchon (JSON parsing)
 *
 *  Dibuat: Mei 2026
 *  Author: Muhammad Nur Bijak Bestari
 *
 * ============================================================
 */

// config.h HARUS di-include pertama (berisi MQTT_MAX_PACKET_SIZE)
#include "config.h"

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <Adafruit_MAX31855.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// =============================================================
//  MQTT TOPICS
// =============================================================

// --- Publish: ESP32 → Dashboard ---
const char* T_SUHU_KIRI     = "oven/suhu/produk_kiri";
const char* T_SUHU_KANAN    = "oven/suhu/produk_kanan";
const char* T_SUHU_BAKAR    = "oven/suhu/pembakaran";
const char* T_BLOWER_STATUS = "oven/blower/status";
const char* T_BLOWER_MODE_PUB = "oven/blower/mode_status"; // ← topic READ-ONLY (beda dari subscribe!)
const char* T_BLOWER_DUTY   = "oven/blower/duty_cycle";
const char* T_ALARM_STATUS  = "oven/alarm/status";
const char* T_BATCH_RESULT  = "oven/batch/result";

// --- Subscribe: Dashboard → ESP32 ---
const char* T_BLOWER_MODE   = "oven/blower/mode";  // dashboard → ESP32 perintah ganti mode
const char* T_BATCH_INPUT   = "oven/batch/input";
const char* T_BATCH_STOP    = "oven/batch/stop";

// --- Troubleshoot ---
const char* T_TS_SSR1       = "oven/troubleshoot/ssr1";
const char* T_TS_SSR2       = "oven/troubleshoot/ssr2";
const char* T_TS_ALARM      = "oven/troubleshoot/alarm";
const char* T_TS_COMMAND    = "oven/troubleshoot/command";
const char* T_TS_RESPONSE   = "oven/troubleshoot/response";

// =============================================================
//  GLOBAL OBJECTS
// =============================================================

WiFiClientSecure wifiSecure;
PubSubClient mqtt(wifiSecure);

// Software SPI — lebih reliable untuk multiple MAX31855
Adafruit_MAX31855 tc1(TC_SCK_PIN, TC_CS1_PIN, TC_MISO_PIN);
Adafruit_MAX31855 tc2(TC_SCK_PIN, TC_CS2_PIN, TC_MISO_PIN);
Adafruit_MAX31855 tc3(TC_SCK_PIN, TC_CS3_PIN, TC_MISO_PIN);

// =============================================================
//  STATE VARIABLES
// =============================================================

// --- Temperature ---
float tempLeft   = 0.0;
float tempRight  = 0.0;
float tempBurner = 0.0;
bool  tempLeftOK   = false;
bool  tempRightOK  = false;
bool  tempBurnerOK = false;

// History untuk deteksi drop suhu (15 readings × 2s = 30s window)
#define TEMP_HISTORY_SIZE 15
float burnerHistory[TEMP_HISTORY_SIZE];
int   historyIndex = 0;
bool  historyFull  = false;

// --- Blower ---
enum BlowerMode { MODE_EFISIEN, MODE_TURBO, MODE_CUSTOM };
BlowerMode blowerMode       = MODE_EFISIEN;
bool       blower1On        = false;
bool       blower2On        = false;
bool       blowerPhaseIsOn  = true;     // true = fase ON, false = fase OFF
unsigned long blowerPhaseStart = 0;
unsigned long blowerOnDurMs  = 20UL * 60UL * 1000UL;  // Default 20 min
unsigned long blowerOffDurMs = 10UL * 60UL * 1000UL;  // Default 10 min
// Simpan custom durasi agar tidak hilang saat handleBlowerModeChange dipanggil ulang
unsigned long customOnDurMs  = (unsigned long)CUSTOM_ON_DEFAULT  * 60UL * 1000UL;
unsigned long customOffDurMs = (unsigned long)CUSTOM_OFF_DEFAULT * 60UL * 1000UL;
int        blowerCycleCount = 0;
unsigned long blowerTotalOnMs = 0;
unsigned long blowerLastOnStart = 0;

// --- Batch ---
bool   batchActive    = false;
String batchId        = "";
float  batchMcAwal    = 0.0;
float  batchBeratAwal = 0.0;
String batchOperator  = "";
unsigned long batchStartTime = 0;

// --- Alarm ---
enum AlarmType { ALARM_NORMAL, ALARM_KOMPOR_MATI, ALARM_SUHU_TINGGI, ALARM_SELESAI };
AlarmType currentAlarm = ALARM_NORMAL;
bool sirenActive       = false;

// --- Troubleshoot ---
bool troubleshootActive       = false;
unsigned long troubleshootStart = 0;

// --- Timing ---
unsigned long lastTempRead    = 0;
unsigned long lastMqttPub     = 0;
unsigned long lastWifiCheck   = 0;
unsigned long lastMqttReconn  = 0;
unsigned long lastBlowerCheck = 0;
unsigned long lastAlarmCheck  = 0;
unsigned long lastSerialPrint = 0;

// --- Stats ---
unsigned long bootTime = 0;
int mqttReconnectCount = 0;

// =============================================================
//                         SETUP
// =============================================================

void setup() {
  // ALARM: Active HIGH — LOW = OFF (aman saat boot), HIGH = ON
  // Matikan dulu sebelum pinMode untuk cegah glitch
  pinMode(ALARM_PIN, OUTPUT);
  digitalWrite(ALARM_PIN, LOW);   // LOW = relay OFF (Active HIGH)

  // Inisialisasi output pins
  pinMode(SSR1_PIN, OUTPUT);
  pinMode(SSR2_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  digitalWrite(SSR1_PIN, LOW);   // SSR OFF
  digitalWrite(SSR2_PIN, LOW);   // SSR OFF
  digitalWrite(LED_PIN, LOW);

  // Serial
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println(F("================================================"));
  Serial.println(F("  SugarDry IoT - ESP32 Firmware v1.0"));
  Serial.println(F("  Pengering Gula Semut Kelapa"));
  Serial.println(F("  UNSOED x Central Agro Lestari"));
  Serial.println(F("================================================"));
  Serial.println();

  bootTime = millis();

  // Inisialisasi temperature history
  for (int i = 0; i < TEMP_HISTORY_SIZE; i++) {
    burnerHistory[i] = 0;
  }

  // Inisialisasi MAX31855 sensors
  Serial.print(F("[SENSOR] Initializing MAX31855... "));
  delay(500);  // MAX31855 perlu waktu stabilisasi

  bool tc1ok = tc1.begin();
  bool tc2ok = tc2.begin();
  bool tc3ok = tc3.begin();

  if (tc1ok) Serial.print(F("TC1:OK "));
  else       Serial.print(F("TC1:FAIL "));
  if (tc2ok) Serial.print(F("TC2:OK "));
  else       Serial.print(F("TC2:FAIL "));
  if (tc3ok) Serial.print(F("TC3:OK "));
  else       Serial.print(F("TC3:FAIL "));
  Serial.println();

  if (!tc1ok || !tc2ok || !tc3ok) {
    Serial.println(F("[SENSOR] ⚠️ Beberapa sensor gagal! Cek wiring CS/SCK/MISO."));
  }

  // WiFi
  Serial.println();
  connectWiFi();

  // MQTT Setup
  wifiSecure.setInsecure();  // Skip TLS certificate verification (OK untuk prototype)
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setKeepAlive(60);

  if (WiFi.status() == WL_CONNECTED) {
    connectMQTT();
  }

  Serial.println();
  Serial.println(F("[SYSTEM] ✅ Setup selesai. Masuk main loop..."));
  Serial.println(F("================================================"));
  Serial.println();
}

// =============================================================
//                        MAIN LOOP
// =============================================================

void loop() {
  unsigned long now = millis();

  // --- 1. WiFi Reconnect ---
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiCheck >= WIFI_RECONNECT_INTERVAL) {
      lastWifiCheck = now;
      Serial.println(F("[WIFI] Disconnected! Mencoba reconnect..."));
      connectWiFi();
    }
  }

  // --- 2. MQTT Loop + Reconnect ---
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) {
      if (now - lastMqttReconn >= MQTT_RECONNECT_INTERVAL) {
        lastMqttReconn = now;
        connectMQTT();
      }
    }
    mqtt.loop();
  }

  // --- 3. Baca Temperature ---
  if (now - lastTempRead >= TEMP_READ_INTERVAL) {
    lastTempRead = now;
    readTemperatures();
  }

  // --- 4. Blower Scheduling ---
  // Skip jika troubleshoot mode aktif (kontrol manual)
  if (!troubleshootActive && batchActive) {
    if (now - lastBlowerCheck >= BLOWER_CHECK_INTERVAL) {
      lastBlowerCheck = now;
      updateBlowerCycle(now);
    }
  }

  // --- 5. Alarm Check ---
  if (batchActive && now - lastAlarmCheck >= ALARM_CHECK_INTERVAL) {
    lastAlarmCheck = now;
    checkAlarms();
  }

  // --- 6. Troubleshoot Timeout Safety ---
  // Gunakan millis() langsung, BUKAN 'now' (cegah unsigned underflow)
  if (troubleshootActive && millis() - troubleshootStart >= TS_TIMEOUT) {
    Serial.println(F("[TS] ⚠️ Timeout! Auto-OFF semua output."));
    exitTroubleshoot();
  }

  // --- 7. MQTT Publish Telemetry ---
  if (mqtt.connected() && now - lastMqttPub >= MQTT_PUBLISH_INTERVAL) {
    lastMqttPub = now;
    publishTelemetry();
  }

  // --- 8. Serial Debug Print ---
  if (now - lastSerialPrint >= SERIAL_PRINT_INTERVAL) {
    lastSerialPrint = now;
    printStatus();
  }

  // --- 9. LED Heartbeat ---
  // Blink pattern: fast = no WiFi, slow = connected, solid = batch active
  if (batchActive) {
    digitalWrite(LED_PIN, HIGH);
  } else if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_PIN, (now / 200) % 2 == 0);  // Fast blink
  } else {
    digitalWrite(LED_PIN, (now / 1000) % 2 == 0);  // Slow blink
  }
}

// =============================================================
//  WiFi FUNCTIONS
// =============================================================

void connectWiFi() {
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Tunggu max 15 detik (non-blocking setelah setup)
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F(" ✅ Connected!"));
    Serial.printf("[WIFI] IP: %s | RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(),
                  WiFi.RSSI());
  } else {
    Serial.println(F(" ❌ Gagal! Akan retry di background."));
  }
}

// =============================================================
//  MQTT FUNCTIONS
// =============================================================

void connectMQTT() {
  if (mqtt.connected()) return;

  Serial.print(F("[MQTT] Connecting to HiveMQ Cloud... "));

  // Client ID unik per session
  String clientId = String(MQTT_CLIENT_ID) + "-" + String(random(0xFFFF), HEX);

  // Last Will & Testament: broker akan otomatis publish "OFFLINE"
  // ke oven/esp32/status jika ESP32 disconnect mendadak (tanpa clean disconnect)
  const char* willTopic   = "oven/esp32/status";
  const char* willPayload = "OFFLINE";
  uint8_t     willQos     = 1;
  bool        willRetain  = true;

  if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS,
                   willTopic, willQos, willRetain, willPayload)) {
    Serial.println(F("✅ Connected!"));
    mqttReconnectCount++;

    // Subscribe HANYA ke topic yang dikirim Dashboard → ESP32
    // (bukan oven/# agar ESP32 tidak terima pesannya sendiri)
    mqtt.subscribe("oven/blower/mode");
    mqtt.subscribe("oven/batch/input");
    mqtt.subscribe("oven/batch/stop");
    mqtt.subscribe("oven/troubleshoot/ssr1");
    mqtt.subscribe("oven/troubleshoot/ssr2");
    mqtt.subscribe("oven/troubleshoot/alarm");
    mqtt.subscribe("oven/troubleshoot/command");
    Serial.println(F("[MQTT] Subscribed to 7 control topics"));

    // Publish status ONLINE (retained) — akan override LWT saat konek berhasil
    mqtt.publish("oven/esp32/status", "ONLINE", true);

  } else {
    Serial.printf("\u274C Gagal! rc=%d\n", mqtt.state());
    printMQTTError(mqtt.state());
  }
}

void printMQTTError(int state) {
  switch (state) {
    case -4: Serial.println(F("  → MQTT_CONNECTION_TIMEOUT")); break;
    case -3: Serial.println(F("  → MQTT_CONNECTION_LOST")); break;
    case -2: Serial.println(F("  → MQTT_CONNECT_FAILED")); break;
    case -1: Serial.println(F("  → MQTT_DISCONNECTED")); break;
    case  1: Serial.println(F("  → MQTT_CONNECT_BAD_PROTOCOL")); break;
    case  2: Serial.println(F("  → MQTT_CONNECT_BAD_CLIENT_ID")); break;
    case  3: Serial.println(F("  → MQTT_CONNECT_UNAVAILABLE")); break;
    case  4: Serial.println(F("  → MQTT_CONNECT_BAD_CREDENTIALS (cek username/password!)")); break;
    case  5: Serial.println(F("  → MQTT_CONNECT_UNAUTHORIZED")); break;
    default: Serial.println(F("  → Unknown error")); break;
  }
}

// =============================================================
//  MQTT CALLBACK (pesan masuk dari Dashboard)
// =============================================================

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Convert payload ke String
  String msg = "";
  for (unsigned int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }

  Serial.printf("[MQTT] ← %s: %s\n", topic, msg.c_str());

  String t = String(topic);

  // --- Blower Mode ---
  if (t == T_BLOWER_MODE) {
    handleBlowerModeChange(msg);
  }
  // --- Batch Start ---
  else if (t == T_BATCH_INPUT) {
    handleBatchStart(msg);
  }
  // --- Batch Stop ---
  else if (t == T_BATCH_STOP) {
    handleBatchStop(msg);
  }
  // --- Troubleshoot: SSR1 ---
  else if (t == T_TS_SSR1) {
    handleTroubleshoot("ssr1", msg);
  }
  // --- Troubleshoot: SSR2 ---
  else if (t == T_TS_SSR2) {
    handleTroubleshoot("ssr2", msg);
  }
  // --- Troubleshoot: Alarm ---
  else if (t == T_TS_ALARM) {
    handleTroubleshoot("alarm", msg);
  }
  // --- Troubleshoot: Command ---
  else if (t == T_TS_COMMAND) {
    handleTroubleshootCommand(msg);
  }
}

// =============================================================
//  TEMPERATURE READING
// =============================================================

void readTemperatures() {
  // Baca MAX31855 #1 — R. Produk Kiri
  double t1 = tc1.readCelsius();
  if (isnan(t1)) {
    tempLeftOK = false;
    // Serial.println(F("[SENSOR] TC1 error!"));
  } else {
    tempLeft = (float)t1;
    tempLeftOK = true;
  }

  delay(10);  // Delay kecil antar pembacaan SPI

  // Baca MAX31855 #2 — R. Produk Kanan
  double t2 = tc2.readCelsius();
  if (isnan(t2)) {
    tempRightOK = false;
  } else {
    tempRight = (float)t2;
    tempRightOK = true;
  }

  delay(10);

  // Baca MAX31855 #3 — R. Pembakaran
  double t3 = tc3.readCelsius();
  if (isnan(t3)) {
    tempBurnerOK = false;
  } else {
    tempBurner = (float)t3;
    tempBurnerOK = true;

    // Simpan history untuk deteksi drop
    burnerHistory[historyIndex] = tempBurner;
    historyIndex = (historyIndex + 1) % TEMP_HISTORY_SIZE;
    if (historyIndex == 0) historyFull = true;
  }
}

// =============================================================
//  BLOWER CONTROL
// =============================================================

void handleBlowerModeChange(String mode) {
  mode.trim();

  if (mode == "Efisien") {
    blowerMode = MODE_EFISIEN;
    // Set duty cycle berdasarkan MC awal batch
    setEfisienDutyCycle(batchMcAwal);
    Serial.println(F("[BLOWER] Mode → Efisien"));
  }
  else if (mode == "Turbo") {
    blowerMode = MODE_TURBO;
    Serial.println(F("[BLOWER] Mode → Turbo (100% ON)"));
  }
  else if (mode == "Custom") {
    blowerMode = MODE_CUSTOM;
    // Pakai customOnDurMs/customOffDurMs yang tersimpan — JANGAN reset ke default!
    // Nilai ini di-set saat handleBatchStart menerima payload dari dashboard.
    blowerOnDurMs  = customOnDurMs;
    blowerOffDurMs = customOffDurMs;
    Serial.printf("[BLOWER] Mode → Custom (pakai durasi tersimpan: ON=%lu ms, OFF=%lu ms)\n",
                  customOnDurMs, customOffDurMs);
  }

  // Reset cycle timer
  blowerPhaseIsOn  = true;
  blowerPhaseStart = millis();
}

void setEfisienDutyCycle(float mc) {
  if (mc < 2.0) {
    blowerOnDurMs  = (unsigned long)BLOWER_ON_MC_LOW  * 60UL * 1000UL;
    blowerOffDurMs = (unsigned long)BLOWER_OFF_DEFAULT * 60UL * 1000UL;
  } else if (mc <= 3.0) {
    blowerOnDurMs  = (unsigned long)BLOWER_ON_MC_MED  * 60UL * 1000UL;
    blowerOffDurMs = (unsigned long)BLOWER_OFF_DEFAULT * 60UL * 1000UL;
  } else {
    blowerOnDurMs  = (unsigned long)BLOWER_ON_MC_HIGH * 60UL * 1000UL;
    blowerOffDurMs = (unsigned long)BLOWER_OFF_DEFAULT * 60UL * 1000UL;
  }
}

void updateBlowerCycle(unsigned long now) {
  if (blowerMode == MODE_TURBO) {
    // Turbo: kedua blower ON terus
    setBlowers(true, true);
    return;
  }

  if (blowerMode == MODE_EFISIEN || blowerMode == MODE_CUSTOM) {
    unsigned long elapsed = now - blowerPhaseStart;

    if (blowerPhaseIsOn) {
      // Fase ON
      setBlowers(true, true);
      if (elapsed >= blowerOnDurMs) {
        // Pindah ke fase OFF
        blowerPhaseIsOn = false;
        blowerPhaseStart = now;
        blowerTotalOnMs += blowerOnDurMs;
        blowerCycleCount++;
        setBlowers(false, false);
        Serial.printf("[BLOWER] Fase OFF — siklus #%d, total ON: %lu menit\n",
                      blowerCycleCount, blowerTotalOnMs / 60000);

        // Publish status
        if (mqtt.connected()) {
          mqtt.publish(T_BLOWER_STATUS, "OFF");
          publishDutyCycle();
        }
      }
    } else {
      // Fase OFF
      setBlowers(false, false);
      if (elapsed >= blowerOffDurMs) {
        // Pindah ke fase ON
        blowerPhaseIsOn = true;
        blowerPhaseStart = now;
        blowerLastOnStart = now;
        setBlowers(true, true);
        Serial.println(F("[BLOWER] Fase ON — pengeringan aktif"));

        if (mqtt.connected()) {
          mqtt.publish(T_BLOWER_STATUS, "ON");
        }
      }
    }
  }
}

void setBlowers(bool b1, bool b2) {
  blower1On = b1;
  blower2On = b2;
  digitalWrite(SSR1_PIN, b1 ? HIGH : LOW);
  digitalWrite(SSR2_PIN, b2 ? HIGH : LOW);
}

void publishDutyCycle() {
  String duty = "";
  if (blowerMode == MODE_TURBO) {
    duty = "ON 100%";
  } else {
    int onMin  = (int)(blowerOnDurMs / 60000);
    int offMin = (int)(blowerOffDurMs / 60000);
    duty = "ON_" + String(onMin) + "_OFF_" + String(offMin);
  }
  mqtt.publish(T_BLOWER_DUTY, duty.c_str());
}

// =============================================================
//  BATCH MANAGEMENT
// =============================================================

void handleBatchStart(String jsonPayload) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, jsonPayload);
  if (err) {
    Serial.printf("[BATCH] JSON parse error: %s\n", err.c_str());
    return;
  }

  // === DEBUG: Print raw payload dan semua field ===
  Serial.println(F("[BATCH] Raw payload diterima:"));
  Serial.println(jsonPayload);
  Serial.printf("[BATCH] Fields: batchId=%s, mode=%s, mc_awal=%.1f, custom_on=%d, custom_off=%d\n",
                doc["batchId"].as<String>().c_str(),
                doc["mode"].as<String>().c_str(),
                doc["mc_awal"] | -1.0f,
                doc["custom_on"] | -1,
                doc["custom_off"] | -1);
  // ===

  batchId        = doc["batchId"].as<String>();
  batchMcAwal    = doc["mc_awal"]   | 3.0f;
  batchBeratAwal = doc["berat_awal"] | 400.0f;
  String mode    = doc["mode"].as<String>();

  batchActive    = true;
  batchStartTime = millis();

  // Reset counters DULU sebelum set mode
  blowerCycleCount = 0;
  blowerTotalOnMs  = 0;
  currentAlarm     = ALARM_NORMAL;
  historyIndex     = 0;
  historyFull      = false;

  // Set blower mode + durasi ON/OFF
  // Catatan: handleBlowerModeChange() set default sementara untuk Custom.
  // Nilai nyata dari payload di-apply DULU, baru publishDutyCycle() dipanggil.
  handleBlowerModeChange(mode);
  if (blowerMode == MODE_EFISIEN) {
    setEfisienDutyCycle(batchMcAwal);
    // Reset phase timer setelah durasi di-set
    blowerPhaseIsOn  = true;
    blowerPhaseStart = millis();
  }
  else if (blowerMode == MODE_CUSTOM) {
    // Baca custom ON/OFF dari payload dashboard (override default dari handleBlowerModeChange)
    // Gunakan isNull() check agar lebih eksplisit — null vs field tidak ada
    int customOnMnt  = (!doc["custom_on"].isNull())  ? (int)doc["custom_on"]  : CUSTOM_ON_DEFAULT;
    int customOffMnt = (!doc["custom_off"].isNull()) ? (int)doc["custom_off"] : CUSTOM_OFF_DEFAULT;
    // Clamp ke range wajar (1-120 menit)
    customOnMnt  = constrain(customOnMnt,  1, 120);
    customOffMnt = constrain(customOffMnt, 1, 120);
    // Simpan ke variabel persisten — ini yang dipakai handleBlowerModeChange selanjutnya
    customOnDurMs  = (unsigned long)customOnMnt  * 60UL * 1000UL;
    customOffDurMs = (unsigned long)customOffMnt * 60UL * 1000UL;
    blowerOnDurMs  = customOnDurMs;
    blowerOffDurMs = customOffDurMs;
    Serial.printf("[BLOWER] Custom → ON: %d mnt (%lu ms), OFF: %d mnt (%lu ms) [dari payload: on=%s, off=%s]\n",
                  customOnMnt, blowerOnDurMs, customOffMnt, blowerOffDurMs,
                  doc["custom_on"].isNull() ? "NULL(default)" : doc["custom_on"].as<String>().c_str(),
                  doc["custom_off"].isNull() ? "NULL(default)" : doc["custom_off"].as<String>().c_str());
    // Reset phase timer SETELAH durasi di-set
    blowerPhaseIsOn  = true;
    blowerPhaseStart = millis();
  }
  // Turbo: handleBlowerModeChange sudah handle (tidak perlu phase timer)

  // Start blowers
  setBlowers(true, true);

  Serial.printf("[BATCH] ✅ Batch #%s dimulai! MC:%.1f%%, Berat:%.0fkg, Mode:%s\n",
                batchId.c_str(), batchMcAwal, batchBeratAwal, mode.c_str());

  // Publish initial status — publishDutyCycle() dipanggil SETELAH semua durasi final di-set
  if (mqtt.connected()) {
    mqtt.publish(T_BLOWER_STATUS, "ON");
    publishDutyCycle();  // ✅ Sekarang blowerOnDurMs/blowerOffDurMs sudah berisi nilai custom yang benar
    mqtt.publish(T_ALARM_STATUS, "NORMAL");
  }

  // Telegram notification
  sendTelegram("🔥 Batch #" + batchId + " dimulai!\nMC Awal: " +
               String(batchMcAwal, 1) + "%\nBerat: " +
               String(batchBeratAwal, 0) + " kg\nMode: " + mode);
}

void handleBatchStop(String jsonPayload) {
  if (!batchActive) return;

  Serial.printf("[BATCH] ✅ Batch #%s dihentikan.\n", batchId.c_str());

  // Hitung durasi
  unsigned long durasiMs = millis() - batchStartTime;
  int durasiMenit = (int)(durasiMs / 60000);

  // Matikan semua output
  setBlowers(false, false);
  setSiren(false);
  currentAlarm = ALARM_NORMAL;

  // Publish batch result
  if (mqtt.connected()) {
    JsonDocument doc;
    doc["batchId"]          = batchId;
    doc["durasi_aktual"]    = durasiMenit;
    doc["blower_on_total"]  = (int)(blowerTotalOnMs / 60000);
    doc["blower_siklus"]    = blowerCycleCount;
    // Duty cycle aktual yang dipakai selama batch — kunci untuk ML training
    doc["duty_on_mnt"]      = (int)(blowerOnDurMs  / 60000);
    doc["duty_off_mnt"]     = (int)(blowerOffDurMs / 60000);
    doc["mode"]             = (blowerMode == MODE_TURBO)  ? "Turbo"  :
                              (blowerMode == MODE_CUSTOM) ? "Custom" : "Efisien";

    char buf[300];
    serializeJson(doc, buf, sizeof(buf));
    mqtt.publish(T_BATCH_RESULT, buf);
    mqtt.publish(T_BLOWER_STATUS, "OFF");
    mqtt.publish(T_ALARM_STATUS, "NORMAL");
  }

  // Telegram notification
  sendTelegram("✅ Batch #" + batchId + " selesai!\nDurasi: " +
               String(durasiMenit) + " menit\nTotal blower ON: " +
               String((int)(blowerTotalOnMs / 60000)) + " menit");

  batchActive = false;
  batchId = "";
}

// =============================================================
//  ALARM LOGIC
// =============================================================

void checkAlarms() {
  if (!batchActive) return;

  // --- 1. Suhu pembakaran terlalu tinggi ---
  if (tempBurnerOK && tempBurner > BURNER_MAX_TEMP) {
    if (currentAlarm != ALARM_SUHU_TINGGI) {
      currentAlarm = ALARM_SUHU_TINGGI;
      triggerAlarm("SUHU_TINGGI",
                   "⚠️ Suhu pembakaran tinggi: " + String(tempBurner, 1) + "°C (max " + String(BURNER_MAX_TEMP, 0) + "°C)");
    }
    return;
  }

  // --- 2. Suhu produk terlalu tinggi ---
  float avgProduct = 0;
  int productCount = 0;
  if (tempLeftOK)  { avgProduct += tempLeft;  productCount++; }
  if (tempRightOK) { avgProduct += tempRight; productCount++; }
  if (productCount > 0) avgProduct /= productCount;

  if (productCount > 0 && avgProduct > PRODUCT_MAX_TEMP) {
    if (currentAlarm != ALARM_SUHU_TINGGI) {
      currentAlarm = ALARM_SUHU_TINGGI;
      triggerAlarm("SUHU_TINGGI",
                   "⚠️ Suhu produk tinggi: " + String(avgProduct, 1) + "°C");
    }
    return;
  }

  // --- 3. Deteksi kompor mati (drop suhu pembakaran drastis) ---
  if (historyFull && tempBurnerOK) {
    // Cari suhu tertua dalam history
    int oldestIdx = historyIndex;  // Index tertua (akan di-overwrite berikutnya)
    float oldestTemp = burnerHistory[oldestIdx];
    float currentTemp = tempBurner;

    // Jika suhu turun lebih dari threshold dalam window
    if (oldestTemp - currentTemp > BURNER_DROP_THRESHOLD && oldestTemp > 50.0) {
      if (currentAlarm != ALARM_KOMPOR_MATI) {
        currentAlarm = ALARM_KOMPOR_MATI;
        triggerAlarm("KOMPOR_MATI",
                     "🔴 Kompor mati terdeteksi! Suhu turun " +
                     String(oldestTemp - currentTemp, 1) + "°C dalam 30 detik");
      }
      return;
    }
  }

  // --- 4. Normal ---
  if (currentAlarm != ALARM_NORMAL) {
    currentAlarm = ALARM_NORMAL;
    setSiren(false);
    if (mqtt.connected()) {
      mqtt.publish(T_ALARM_STATUS, "NORMAL");
    }
    Serial.println(F("[ALARM] Status kembali NORMAL"));
  }
}

void triggerAlarm(const char* alarmCode, String message) {
  Serial.printf("[ALARM] 🚨 %s: %s\n", alarmCode, message.c_str());

  // Nyalakan sirine
  setSiren(true);

  // Publish ke MQTT
  if (mqtt.connected()) {
    mqtt.publish(T_ALARM_STATUS, alarmCode);
  }

  // Telegram
  sendTelegram("🚨 ALARM: " + message);
}

void setSiren(bool on) {
  sirenActive = on;
  // Active HIGH: HIGH (3.3V) = sirine ON, LOW (0V) = sirine OFF
  // Konsisten dengan SSR: ON → tegangan naik, OFF → tegangan turun
  digitalWrite(ALARM_PIN, on ? HIGH : LOW);
}

// =============================================================
//  TROUBLESHOOT MODE
// =============================================================

void handleTroubleshoot(String device, String command) {
  command.trim();
  command.toUpperCase();

  // Masuk troubleshoot mode
  if (!troubleshootActive) {
    troubleshootActive = true;
    troubleshootStart = millis();
    Serial.println(F("[TS] ⚙️ Troubleshoot mode AKTIF (timeout 5 menit)"));
  }

  // Reset timeout timer
  troubleshootStart = millis();

  bool turnOn = (command == "ON");

  if (device == "ssr1") {
    blower1On = turnOn;
    digitalWrite(SSR1_PIN, turnOn ? HIGH : LOW);
    Serial.printf("[TS] SSR1 (Blower 1) → %s\n", turnOn ? "ON" : "OFF");
  }
  else if (device == "ssr2") {
    blower2On = turnOn;
    digitalWrite(SSR2_PIN, turnOn ? HIGH : LOW);
    Serial.printf("[TS] SSR2 (Blower 2) → %s\n", turnOn ? "ON" : "OFF");
  }
  else if (device == "alarm") {
    setSiren(turnOn);
    // Debug: baca balik nilai pin untuk konfirmasi
    int pinState = digitalRead(ALARM_PIN);
    float pinVolt = pinState ? 3.3f : 0.0f;
    Serial.printf("[TS] Alarm Sirine → %s | GPIO25 actual: %s (%.1fV)\n",
                  turnOn ? "ON" : "OFF",
                  pinState ? "HIGH" : "LOW",
                  pinVolt);
    if (turnOn && pinState == LOW) {
      Serial.println(F("[TS] ⚠️  WARNING: GPIO25 masih LOW padahal seharusnya HIGH!"));
      Serial.println(F("[TS]    Kemungkinan: relay modul menarik pin ke GND (hardware issue)"));
    }
  }
}

void handleTroubleshootCommand(String command) {
  command.trim();
  command.toUpperCase();
  Serial.printf("[TS] Command: %s\n", command.c_str());

  if (command == "PING") {
    // Respond dengan PONG
    if (mqtt.connected()) {
      String pong = "{\"response\":\"PONG\",\"uptime_ms\":" + String(millis() - bootTime) + "}";
      mqtt.publish(T_TS_RESPONSE, pong.c_str());
    }
    Serial.println(F("[TS] → PONG"));
  }
  else if (command == "RESTART") {
    Serial.println(F("[TS] ⚠️ Restart ESP32..."));
    // Safety: matikan semua output dulu
    setBlowers(false, false);
    setSiren(false);
    delay(500);
    ESP.restart();
  }
  else if (command == "READ_SENSORS") {
    // Force read + respond
    readTemperatures();
    JsonDocument doc;
    doc["tc1"] = tempLeftOK ? tempLeft : -999;
    doc["tc2"] = tempRightOK ? tempRight : -999;
    doc["tc3"] = tempBurnerOK ? tempBurner : -999;
    doc["tc1_ok"] = tempLeftOK;
    doc["tc2_ok"] = tempRightOK;
    doc["tc3_ok"] = tempBurnerOK;

    char buf[256];
    serializeJson(doc, buf, sizeof(buf));
    if (mqtt.connected()) mqtt.publish(T_TS_RESPONSE, buf);
  }
  else if (command == "STATUS") {
    sendStatusResponse();
  }
}

void sendStatusResponse() {
  JsonDocument doc;

  // WiFi info
  doc["rssi"]   = WiFi.RSSI();
  doc["ssid"]   = WiFi.SSID();
  doc["ip"]     = WiFi.localIP().toString();
  doc["mqtt"]   = mqtt.connected() ? "Connected" : "Disconnected";

  // Uptime
  unsigned long uptimeMs = millis() - bootTime;
  int uptH = uptimeMs / 3600000;
  int uptM = (uptimeMs % 3600000) / 60000;
  doc["uptime"] = String(uptH) + "h " + String(uptM) + "m";

  // Memory
  doc["heap"]   = String(ESP.getFreeHeap() / 1024) + " KB";

  // Temperatures
  doc["temp_left"]   = tempLeft;
  doc["temp_right"]  = tempRight;
  doc["temp_burner"] = tempBurner;

  // Blower
  doc["blower1"]     = blower1On;
  doc["blower2"]     = blower2On;
  doc["batch"]       = batchActive;
  doc["alarm"]       = sirenActive;
  doc["troubleshoot"] = troubleshootActive;

  char buf[512];
  serializeJson(doc, buf, sizeof(buf));
  if (mqtt.connected()) mqtt.publish(T_TS_RESPONSE, buf);

  Serial.println(F("[TS] Status response sent"));
}

void exitTroubleshoot() {
  troubleshootActive = false;

  // Safety: matikan semua output
  setBlowers(false, false);
  setSiren(false);

  Serial.println(F("[TS] ⚙️ Troubleshoot mode NONAKTIF. Semua output OFF."));

  if (mqtt.connected()) {
    mqtt.publish(T_TS_RESPONSE, "{\"response\":\"TS_EXIT\",\"reason\":\"timeout\"}");
  }
}

// =============================================================
//  MQTT PUBLISH TELEMETRY
// =============================================================

void publishTelemetry() {
  if (!mqtt.connected()) return;

  // Publish suhu sebagai string (seperti di config dashboard)
  char buf[16];

  dtostrf(tempLeft, 4, 1, buf);
  mqtt.publish(T_SUHU_KIRI, buf);

  dtostrf(tempRight, 4, 1, buf);
  mqtt.publish(T_SUHU_KANAN, buf);

  dtostrf(tempBurner, 4, 1, buf);
  mqtt.publish(T_SUHU_BAKAR, buf);

  // Blower status
  mqtt.publish(T_BLOWER_STATUS, (blower1On || blower2On) ? "ON" : "OFF");

  // Blower mode
  const char* modeStr = "Efisien";
  if (blowerMode == MODE_TURBO) modeStr = "Turbo";
  else if (blowerMode == MODE_CUSTOM) modeStr = "Custom";
  mqtt.publish(T_BLOWER_MODE_PUB, modeStr);

  // Duty cycle
  publishDutyCycle();
}

// =============================================================
//  TELEGRAM NOTIFICATION
// =============================================================

void sendTelegram(String message) {
  if (!TELEGRAM_ENABLED) return;
  if (WiFi.status() != WL_CONNECTED) return;

  String url = "https://api.telegram.org/bot" + String(TELEGRAM_BOT_TOKEN) +
               "/sendMessage";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["chat_id"] = TELEGRAM_CHAT_ID;
  doc["text"]    = "🥥 SugarDry IoT\n\n" + message;
  doc["parse_mode"] = "HTML";

  char body[512];
  serializeJson(doc, body, sizeof(body));

  int httpCode = http.POST(body);
  if (httpCode > 0) {
    Serial.printf("[TELEGRAM] Sent! HTTP %d\n", httpCode);
  } else {
    Serial.printf("[TELEGRAM] Error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// =============================================================
//  SERIAL DEBUG
// =============================================================

void printStatus() {
  Serial.println(F("--- STATUS ---"));
  Serial.printf("  WiFi: %s | RSSI: %d dBm\n",
                WiFi.status() == WL_CONNECTED ? "OK" : "DISCONNECTED",
                WiFi.RSSI());
  Serial.printf("  MQTT: %s\n", mqtt.connected() ? "OK" : "DISCONNECTED");
  Serial.printf("  Suhu: Kiri=%.1f°C  Kanan=%.1f°C  Bakar=%.1f°C\n",
                tempLeft, tempRight, tempBurner);
  Serial.printf("  Sensor: TC1=%s  TC2=%s  TC3=%s\n",
                tempLeftOK ? "OK" : "ERR",
                tempRightOK ? "OK" : "ERR",
                tempBurnerOK ? "OK" : "ERR");
  Serial.printf("  Blower: B1=%s  B2=%s  Mode=%s\n",
                blower1On ? "ON" : "OFF",
                blower2On ? "ON" : "OFF",
                blowerMode == MODE_TURBO ? "Turbo" :
                blowerMode == MODE_CUSTOM ? "Custom" : "Efisien");
  Serial.printf("  Batch: %s  Alarm: %s  Troubleshoot: %s\n",
                batchActive ? batchId.c_str() : "IDLE",
                currentAlarm == ALARM_NORMAL ? "NORMAL" :
                currentAlarm == ALARM_KOMPOR_MATI ? "KOMPOR_MATI" :
                currentAlarm == ALARM_SUHU_TINGGI ? "SUHU_TINGGI" : "SELESAI",
                troubleshootActive ? "ACTIVE" : "OFF");

  // Uptime
  unsigned long uptimeMs = millis() - bootTime;
  int h = uptimeMs / 3600000;
  int m = (uptimeMs % 3600000) / 60000;
  int s = (uptimeMs % 60000) / 1000;
  Serial.printf("  Uptime: %02d:%02d:%02d | Free heap: %d bytes\n", h, m, s, ESP.getFreeHeap());
  Serial.println(F("--------------"));
}
