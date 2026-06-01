# 🔌 Wiring Infrastructure Guide — Panel Box Coconut Sugar Dryer
**Tanggal:** 07 Mei 2026 | **Update:** 08 Mei 2026 (Analisis kabel + koreksi diagram)

---

## 🆕 BAGIAN 0 — Koreksi Kabel: AWG vs NYAF, Ukuran & Warna

### Bedanya AWG dan NYAF

**NYAF** = standar kabel Indonesia (IEC), serabut, fleksibel, dipakai untuk instalasi dalam panel. Satuannya mm².

**AWG** = standar Amerika, biasa dipakai di dunia elektronik (Arduino, breadboard, PCB). Makin besar nomor AWG, makin TIPIS kabelnya.

Konversi penting:

- AWG24 ≈ 0.2mm² → untuk sinyal (SPI, GPIO)
- AWG22 ≈ 0.35mm² → untuk sinyal + DC kecil
- AWG20 ≈ 0.5mm² → untuk DC <1A
- AWG18 ≈ 0.75mm² → untuk DC 1–3A
- AWG16 ≈ 1.5mm² → untuk DC 3–5A atau AC beban ringan
- NYAF 1.5mm² ≈ AWG16 → kabel panel AC standar
- NYAF 2.5mm² ≈ AWG13 → kabel panel AC utama (PLN, motor)

---

### Tabel Spesifikasi Kabel Per Jalur

#### Zona AC — Gunakan NYAF (bukan AWG)

Jalur AC 220V wajib pakai NYAF karena lebih tahan panas, punya insulasi lebih tebal, dan sesuai standar instalasi listrik Indonesia.

**PLN masuk → MCB Utama 10A**
Gunakan NYAF 2.5mm². Warna: Merah untuk fasa (L), Biru untuk netral (N), Kuning-Hijau untuk PE (jika ada).

**MCB 10A → Splitter/TB-1 → HLK-5M05 dan HLK-PM12 (terminal L)**
Gunakan NYAF 1.5mm² warna Merah. Arus ke HLK kecil (<1A masing-masing) tapi tetap pakai NYAF karena ini jalur AC 220V.

**MCB 10A → MCB 6A**
Gunakan NYAF 2.5mm² warna Merah.

**Neutral Bus → semua beban AC (HLK N, NXC-09 A2, Motor N)**
Gunakan NYAF 1.5mm² warna Biru untuk cabang ke HLK dan kontaktor. NYAF 2.5mm² warna Biru untuk ke motor.

**MCB 6A → SSR Pin 1 dan NXC-09 L1**
Gunakan NYAF 2.5mm² warna Merah. Motor blower bisa menarik arus hingga 4–5A saat start.

**SSR Pin 2 (AC Out) → NXC-09 A1 Coil**
Gunakan NYAF 1.5mm² warna Merah. Arus coil kontaktor kecil (~1A).

**NXC-09 T1 (kontak utama OUT) → Motor Blower**
Gunakan NYAF 2.5mm² atau NYY 3×1.5mm² warna standar. Ini jalur arus motor penuh.

---

#### Zona DC — Gunakan NYAF tipis atau kabel AWG serabut

Untuk jalur DC di dalam panel dan PCB bolong, boleh pakai NYAF 0.5–1mm² atau kabel AWG fleksibel berwarna. Yang penting: serabut (bukan solid) agar mudah dirouting di PCB bolong.

**HLK-5M05 output (+5V, GND) → PCB bolong**
Gunakan NYAF 0.75mm² atau AWG18. Warna: Merah untuk +5V, Hitam untuk GND. Panjang maksimal 30cm.

**HLK-PM12 output (+12V) → Relay COM di PCB bolong**
Gunakan NYAF 0.75mm² atau AWG18. Warna: Kuning untuk +12V, Hitam untuk GND.

**HLK-PM12 GND → Ground Bar (langsung)**
Gunakan NYAF 0.75–1mm² warna Hitam.

**ESP32 GPIO (Koneksi Langsung) → Terminal di PCB → SSR Pin 3+ (DC Control)**
Gunakan AWG22–24 (kabel sinyal tipis). Warna bebas tapi konsisten, misal Oranye atau Putih.
Koneksi langsung tanpa resistor eksternal. SSR memiliki pembatas arus internal (3-32VDC) yang aman untuk ESP32.

**SSR Pin 4 (DC Control−) → Ground Bar**
Gunakan AWG22 atau NYAF 0.5mm² warna Hitam. Langsung ke Ground Bar, bukan lewat PCB bolong.

**PCB bolong GND rail → Ground Bar (satu kabel)**
Gunakan NYAF 1mm² atau AWG18 warna Hitam.

**SPI bus (CLK, MISO, CS) di PCB bolong**
Gunakan AWG24–26 (jumper wire pendek di PCB bolong). Panjang maksimal 15cm di dalam PCB.

**Thermocouple (TC+ dan TC−) dari oven ke panel**
WAJIB pakai kabel kompensasi thermocouple Type K (warna standar: Kuning+ dan Merah−, atau sesuai standar IEC: Hijau+ dan Putih−). Jangan pakai kabel biasa.

**Relay NO → Terminal sirine → Sirine BJ-1KL**
Gunakan AWG20 atau NYAF 0.5mm² warna Merah untuk +12V, Hitam untuk GND. Arus sirine ~500mA.

---

### Koreksi dari Diagram Inside Panel (Not Fix)

Dari gambar yang diunggah, terlihat beberapa hal yang perlu diperbaiki:

**1. Warna kabel AC belum konsisten**
Di diagram terlihat kabel merah dan biru dipakai bergantian untuk fasa dan netral, tapi ada beberapa jalur yang warnanya tidak sesuai standar. Pastikan: Merah = Fasa selalu, Biru = Netral selalu, tanpa pengecualian di seluruh jalur AC.

**2. Ground Bus dan Neutral Bus posisinya sudah benar (tengah panel)**
Namun Ground Bus sebaiknya dibaut langsung ke plat panel di titik terdekat, bukan hanya diletakkan di DIN rail mengambang.

**3. SSR heatsink**
Di diagram SSR terlihat tidak ada heatsink. Wajib ditambahkan — SSR tanpa heatsink bisa overheat dalam hitungan menit saat motor aktif.

**4. Kabel dari PCB bolong ke SSR (DC Control)**
Hubungkan langsung dari GPIO ESP32 ke terminal SSR tanpa resistor 330Ω, karena SSR komersial membutuhkan tegangan minimal 3.0V di terminal inputnya.

### Koreksi dari Diagram PCB Bolong

**1. Warna kabel di PCB bolong sudah cukup baik** — merah untuk power, hitam untuk GND, kuning untuk CLK, putih untuk MISO, warna berbeda untuk CS masing-masing sensor.

**2. Decoupling caps posisinya sudah benar** — terlihat dekat VIN ESP32. Pastikan kaki positif (panjang) Elco ke +5V rail, kaki negatif (bergaris) ke GND rail.

**3. Terminal ESP-SSR di tepi kiri PCB** — sudah benar, ini titik koneksi kabel ke SSR. Pastikan kabel yang keluar dari terminal ini adalah AWG22 (bukan AWG26 yang terlalu tipis untuk melewati ferrule terminal block).

**4. Relay di sudut kanan bawah** — posisi sudah baik, jauh dari area sinyal SPI sensor. Label 12V-COM dan NO sudah benar.

**5. MAX31855 ×3 di sisi kanan** — terlihat pakai kabel CLK (kuning) dan MISO (putih) shared. Sudah benar. Pastikan kabel CS ke masing-masing sensor berbeda GPIO (GPIO5, GPIO17, GPIO16).

---

### Ringkasan Pembelian Kabel

NYAF 2.5mm² merah (5 meter) → jalur fasa AC utama

NYAF 2.5mm² biru (3 meter) → jalur netral AC utama dan motor

NYAF 1.5mm² merah (2 meter) → cabang fasa ke HLK dan kontaktor coil

NYAF 1.5mm² biru (2 meter) → cabang netral ke HLK

NYAF 1mm² kuning-hijau (1 meter) → Ground Bar ke bodi panel dan GND DC

NYAF 0.75mm² merah (1 meter) → DC +5V dan +12V dari HLK ke PCB

NYAF 0.75mm² hitam (2 meter) → DC GND dari HLK ke PCB dan Ground Bar

Kabel AWG22 serabut warna-warni (1 set, biasanya 10 warna × 5m) → sinyal GPIO, SPI, dan koneksi di PCB bolong

Kabel kompensasi thermocouple Type K (3 meter × 3 pasang) → dari oven ke panel

---

## BAGIAN 1 — PCB Bolong: Apa yang Masuk dan Apa yang Tidak?

### ⚠️ HLK-5M05 dan HLK-PM12 TIDAK BOLEH di PCB Bolong yang sama dengan ESP32

**Alasan:**
- HLK-5M05 dan HLK-PM12 punya tegangan AC 220V di terminal inputnya
- PCB bolong = papan kecil, jarak antar komponen sempit → bahaya sentuh
- Modul HLK panas saat beroperasi → bisa merusak komponen DC di sekitarnya
- Butuh mounting yang kuat (baut ke panel), bukan hanya disolder ke PCB bolong

---

### Layout: 2 Area Terpisah

```
PANEL BOX
│
├── [AREA KIRI — AC Zone]
│   ├── MCB Utama 10A          → baut ke DIN rail
│   ├── MCB Blower 6A          → baut ke DIN rail
│   ├── SSR-25DA ×2            → baut ke plat panel + heatsink
│   ├── NXC-09 ×2              → baut ke DIN rail
│   ├── RC Snubber ×2          → klem di terminal A1-A2 kontaktor
│   ├── HLK-5M05               → baut ke DIN rail (pakai DIN rail clip) ATAU baut ke plat panel
│   └── HLK-PM12               → baut ke DIN rail / plat panel
│
└── [AREA KANAN — DC Zone]
    └── PCB BOLONG (satu papan):
        ├── ESP32 DevKit        (disokong dengan spacer plastik 5mm di atas PCB)
        ├── MAX31855 ×3         (disolder/dipasang di PCB)
        ├── Relay 1ch 5V        (dipasang di PCB)
        ├── Koneksi Langsung (tanpa resistor 330Ω ke jalur GPIO Blower)
        └── Decoupling Caps     (100µF + 100nF, disolder dekat VIN ESP32)
```

### Koneksi HLK ke PCB Bolong

```
HLK-5M05 (terpisah, di area AC zone)
  Output (+5V) ──── NYAF 0.75mm² MERAH ──→ +5V rail PCB bolong (via terminal masuk PCB)
  Output (GND) ──── NYAF 0.75mm² HITAM ──→ GND rail PCB bolong

HLK-PM12 (terpisah, di area AC zone)
  Output (+12V) ─── NYAF 0.75mm² KUNING ─→ Terminal COM Relay di PCB bolong
  Output (GND) ──── NYAF 0.75mm² HITAM ──→ Ground Bar (langsung, bukan lewat PCB)
```

> Kabel output DC dari HLK ke PCB bolong maksimal **30cm** dan jangan paralel dengan kabel AC

---

### Cara Mounting HLK di Panel (Tanpa PCB)

**Opsi A — DIN Rail (paling rapi):**
Beli **DIN Rail mount bracket untuk HLK** (ada di Tokopedia, ~Rp 5.000/pc)  
HLK diklik langsung ke DIN rail di area AC zone

**Opsi B — Baut ke plat panel:**
Gunakan **spacer PCB M3** (plastik) + baut M3 untuk melekatkan HLK ke plat panel  
Tambahkan label "AC 220V — JANGAN SENTUH"

---

## BAGIAN 2 — Socket / Koneksi Masuk Kabel PLN

### Rekomendasi: Cable Gland (Bukan Socket Lepas)

Untuk panel box permanen dengan kabel PLN yang tidak perlu sering dicabut, gunakan **Cable Gland (Klem Kabel)**:

| Komponen | Spec | Harga | Fungsi |
|----------|------|-------|--------|
| **Cable Gland PG13.5** | Nilon atau Brass, untuk kabel ∅6–12mm | Rp 3.000–8.000/pc | Strain relief + seal masuk kabel PLN |
| **Cable Gland M20** | Setara PG13.5, thread M20 | Rp 3.000–8.000/pc | Alternatif |

**Cara pasang:**
1. Bor lubang di bawah panel (∅20–22mm)
2. Pasang cable gland, kencangkan ring luar
3. Masukkan kabel PLN (L+N, atau L+N+PE jika ada) lewat cable gland
4. Kencangkan cable gland → kabel tidak bisa ditarik-tarik (strain relief)

---

### Alternatif: IEC C14 Panel Mount (jika ingin bisa dicabut — untuk lab/prototype)

Jika panel ingin bisa dicabut dari sumber PLN dengan mudah (untuk demo/capstone):

| Komponen | Spec | Harga | Keterangan |
|----------|------|-------|------------|
| **IEC C14 Panel Mount Inlet** | 10A 250VAC, 2-pin atau 3-pin | Rp 8.000–20.000 | Seperti colokan belakang PC |
| **Kabel IEC C13** | 2-pin atau 3-pin, panjang 1.5m | Rp 15.000–30.000 | Kabel power PC biasa |

**Pasang IEC C14 di bawah/samping panel → colokan ke stop kontak PLN**

> ⚠️ IEC C14 2-pin hanya untuk L dan N. Tidak ada PE. Untuk capstone lab ini CUKUP.  
> ⚠️ Rating max 10A — pastikan beban total sistem tidak melebihi 10A

---

## BAGIAN 3 — Topologi Wiring yang Kamu Usulkan (BENAR! ✅)

Kamu sudah benar. Ini konfirmasinya dengan flow lengkap:

```
PLN 220V AC
│
▼ [Cable Gland / IEC C14]
│
▼ [MCB UTAMA 10A] ──────────── (proteksi seluruh sistem)
│
▼ [TERMINAL DISTRIBUSI FASA MCB 10A] ← titik percabangan utama
│
├──────────→ [HLK-5M05 terminal L]  (PSU 5V)
├──────────→ [HLK-PM12 terminal L]  (PSU 12V)
└──────────→ [MCB BLOWER 6A IN]
             │
             ▼ [TERMINAL DISTRIBUSI FASA MCB 6A] ← titik percabangan blower
             │
             ├──→ [SSR #1 — Pin 1 AC Load IN]
             ├──→ [SSR #2 — Pin 1 AC Load IN]
             ├──→ [NXC-09 #1 — Terminal 1/L1 (kontak utama IN)]
             └──→ [NXC-09 #2 — Terminal 1/L1 (kontak utama IN)]

[NEUTRAL BUS] ← semua netral AC terminasi di sini
│
├── PLN Netral (N) masuk
├── HLK-5M05 terminal N
├── HLK-PM12 terminal N
├── NXC-09 #1 A2 (coil return)
├── NXC-09 #2 A2 (coil return)
├── Motor #1 terminal N (keluar panel)
└── Motor #2 terminal N (keluar panel)

[GROUND BAR] ← semua PE dan GND DC terminasi di sini
│
├── Baut ke bodi panel (logam ke logam)
├── GND output HLK-5M05
├── GND output HLK-PM12
├── ESP32 GND (semua pin)
├── MAX31855 GND ×3
├── Relay GND
├── Motor #1 PE (jika ada kabel PE ke motor)
├── Motor #2 PE (jika ada kabel PE ke motor)
└── [Opsional] Earth Rod / PE dari instalasi PLN
```

---

## BAGIAN 4 — Daftar Terminal yang Kamu Butuhkan

### 📋 Terminal Block DIN Rail (tipe UK 2.5 atau setara)

> Ini adalah terminal block individual yang bisa dirangkai di DIN rail. Beli per-piece atau per-set.

---

#### 🔴 TB-1: Terminal Distribusi Fasa MCB 10A Output

| Detail | Spec |
|--------|------|
| Warna | **Merah** |
| Ukuran kabel | 2.5mm² |
| Jumlah posisi | **4 terminal** |
| Fungsi | Distribusi fasa dari MCB 10A ke: HLK-5M05, HLK-PM12, MCB 6A, (spare) |
| Tipe | DIN rail terminal block UK2.5 merah |
| Harga | ~Rp 3.000–5.000/pc → total ~Rp 12.000–20.000 |

Wiring di TB-1:
```
[MCB 10A OUT] → masuk TB-1 posisi 1
TB-1 pos 1 ← jumper → pos 2 ← jumper → pos 3 ← jumper → pos 4
│               │               │               │
↓               ↓               ↓               ↓
HLK-5M05 L   HLK-PM12 L   MCB Blower 6A IN   (spare)
```
> **Catatan:** Gunakan **jumper terminal block** (short circuit bar) untuk menghubungkan semua posisi TB-1 → satu kabel masuk dari MCB 10A, 3 kabel keluar

---

#### 🔴 TB-2: Terminal Distribusi Fasa MCB 6A Output

| Detail | Spec |
|--------|------|
| Warna | **Merah** |
| Ukuran kabel | 2.5mm² |
| Jumlah posisi | **4 terminal** |
| Fungsi | Distribusi fasa dari MCB 6A ke: SSR#1, SSR#2, NXC-09#1 L1, NXC-09#2 L1 |
| Tipe | DIN rail terminal block UK2.5 merah |
| Harga | ~Rp 12.000–20.000 |

Wiring di TB-2:
```
[MCB 6A OUT] → masuk TB-2 (dijumper semua)
TB-2 pos 1 → SSR #1 Pin 1 (AC Load IN)
TB-2 pos 2 → SSR #2 Pin 1 (AC Load IN)
TB-2 pos 3 → NXC-09 #1 terminal 1/L1
TB-2 pos 4 → NXC-09 #2 terminal 1/L1
```

---

#### 🔵 TB-3: Neutral Bus Bar

| Detail | Spec |
|--------|------|
| Warna | **Biru** |
| Ukuran kabel | 2.5mm² |
| Jumlah posisi | **8 terminal** |
| Fungsi | Common neutral untuk semua beban AC |
| Tipe | DIN Rail Neutral Bus Bar biru (beli 1 set isi 10) atau terminal UK2.5 biru dijumper |
| Harga | ~Rp 15.000–35.000 (set) |

Koneksi ke Neutral Bus:
```
[PLN Netral masuk]      → pos 1
[HLK-5M05 terminal N]   → pos 2
[HLK-PM12 terminal N]   → pos 3
[NXC-09 #1 A2 coil]     → pos 4
[NXC-09 #2 A2 coil]     → pos 5
[Motor #1 Netral keluar] → pos 6
[Motor #2 Netral keluar] → pos 7
[spare]                  → pos 8
```

---

#### 🟡 TB-4: Ground Bar (PE Bar)

| Detail | Spec |
|--------|------|
| Warna | **Kuning-Hijau** |
| Ukuran kabel | 1.5–2.5mm² |
| Jumlah posisi | **8 terminal** |
| Fungsi | Reference ground DC + PE seluruh sistem |
| Tipe | DIN Rail Ground Bar / PE Bar kuning-hijau |
| Harga | ~Rp 15.000–35.000 (set) |

Koneksi ke Ground Bar:
```
[Baut ke bodi panel]      → (kontak logam langsung, KUPAS CAT!)
[GND output HLK-5M05]    → pos 1
[GND output HLK-PM12]    → pos 2
[ESP32 GND]               → pos 3
[MAX31855 GND ×3]         → pos 4 (bisa dijumper ke ESP32 GND di PCB bolong)
[Relay GND]               → pos 5
[Motor #1 PE]             → pos 6 (jika kabel motor 3-inti)
[Motor #2 PE]             → pos 7 (jika kabel motor 3-inti)
```

---

#### 🟠 TB-5: Terminal Kabel Motor Output (keluar panel)

| Detail | Spec |
|--------|------|
| Warna | Merah (fasa) + Biru (netral) |
| Ukuran kabel | 2.5mm² |
| Jumlah posisi | **4 terminal** (2 merah + 2 biru, atau 6 jika ada PE) |
| Fungsi | Titik terminasi kabel ke motor blower #1 dan #2 |
| Tipe | UK2.5 standard |
| Harga | ~Rp 12.000–20.000 |

```
TB-5 pos 1 (merah) ← dari NXC-09 #1 T1 → ke Motor #1 L (via cable gland)
TB-5 pos 2 (biru)  ← dari Neutral Bus   → ke Motor #1 N (via cable gland)
TB-5 pos 3 (merah) ← dari NXC-09 #2 T1 → ke Motor #2 L (via cable gland)
TB-5 pos 4 (biru)  ← dari Neutral Bus   → ke Motor #2 N (via cable gland)
```

> Gunakan terminal blok ini sebagai "break point" → kabel motor bisa dilepas tanpa buka panel

---

#### 🟤 TB-6: Terminal Kabel Thermocouple Masuk (dari oven ke panel)

| Detail | Spec |
|--------|------|
| Warna | Bebas (beri label TC1+, TC1−, TC2+, TC2−, TC3+, TC3−) |
| Ukuran kabel | 0.5–1mm² (kabel kompensasi thermocouple tipis) |
| Jumlah posisi | **6 terminal** |
| Fungsi | Titik koneksi kabel kompensasi thermocouple ke modul MAX31855 |
| Tipe | UK1.5 atau UK2.5 (bisa yang lebih kecil) |
| Harga | ~Rp 12.000–18.000 |

```
TB-6 pos 1 (TC1+) ← kabel TC zona kiri (+)  → ke MAX31855 #1 TC+
TB-6 pos 2 (TC1−) ← kabel TC zona kiri (−)  → ke MAX31855 #1 TC−
TB-6 pos 3 (TC2+) ← kabel TC zona kanan (+) → ke MAX31855 #2 TC+
TB-6 pos 4 (TC2−) ← kabel TC zona kanan (−) → ke MAX31855 #2 TC−
TB-6 pos 5 (TC3+) ← kabel TC pembakaran (+) → ke MAX31855 #3 TC+
TB-6 pos 6 (TC3−) ← kabel TC pembakaran (−) → ke MAX31855 #3 TC−
```

> ⚠️ PENTING: Gunakan terminal khusus **thermocouple** jika ada (tembaga/chromel), atau pastikan terminal biasa tidak merusak karakteristik kabel kompensasi

---

#### 🔴 TB-7: Terminal Sirine Output (keluar panel)

| Detail | Spec |
|--------|------|
| Warna | Hitam/kuning |
| Ukuran kabel | 1mm² |
| Jumlah posisi | **2 terminal** |
| Fungsi | Output kabel DC 12V ke sirine BJ-1KL di luar panel |
| Tipe | UK1.5 atau UK2.5 |
| Harga | ~Rp 3.000–6.000 |

```
TB-7 pos 1 (+) ← dari Relay NO → ke Sirine terminal (+)
TB-7 pos 2 (−) ← dari HLK-PM12 GND → ke Sirine terminal (−)
```

---

## 📦 RINGKASAN TOTAL TERMINAL YANG DIBUTUHKAN

| Kode | Nama | Jml Posisi | Warna | Kabel | Harga Est. |
|------|------|:----------:|-------|-------|-----------|
| TB-1 | Distribusi Fasa MCB 10A | 4 | Merah | 2.5mm² | Rp 15.000 |
| TB-2 | Distribusi Fasa MCB 6A | 4 | Merah | 2.5mm² | Rp 15.000 |
| TB-3 | Neutral Bus Bar | 8 | Biru | 2.5mm² | Rp 25.000 |
| TB-4 | Ground Bar / PE Bar | 8 | Kuning-Hijau | 1.5–2.5mm² | Rp 25.000 |
| TB-5 | Terminal Motor Output | 4–6 | Merah+Biru | 2.5mm² | Rp 15.000 |
| TB-6 | Terminal Thermocouple Masuk | 6 | Bebas+label | 0.5–1mm² | Rp 15.000 |
| TB-7 | Terminal Sirine Output | 2 | Hitam | 1mm² | Rp 5.000 |
| — | **Jumper Bar** (untuk TB-1 & TB-2) | 2 set | — | — | Rp 5.000 |
| — | **End Bracket** + **End Cover** (per sisi terminal) | 1 set | — | — | Rp 10.000 |
| — | **Label strip / marker** | 1 set | — | — | Rp 5.000 |
| **TOTAL** | | **~36 posisi** | | | **~Rp 135.000** |

---

## 📐 Posisi Terminal di DIN Rail

```
DIN RAIL PANEL (tampak depan, kiri ke kanan):

[MCB 10A] [MCB 6A] | [TB-1 Fasa 10A] | [TB-2 Fasa 6A] | [TB-3 Neutral] | [TB-4 Ground]

DIN RAIL KEDUA (atau area bawah panel):

[TB-5 Motor Out] | [TB-6 Thermocouple In] | [TB-7 Sirine Out]
```

---

## 📎 Accessories Tambahan yang Diperlukan

| Komponen | Qty | Harga | Fungsi |
|----------|:---:|-------|--------|
| Cable Gland PG13.5 (untuk kabel PLN & Motor) | 5 | Rp 5.000/pc = Rp 25.000 | Strain relief + seal |
| Cable Gland PG9 (untuk TC & Sirine) | 3 | Rp 3.000/pc = Rp 9.000 | Untuk kabel tipis |
| DIN Rail 35mm (panjang 40cm) | 2 | Rp 10.000/pc = Rp 20.000 | Mounting semua komponen |
| Jumper terminal bar (10-pin) | 2 | Rp 5.000/set | Untuk TB-1 dan TB-2 |
| Ferrule (sepatu kabel) AWG22–12 set | 1 set | Rp 25.000 | Ujung kabel rapi, tidak serabut |
| Crimping tool ferrule | 1 | Rp 35.000 | Untuk pasang ferrule |
| Label maker / sticker label | 1 set | Rp 10.000 | Labeling terminal dan kabel |

> **Ferrule / Sepatu Kabel** sangat disarankan — kabel serabut tanpa ferrule bisa longgar di terminal block, menyebabkan arc/percikan

---

## ✅ CHECKLIST URUTAN PASANG TERMINAL

- [ ] Pasang DIN rail di panel
- [ ] Pasang Ground Bar → baut ke bodi panel (kupas cat!)
- [ ] Pasang Neutral Bus
- [ ] Pasang TB-1 (fasa MCB 10A), pasang jumper bar
- [ ] Pasang TB-2 (fasa MCB 6A), pasang jumper bar
- [ ] Pasang TB-5 (motor output)
- [ ] Pasang TB-6 (thermocouple input)
- [ ] Pasang TB-7 (sirine output)
- [ ] Label semua terminal sebelum mulai wiring
- [ ] Crimp ferrule di semua ujung kabel serabut
- [ ] Mulai wiring AC (dari MCB ke terminal ke komponen)
- [ ] Mulai wiring DC (dari PSU ke PCB bolong ke sensor)
