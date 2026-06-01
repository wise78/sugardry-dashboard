# Entity Relationship Diagram (ERD)

Berdasarkan *Data Flow Diagram* (terutama struktur data yang tertangkap pada D1 dan D2), berikut adalah model basis data relasional (ERD) yang menjabarkan entitas dan atribut untuk penyimpanan data cloud Anda. Struktur ini sangat optimal dipakai sebagai dasar perancangan *database* lokal (MySQL/PostgreSQL) maupun NoSQL yang memfasilitasi kebutuhan *Machine Learning* ke depannya.

```mermaid
erDiagram
    %% Entitas Utama
    OPERATOR {
        int id_operator PK
        string nama_operator
        string kontak
    }

    MESIN_OVEN {
        int id_mesin PK
        string nama_mesin "Contoh: Dryer 01"
        float kapasitas_total_kg
        float volume_ruang_bakar
        float volume_ruang_produk
        int rpm_blower
    }

    BATCH_PENGOVENAN {
        int id_batch PK
        int id_mesin FK
        int id_operator FK
        datetime waktu_mulai
        datetime waktu_selesai
        %% Data Pre-Batch
        float mc_awal_persen
        float berat_awal_kg
        int jml_kompor_menyala
        int tipe_gas_kg "3, 5, atau 12"
        string mode_blower "Efisien / Turbo / Custom"
        %% Data Auto-Log & Calculated
        int durasi_aktual_menit
        %% Data Post-Batch
        float mc_akhir_persen
        float berat_akhir_mesh_kg
        float berat_akhir_brontol_kg
        float total_susut_kg
        float efisiensi_score
    }

    LOG_TELEMETRI {
        int id_log PK
        int id_batch FK
        datetime timestamp
        float suhu_produk_kiri
        float suhu_produk_kanan
        float suhu_pembakaran
        boolean status_blower_1
        boolean status_blower_2
    }

    EVENT_ALARM {
        int id_alarm PK
        int id_batch FK
        datetime timestamp
        string jenis_alarm "KOMPOR_MATI / ANOMALI / SELESAI"
        string deskripsi
    }

    %% Relasi (Relationships)
    OPERATOR ||--o{ BATCH_PENGOVENAN : "menjalankan"
    MESIN_OVEN ||--o{ BATCH_PENGOVENAN : "tempat terjadinya"
    BATCH_PENGOVENAN ||--o{ LOG_TELEMETRI : "merekam (time-series)"
    BATCH_PENGOVENAN ||--o{ EVENT_ALARM : "memiliki riwayat"
```

---

### Penjelasan Relasi & Tabel:

1. **`MESIN_OVEN` (Master Data):** Menyimpan spesifikasi teknis alat. Atributnya merujuk ke parameter *Pre-Batch* dari dokumen excel mitra. Satu mesin bisa dipakai berulang kali untuk banyak batch (1 ke Banyak).
2. **`OPERATOR` (Master Data):** Karena input pre/post batch dilakukan oleh manusia, mencatat siapa yang bertugas bisa berguna untuk validitas data model ML nantinya.
3. **`BATCH_PENGOVENAN` (Transaksi Utama / D1):** Ini adalah jantung dari program. Tabel ini menggabungkan *input manual* sebelum masak, *input manual* sesudah masak, dan ringkasan performa yang diolah mesin. Dalam konteks Machine Learning, satu buah *row* di tabel `BATCH_PENGOVENAN` akan menjadi satu buah *row training data*.
4. **`LOG_TELEMETRI` (Time Series / D2):** Data yang *di-publish* oleh ESP32 setiap beberapa detik. Terhubung ke ID Batch agar saat Anda menganalisis performa pengeringan, Anda bisa merekonstruksi grafik fluktuasi suhunya dari awal sampai akhir sesi tersebut.
5. **`EVENT_ALARM`:** Terpisah dari log suhu agar *platform* gampang menghitung berapa kali oven mengalami *burn-out* (kompor mati) tanpa harus mencari di seluruh tabel telemetri yang masif.
