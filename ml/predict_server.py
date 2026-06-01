"""
SugarDry IoT — ML Prediction Server (Flask API)
Dashboard memanggil API ini untuk prediksi duty cycle & anomaly detection.

Endpoints:
  POST /api/predict/duty-cycle  → rekomendasi durasi optimal
  POST /api/predict/anomaly     → cek anomali suhu real-time
  GET  /api/health              → status server

Usage: python predict_server.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os

app = Flask(__name__)
CORS(app)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

# Load models (lazy)
_blower_model = None
_label_encoder = None
_anomaly_model = None


def get_blower_model():
    global _blower_model, _label_encoder
    if _blower_model is None:
        path = os.path.join(MODEL_DIR, "blower_optimizer.joblib")
        if os.path.exists(path):
            _blower_model = joblib.load(path)
            _label_encoder = joblib.load(os.path.join(MODEL_DIR, "label_encoder.joblib"))
    return _blower_model, _label_encoder


def get_anomaly_model():
    global _anomaly_model
    if _anomaly_model is None:
        path = os.path.join(MODEL_DIR, "anomaly_detector.joblib")
        if os.path.exists(path):
            _anomaly_model = joblib.load(path)
    return _anomaly_model


@app.route("/api/predict/duty-cycle", methods=["POST"])
def predict_duty_cycle():
    """
    Prediksi duty cycle optimal dengan mencoba beberapa kandidat.

    Model memprediksi mc_akhir untuk setiap kandidat duty cycle,
    lalu memilih yang menghasilkan mc_akhir < 1% dengan durasi terpendek.
    """
    model, le = get_blower_model()
    if model is None:
        return jsonify({"error": "Model belum di-train", "source": "rule_based"}), 503

    data = request.json
    mc          = data.get("mc_awal", 3.0)
    berat       = data.get("berat_awal_kg", 400)
    jml_kompor  = data.get("jml_kompor", 2)
    tipe_gas    = data.get("tipe_gas_kg", 12)
    durasi_plan = data.get("durasi_rencana_mnt", 360)
    suhu_bakar  = data.get("suhu_avg_bakar", 150)
    suhu_produk = data.get("suhu_avg_produk", 28)
    suhu_std_b  = data.get("suhu_std_bakar", 10)
    suhu_std_p  = data.get("suhu_std_produk", 3)
    suhu_slope  = data.get("suhu_slope_bakar", 0)

    try:
        mode_enc = le.transform([data.get("mode_blower", "Efisien")])[0]
    except ValueError:
        mode_enc = 0

    # Kandidat duty cycle: (on_mnt, off_mnt, label)
    kandidat = [
        (20, 10, "ON20/OFF10"),
        (25, 10, "ON25/OFF10"),
        (30, 10, "ON30/OFF10"),
        (30,  5, "ON30/OFF5"),
        (360, 0, "Turbo"),
    ]

    hasil = []
    for on, off, label in kandidat:
        period   = on + off if (on + off) > 0 else 1
        siklus   = int(durasi_plan / period)
        total_on = on * siklus
        durasi_aktual = period * siklus

        features = np.array([[
            mc, berat, jml_kompor, tipe_gas, durasi_plan,
            suhu_bakar, suhu_produk, suhu_std_b, suhu_std_p, suhu_slope,
            total_on, siklus, durasi_aktual, mode_enc,
        ]])
        mc_pred = float(model.predict(features)[0])
        hasil.append({
            "label": label,
            "blower_on_mnt": on,
            "blower_off_mnt": off,
            "blower_siklus": siklus,
            "durasi_estimasi_mnt": durasi_aktual,
            "mc_akhir_prediksi": round(mc_pred, 3),
            "target_tercapai": mc_pred < 1.0,
        })

    # Pilih yang mc_akhir < 1% dengan durasi terpendek (paling efisien)
    valid = [h for h in hasil if h["target_tercapai"]]
    best  = min(valid, key=lambda h: h["durasi_estimasi_mnt"]) if valid \
            else min(hasil, key=lambda h: h["mc_akhir_prediksi"])

    return jsonify({
        "recommendation": best,
        "all_candidates": hasil,
        "source": "ml_model",
        "note": "mc_akhir_prediksi adalah estimasi dari model XGBoost",
    })


@app.route("/api/predict/anomaly", methods=["POST"])
def predict_anomaly():
    """Cek apakah kondisi suhu saat ini anomali."""
    model = get_anomaly_model()
    if model is None:
        return jsonify({"error": "Anomaly model belum di-train"}), 503

    data = request.json
    sb = data.get("suhu_bakar", 0)
    sp = data.get("suhu_produk", 0)

    features = np.array([[
        sb, sp,
        data.get("delta_bakar", 0),
        data.get("delta_produk", 0),
        sb / max(sp, 1),
    ]])

    pred = model.predict(features)[0]
    score = model.score_samples(features)[0]

    anomaly_type = "NORMAL"
    if pred == -1:
        if data.get("delta_bakar", 0) < -5:
            anomaly_type = "KOMPOR_MATI"
        elif sb > 200:
            anomaly_type = "OVERHEAT"
        else:
            anomaly_type = "ANOMALI"

    return jsonify({
        "is_anomaly": pred == -1,
        "anomaly_type": anomaly_type,
        "anomaly_score": round(float(score), 4),
    })


@app.route("/api/health", methods=["GET"])
def health():
    blower, _ = get_blower_model()
    anomaly = get_anomaly_model()
    return jsonify({
        "status": "ok",
        "blower_model": blower is not None,
        "anomaly_model": anomaly is not None,
    })


if __name__ == "__main__":
    print("🚀 SugarDry ML Server starting on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
