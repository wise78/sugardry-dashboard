/*
 * ============================================================
 *  SugarDry IoT — Konfigurasi ESP32
 *  UNSOED × Central Agro Lestari
 * ============================================================
 *
 *  ⚠️  ISI SEMUA VALUE BERTANDA "YOUR_..." DENGAN DATA ASLI!
 *  ⚠️  JANGAN share file ini ke GitHub dengan credential asli.
 *
 * ============================================================
 */

#ifndef CONFIG_H
#define CONFIG_H

// =============================================================
//  PIN DEFINITIONS (sesuai wiring diagram Capstone)
// =============================================================

// --- MAX31855 Thermocouple (Software SPI - shared bus) ---
#define TC_SCK_PIN    18    // Shared SPI Clock
#define TC_MISO_PIN   19    // Shared SPI MISO (SO/DO)
#define TC_CS1_PIN    5     // CS - R. Produk Kiri
#define TC_CS2_PIN    17    // CS - R. Produk Kanan
#define TC_CS3_PIN    16    // CS - R. Pembakaran

// --- SSR Blower Output ---
// ESP32 GPIO → 330Ω → SSR Fotek pin 3+ → NXC-09 coil → Motor
#define SSR1_PIN      32    // SSR #1 → Blower 1
#define SSR2_PIN      33    // SSR #2 → Blower 2

// --- Alarm Relay (Active HIGH setelah pindah ke GPIO27) ---
// ESP32 GPIO27 → Relay IN → COM: 12V+ → NO: Sirine+
// GPIO25 TIDAK DIPAKAI: DAC1 pin, konflik saat WiFi aktif!
#define ALARM_PIN     27    // ⚠️ Dipindah dari GPIO25 ke GPIO27 (bukan DAC pin)

// --- Built-in LED ---
#define LED_PIN       2     // Onboard LED for heartbeat

// =============================================================
//  WiFi CREDENTIALS
// =============================================================
#define WIFI_SSID       "Xiaomi 14T"
#define WIFI_PASSWORD   "31787831"

// =============================================================
//  MQTT — HiveMQ Cloud
// =============================================================
// Dapatkan dari: https://console.hivemq.cloud/
// Port 8883 = MQTT over TLS (untuk ESP32)
// Port 8884 = WebSocket Secure (untuk Dashboard browser)
#define MQTT_HOST       "7993d8054ea947be928cddd219b714b8.s1.eu.hivemq.cloud"
#define MQTT_PORT       8883
#define MQTT_USER       "sugardry-user"
#define MQTT_PASS       "Password123!"
#define MQTT_CLIENT_ID  "sugardry-esp32"

// =============================================================
//  Telegram Bot (opsional)
// =============================================================
// Cara membuat:
//   1. Chat @BotFather di Telegram → /newbot
//   2. Simpan token yang diberikan
//   3. Chat @userinfobot → dapat chat_id
#define TELEGRAM_BOT_TOKEN  "YOUR_BOT_TOKEN"
#define TELEGRAM_CHAT_ID    "YOUR_CHAT_ID"
#define TELEGRAM_ENABLED    false   // Set true setelah isi token

// =============================================================
//  TIMING INTERVALS (milliseconds)
// =============================================================
#define TEMP_READ_INTERVAL      2000     // Baca sensor setiap 2 detik
#define MQTT_PUBLISH_INTERVAL   2000     // Publish telemetry setiap 2 detik
#define WIFI_RECONNECT_INTERVAL 10000    // Coba reconnect WiFi setiap 10 detik
#define MQTT_RECONNECT_INTERVAL 5000     // Coba reconnect MQTT setiap 5 detik
#define BLOWER_CHECK_INTERVAL   1000     // Cek siklus blower setiap 1 detik
#define ALARM_CHECK_INTERVAL    2000     // Cek kondisi alarm setiap 2 detik
#define SERIAL_PRINT_INTERVAL   5000     // Print debug ke Serial setiap 5 detik

// =============================================================
//  ALARM THRESHOLDS
// =============================================================
#define BURNER_MAX_TEMP         200.0    // °C — suhu pembakaran max (warning)
#define BURNER_DROP_THRESHOLD   15.0     // °C — drop suhu = kompor mati
#define BURNER_DROP_WINDOW      30000    // ms — window deteksi drop (30 detik)
#define PRODUCT_MAX_TEMP        100.0    // °C — suhu produk max (warning)

// =============================================================
//  BLOWER DUTY CYCLE (menit)
// =============================================================
// Mode Efisien — berdasarkan MC awal
#define BLOWER_ON_MC_LOW        20       // MC < 2%: ON 20 menit
#define BLOWER_ON_MC_MED        25       // MC 2-3%: ON 25 menit
#define BLOWER_ON_MC_HIGH       30       // MC 3-5%: ON 30 menit
#define BLOWER_OFF_DEFAULT      10       // OFF 10 menit (semua level MC)

// Mode Custom — default values (bisa diubah via MQTT)
#define CUSTOM_ON_DEFAULT       15       // Custom default ON 15 menit
#define CUSTOM_OFF_DEFAULT      10       // Custom default OFF 10 menit

// =============================================================
//  TROUBLESHOOT SAFETY
// =============================================================
#define TS_TIMEOUT              300000   // 5 menit auto-off (safety)

// =============================================================
//  MQTT MAX PACKET SIZE
// =============================================================
// Harus di-define SEBELUM #include <PubSubClient.h>
// Default PubSubClient hanya 256 bytes — tidak cukup untuk JSON
#define MQTT_MAX_PACKET_SIZE    1024

#endif // CONFIG_H
