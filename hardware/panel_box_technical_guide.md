# 🧰 Panel Box — Pertanyaan Teknis Lanjutan
**Konteks:** Wiring 1-fasa Coconut Sugar Dryer IoT  
**Tanggal:** 07 Mei 2026

---

## ❓ PERTANYAAN 1 — Campur AC 220V + Sinyal ESP32/MAX31855 dalam satu panel, apakah aman?

### Jawaban Singkat: **Bisa, TAPI harus ada pemisahan zona dan perlakuan khusus.**

Panel yang mencampur tegangan tinggi AC (220V) dengan sinyal low-voltage DC (3.3V SPI) adalah hal **umum di industri** — disebut panel kontrol industri (MCC/PLC panel). Kuncinya adalah **segregasi zona** dan **grounding yang benar**.

---

### 🔴 Risiko Jika Tidak Ditangani

| Ancaman | Dari | Korban | Efek |
|---------|------|--------|------|
| **EMI (Elektromagnetik Interference)** | SSR switching, coil kontaktor | ESP32, MAX31855, sinyal SPI | Data suhu error / ESP32 hang |
| **Voltage spike (transient)** | Kontaktor saat OFF | SSR, ESP32 via GND | ESP32 reset/rusak |
| **Capacitive coupling** | Kabel AC dekat kabel sinyal | Kabel SPI (SCK, MISO, CS) | Noise di pembacaan suhu |
| **Ground loop** | GND DC terpisah dari GND panel | Seluruh rangkaian DC | Pembacaan sensor drift |

---

### ✅ Perlakuan Khusus yang WAJIB Dilakukan

#### A. Segregasi Zona Fisik (paling penting)
```
┌─────────────────────────────────────────────────────┐
│                    PANEL BOX                        │
│                                                     │
│  ┌─────────────────┐    ┌───────────────────────┐  │
│  │  ZONA AC (kiri) │    │  ZONA DC/Sinyal (kanan)│  │
│  │                 │    │                        │  │
│  │ MCB Utama       │    │  ESP32 DevKit          │  │
│  │ MCB Blower      │    │  MAX31855 ×3           │  │
│  │ SSR-25DA ×2     │    │  HLK-5M05 (output DC) │  │
│  │ NXC-09 ×2       │    │  HLK-PM12 (output DC) │  │
│  │ RC Snubber ×2   │    │  Relay 1ch 5V          │  │
│  │ HLK input AC    │    │  Resistor 330Ω         │  │
│  └─────────────────┘    └───────────────────────┘  │
│         ↕                          ↕                │
│    Kabel AC tebal              Kabel signal tipis   │
│    (NYA 2.5mm² merah)         (AWG22-26, warna beda)│
│                                                     │
│  ← JARAK MINIMUM 10cm antara zona AC dan zona DC → │
└─────────────────────────────────────────────────────┘
```

#### B. Routing Kabel — Jangan Paralel Kabel AC dengan Sinyal!

| ❌ JANGAN | ✅ LAKUKAN |
|----------|-----------|
| Bundel kabel AC + SPI jadi satu | Pisahkan jalur kabel AC dan sinyal (jarak ≥ 5cm) |
| Kabel SPI berjalan sejajar kabel 220V | Kabel SPI melintang tegak lurus (90°) terhadap kabel AC |
| Kabel GND DC dan netral AC di kabel yang sama | Netral AC = Neutral Bus, GND DC = GND ESP32 (terpisah) |
| Kabel thermocouple dekat kabel SSR | Thermocouple routing jauh dari jalur switching |

#### C. Perlindungan Sinyal SPI (MAX31855)

Sinyal SPI (SCK GPIO18, MISO GPIO19, CS GPIO5/16/17) rentan noise karena:
- Frekuensi SPI = 1-4 MHz → panjang gelombang pendek
- Kabel panjang = antena

**Mitigasi:**
- Panjang kabel SPI maksimum **30cm** di dalam panel
- Pasang **kapasitor 100nF** di VCC-GND tiap modul MAX31855 (bypass cap)
- Gunakan kabel twisted-pair untuk SCK/GND jika kabel > 20cm

#### D. RC Snubber — Wajib (sudah ada di diagram)
RC Snubber di terminal A1-A2 kontaktor meredam voltage spike saat coil kontaktor diputus. Ini **melindungi SSR** dari kerusakan akibat back-EMF.

#### E. Decoupling Capacitor di ESP32 VIN
Kapasitor 100µF + 100nF paralel di VIN-GND ESP32 menyaring noise tegangan supply yang diakibatkan oleh SSR switching.

---

## ❓ PERTANYAAN 2 — Panel Box dari Bahan Apa?

### Jawaban: **Panel Besi / Mild Steel (Baja Lunak) Galvanis atau Cat Powder Coat**

---

### Perbandingan Material Panel

| Material | EMI Shielding | Kekuatan Mekanikal | Harga | Grounding | Rekomendasi |
|----------|:-------------:|:------------------:|:-----:|:---------:|:-----------:|
| **Besi mild steel 1.5-2mm** (galvanis / powder coat) | ✅ Sangat baik | ✅ Baik | Rp 150-400rb | ✅ Mudah (logam) | ⭐ **PILIHAN UTAMA** |
| Stainless steel 304 | ✅ Baik | ✅ Sangat baik | Rp 500rb+ | ✅ Mudah | Overkill untuk capstone |
| Aluminium | ✅ Baik | ✅ Cukup | Rp 300-500rb | ✅ Mudah | Mahal, susah las |
| ABS Plastik (fiberglass) | ❌ NOL — tidak ada shielding | ✅ Cukup | Rp 100-200rb | ❌ Tidak bisa di-ground | **❌ JANGAN dipakai** |
| Acrylic transparan | ❌ NOL | ❌ Rapuh | Mahal | ❌ Tidak bisa di-ground | Hanya untuk display/prototype |

---

### Mengapa HARUS Besi (Steel), bukan Plastik?

#### 1. 🛡️ EMI Shielding — Faraday Cage Effect
Panel besi logam bertindak sebagai **Faraday cage** — gelombang elektromagnetik dari SSR switching dan coil kontaktor **terpantulkan/diserap** oleh dinding logam dan tidak memengaruhi komponen sensitif di luar.

Plastik = **transparan** terhadap EMI → tidak ada perlindungan sama sekali.

#### 2. ⚡ Grounding Bodi Panel
Panel logam bisa dijadikan **reference ground** (PE) → baut ground bar langsung ke plat panel → seluruh bodi panel jadi conductor yang aman. Saat ada short circuit ke bodi, arus mengalir ke ground bar → MCB trip.

Plastik = tidak bisa di-ground → jika ada kabel AC lepas menyentuh plastik, **tidak ada trip, bahaya setrum**.

#### 3. 🔥 Tahan Panas
SSR menghasilkan panas saat switching → panel besi berfungsi sebagai **heat spreader pasif**. Heatsink SSR yang menempel ke plat besi mendistribusikan panas ke seluruh bodi panel.

Plastik = melumer/deformasi jika kena panas berlebih.

#### 4. 🏭 Standar Industri
Semua panel kontrol industri (IEC 60439, SNI) menggunakan enclosure logam untuk instalasi AC 220V ke atas.

---

### Spesifikasi Panel yang Disarankan untuk Proyek Ini

| Parameter | Spec |
|-----------|------|
| Material | Mild steel 1.5mm–2mm, powder coat / galvanis |
| Ukuran | **400mm × 300mm × 200mm** (P×L×D) atau lebih besar |
| IP Rating | **IP54** minimum (tahan debu + percikan air — mesin oven punya uap) |
| Warna | Abu-abu RAL7035 (standar panel listrik) |
| Pintu | Single door dengan kunci / baut |
| DIN Rail | Sudah built-in atau pasang sendiri (35mm DIN rail) |
| Ventilasi | Lubang ventilasi berfilter di atas (atau pasang small fan 24V DC) |
| Harga estimasi | Rp 150.000 – Rp 350.000 (toko listrik/tokopedia) |

> **Keyword pencarian:** *"panel box besi 40x30 IP54"* atau *"enclosure metal 400x300 DIN rail"*

---

## ❓ PERTANYAAN 3 — Ground Bar Konek ke Mana? (Wiring 1-Fasa Tanpa PE dari PLN)

### Konteks Masalah
Di wiring barumu (1 fasa), PLN masuk hanya **2 kabel: Fasa (L) dan Netral (N)**. Tidak ada kabel ketiga PE (Protective Earth / kuning-hijau) dari instalasi rumah. Lalu **Ground Bar di panel konek ke mana?**

---

### Jawaban: **Ground Bar tetap WAJIB ada dan konek ke BODI PANEL**

#### Konsep Dasar: Functional Ground vs. Protective Earth

| Istilah | Definisi | Konek ke |
|---------|----------|----------|
| **Protective Earth (PE)** | Ground dari PLN, dari tiang listrik ke tanah | Tiang PLN → meteran → instalasi rumah |
| **Functional Ground (FG)** | Ground referensi sinyal DC dalam panel | GND DC semua komponen DC |
| **Ground Bar** | Busbar logam untuk terminasi semua grounding | Bodi panel (logam) |
| **Bodi Panel** | Enclosure besi panel | Ground Bar → baut ke plat besi panel |

---

### Skema Koneksi Ground Bar (Wiring 1-Fasa Tanpa PE dari PLN)

```
INSTALASI PLN (1 Fasa)
     │
     ├── Kabel FASA (merah)  ──────────────→ MCB Utama IN
     └── Kabel NETRAL (biru) ──────────────→ Neutral Bus

GROUND BAR (dalam panel)
     │
     ├── Baut ke BODI PANEL (kontak logam ke logam, cat dikupas!)
     │
     ├── HLK-5M05 → kaki GND output DC (-)  ──── ke Ground Bar
     ├── HLK-PM12 → kaki GND output DC (-)  ──── ke Ground Bar  
     ├── ESP32 GND ─────────────────────────── ke Ground Bar
     ├── MAX31855 GND (×3) ─────────────────── ke Ground Bar
     ├── Relay GND ─────────────────────────── ke Ground Bar
     ├── Heatsink SSR (opsional, via baut ke panel) ── ke Ground Bar
     │
     └── [Opsional - jika ada kabel PE dari PLN]
           └── PE dari instalasi rumah ────── ke Ground Bar
```

---

### Situasi Spesifik: Tidak Ada Kabel PE dari PLN

Jika lokasi pemasangan **tidak memiliki grounding PLN** (instalasi lama 2 kabel saja):

#### Opsi A — Pasang Earth Electrode Sendiri (paling benar)
Tancapkan **ground rod** (batang tembaga/besi galvanis ∅1cm, panjang 1-2m) ke tanah dekat panel.  
Sambungkan: **Ground Rod → Ground Bar panel** dengan kabel kuning-hijau NYA 2.5mm²

Ini yang paling benar secara keselamatan. Arus bocor punya jalur ke bumi.

#### Opsi B — Functional Ground tanpa Earth Electrode (untuk capstone/lab)
Ground Bar hanya terhubung ke bodi panel tanpa koneksi ke bumi fisik.

**Fungsinya:**
- Semua GND DC (ESP32, sensor, relay) punya referensi yang sama → **sistem DC bekerja normal**
- Bodi panel jadi referensi GND → **shielding EMI tetap berfungsi**
- **TIDAK ADA proteksi shock** jika kabel AC bocor ke bodi panel

**Untuk capstone (lab/demo):**
- Opsi B **cukup aman jika:**
  - MCB ada dan berfungsi
  - Panel tidak disentuh saat beroperasi
  - Satu orang yang paham yang menyalakan sistem

> ⚠️ Untuk instalasi permanen di lapangan/pabrik, **Opsi A wajib diimplementasikan**.

---

### Mengapa GND DC WAJIB ke Ground Bar (bukan mengambang)?

```
Kondisi SALAH (GND DC mengambang):
  ESP32 GND ──── floating (tidak ke mana-mana)
  → Noise SSR masuk lewat coupling → ESP32 crash
  → MAX31855 baca suhu error ±50°C
  → Relay trigger sendiri

Kondisi BENAR (GND DC ke Ground Bar → bodi panel):
  ESP32 GND ──── Ground Bar ──── Bodi Panel (logam)
  → Bodi panel jadi "sink" untuk noise
  → Noise terdisipasi ke bodi, bukan masuk ke sinyal
  → Pembacaan MAX31855 stabil
```

Panel logam + Ground Bar yang terhubung = **praktis seperti Faraday cage dengan referensi tunggal**.

---

### Ringkasan Koneksi Ground Bar

```
Ground Bar (logam, dibaut ke bodi panel)
├── [WAJIB] Baut ke plat besi panel (kupas cat di titik kontak!)
├── [WAJIB] GND output HLK-5M05 (−5V)
├── [WAJIB] GND output HLK-PM12 (−12V)  
├── [WAJIB] GND ESP32 (semua pin GND)
├── [WAJIB] GND MAX31855 ×3
├── [WAJIB] GND Relay 1ch
├── [OPSIONAL] Heatsink SSR (baut ke panel = otomatis terhubung)
└── [JIKA ADA] Kabel PE dari instalasi PLN atau Earth Rod
```

**Kabel untuk Ground Bar:** NYA / NYAF kuning-hijau, minimal 1.5mm²

---

## 📌 KESIMPULAN TIGA PERTANYAAN

| Pertanyaan | Jawaban Singkat |
|------------|-----------------|
| Campur AC + sinyal ESP32? | ✅ Aman JIKA ada **segregasi zona fisik** (kiri=AC, kanan=DC/sinyal), kabel AC dan sinyal tidak bundel/paralel, RC Snubber & decoupling cap terpasang |
| Material panel box? | ✅ **Besi mild steel 1.5-2mm** (galvanis/powder coat), IP54, ukuran min. 400×300×200mm. Plastik ❌ dilarang keras — tidak ada EMI shielding dan tidak bisa di-ground |
| Ground Bar konek ke mana? | ✅ **Ke bodi panel** (baut langsung, kupas cat), + semua GND DC (ESP32, sensor, PSU). Jika tidak ada PE dari PLN, pasang earth rod sendiri atau gunakan functional ground untuk kondisi capstone/lab |
