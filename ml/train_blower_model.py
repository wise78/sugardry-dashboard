"""
SugarDry IoT — Train XGBoost: Prediksi mc_akhir

DESAIN MODEL:
  - Target  (y) : mc_akhir (%) — hasil akhir pengeringan yang diukur operator
  - Input   (X) : kondisi pre-batch + duty cycle yang digunakan
  - Dataset     : SEMUA batch (termasuk yang gagal/MC > 1%) — batch gagal
                  mengajarkan model "kombinasi ini tidak cukup kering"

CARA PAKAI MODEL SAAT PREDIKSI:
  Saat pre-batch, dashboard mencoba beberapa nilai duty cycle (simulasi),
  lalu memilih yang diprediksi menghasilkan mc_akhir paling kecil (< 1%).

Usage:
    python train_blower_model.py
"""

import os
import json
import itertools

import pandas as pd
import numpy as np
from xgboost import XGBRegressor
from sklearn.model_selection import LeaveOneOut, cross_val_score
from sklearn.preprocessing import LabelEncoder
import joblib


# === Configuration ===
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "batches_export.csv")
MODEL_DIR  = os.path.join(os.path.dirname(__file__), "models")
MIN_BATCHES = 10  # Minimum total batch untuk training (idealnya 30+)

# -----------------------------------------------------------------------
# FITUR INPUT (X)
# Semua kolom ini sudah TERSEDIA sebelum / saat batch selesai.
# "blower_on_total_mnt" & "blower_siklus" berasal dari auto-log ESP32
# (dicatat selama batch, bukan diisi operator).
# -----------------------------------------------------------------------
FEATURE_COLS = [
    # --- Pre-batch: diisi operator sebelum mulai ---
    "mc_awal",              # float, %  — moisture content awal gula
    "berat_awal_kg",        # float, kg — berat muatan awal
    "jml_kompor",           # int       — kompor menyala (1 atau 2)
    "tipe_gas_kg",          # int       — ukuran tabung gas (3/5/12)
    "durasi_rencana_mnt",   # int       — target durasi yang direncanakan

    # --- Auto-log suhu: dari telemetry ESP32, diagregasi per batch ---
    "suhu_avg_bakar",       # float, °C — rata-rata suhu R. Pembakaran
    "suhu_avg_produk",      # float, °C — rata-rata suhu R. Produk (kiri+kanan)/2
    "suhu_std_bakar",       # float     — stabilitas suhu pembakaran
    "suhu_std_produk",      # float     — stabilitas suhu produk
    "suhu_slope_bakar",     # float     — tren suhu (°C/menit, negatif = turun)

    # --- Duty cycle yang dipakai: dari mode blower + auto-log ---
    # Model belajar: "duty cycle ini + kondisi ini → mc_akhir sekian"
    "blower_on_total_mnt",  # int, mnt  — total menit blower ON selama batch
    "blower_siklus",        # int       — berapa kali ON-OFF terjadi
    "durasi_aktual_mnt",    # int, mnt  — berapa lama batch benar-benar berjalan
]

# -----------------------------------------------------------------------
# TARGET (y)
# mc_akhir = moisture content akhir, diisi operator setelah pemasakan.
# Inilah yang ingin diprediksi model.
# Semakin kecil = semakin kering = semakin baik (target < 1%).
# -----------------------------------------------------------------------
TARGET_COL = "mc_akhir"


# -----------------------------------------------------------------------
# LOAD & PREPARE
# -----------------------------------------------------------------------
def load_and_prepare_data():
    """
    Load CSV hasil export Firebase.
    Gunakan SEMUA batch yang memiliki data lengkap (pre + post).
    Batch gagal (mc_akhir >= 1%) tetap dipakai — mereka mengajarkan
    model kondisi apa yang TIDAK menghasilkan pengeringan cukup.
    """
    if not os.path.exists(DATA_PATH):
        print(f"❌ File tidak ditemukan: {DATA_PATH}")
        print("   Jalankan export_firebase.py dulu!")
        return None, None, None

    df = pd.read_csv(DATA_PATH)
    print(f"📂 Total batch di CSV: {len(df)}")

    # Buang baris yang kolom kritis-nya kosong/nol
    required = FEATURE_COLS + [TARGET_COL]
    df_clean = df.dropna(subset=required).copy()
    df_clean = df_clean[df_clean["mc_akhir"] > 0]  # mc_akhir 0 = belum diisi
    print(f"✅ Batch dengan data lengkap: {len(df_clean)}")

    # Statistik target
    n_sukses = (df_clean["mc_akhir"] < 1).sum()
    n_gagal  = (df_clean["mc_akhir"] >= 1).sum()
    print(f"   Batch sukses (MC < 1%) : {n_sukses}")
    print(f"   Batch gagal  (MC ≥ 1%) : {n_gagal}  ← tetap dipakai untuk training!")
    print(f"   mc_akhir rata-rata     : {df_clean['mc_akhir'].mean():.2f}%")
    print(f"   mc_akhir min / max     : {df_clean['mc_akhir'].min():.2f}% / {df_clean['mc_akhir'].max():.2f}%")

    if len(df_clean) < MIN_BATCHES:
        print(f"\n⚠️ Data masih kurang ({len(df_clean)} < {MIN_BATCHES} batch).")
        print("   Kumpulkan lebih banyak batch dulu.")
        print("   Saat ini dashboard gunakan rule-based heuristic.")
        return None, None, None

    # Encode mode_blower (Efisien/Turbo/Custom → angka)
    le = LabelEncoder()
    df_clean["mode_encoded"] = le.fit_transform(df_clean["mode_blower"])
    feature_cols = FEATURE_COLS + ["mode_encoded"]

    X = df_clean[feature_cols]
    y = df_clean[TARGET_COL]

    return X, y, le


# -----------------------------------------------------------------------
# TRAIN
# -----------------------------------------------------------------------
def train_model(X, y):
    """Train XGBoost Regressor dengan Leave-One-Out CV."""
    print(f"\n🏋️  Training XGBoost (n={len(X)}, target=mc_akhir)...")

    model = XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
    )

    # Leave-One-Out CV — cocok untuk dataset kecil (< 100 sample)
    loo = LeaveOneOut()
    mae_scores = cross_val_score(model, X, y, cv=loo,
                                  scoring="neg_mean_absolute_error")
    r2_scores  = cross_val_score(model, X, y, cv=loo, scoring="r2")

    mae = -mae_scores.mean()
    r2  = r2_scores.mean()

    print(f"\n📊 Leave-One-Out Cross-Validation:")
    print(f"   MAE mc_akhir : ±{mae:.3f}%  (error prediksi moisture content)")
    print(f"   R²           : {r2:.3f}    (1.0 = sempurna)")

    if mae < 0.5:
        print("   ✅ Model sudah cukup baik untuk dipakai")
    elif mae < 1.0:
        print("   ⚠️  Model OK, tambah data untuk meningkatkan akurasi")
    else:
        print("   ❌ Akurasi kurang — butuh lebih banyak data / variasi batch")

    # Final fit pada semua data
    model.fit(X, y)
    return model, mae, r2


# -----------------------------------------------------------------------
# SAVE
# -----------------------------------------------------------------------
def save_model(model, le, X, mae, r2):
    """Simpan model, label encoder, dan metadata."""
    os.makedirs(MODEL_DIR, exist_ok=True)

    joblib.dump(model, os.path.join(MODEL_DIR, "blower_optimizer.joblib"))
    joblib.dump(le,    os.path.join(MODEL_DIR, "label_encoder.joblib"))
    print(f"\n💾 Model saved → {MODEL_DIR}/blower_optimizer.joblib")

    # Feature importance
    feature_cols = list(X.columns)
    importance = dict(zip(feature_cols, model.feature_importances_))
    importance_sorted = sorted(importance.items(), key=lambda x: x[1], reverse=True)

    print("\n📊 Feature Importance (pengaruh terhadap mc_akhir):")
    for feat, imp in importance_sorted:
        bar = "█" * int(imp * 50)
        print(f"   {feat:25s} {imp:.3f}  {bar}")

    meta = {
        "model_type": "XGBRegressor",
        "target": TARGET_COL,
        "target_description": "mc_akhir (%) — moisture content akhir setelah pengeringan",
        "features": feature_cols,
        "n_training_samples": len(X),
        "loo_mae_pct": round(mae, 4),
        "loo_r2": round(r2, 4),
        "usage": (
            "Prediksi mc_akhir dari kombinasi kondisi pre-batch + duty cycle. "
            "Untuk rekomendasi: coba beberapa duty cycle, pilih yang menghasilkan mc_akhir < 1%."
        ),
        "feature_importance": {k: round(float(v), 4) for k, v in importance_sorted},
    }
    with open(os.path.join(MODEL_DIR, "model_metadata.json"), "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"📄 Metadata saved → {MODEL_DIR}/model_metadata.json")


# -----------------------------------------------------------------------
# DEMO: Cara model dipakai saat prediksi
# -----------------------------------------------------------------------
def demo_inference(model, le):
    """
    Contoh: operator mau mulai batch dengan mc_awal=3.5%, berat=400kg.
    Dashboard mencoba beberapa duty cycle, pilih yang prediksi mc_akhir < 1%.
    """
    print("\n" + "=" * 60)
    print("🔮 Demo Inferensi — Mencari duty cycle optimal:")
    print("   Kondisi: mc_awal=3.5%, berat=400kg, 2 kompor, suhu bakar ~150°C")
    print("=" * 60)

    # Kandidat duty cycle untuk dicoba
    kandidat = [
        {"blower_on_total_mnt": 180, "blower_siklus": 6,  "durasi_aktual_mnt": 270, "label": "ON20/OFF10 × 9 siklus"},
        {"blower_on_total_mnt": 225, "blower_siklus": 9,  "durasi_aktual_mnt": 315, "label": "ON25/OFF10 × 9 siklus"},
        {"blower_on_total_mnt": 270, "blower_siklus": 9,  "durasi_aktual_mnt": 360, "label": "ON30/OFF10 × 9 siklus"},
        {"blower_on_total_mnt": 360, "blower_siklus": 1,  "durasi_aktual_mnt": 360, "label": "Turbo (ON 100%)"},
    ]

    mode_enc = le.transform(["Efisien"])[0]
    results = []

    for k in kandidat:
        features = np.array([[
            3.5, 400, 2, 12, 360,   # pre-batch
            150, 70, 10, 3, -0.01,  # suhu telemetry
            k["blower_on_total_mnt"], k["blower_siklus"], k["durasi_aktual_mnt"],
            mode_enc,
        ]])
        mc_pred = model.predict(features)[0]
        status = "✅ CUKUP" if mc_pred < 1.0 else "❌ KURANG KERING"
        print(f"   {k['label']:28s} → prediksi mc_akhir: {mc_pred:.2f}%  {status}")
        results.append((k["label"], mc_pred))

    # Pilih duty cycle dengan mc_akhir terkecil yang < 1%
    valid = [(label, mc) for label, mc in results if mc < 1.0]
    if valid:
        best_label, best_mc = min(valid, key=lambda x: x[1])
        print(f"\n   🏆 Rekomendasi: {best_label} (prediksi mc_akhir = {best_mc:.2f}%)")
    else:
        print("\n   ⚠️  Tidak ada duty cycle yang diprediksi mencapai MC < 1%.")
        print("      Pertimbangkan tambah durasi atau periksa kondisi oven.")


# -----------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------
def main():
    print("=" * 60)
    print("🤖 SugarDry IoT — Blower Optimizer Training")
    print("   Target: prediksi mc_akhir dari kondisi batch + duty cycle")
    print("=" * 60)

    X, y, le = load_and_prepare_data()
    if X is None:
        return

    model, mae, r2 = train_model(X, y)
    save_model(model, le, X, mae, r2)
    demo_inference(model, le)

    print("\n" + "=" * 60)
    print("✅ Training selesai!")
    print(f"   Error prediksi mc_akhir: ±{mae:.3f}%")
    print("   Jalankan predict_server.py untuk deploy sebagai API")
    print("=" * 60)


if __name__ == "__main__":
    main()
