# 🥥 SugarDry — Coconut Sugar Dryer IoT System

> Sistem Monitoring & Kontrol Real-time untuk Mesin Pengering Gula Semut Kelapa berbasis Internet of Things (IoT).
> Proyek kolaborasi riset: **Universitas Jenderal Soedirman (UNSOED) × Central Agro Lestari**

![Status](https://img.shields.io/badge/Status-Development-orange)
![Platform](https://img.shields.io/badge/Platform-ESP32-green)
![Dashboard](https://img.shields.io/badge/Dashboard-HTML%20%7C%20CSS%20%7C%20JS-blue)
![MQTT](https://img.shields.io/badge/Protocol-MQTT%20(HiveMQ)-purple)
![Database](https://img.shields.io/badge/Database-Firebase-yellow)

---

## 📁 Project Structure

```
sugardry-dashboard/
├── dashboard/          # Web Dashboard (HTML/CSS/JS)
│   ├── index.html      # Main dashboard UI
│   ├── styles.css      # Styling
│   ├── app.js          # Core application logic
│   ├── config.js       # Configuration (MQTT, Firebase)
│   ├── firebase-service.js  # Firebase Realtime Database service
│   ├── mqtt-service.js      # MQTT WebSocket communication
│   ├── ml-service.js        # ML prediction client
│   └── assets/              # Static assets
├── firmware/           # ESP32 Arduino Firmware
│   ├── SugarDry_ESP32/      # Main production firmware
│   │   ├── SugarDry_ESP32.ino
│   │   └── config.h
│   └── HardwareTest/        # Hardware testing sketch
│       └── HardwareTest.ino
├── hardware/           # Hardware Documentation
│   ├── wiring_analysis.md
│   ├── panel_box_technical_guide.md
│   ├── terminal_and_wiring_guide.md
│   └── *.png / *.jpeg       # Wiring diagrams & photos
├── ml/                 # Machine Learning Models
│   ├── train_blower_model.py    # Blower optimization model
│   ├── train_anomaly_model.py   # Anomaly detection model
│   ├── predict_server.py        # Prediction API server
│   ├── export_firebase.py       # Firebase data export utility
│   └── requirements.txt
└── README.md
```

---

## 📌 Key Features

### 🌡️ Real-time Temperature Monitoring
- 3 zona suhu: Ruang Produk Kiri, Ruang Produk Kanan, Ruang Pembakaran
- Sensor MAX31855 + Thermocouple Type-K via SPI
- Live chart & gauge visualization

### 💨 Smart Blower Control
- **Mode Efisien:** Duty cycle otomatis (rule-based → ML setelah ≥30 batch)
- **Mode Turbo:** Full power untuk kejar deadline
- **Mode Custom:** Operator set interval manual

### 📝 Batch Data Management
- Pre-batch parameter input (MC awal, berat, mode blower)
- Auto-logging selama batch (suhu rata-rata, blower siklus, durasi)
- Post-batch summary (MC akhir, penyusutan, efisiensi)

### 🚨 Safety Alarm System
- Deteksi kompor mati (penurunan suhu drastis)
- Alarm suhu anomali (melewati batas atas)
- Log alarm otomatis dengan timestamp

### 🤖 Machine Learning (Roadmap)
- Prediksi duty cycle blower optimal berdasarkan data historis
- Deteksi anomali suhu berbasis model

---

## 🏗️ System Architecture

```
[Sensor]                  [ESP32]           [Cloud]              [User]
TC Type K ×3             │              │
→ MAX31855 ×3  ─SPI────→ │              │
                         │  WiFi MQTT   │──→ HiveMQ ──→ Dashboard
                         │              │──→ Firebase RTDB
SSR Fotek ×2  ←GPIO───── │              │
→ NXC-09 ×2              │              │
→ Blower ×2              │              │

Relay modul   ←GPIO───── │
→ Sirine 12V             │
```

---

## 🛠️ Getting Started

### Dashboard
```bash
git clone https://github.com/wise78/sugardry-dashboard.git
cd sugardry-dashboard/dashboard
# Open index.html with a browser or use VS Code Live Server
```

### Firmware
1. Install [Arduino IDE](https://www.arduino.cc/en/software) atau [PlatformIO](https://platformio.org/)
2. Install board: **ESP32 by Espressif Systems**
3. Install libraries: `MAX31855`, `PubSubClient`, `ArduinoJson`, `WiFi`
4. Open `firmware/SugarDry_ESP32/SugarDry_ESP32.ino`
5. Configure WiFi & MQTT credentials in `config.h`
6. Upload ke ESP32

### ML Server
```bash
cd ml
pip install -r requirements.txt
python predict_server.py
```

---

## 📡 Tech Stack

| Layer | Technology |
|---|---|
| Microcontroller | ESP32-WROOM-32U |
| Sensors | MAX31855 + Thermocouple Type K ×3 |
| Actuators | SSR-25DA ×2, NXC-09 Contactor ×2, Blower TAKAFAN DE160 ×2 |
| Protocol | MQTT over WebSocket Secure (WSS) |
| MQTT Broker | HiveMQ Cloud |
| Database | Firebase Realtime Database |
| Dashboard | Vanilla HTML/CSS/JavaScript |
| ML | Python (XGBoost, scikit-learn) |

---

## 👤 Author

**Muhammad Nur Bijak Bestari**
Teknik Elektro — Universitas Jenderal Soedirman (UNSOED), Purwokerto

---

*Capstone Project — 2026*
