# 🔌 Wiring Analysis — Coconut Sugar Dryer IoT
**Tanggal analisis:** 20 April 2026 | **Update terakhir:** 18 Mei 2026
**Referensi:** Caps.png (wiring diagram)

---

## Kesimpulan Singkat

**Topologi dasar sudah BENAR.** Jalur SPI sensor, SSR→kontaktor, dan relay alarm sudah sesuai arsitektur.

**5 hal KRITIS yang belum ada dan WAJIB ditambah:**

1. 🔴 **MCB Utama 10A** — breaker utama panel, pasang sebelum MCB Blower
2. 🟢 **Koneksi Langsung (Tanpa Resistor)** — GPIO32/33 → SSR pin 3+ (SSR memiliki pembatas arus internal 3-32VDC, tidak perlu resistor eksternal)
3. 🔴 **2× RC Snubber** — 100Ω + 0.1µF 250VAC paralel A1-A2 tiap NXC-09
4. 🟡 **Decoupling cap** — 100µF + 100nF di VIN-GND ESP32
5. ✅ **[UPDATE 18 Mei] AMS1117 3.3V** — regulator dedicated untuk supply 3× MAX31855 (dari HLK-5M05 5V). ESP32 pin 3.3V tidak lagi menanggung beban sensor.

## Daftar Belanja Minimal (~Rp 100.000)

| Komponen | Spec | Qty | Harga |
|----------|------|-----|-------|
| MCB 1P 10A | DIN rail | 1 | Rp 25.000 |
| Resistor 330Ω ¼W | Carbon film | 4 | Rp 2.000 |
| Kapasitor 0.1µF 250VAC | Film/polypropylene | 4 | Rp 8.000 |
| Resistor 100Ω ¼W | Carbon film | 4 | Rp 2.000 |
| Kapasitor 100µF 16V | Elektrolit | 2 | Rp 3.000 |
| Kapasitor 100nF | Keramik MLCC | 3 | Rp 2.000 |
| Heatsink 100×100mm + paste | Aluminium | 2 | Rp 40.000 |
| **AMS1117-3.3V** | SOT-223 atau modul breakout | 1 | Rp 5.000 |
| Kapasitor 10µF 16V | Elektrolit, input & output AMS1117 | 2 | Rp 2.000 |
| Kapasitor 100nF keramik | Bypass AMS1117 | 2 | Rp 1.000 |

## Checklist Pemasangan

### Fase 1: Power Distribution
- [ ] MCB Utama 10A terpasang SEBELUM MCB Blower
- [ ] HLK-PM12 ambil fasa dari MCB Utama (BUKAN MCB Blower)
- [ ] HLK-5M05 ambil fasa dari MCB Utama

### Fase 2: SSR + Kontaktor
- [ ] Heatsink + thermal paste di kedua SSR
- [ ] Koneksi langsung (tanpa resistor): GPIO32 → SSR#1 pin 3+
- [ ] Koneksi langsung (tanpa resistor): GPIO33 → SSR#2 pin 3+
- [ ] RC Snubber paralel A1-A2 di NXC-09 #1
- [ ] RC Snubber paralel A1-A2 di NXC-09 #2
- [ ] 1/L1 NXC-09 langsung dari MCB Blower (BUKAN dari SSR)

### Fase 3: Sensor & Regulator AMS1117
- [ ] MAX31855 SPI: SCK=GPIO18, MISO=GPIO19
- [ ] CS: GPIO5 (Kiri), GPIO17 (Kanan), GPIO16 (Pembakaran)
- [ ] Decoupling 100µF + 100nF di VIN-GND ESP32
- [ ] AMS1117 IN → HLK-5M05 Vout (+5V)
- [ ] AMS1117 OUT → VCC ketiga MAX31855 (paralel)
- [ ] AMS1117 IN decoupling: 10µF elektrolit + 100nF keramik ke GND
- [ ] AMS1117 OUT decoupling: 10µF elektrolit + 100nF keramik ke GND
- [ ] GND AMS1117 → common GND (sama dengan ESP32 & HLK-5M05)

### Fase 4: Alarm
- [ ] Relay IN → GPIO25 (active LOW, init HIGH di setup())
- [ ] Sirine GND → GND HLK-PM12 (BUKAN GND ESP32)

### Fase 5: Test
- [ ] Continuity test semua jalur (multimeter, tanpa PLN)
- [ ] Cek output: HLK-5M05 = 5V, HLK-PM12 = 12V
- [ ] Upload firmware test: baca suhu saja, blower OFF

---

## 📌 DETAILED WIRING TABLE — Sambungan Per-Pin & Per-Koneksi

Referensi diagram: **Caps Wiring Fixed.png**
Tanggal update: 20 April 2026

---

### TABEL 1 — Distribusi Daya AC 220V (dari PLN)

| No | DARI (Sumber) | PIN / TERMINAL | → MENUJU | PIN / TERMINAL | Jenis Kabel | Catatan |
|----|---------------|----------------|----------|----------------|-------------|---------|
| 1 | PLN 220V AC | Kabel Fasa (L) | MCB Utama 10A | Terminal IN | NYA 2.5mm² merah | Kabel masuk via cable gland |
| 2 | PLN 220V AC | Kabel Netral (N) | Neutral Bus | — | NYA 2.5mm² biru | Langsung ke bus netral |
| 3 | PLN 220V AC | Kabel Ground (PE) | Ground Bar | — | NYA 2.5mm² kuning-hijau | Wajib ke bodi panel |
| 4 | MCB Utama 10A | Terminal OUT | MCB Blower 6A | Terminal IN | NYA 2.5mm² merah | Untuk fasa jalur blower |
| 5 | MCB Utama 10A | Terminal OUT | HLK-5M05 | Terminal L (AC IN) | NYA 1.5mm² merah | Cabang fasa untuk PSU 5V |
| 6 | MCB Utama 10A | Terminal OUT | HLK-PM12 | Terminal L (AC IN) | NYA 1.5mm² merah | Cabang fasa untuk PSU 12V |
| 7 | Neutral Bus | — | HLK-5M05 | Terminal N (AC IN) | NYA 1.5mm² biru | Netral PSU 5V |
| 8 | Neutral Bus | — | HLK-PM12 | Terminal N (AC IN) | NYA 1.5mm² biru | Netral PSU 12V |

> ⚠️ PENTING: HLK-PM12 mengambil fasa dari MCB Utama 10A (baris #6), BUKAN dari MCB Blower 6A. Ini agar sirine tetap berbunyi meskipun MCB Blower trip.

---

### TABEL 2 — SSR Fotek SSR-25DA (× 2 unit)

#### SSR #1 (Blower Kiri)

| No | PIN SSR #1 | Nama Pin | → Disambung ke | Keterangan |
|----|------------|----------|----------------|------------|
| 1 | Pin 1 (kiri atas, ~) | AC Load IN | MCB Blower 6A → Terminal OUT | Fasa AC 220V masuk |
| 2 | Pin 2 (kanan atas, ~) | AC Load OUT | NXC-09 #1 → Terminal A1 (coil) | Fasa ter-switch keluar ke coil kontaktor |
| 3 | Pin 3 (kanan bawah, +) | DC Control+ | ESP32 GPIO32 | Koneksi Langsung (SSR sudah memiliki pembatas arus internal) |
| 4 | Pin 4 (kiri bawah, −) | DC Control− | GND ESP32 | Common ground DC |

#### SSR #2 (Blower Kanan)

| No | PIN SSR #2 | Nama Pin | → Disambung ke | Keterangan |
|----|------------|----------|----------------|------------|
| 1 | Pin 1 (kiri atas, ~) | AC Load IN | MCB Blower 6A → Terminal OUT | Fasa AC 220V masuk |
| 2 | Pin 2 (kanan atas, ~) | AC Load OUT | NXC-09 #2 → Terminal A1 (coil) | Fasa ter-switch keluar ke coil kontaktor |
| 3 | Pin 3 (kanan bawah, +) | DC Control+ | ESP32 GPIO33 | Koneksi Langsung (SSR sudah memiliki pembatas arus internal) |
| 4 | Pin 4 (kiri bawah, −) | DC Control− | GND ESP32 | Common ground DC |

> Heatsink aluminium 100×100mm + thermal paste dipasang di bagian belakang (permukaan metal) tiap SSR.

---

### TABEL 3 — Kontaktor Chint NXC-09 (× 2 unit)

#### NXC-09 #1 (Blower Kiri)

| No | PIN NXC-09 #1 | Fungsi | → Disambung ke | Keterangan |
|----|---------------|--------|----------------|------------|
| 1 | A1 (coil +) | Coil energize | SSR #1 Pin 2 (AC OUT) | Fasa ter-switch dari SSR |
| 2 | A1 (coil +) | RC Snubber | Modul RC Snubber → Lubang kiri | ⚠️ Dijadikan satu baut dgn baris #1 |
| 3 | A2 (coil −) | Coil return | Neutral Bus | Netral permanen |
| 4 | A2 (coil −) | RC Snubber | Modul RC Snubber → Lubang kanan | ⚠️ Dijadikan satu baut dgn baris #3 |
| 5 | 1/L1 (kontak utama IN) | Fasa motor masuk | MCB Blower 6A → Terminal OUT | ⚠️ LANGSUNG dari MCB, bukan dari SSR |
| 6 | 2/T1 (kontak utama OUT) | Fasa motor keluar | Motor Blower #1 → Terminal L | Ke terminal fasa motor |
| 7 | 3/L2, 4/T2, 5/L3, 6/T3 | — | TIDAK DIPAKAI | Motor 1 fasa, hanya pakai L1-T1 |
| 8 | 13NO, 14NO, 22NC | — | TIDAK DIPAKAI | Kontak bantu tidak dibutuhkan |

#### NXC-09 #2 (Blower Kanan)

| No | PIN NXC-09 #2 | Fungsi | → Disambung ke | Keterangan |
|----|---------------|--------|----------------|------------|
| 1 | A1 (coil +) | Coil energize | SSR #2 Pin 2 (AC OUT) | Fasa ter-switch dari SSR |
| 2 | A1 (coil +) | RC Snubber | Modul RC Snubber → Lubang kiri | ⚠️ Dijadikan satu baut dgn baris #1 |
| 3 | A2 (coil −) | Coil return | Neutral Bus | Netral permanen |
| 4 | A2 (coil −) | RC Snubber | Modul RC Snubber → Lubang kanan | ⚠️ Dijadikan satu baut dgn baris #3 |
| 5 | 1/L1 (kontak utama IN) | Fasa motor masuk | MCB Blower 6A → Terminal OUT | ⚠️ LANGSUNG dari MCB, bukan dari SSR |
| 6 | 2/T1 (kontak utama OUT) | Fasa motor keluar | Motor Blower #2 → Terminal L | Ke terminal fasa motor |
| 7 | 3/L2, 4/T2, 5/L3, 6/T3 | — | TIDAK DIPAKAI | Motor 1 fasa |
| 8 | 13NO, 14NO, 22NC | — | TIDAK DIPAKAI | Kontak bantu tidak dibutuhkan |

---

### TABEL 4 — Motor Blower TAKAFAN DE160 (× 2 unit, 220V 1-Fasa)

| No | Motor | Terminal Motor | → Disambung ke | Keterangan |
|----|-------|---------------|----------------|------------|
| 1 | Blower #1 | Terminal L (fasa) | NXC-09 #1 → 2/T1 | Fasa dari kontak utama kontaktor |
| 2 | Blower #1 | Terminal N (netral) | Neutral Bus | Netral permanen |
| 3 | Blower #1 | Terminal PE (ground) | Ground Bar | Grounding bodi motor |
| 4 | Blower #2 | Terminal L (fasa) | NXC-09 #2 → 2/T1 | Fasa dari kontak utama kontaktor |
| 5 | Blower #2 | Terminal N (netral) | Neutral Bus | Netral permanen |
| 6 | Blower #2 | Terminal PE (ground) | Ground Bar | Grounding bodi motor |

---

### TABEL 5 — ESP32 DevKit — Semua Pin yang Digunakan

| No | PIN ESP32 | Arah | → Disambung ke | Protokol | Keterangan |
|----|-----------|------|----------------|----------|------------|
| 1 | **VIN (5V)** | IN | HLK-5M05 → Vout (+) | Power | ⚠️ Lewat decoupling caps dulu |
| 2 | **GND** | — | HLK-5M05 → Vout (−) | Power | Common ground seluruh sistem DC |
| 3 | **GPIO18** | OUT | MAX31855 #1 SCK, MAX31855 #2 SCK, MAX31855 #3 SCK | SPI CLK | Shared untuk 3 modul (paralel) |
| 4 | **GPIO19** | IN | MAX31855 #1 SO, MAX31855 #2 SO, MAX31855 #3 SO | SPI MISO | Shared untuk 3 modul (paralel) |
| 5 | **GPIO5** | OUT | MAX31855 #1 → CS | SPI CS | Chip Select — R. Produk Kiri |
| 6 | **GPIO17** | OUT | MAX31855 #2 → CS | SPI CS | Chip Select — R. Produk Kanan |
| 7 | **GPIO16** | OUT | MAX31855 #3 → CS | SPI CS | Chip Select — R. Pembakaran |
| 8 | **GPIO32** | OUT | SSR #1 Pin 3+ (Koneksi Langsung) | GPIO | Kontrol Blower Kiri (HIGH = ON) |
| 9 | **GPIO33** | OUT | SSR #2 Pin 3+ (Koneksi Langsung) | GPIO | Kontrol Blower Kanan (HIGH = ON) |
| 10 | **GPIO25** | OUT | Relay 5V → Pin IN | GPIO | Kontrol Alarm/Sirine (LOW = ON!) |
| 11 | **3.3V** | OUT | MAX31855 #1 VCC, #2 VCC, #3 VCC | Power | Suplai 3.3V ke modul sensor |
| 12 | **GND** | — | MAX31855 #1 GND, #2 GND, #3 GND | Power | Ground sensor |
| 13 | **GND** | — | SSR #1 Pin 4−, SSR #2 Pin 4− | Power | Ground kontrol SSR |
| 14 | **GND** | — | Relay 5V → GND | Power | Ground relay |

> GPIO yang TIDAK dipakai (tersedia untuk ekspansi): GPIO4, 12, 13, 14, 15, 21, 22, 23, 26, 27, 34, 35

---

### TABEL 6a — AMS1117 3.3V Regulator (UPDATE 18 Mei 2026)

> ✅ Ditambahkan: AMS1117 menjadi dedicated supply untuk semua MAX31855, membebaskan pin 3.3V ESP32 dari beban eksternal.

| No | PIN AMS1117 | Fungsi | → Disambung ke | Keterangan |
|----|-------------|--------|----------------|------------|
| 1 | IN | Input tegangan | HLK-5M05 → Vout (+5V) | Input 5V dari PSU |
| 2 | GND | Ground | Common GND (ESP32 / HLK-5M05) | Harus satu common ground |
| 3 | OUT | Output 3.3V | VCC ketiga MAX31855 (paralel) | Arus maks 800mA, beban sensor hanya ~5mA total |
| 4 | Cap IN+ | Decoupling input | 10µF elektrolit (+) ke IN, (−) ke GND | Wajib untuk stabilitas |
| 5 | Cap IN bypass | Bypass input | 100nF keramik paralel dengan cap IN | High-frequency decoupling |
| 6 | Cap OUT+ | Decoupling output | 10µF elektrolit (+) ke OUT, (−) ke GND | Wajib, letakkan sedekat mungkin |
| 7 | Cap OUT bypass | Bypass output | 100nF keramik paralel dengan cap OUT | High-frequency decoupling |

> ⚠️ Polaritas kapasitor elektrolit: kaki (+) panjang ke tegangan, kaki (−) bergaris ke GND.

---

### TABEL 6b — MAX31855 Modul Sensor Suhu (× 3 unit) — Updated

| No | Modul | Pin Modul | → Disambung ke | Keterangan |
|----|-------|-----------|----------------|------------|
| 1 | MAX31855 #1 (R. Produk Kiri) | VCC | **AMS1117 OUT (3.3V)** | ✅ Bukan dari ESP32 lagi |
| 2 | | GND | Common GND | |
| 3 | | SCK | ESP32 → GPIO18 | Shared SPI Clock |
| 4 | | SO (MISO) | ESP32 → GPIO19 | Shared SPI Data |
| 5 | | CS | ESP32 → GPIO5 | Chip Select unik |
| 6 | | TC+ / TC− | Thermocouple Type K #1 | Zona: R. Produk Kiri |
| 7 | MAX31855 #2 (R. Produk Kanan) | VCC | **AMS1117 OUT (3.3V)** | ✅ Bukan dari ESP32 lagi |
| 8 | | GND | Common GND | |
| 9 | | SCK | ESP32 → GPIO18 | Shared |
| 10 | | SO (MISO) | ESP32 → GPIO19 | Shared |
| 11 | | CS | ESP32 → GPIO17 | Chip Select unik |
| 12 | | TC+ / TC− | Thermocouple Type K #2 | Zona: R. Produk Kanan |
| 13 | MAX31855 #3 (R. Pembakaran) | VCC | **AMS1117 OUT (3.3V)** | ✅ Bukan dari ESP32 lagi |
| 14 | | GND | Common GND | |
| 15 | | SCK | ESP32 → GPIO18 | Shared |
| 16 | | SO (MISO) | ESP32 → GPIO19 | Shared |
| 17 | | CS | ESP32 → GPIO16 | Chip Select unik |
| 18 | | TC+ / TC− | Thermocouple Type K #3 | Zona: R. Pembakaran |

---

### TABEL 7 — Relay 5V + Sirine/Buzzer 12V (Alarm)

| No | Komponen | Pin | → Disambung ke | Keterangan |
|----|----------|-----|----------------|------------|
| 1 | Relay 1ch 5V | VCC | HLK-5M05 → Vout (+5V) | Suplai daya relay |
| 2 | | GND | ESP32 → GND / HLK-5M05 GND | Harus common ground dgn ESP32 |
| 3 | | IN | ESP32 → GPIO25 | ⚠️ Active LOW! (LOW = relay ON) |
| 4 | | COM | HLK-PM12 → Vout (+12V) | Sumber 12V untuk sirine |
| 5 | | NO | Sirine/Buzzer → Terminal (+) | 12V mengalir saat relay aktif |
| 6 | Sirine BJ-1KL 12V | Terminal (+) | Relay → NO | Dapat 12V dari relay |
| 7 | | Terminal (−) | HLK-PM12 → GND (−) | ⚠️ GND HLK-PM12, BUKAN GND ESP32! |

---

### TABEL 8 — Decoupling Capacitor (Proteksi ESP32)

| No | Komponen | Kaki 1 | Kaki 2 | Posisi Pemasangan |
|----|----------|--------|--------|-------------------|
| 1 | Kapasitor Elco 100µF 16V | Kaki (+) panjang → Jalur +5V VIN | Kaki (−) garis abu² → Jalur GND | SEDEKAT mungkin ke pin VIN ESP32 |
| 2 | Kapasitor Keramik 100nF | Kaki manapun → Jalur +5V VIN | Kaki satunya → Jalur GND | MENEMPEL dekat pin VIN ESP32 |

> Kedua kapasitor dipasang PARALEL antara VIN dan GND.
> Posisi: SETELAH percabangan kabel relay, sedekat mungkin ke ESP32.
> ⚠️ Elco ada polaritas! Kaki dengan garis abu-abu (−) WAJIB ke GND. Terbalik = meledak!

---

### TABEL 9 — RC Snubber (Proteksi Kontaktor) × 2 Modul

| No | Modul RC | Lubang Terminal Hijau | → Disambung ke | Keterangan |
|----|----------|----------------------|----------------|------------|
| 1 | RC Snubber #1 | Lubang kiri | NXC-09 #1 → Baut A1 | Gabung satu baut dengan kabel dari SSR #1 |
| 2 | | Lubang kanan | NXC-09 #1 → Baut A2 | Gabung satu baut dengan kabel netral |
| 3 | RC Snubber #2 | Lubang kiri | NXC-09 #2 → Baut A1 | Gabung satu baut dengan kabel dari SSR #2 |
| 4 | | Lubang kanan | NXC-09 #2 → Baut A2 | Gabung satu baut dengan kabel netral |

> Modul RC Snubber tidak ada polaritas (bolak-balik bebas).
> Fungsi: Meredam voltage spike dari coil kontaktor saat dimatikan agar SSR tidak rusak.

---

## ⚠️ PANDUAN KABEL — Jenis, Ukuran & Zona Bahaya (Update 18 Mei 2026)

### Mengapa TIDAK BISA pakai AWG 22 / AWG 23 untuk jalur AC?

| Ukuran | Cross-section | Ampacity (bundled) | Cocok untuk |
|--------|--------------|-------------------|-------------|
| AWG 22 | 0,33 mm² | ~0,3–0,5A | Sinyal DC, data, GPIO |
| AWG 23 | 0,26 mm² | ~0,2–0,3A | Sinyal DC saja |
| NYA/NYAF 1,5 mm² | 1,5 mm² | ~10A | AC lighting, PSU low-power |
| NYA/NYAF 2,5 mm² | 2,5 mm² | ~16A | AC motor, MCB utama |

> ❌ AWG 22/23 adalah kabel sinyal, **TIDAK BOLEH** dialiri arus AC 220V motor/MCB.
> ✅ AWG 22/23 **boleh digunakan** untuk jalur DC tegangan rendah: ESP32 GPIO → SSR pin DC, jalur SPI sensor, jalur relay DC, jalur GND signal.

### Aturan pemilihan kabel: 3 hal utama

1. **Ampacity (kemampuan arus)** — pilih kabel yang mampu minimal 1,25× arus maksimal jalur
2. **Tegangan rated** — kabel AC 220V harus rated minimal 300V (NYA/NYAF standar 450/750V ✓)
3. **Suhu lingkungan** — di dalam panel bisa panas, pilih yang tahan 70°C (NYA/NYAF standar ✓)

### Peta warna & jenis kabel per jalur

| Jalur | Jenis Kabel | Ukuran | Warna |
|-------|------------|--------|-------|
| Fasa masuk PLN → MCB Utama | NYA | 2,5 mm² | Merah |
| MCB Utama → MCB Blower | NYA | 2,5 mm² | Merah |
| MCB Utama → HLK-5M05 L | NYA | 1,5 mm² | Merah |
| MCB Utama → HLK-PM12 L | NYA | 1,5 mm² | Merah |
| Netral (N-Bus ke semua) | NYA | 1,5–2,5 mm² | Biru |
| Ground (PE) | NYA | 2,5 mm² | Kuning-hijau |
| MCB Blower → SSR AC pin 1 | NYA | 1,5 mm² | Merah |
| MCB Blower → NXC-09 1/L1 | NYA | 1,5 mm² | Merah |
| SSR AC pin 2 → NXC-09 A1 | NYA | 1,5 mm² | Merah |
| NXC-09 2/T1 → Motor | NYA | 1,5 mm² | Merah |
| HLK-5M05 +5V → AMS1117 IN | AWG 22 OK / NYAF 0,5 mm² | 0,5 mm² | Merah/Oranye |
| AMS1117 OUT +3,3V → MAX31855 VCC | AWG 22 ✓ | 0,33 mm² | Oranye |
| ESP32 GPIO → SSR DC+ (Koneksi Langsung) | AWG 22 ✓ | 0,33 mm² | Kuning |
| SPI (SCK, MISO, CS) | AWG 22 ✓ | 0,33 mm² | Putih/Abu |
| GND signal | AWG 22 ✓ | 0,33 mm² | Hitam |
| Relay IN → GPIO25 | AWG 22 ✓ | 0,33 mm² | Kuning |
| HLK-PM12 +12V → relay COM | AWG 22 / NYAF 0,5 mm² | 0,5 mm² | Oranye |
| Relay NO → Sirine + | NYAF 0,5 mm² | 0,5 mm² | Oranye |

### 🔴 Zona Bahaya — Bagian yang Paling Wajib Diperhatikan

| No | Zona | Risiko | Tindakan |
|----|------|--------|----------|
| 1 | **Kabel AC ke motor blower** (NXC-09 → motor) | Kabel terlalu kecil → panas → kebakaran | Pakai NYA/NYAF min 1,5mm², ikat rapi jangan menekuk tajam |
| 2 | **SSR Fotek (sisi AC)** | Tanpa heatsink → SSR overheat, short internal, meledak | Heatsink 100×100mm + thermal paste **wajib** |
| 3 | **GPIO ESP32 → SSR pin DC** | Ditambah resistor 330Ω → Tegangan drop ke ~1.2V (SSR tidak mau ON) | Koneksi **langsung** tanpa resistor. SSR tipe 3-32VDC sudah memiliki regulator arus internal yang aman bagi GPIO ESP32. |
| 4 | **Coil kontaktor NXC-09** | Voltage spike saat OFF → merusak SSR | RC Snubber 100Ω + 0,1µF 250VAC paralel A1-A2 **wajib** |
| 5 | **Relay sirine (active LOW)** | Jika GPIO25 tidak diinisialisasi HIGH → sirine bunyi terus saat boot | `digitalWrite(ALARM_PIN, HIGH)` di **baris pertama** `setup()` |
| 6 | **GND sirine 12V** | Jika GND sirine ke GND ESP32 → noise/kerusakan ESP32 | GND sirine **harus** ke GND HLK-PM12, bukan GND ESP32 |
| 7 | **MCB Blower 6A → 1/L1 NXC-09** | Jika tidak langsung (diambil dari SSR) → motor tidak jalan atau kontaktor tidak pull-in benar | Pastikan 1/L1 dapat fasa **langsung** dari MCB Blower |
| 8 | **Kapasitor elektrolit decoupling** | Polaritas terbalik → kapasitor meledak | Cek orientasi (+) dan (−) sebelum power on |
| 9 | **AMS1117 tanpa decoupling cap** | Tanpa cap → output AMS1117 berosilasi → sensor MAX31855 baca error/noise | 10µF + 100nF di IN dan OUT AMS1117 **wajib** |
| 10 | **Kabel TC thermocouple** | Pakai kabel biasa (bukan kompensasi Type K) → error suhu besar, data tidak valid | Wajib pakai **kabel kompensasi Type K** (warna kuning/merah khas) |
