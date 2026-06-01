/**
 * SugarDry IoT — ML Service
 * Menghubungkan dashboard dengan Python ML prediction server.
 * Jika server ML tidak tersedia, fallback ke rule-based heuristic.
 *
 * Dependencies: config.js (untuk ML server URL)
 */

const MLService = (() => {
  const BASE_URL = 'http://localhost:5000/api';
  let serverAvailable = false;

  /**
   * Check apakah ML server berjalan
   */
  async function checkHealth() {
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      serverAvailable = data.status === 'ok';
      console.log(serverAvailable ? '✅ ML Server connected' : '⚠️ ML Server unhealthy');
      return data;
    } catch {
      serverAvailable = false;
      console.warn('⚠️ ML Server tidak tersedia — menggunakan rule-based');
      return null;
    }
  }

  /**
   * Prediksi duty cycle optimal dari data pre-batch.
   * Dipanggil saat operator memilih mode "Efisien".
   *
   * @param {object} preBatchData - Data dari form pre-batch
   * @returns {object|null} - Prediksi ML atau null (fallback ke rule-based)
   */
  async function predictDutyCycle(preBatchData) {
    if (!serverAvailable) return null;

    try {
      const res = await fetch(`${BASE_URL}/predict/duty-cycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mc_awal: preBatchData.mcAwal,
          berat_awal_kg: preBatchData.beratAwal,
          jml_kompor: preBatchData.jmlKompor || 2,
          tipe_gas_kg: preBatchData.tipeGas || 12,
          suhu_avg_bakar: preBatchData.suhuBakar || 150,
          suhu_avg_produk: preBatchData.suhuProduk || 28,
          durasi_rencana_mnt: preBatchData.durasiRencana || 360,
          mode_blower: preBatchData.modeBlower || 'Efisien',
        }),
      });
      return await res.json();
    } catch (err) {
      console.warn('⚠️ ML prediction failed:', err.message);
      return null;
    }
  }

  /**
   * Cek anomali suhu real-time.
   * Dipanggil setiap 30 detik selama batch aktif.
   *
   * @param {object} suhuData - Suhu terkini + delta
   * @returns {object|null} - {is_anomaly, anomaly_type, score}
   */
  async function checkAnomaly(suhuData) {
    if (!serverAvailable) return null;

    try {
      const res = await fetch(`${BASE_URL}/predict/anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suhuData),
      });
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Rule-based fallback (sama dengan yang di context doc)
   */
  function getRuleBasedDutyCycle(mcAwal) {
    if (mcAwal < 2) return { blower_on_mnt: 20, blower_off_mnt: 10, source: 'rule_based' };
    if (mcAwal <= 3) return { blower_on_mnt: 25, blower_off_mnt: 10, source: 'rule_based' };
    return { blower_on_mnt: 30, blower_off_mnt: 10, source: 'rule_based' };
  }

  return {
    checkHealth,
    predictDutyCycle,
    checkAnomaly,
    getRuleBasedDutyCycle,
    isAvailable: () => serverAvailable,
  };
})();
