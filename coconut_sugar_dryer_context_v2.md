# 🥥 Coconut Sugar Dryer IoT — Project Context v3
**Owner:** Muhammad Nur Bijak Bestari — Mahasiswa Teknik Elektro UNSOED, Purwokerto
**Dibuat:** April 2026
**Status saat ini:** Design wiring ~80% selesai. UI dan firmware belum dikerjakan.
**Tujuan dokumen:** Context lengkap untuk melanjutkan di sesi chat lain

---

## 1. Scope Final (Sudah Dikunci)

Scope awal mencakup prediksi MC berbasis ML, sensor gas MQ-9, sensor foton LDR, dan sensor humidity SHT40. Setelah konsultasi ulang dengan mitra, scope dipersempit karena waktu pengerjaan hanya 3 bulan.

**Scope yang berlaku sekarang:**
- **Monitoring suhu real-time** — 3 zona (R.Produk Kiri, R.Produk Kanan, R.Pembakaran) via MAX31855 + TC Type K
- **Kontrol blower otomatis** — 2 unit TAKAFAN DE160 via SSR + NXC-09, dikontrol ESP32
- **Alarm sirine** — untuk pengovenan selesai dan anomali (kompor mati terdeteksi dari penurunan suhu drastis)
- **Dashboard monitoring** — Ubidots + HiveMQ MQTT
- **Sistem belajar bertahap** — data batch dikumpulkan, rekomendasi blower optimal aktif setelah ≥30 batch

**Yang TIDAK jadi diimplementasikan (dropped dari scope):**
- ~~MQ-9 gas sensor~~ — tidak jadi
- ~~LDR / sensor foton~~ — tidak jadi
- ~~SHT40 humidity sensor~~ — tidak jadi
- ~~Safety logic foton + gas~~ — tidak relevan

**Deteksi kompor mati** dilakukan secara tidak langsung: jika suhu zona pembakaran turun drastis di luar ambang wajar selama sesi aktif, sistem trigger alarm. Bukan dari sensor foton/gas.

---

## 2. Spesifikasi Fisik Oven (dari spreadsheet mitra)

| Parameter | Nilai |
|---|---|
| Kapasitas | 400 kg |
| Volume ruang bakar | 45 × 110 × 60 cm |
| Volume ruang produk | 90 × 108.5 × 177 cm |
| Dimensi tray | 90 × 35 × 5 cm |
| Kapasitas per tray | 5 kg |
| Jumlah tray | 80 tray |
| Kompor | Semawar high pressure (1–2 unit, Shopee) |
| Regulator | Starcam SCT-12TM, 2 kg/h |
| Kontrol suhu existing | REX-C100 × 3 (SSR output 12V DC) |

---

## 3. Komponen Existing di Panel Mitra

| No | Komponen | Spesifikasi | Catatan |
|---|---|---|---|
| 1 | Thermocouple Type K | M6, 0-400°C, kabel 2m, SS braiding | Existing ×3+ — dipakai untuk REX-C100, TC baru beli untuk MAX31855 |
| 2 | REX-C100 | PID, TC Type K input, SSR output 12V DC, 220VAC | Existing ×3 — #2 zona tengah masih FAULT, tidak ada RS485 |
| 3 | Kontaktor Chint NXC-09 | 9A, 4kW, body 3 fasa dipakai 1 fasa | Existing ×2 |
| 4 | Blower TAKAFAN DE160 | Centrifugal steel, 250W, 220V 1ph, 2800 RPM | Existing ×2 — ON/OFF only, tidak ada speed control |
| 5 | Tombol ON/OFF | VORGE LA115 double push button 22mm | Existing |
| 6 | Kompor + Regulator | Semawar high pressure + Starcam SCT-12TM | Existing |

**Catatan REX-C100:** Tidak ada RS485 → tidak bisa Modbus → tidak bisa dibaca ESP32. REX-C100 tetap berjalan independen untuk kontrol heater. ESP32 membaca suhu via MAX31855 yang dipasang terpisah, bukan dari REX-C100.

**Catatan TC:** REX-C100 dan MAX31855 tidak bisa share satu TC (sinyal µV terlalu lemah, junction ganda menyebabkan error). Solusi: TC-A existing tetap ke REX-C100, TC-B baru dipasang ±5cm dari TC-A di titik ukur yang sama → ke MAX31855 → ESP32. Wajib pakai kabel kompensasi Type K (warna kuning/merah), bukan kabel biasa.

---

## 4. Arsitektur Sistem

```
[Sensor]                  [ESP32]           [Cloud]          [User]
TC Type K ×3             │              │
→ MAX31855 ×3  ─SPI────→ │              │
                         │  WiFi MQTT   │──→ HiveMQ ──→ Ubidots Dashboard
                         │              │──→ Telegram Bot (alarm)
SSR Fotek ×2  ←GPIO───── │              │
→ NXC-09 ×2              │              │
→ Motor ×2               │              │

Relay modul   ←GPIO───── │
→ Sirine 12V             │
```

### Power architecture
```
PLN 220V AC
    │
    ├── [MCB Utama 10A]  ← BELUM TERPASANG, WAJIB DITAMBAH
    │       │
    │       ├── [MCB Blower 6A] → Fasa Bus blower
    │       ├── [HLK-5M05] → 5V DC → VIN ESP32, VCC relay modul
    │       └── [HLK-PM12] → 12V DC → COM relay modul → NO → Sirine +
    │
    ├── N-Bus → A2 NXC-09 ×2 | N motor ×2 | N HLK-5M05 | N HLK-PM12
    └── PE-Bar → Chassis motor ×2 | Bodi panel
```

---

## 5. Pin Assignment ESP32 (Scope Final)

| Komponen | Pin ESP32 | Protokol | Tegangan | Proteksi wajib |
|---|---|---|---|---|
| MAX31855 #1 R.Produk Kiri | GPIO18 SCK, GPIO19 MISO, **GPIO5 CS** | SPI | 3.3V | 10kΩ pullup CS |
| MAX31855 #2 R.Produk Kanan | GPIO18 SCK, GPIO19 MISO, **GPIO17 CS** | SPI shared | 3.3V | CS berbeda |
| MAX31855 #3 R.Pembakaran | GPIO18 SCK, GPIO19 MISO, **GPIO16 CS** | SPI shared | 3.3V | Ferrite bead kabel TC |
| SSR Blower #1 | **GPIO32** → 330Ω → SSR pin 3+ | GPIO output | 3.3V | 330Ω seri WAJIB |
| SSR Blower #2 | **GPIO33** → 330Ω → SSR pin 3+ | GPIO output | 3.3V | 330Ω seri WAJIB |
| Relay alarm (sirine) | **GPIO25** → relay IN | GPIO output | 3.3V | Active LOW — init HIGH |

**GPIO bebas untuk ekspansi:** GPIO4, GPIO12, GPIO13, GPIO14, GPIO15, GPIO21, GPIO22, GPIO23, GPIO26, GPIO27, GPIO34, GPIO35

---

## 6. Detail Wiring Komponen Kritis

### SSR Fotek SSR-25DA — pin layout fisik
```
Pin 1 (kiri atas,  ~)  = AC Load IN  → dari Fasa MCB Blower
Pin 2 (kanan atas, ~)  = AC Load OUT → ke terminal A1 coil NXC-09
Pin 3 (kanan bawah, +) = DC Control+ → dari GPIO ESP32 via 330Ω
Pin 4 (kiri bawah,  -) = DC Control- → GND ESP32
```
- Heatsink 100×100mm + thermal paste wajib di belakang tiap SSR
- RC Snubber: kapasitor 0.1µF 250VAC + resistor 100Ω seri, dipasang paralel A1-A2 tiap NXC-09

### Kontaktor Chint NXC-09 — pin yang dipakai (motor 1 fasa)
| Pin | Dipakai | Disambung ke |
|---|---|---|
| A1 (coil) | ✓ | Pin 2 SSR — fasa switched |
| A2 (coil) | ✓ | N-Bus — netral permanen |
| 1/L1 (kontak utama in) | ✓ | Fasa MCB Blower — langsung, BUKAN dari SSR |
| 2/T1 (kontak utama out) | ✓ | Terminal L motor blower |
| 3/L2, 4/T2, 5/L3, 6/T3 | ✗ | Tidak dipakai (motor 1 fasa) |
| 13NO, 14NO, 22NC | ✗ | Tidak dipakai |

**Poin kritis:** fasa dari MCB Blower masuk ke dua tempat di NXC-09 dengan fungsi berbeda — satu ke pin 1 SSR (jalur coil via SSR), satu lagi langsung ke 1/L1 (jalur kontak utama motor). Ini bukan double wiring, tapi memang dua jalur terpisah.

### Relay modul 5V — alarm sirine
```
VCC  → 5V dari HLK-5M05
GND  → GND ESP32 / HLK-5M05
IN   → GPIO25 ESP32 (active LOW — LOW = sirine ON)
COM  → 12V+ dari HLK-PM12
NO   → Sirine 12V terminal +
(Sirine terminal − → GND HLK-PM12, bukan GND ESP32)
```

### Alarm trigger logic (software, bukan sensor fisik)
Karena MQ-9 dan LDR tidak jadi, deteksi anomali dilakukan dari data suhu:
```
Kompor mati    → suhu R.Pembakaran turun > threshold dalam waktu singkat
Selesai masak  → timer habis ATAU suhu stabil di bawah setpoint setelah durasi
Suhu anomali   → suhu melewati batas atas yang ditetapkan (>200°C misalnya)
```

---

## 7. Tiga Mode Blower

| Mode | Perilaku | Kapan |
|---|---|---|
| **Efisien** | Sistem pilih duty cycle terbaik dari historis. Awal: rule-based heuristic. Setelah ≥30 batch: ML (XGBoost) | Default |
| **Turbo** | Kedua blower ON 100% dari start hingga finish | Kejar deadline produksi |
| **Custom** | Operator set interval ON/OFF manual | Fase awal koleksi data |

**Rule-based heuristic Mode Efisien (sebelum ML):**
```
MC awal < 2%  → ON 20 mnt / OFF 10 mnt
MC awal 2–3% → ON 25 mnt / OFF 10 mnt
MC awal 3–5% → ON 30 mnt / OFF 10 mnt
Suhu turun >5°C → perpendek interval OFF
```

---

## 8. Data Schema per Batch (Training Data ML)

### Input operator (pre-batch)
```
mc_awal            : float, %
berat_awal_kg      : float, kg
suhu_awal_bakar    : float, °C
suhu_awal_produk   : float, °C (rata-rata kiri+kanan)
jumlah_kompor      : int, 1 atau 2
jenis_gas_kg       : int, 3/5/12
jumlah_tabung      : int
mode_blower        : str, Efisien/Turbo/Custom
durasi_rencana_mnt : int
```

### Auto-log sistem selama batch
```
suhu_rata_produk_kiri  : float, °C (time-series average)
suhu_rata_produk_kanan : float, °C
suhu_rata_bakar        : float, °C
blower_on_total_mnt    : int
blower_siklus          : int (jumlah ON-OFF)
durasi_aktual_mnt      : int
alarm_event            : list (timestamp + jenis kejadian)
```

### Input operator (post-batch)
```
mc_akhir              : float, % (dari moisture analyzer)
berat_akhir_kg        : float, kg
susut_kg              : float (auto-hitung)
susut_persen          : float (auto-hitung)
target_mc_tercapai    : bool (MC < 1%?)
estimasi_gas_terpakai : float, kg (manual — timbang tabung sebelum & sesudah)
efisiensi_score       : float (gas_kg / kg_produk_jadi, auto-hitung)
```

---

## 9. Cloud & Dashboard Stack

| Layer | Tool | Plan |
|---|---|---|
| MQTT Broker | HiveMQ Cloud | Free, 10 device |
| Dashboard | Ubidots | Free tier |
| Notifikasi | Telegram Bot | via HTTP API dari ESP32 |

### MQTT Topics
```
oven/suhu/produk_kiri      → float °C
oven/suhu/produk_kanan     → float °C
oven/suhu/pembakaran       → float °C
oven/blower/status         → str ON/OFF
oven/blower/mode           → str Efisien/Turbo/Custom
oven/blower/duty_cycle     → str "ON_X_OFF_Y" (menit)
oven/alarm/status          → str NORMAL/KOMPOR_MATI/SELESAI/ANOMALI
oven/batch/input           → JSON (pre-batch operator input)
oven/batch/result          → JSON (post-batch summary)
```

---

## 10. BOM Komponen yang Perlu Dibeli

### Core — sudah ada di wiring diagram
| Komponen | Spesifikasi | Qty | Est. Harga |
|---|---|---|---|
| ESP32 DevKit V1 | WROOM-32, 38 pin | 2 (1 spare) | Rp 63.000–70.000/unit |
| MAX31855 modul | SPI, K-type amplifier, 3.3V breakout | 3 | Rp 35.000–55.000/unit |
| TC Type K baru | M6, 0-400°C, kabel 2m (untuk MAX31855) | 3 | ~Rp 20.000–35.000/unit |
| SSR Fotek 25DA | DC-AC, 25A, zero-crossing | 2 | Rp 55.000–90.000/unit |
| Heatsink aluminium | 100×100×25mm untuk SSR | 2 | Rp 15.000–25.000/unit |
| HLK-5M05 | 220VAC→5VDC 1A | 1 | Rp 35.000–55.000 |
| HLK-PM12 | 220VAC→12VDC 1A | 1 | Rp 35.000–55.000 |
| MCB 1P 10A | MCB Utama panel, DIN rail | 1 | Rp 20.000–40.000 |
| Relay modul 1-channel 5V | Optoisolator, 10A 250VAC, active LOW | 1 | Rp 8.000–18.000 |
| Sirine 12V DC | 120dB + LED flasher | 1 | Rp 25.000–50.000 |
| Kabel kompensasi TC Type K | Shielded, per meter | 5m | Rp 15.000–30.000/m |
| Busbar Netral (N-Bus) | DIN rail, 10 pole | 1 | Rp 15.000–30.000 |
| Ground Bar (PE) | DIN rail | 1 | Rp 15.000–25.000 |

### Komponen pasif & proteksi
| Komponen | Fungsi | Qty |
|---|---|---|
| Resistor 330Ω 1/4W | GPIO→SSR pin 3+ (wajib ×2, beli lebih) | 5 |
| Kapasitor 0.1µF 250VAC (film) | RC snubber NXC-09 (×2 kontaktor) | 4 |
| Resistor 100Ω 1/4W | RC snubber NXC-09 | 4 |
| Kapasitor 100µF 16V + 100nF | Decoupling VIN ESP32 | 3 set |
| Dioda 1N4007 | Flyback protection | 5 |
| MOV 275V | Surge absorber input PLN | 1 |
| Ferrite bead Ø3mm | EMI rejection kabel TC zona pembakaran | 3 |
| Terminal block DIN 4mm² | Junction wiring rapi | 1 strip |

**Estimasi total: Rp 900.000 – 1.500.000**

---

## 11. Checklist Sebelum Power-On

- [ ] **MCB Utama 10A terpasang** — satu-satunya item struktural yang belum ada
- [ ] **HLK-PM12 ambil fasa dari setelah MCB Utama** (bukan dari MCB Blower)
- [ ] **Resistor 330Ω** terpasang fisik di GPIO32→SSR#1 pin3+ dan GPIO33→SSR#2 pin3+
- [ ] **RC Snubber** (0.1µF + 100Ω) terpasang paralel A1-A2 tiap NXC-09 (×2)
- [ ] **Heatsink + thermal paste** di kedua SSR Fotek
- [ ] **Kabel 1/L1 NXC-09** mendapat fasa dari MCB Blower langsung (bukan dari SSR)
- [ ] **CS pin MAX31855** masing-masing ke GPIO5, GPIO17, GPIO16 — verifikasi fisik
- [ ] **GND sirine** kembali ke GND HLK-PM12 (bukan GND ESP32)
- [ ] **Test continuity** semua jalur dengan multimeter sebelum sambung PLN
- [ ] **`digitalWrite(ALARM_PIN, HIGH)`** di baris pertama `setup()` firmware

---

## 12. Yang Belum Dikerjakan (Next Steps)

### Firmware ESP32 — belum ada sama sekali
Prioritas pengerjaan:
1. Baca suhu dari 3 MAX31855 via SPI (library `MAX31855`)
2. Publish data suhu ke HiveMQ via MQTT (library `PubSubClient`)
3. Terima perintah dari dashboard (mode blower, start/stop)
4. Blower scheduling — non-blocking dengan `millis()` (JANGAN `delay()`)
5. Alarm logic dari data suhu (deteksi kompor mati dari penurunan suhu)
6. Log data batch ke cloud

**Penting di firmware:**
- `digitalWrite(ALARM_PIN, HIGH)` di awal `setup()` — relay active LOW
- Semua scheduling blower pakai `millis()` bukan `delay()` agar MQTT tidak terputus
- Reconnect logic untuk WiFi dan MQTT

### Dashboard Ubidots — belum dikonfigurasi
- Widget gauge suhu 3 zona
- Switch mode blower (Efisien/Turbo/Custom)
- Input form pre-batch
- Alert widget untuk alarm
- Riwayat batch

---

## 13. Roadmap 3 Bulan

### Bulan 1 — Hardware + Basic Monitoring (sedang berjalan)
- [x] Design wiring diagram lengkap
- [x] Identifikasi komponen dan BOM
- [ ] Tambah MCB Utama + RC Snubber + heatsink SSR
- [ ] Beli dan rakit semua komponen
- [ ] Firmware: baca suhu + MQTT publish
- [ ] Dashboard Ubidots aktif monitoring suhu real-time

### Bulan 2 — Blower Control + Data Collection
- [ ] Firmware: implementasi 3 mode blower dengan `millis()`
- [ ] Input pre-batch dari dashboard
- [ ] Auto-log tiap batch ke cloud
- [ ] Alarm dari anomali suhu
- [ ] Resume post-batch (penyusutan kg/%)

### Bulan 3 — Refinement + ML Foundation
- [ ] EDA data batch terkumpul
- [ ] Fit model pertama (XGBoost atau linear regression)
- [ ] Upgrade mode Efisien dari rule-based ke ML
- [ ] Dokumentasi teknis + manual operator
- [ ] Deliverable ke mitra

---

## 14. Pertanyaan Terbuka ke Mitra

1. Sinyal WiFi tersedia di lokasi pabrik? (menentukan perlu SIM7600 atau tidak)
2. REX-C100 #2 zona tengah kapan akan diperbaiki?
3. Kabel TC existing — sudah kabel kompensasi Type K atau kabel biasa?
4. Apakah kedua blower selalu dikontrol bersamaan, atau bisa independen per zona?

---

*Dokumen ini merangkum sesi diskusi April 2026 antara Bijak dan Claude. Scope final: monitoring suhu 3 zona + kontrol blower otomatis 2 unit + alarm sirine. MQ-9, LDR foton, dan SHT40 tidak jadi diimplementasikan.*
