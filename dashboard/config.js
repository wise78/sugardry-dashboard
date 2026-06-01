/**
 * SugarDry IoT — Configuration
 * ⚠️  ISI SEMUA VALUE DI BAWAH DENGAN CREDENTIAL ASLI KAMU
 * ⚠️  JANGAN commit file ini dengan credential asli ke GitHub!
 *
 * Cara pakai:
 *   1. Copy file ini → rename jadi config.local.js (untuk dev)
 *   2. Atau langsung isi di sini untuk testing
 */

const CONFIG = {
  // ===== MODE =====
  // 'simulation' = data dummy (tanpa ESP32)
  // 'live'       = data real dari MQTT + Firebase
  // 'hybrid'     = MQTT untuk telemetry, Firebase untuk persistence (REKOMENDASI)
  mode: 'live',

  // ===== FIREBASE =====
  firebase: {
    apiKey: 'AIzaSyA1QYeFNdt6gM5kNtUxII0GZO4WfEMkYsE',
    authDomain: 'sugardry-iot.firebaseapp.com',
    databaseURL: 'https://sugardry-iot-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'sugardry-iot',
    storageBucket: 'sugardry-iot.firebasestorage.app',
    messagingSenderId: '574718714207',
    appId: '1:574718714207:web:ee9916969fbdaf0bfa56ea',
  },

  // ===== HIVEMQ MQTT =====
  mqtt: {
    // WebSocket Secure URL — dari HiveMQ Cloud dashboard
    // Format: wss://<cluster-url>:8884/mqtt
    broker: 'wss://7993d8054ea947be928cddd219b714b8.s1.eu.hivemq.cloud:8884/mqtt',
    username: 'sugardry-user',
    password: 'Password123!',
    // Client ID unik per session
    clientId: `sugardry-dash-${Math.random().toString(16).slice(2, 8)}`,
    // Auto reconnect interval (ms)
    reconnectPeriod: 5000,
    // Keep alive interval (seconds)
    keepalive: 60,
  },

  // ===== MQTT TOPICS =====
  topics: {
    // ESP32 → Dashboard (subscribe)
    suhuProdukKiri: 'oven/suhu/produk_kiri',
    suhuProdukKanan: 'oven/suhu/produk_kanan',
    suhuPembakaran: 'oven/suhu/pembakaran',
    blowerStatus: 'oven/blower/status',
    blowerDutyCycle: 'oven/blower/duty_cycle',
    blowerModeStatus: 'oven/blower/mode_status', // ESP32 publish status mode (read-only, bukan command)
    alarmStatus: 'oven/alarm/status',
    batchResult: 'oven/batch/result',

    // Dashboard → ESP32 (publish)
    blowerMode: 'oven/blower/mode',
    batchInput: 'oven/batch/input',
    batchStop: 'oven/batch/stop',

    // Troubleshoot (Dashboard ↔ ESP32)
    tsSSR1: 'oven/troubleshoot/ssr1',
    tsSSR2: 'oven/troubleshoot/ssr2',
    tsAlarm: 'oven/troubleshoot/alarm',
    tsCommand: 'oven/troubleshoot/command',
    tsResponse: 'oven/troubleshoot/response',
  },

  // ===== MACHINE DEFAULT =====
  defaultMachineId: 'dryer01',

  // ===== TELEMETRY =====
  telemetry: {
    // Interval publish dari ESP32 (ms) — untuk referensi
    publishInterval: 2000,
    // Max history points in chart (prevent memory leak)
    maxHistoryPoints: 1800,
    // Simulation update interval (ms) — only used in simulation mode
    simulationInterval: 2000,
  },

  // ===== ALARM THRESHOLDS =====
  alarms: {
    // Suhu pembakaran max sebelum warning
    burnerMaxTemp: 200,
    // Penurunan suhu yang dianggap anomali (°C dalam 30 detik)
    burnerDropThreshold: 15,
    // Max alarm entries di log
    maxAlarmEntries: 50,
  },
};
