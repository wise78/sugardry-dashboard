# Data Flow Diagram (DFD): Coconut Sugar Dryer IoT

Berikut ini adalah perbaikan simbol pada DFD:
- **Entitas Eksternal (External Entity):** Secara tegas menggunakan Kotak Siku `[ ]`.
- **Proses (Process):** Tetap menggunakan Lingkaran `(( ))`.
- **Data Store / Storage:** Menurut standar DFD (seperti yang dijelaskan di GeeksforGeeks), Data Store wajib menggunakan **Dua Garis Horizontal (Two Horizontal Lines)**. Namun, karena keterbatasan library visual Markdown (Mermaid.js) yang *tidak memiliki bentuk dua garis horizontal*, diagram disini direpresentasikan menggunakan **Silinder Database `[( )]`** sebagai storage. Saat Anda memindahkannya ke Visio atau Draw.io, pastikan Anda menggunakan simbol 2 garis horizontal!

---

## 1. DFD Level 0 (Context Diagram)

```mermaid
graph TD
    %% Entitas Eksternal (KOTAK)
    Operator[Operator / Mitra]
    Sensor[Sensor Suhu MAX31855]
    Aktuator[Aktuator Blower & Sirine]
    Cloud[Ubidots / Telegram]

    %% Main Process (LINGKARAN)
    System((0.0<br>Sistem IoT<br>Oven Gula Semut))

    %% Data Flows
    Operator -- "Pre-Batch (MC, Berat, Mode)<br>Post-Batch (Susut, Efisiensi)" --> System
    System -- "Status Oven & Alarm Fisik" --> Operator
    
    Sensor -- "Suhu Ruang Produk (L/R)<br>Suhu Ruang Bakar" --> System
    
    System -- "Sinyal SSR ON/OFF (Blower)<br>Sinyal Relay ON/OFF (Sirine)" --> Aktuator
    System -- "Publish Telemetri Suhu<br>Alarm Event" --> Cloud
    Cloud -- "User Dashboard View<br>Notif Telegram" --> Operator
```

---

## 2. DFD Level 1 (Dekomposisi Sistem Utama)

```mermaid
graph TD
    %% Entitas Eksternal (KOTAK SOLID)
    Operator[Operator]
    Sensor[Sensor Suhu]
    Aktuator[Aktuator Fisik]
    Cloud[Platform Cloud]

    %% Data Stores (DIREPRESENTASIKAN SEBAGAI CYLINDER KARENA LIMITASI MERMAID)
    D1[("D1: Data Store Batch")]
    D2[("D2: Log Telemetri")]
    D3[("D3: Data Store Mesin")]
    D4[("D4: Data Store Operator")]
    D5[("D5: Data Store Alarm")]

    %% Processes (LINGKARAN)
    P1((1.0<br>Manajemen<br>Batch & Mesin))
    P2((2.0<br>Monitoring &<br>Kontrol Real-time))
    P3((3.0<br>Publikasi &<br>Notifikasi))

    %% Flows from/to Entities
    Operator -- "Registrasi Mesin & Profil, <br>Start/Stop, Data Pre/Post-Batch" --> P1
    Sensor -- "Data SPI Suhu (3 Zona)" --> P2
    P2 -- "Sinyal GPIO/SSR" --> Aktuator
    P3 -- "Payload MQTT" --> Cloud

    %% Internal Flows & Data Store
    P1 -- "Simpan Profil Master" --> D3
    P1 -- "Simpan Profil Master" --> D4
    P1 -- "Log Input/Output" --> D1
    
    P1 -- "Parameter Mode Blower,<br>Threshold Start" --> P2
    D1 -. "Data Historis (Untuk rule-based/ML)" .-> P2
    
    P2 -- "Log Suhu Periodik" --> D2
    P2 -- "Simpan Kejadian Kompor Mati" --> D5
    
    P2 -- "Stream Suhu aktual,<br>Status Blower/Anomali" --> P3
```

---

## 3. DFD Level 2 (Breakdown Proses 2.0: Kontrol Real-time)

```mermaid
graph TD
    %% Input dari luar Level 2
    InputSensor[Dari Sensor Suhu]
    InputParam[Dari P1.0: Parameter Mode]
    DataHistoris[("D1: Data Store Batch")]
    
    OutputAktuator[Sinyal ke Aktuator]
    OutputTele[Ke P3.0: Publikasi Awan]
    LogTelemetri[("D2: Log Telemetri")]
    LogAlarm[("D5: Data Store Alarm")]

    %% Sub-Processes (LINGKARAN)
    P2_1((2.1<br>Akuisisi & Filtering<br>Suhu))
    P2_2((2.2<br>Deteksi<br>Anomali))
    P2_3((2.3<br>Evaluasi Mode &<br>Algoritma Blower))
    P2_4((2.4<br>Scheduler<br>Hardware))

    %% Data flow mapping
    InputSensor -- "Nilai Mentah (mV)" --> P2_1
    P2_1 -- "Suhu Valid (°C)" --> OutputTele
    P2_1 -- "Suhu Valid (°C)" --> P2_2
    P2_1 -- "Suhu Valid (°C)" --> P2_3

    %% Deteksi Anomali
    P2_2 -- "Suhu Drop Drastis -> Event: Kompor Mati" --> P2_4
    P2_2 -- "Simpan Log Peringatan" --> LogAlarm

    %% Evaluasi Blower
    InputParam -- "Pilihan Mode (Mis. Efisien)" --> P2_3
    DataHistoris -. "Model ML / Rule Heuristik" .-> P2_3
    P2_3 -- "Target Duty Cycle<br>(ON X mnt, OFF Y mnt)" --> P2_4

    %% Scheduler ke Hardware
    P2_4 -- "Perintah GPIO High/Low" --> OutputAktuator
    P2_4 -- "Simpan Periodik per detik" --> LogTelemetri
```
