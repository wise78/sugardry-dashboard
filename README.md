# 🥥 SugarDry IoT Dashboard

Dashboard Monitoring Real-time untuk Sistem Pengering Gula Semut Kelapa berbasisi Internet of Things (IoT). Proyek kolaborasi riset: **Universitas Jenderal Soedirman (UNSOED) × Central Agro Lestari**.

![Status](https://img.shields.io/badge/Status-Development-orange)
![Tech Stack](https://img.shields.io/badge/Tech-HTML%20%7C%20CSS%20%7C%20JS-blue)

## 📌 Fitur Utama
Sistem ini dirancang untuk kemudahan pemantauan mesin oven di lingkungan industri skala menengah-kecil:
1. **Real-time Monitoring:** Memantau Suhu Ruang Produk (Kiri & Kanan) serta Ruang Pembakaran secara langsung dari jarak jauh via integrasi sensor fisik (MAX31855 & ESP32).
2. **Pencatatan Pre-Batch & Post-Batch:** Memasukkan parameter kritis operator sebelum pengovenan (seperti Moisture Content/MC awal, Mode Blower) dan hasil pasca-pengovenan untuk dikalkulasi otomatis efisiensinya.
3. **Manajemen Mesin:** Pendaftaran mesin *dryer* baru beserta spesifikasi volume bakar dan kapasitasnya dengan antarmuka dinamis.
4. **Log Alarm Otomatis:** Histori *safety event* mesin (misal: "Suhu Burner mendekati batas atas" atau "Cooling Phase ON").

## 🛠 Instalasi dan Menjalankan Proyek
Proyek ini dibangun murni menggunakan *Vanilla* HTML, CSS, dan JavaScript tanpa perlu kompilasi (No build step).

1. Clone repositori ini ke komputer lokal Anda:
   ```bash
   git clone https://github.com/wise78/sugardry-dashboard.git
   ```
2. Buka folder proyek:
   ```bash
   cd sugardry-dashboard
   ```
3. Buka file `index.html` dengan *web browser* apa pun (disarankan Google Chrome). 
   *(Atau gunakan ekstensi VS Code seperti "Live Server" untuk pengalaman pengembangan terbaik).*

## 📡 Arsitektur IoT (Rencana Deployment)
Versi *production* dari dashboard ini akan berkomunikasi dengan perangkat lunak dan perangkat keras berikut:
* **Perangkat Keras:** ESP32-WROOM-32U, Sensor Termokopel MAX31855, Solid State Relay (SSR), Kontaktor NXC-09, dan Blower AC. 
* **Protokol:** Komunikasi *Real-time* melalui MQTT dengan WebSocket Secure (WSS).
* **Broker:** HiveMQ Cloud (Serverless MQTT).
* **Basis Data:** Google Firebase Realtime Database.
* **Hosting:** Vercel / Netlify.

---
*Dibuat untuk Tugas Akhir / Capstone Project Teknik*
