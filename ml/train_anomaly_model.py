"""
SugarDry IoT — Train Isolation Forest Anomaly Detector
Deteksi pola suhu abnormal secara real-time (unsupervised).

Usage: python train_anomaly_model.py
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import joblib

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "batches_export.csv")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")


def generate_normal_windows(df_success):
    """Generate time-window samples dari statistik batch normal."""
    windows = []
    for _, batch in df_success.iterrows():
        avg_b = batch["suhu_avg_bakar"]
        std_b = batch["suhu_std_bakar"]
        avg_p = batch["suhu_avg_produk"]
        std_p = batch["suhu_std_produk"]
        if avg_b == 0 or avg_p == 0:
            continue
        for _ in range(50):
            sb = np.random.normal(avg_b, max(std_b, 1))
            sp = np.random.normal(avg_p, max(std_p, 0.5))
            windows.append({
                "suhu_bakar": round(sb, 1),
                "suhu_produk": round(sp, 1),
                "delta_bakar": round(np.random.normal(0, 2), 2),
                "delta_produk": round(np.random.normal(0, 0.5), 2),
                "rasio_bakar_produk": round(sb / max(sp, 1), 2),
            })
    return pd.DataFrame(windows)


def main():
    print("=" * 50)
    print("🤖 SugarDry — Anomaly Detector Training")
    print("=" * 50)

    df = pd.read_csv(DATA_PATH)
    df_ok = df[df["target_mc_tercapai"] == True]
    print(f"Batch normal: {len(df_ok)}")

    if len(df_ok) < 5:
        print("⚠️ Butuh minimal 5 batch.")
        return

    df_w = generate_normal_windows(df_ok)
    print(f"Generated {len(df_w)} normal windows")

    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(df_w)

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, os.path.join(MODEL_DIR, "anomaly_detector.joblib"))

    meta = {
        "model_type": "IsolationForest",
        "features": list(df_w.columns),
        "n_windows": len(df_w),
    }
    with open(os.path.join(MODEL_DIR, "anomaly_metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print("✅ Anomaly detector saved!")


if __name__ == "__main__":
    main()
