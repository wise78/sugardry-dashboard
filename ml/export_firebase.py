"""
SugarDry IoT — Export Batch Data from Firebase RTDB to CSV
Mengambil data batch + telemetry dari Firebase, lalu mengubahnya
menjadi 1 row per batch dengan fitur-fitur statistik untuk training ML.

Usage:
    python export_firebase.py

Output:
    ml/data/batches_export.csv
"""

import os
import sys

import firebase_admin
from firebase_admin import credentials, db
import pandas as pd
import numpy as np


def init_firebase():
    """Initialize Firebase Admin SDK."""
    # Cari service account key
    key_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
    if not os.path.exists(key_path):
        print("❌ File serviceAccountKey.json tidak ditemukan!")
        print("   Download dari Firebase Console → Project Settings → Service Accounts")
        print(f"   Simpan di: {key_path}")
        sys.exit(1)

    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred, {
        "databaseURL": "https://sugardry-iot-default-rtdb.asia-southeast1.firebasedatabase.app"
    })
    print("✅ Firebase initialized")


def aggregate_telemetry(tele_data):
    """
    Aggregate time-series telemetry menjadi fitur statistik.

    Input:  dict of telemetry entries (dari Firebase push IDs)
    Output: dict dengan suhu_avg, suhu_std, suhu_slope, dll.
    """
    if not tele_data:
        return {
            "suhu_awal_bakar": 0, "suhu_awal_produk": 0,
            "suhu_avg_bakar": 0, "suhu_avg_produk": 0,
            "suhu_std_bakar": 0, "suhu_std_produk": 0,
            "suhu_slope_bakar": 0,
            "suhu_max_bakar": 0, "suhu_min_bakar": 0,
            "n_telemetry_points": 0,
        }

    # Sort by timestamp
    entries = sorted(tele_data.values(), key=lambda x: x.get("timestamp", 0))

    temps_bakar = [e.get("suhu_pembakaran", 0) for e in entries]
    temps_produk_kiri = [e.get("suhu_produk_kiri", 0) for e in entries]
    temps_produk_kanan = [e.get("suhu_produk_kanan", 0) for e in entries]
    temps_produk = [(k + n) / 2 for k, n in zip(temps_produk_kiri, temps_produk_kanan)]

    # Slope via linear regression
    slope_bakar = 0
    if len(temps_bakar) > 2:
        x = np.arange(len(temps_bakar))
        slope_bakar = np.polyfit(x, temps_bakar, 1)[0]

    return {
        "suhu_awal_bakar": temps_bakar[0] if temps_bakar else 0,
        "suhu_awal_produk": temps_produk[0] if temps_produk else 0,
        "suhu_avg_bakar": round(np.mean(temps_bakar), 1),
        "suhu_avg_produk": round(np.mean(temps_produk), 1),
        "suhu_std_bakar": round(np.std(temps_bakar), 2),
        "suhu_std_produk": round(np.std(temps_produk), 2),
        "suhu_slope_bakar": round(slope_bakar, 4),
        "suhu_max_bakar": round(max(temps_bakar), 1),
        "suhu_min_bakar": round(min(temps_bakar), 1),
        "n_telemetry_points": len(entries),
    }


def count_alarms(machine_id, batch_id):
    """Hitung jumlah alarm untuk batch tertentu."""
    try:
        alarms_ref = db.reference(f"alarms/{machine_id}")
        alarms = alarms_ref.get() or {}
        return sum(
            1 for a in alarms.values()
            if a.get("batch_id") == batch_id
        )
    except Exception:
        return 0


def export_batches():
    """
    Ambil semua batch completed + telemetry, gabung jadi 1 DataFrame.

    Setiap row = 1 batch lengkap (pre + post + telemetry aggregated).
    Ini yang akan jadi training data untuk XGBoost.
    """
    batches_ref = db.reference("batches")
    batches = batches_ref.get() or {}

    if not batches:
        print("⚠️ Tidak ada data batch di Firebase")
        return pd.DataFrame()

    rows = []
    skipped = 0

    for batch_id, batch in batches.items():
        # Hanya batch yang sudah selesai
        if batch.get("status") != "completed":
            skipped += 1
            continue

        pre = batch.get("pre_batch", {})
        post = batch.get("post_batch", {})
        summary = batch.get("summary", {})
        machine_id = batch.get("machine_id", "dryer01")

        # Ambil telemetry logs
        tele_ref = db.reference(f"telemetry_logs/{batch_id}")
        tele_data = tele_ref.get()
        tele_features = aggregate_telemetry(tele_data)

        # Alarm count
        alarm_count = count_alarms(machine_id, batch_id)

        # Build training row
        row = {
            "batch_id": batch_id,
            "machine_id": machine_id,
            "operator": batch.get("operator_name", ""),
            "start_time": batch.get("start_time", 0),

            # === INPUT FEATURES (X) ===
            "mc_awal": pre.get("mc_awal", 0),
            "berat_awal_kg": pre.get("berat_awal_kg", 0),
            "jml_kompor": pre.get("jml_kompor", 2),
            "tipe_gas_kg": pre.get("tipe_gas_kg", 12),
            "jml_tabung": pre.get("jml_tabung", 2),
            "mode_blower": pre.get("mode_blower", "Efisien"),
            "durasi_rencana_mnt": pre.get("durasi_rencana_mnt", 360),

            # Telemetry-derived features
            **tele_features,
            "alarm_count": alarm_count,

            # === TARGET (y) ===
            "mc_akhir": post.get("mc_akhir", 0),
            "berat_mesh_kg": post.get("berat_mesh_kg", 0),
            "berat_brontol_kg": post.get("berat_brontol_kg", 0),
            "gas_terpakai_kg": post.get("gas_terpakai_kg", 0),
            "durasi_aktual_mnt": summary.get("durasi_aktual_mnt", 0),
            "susut_persen": summary.get("susut_persen", 0),
            "efisiensi_score": summary.get("efisiensi_score", 0),
            "target_mc_tercapai": summary.get("target_mc_tercapai", False),
        }
        rows.append(row)

    df = pd.DataFrame(rows)

    # Save
    os.makedirs("ml/data", exist_ok=True)
    output_path = os.path.join(os.path.dirname(__file__), "data", "batches_export.csv")
    df.to_csv(output_path, index=False)

    print(f"\n📊 Export Summary:")
    print(f"   Total batch di Firebase : {len(batches)}")
    print(f"   Batch completed         : {len(rows)}")
    print(f"   Batch skipped (active)  : {skipped}")
    print(f"   Output                  : {output_path}")
    print(f"\n✅ Export selesai!")

    return df


if __name__ == "__main__":
    init_firebase()
    df = export_batches()
    if len(df) > 0:
        print(f"\n📋 Columns: {list(df.columns)}")
        print(f"\n{df.describe()}")
