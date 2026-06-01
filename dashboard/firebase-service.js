/**
 * SugarDry IoT — Firebase Service
 * Handles all Firebase Realtime Database operations
 *
 * Dependencies: Firebase SDK (loaded via CDN in index.html)
 * Requires: config.js loaded first
 */

const FirebaseService = (() => {
  let db = null;
  let initialized = false;

  // ===== INIT =====
  function init() {
    if (initialized) return;

    try {
      // Check if Firebase SDK is loaded
      if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase SDK not loaded — skipping Firebase init');
        return;
      }

      // Check if config has real values
      if (CONFIG.firebase.apiKey === 'YOUR_API_KEY') {
        console.warn('⚠️ Firebase config not set — using placeholder values');
        return;
      }

      firebase.initializeApp(CONFIG.firebase);
      db = firebase.database();
      initialized = true;
      console.log('✅ Firebase initialized');
    } catch (err) {
      console.error('❌ Firebase init error:', err);
    }
  }

  function isReady() {
    return initialized && db !== null;
  }

  // ===== MACHINES =====

  /**
   * Save a machine to Firebase
   * @param {string} machineId - e.g. 'dryer01'
   * @param {object} data - machine data object
   */
  async function saveMachine(machineId, data) {
    if (!isReady()) return;
    try {
      await db.ref(`machines/${machineId}`).set({
        ...data,
        updated_at: firebase.database.ServerValue.TIMESTAMP,
      });
      console.log(`✅ Machine ${machineId} saved`);
    } catch (err) {
      console.error('❌ Save machine error:', err);
    }
  }

  /**
   * Get all machines from Firebase
   * @returns {Promise<object>} machines data or null
   */
  async function getMachines() {
    if (!isReady()) return null;
    try {
      const snapshot = await db.ref('machines').once('value');
      return snapshot.val();
    } catch (err) {
      console.error('❌ Get machines error:', err);
      return null;
    }
  }

  /**
   * Listen for machine changes in real-time
   * @param {function} callback - called with machines data
   */
  function onMachinesChange(callback) {
    if (!isReady()) return;
    db.ref('machines').on('value', (snapshot) => {
      callback(snapshot.val());
    });
  }

  // ===== OPERATORS =====

  async function saveOperator(operatorId, data) {
    if (!isReady()) return;
    try {
      await db.ref(`operators/${operatorId}`).set({
        ...data,
        created_at: firebase.database.ServerValue.TIMESTAMP,
      });
    } catch (err) {
      console.error('❌ Save operator error:', err);
    }
  }

  async function getOperators() {
    if (!isReady()) return null;
    try {
      const snapshot = await db.ref('operators').once('value');
      return snapshot.val();
    } catch (err) {
      console.error('❌ Get operators error:', err);
      return null;
    }
  }

  // ===== BATCHES =====

  /**
   * Start a new batch — saves pre-batch data
   * @param {string} batchId
   * @param {object} preBatchData
   */
  async function startBatch(batchId, preBatchData) {
    if (!isReady()) return;
    try {
      await db.ref(`batches/${batchId}`).set({
        machine_id: preBatchData.machineId || CONFIG.defaultMachineId,
        operator_name: preBatchData.operator,
        start_time: firebase.database.ServerValue.TIMESTAMP,
        end_time: null,
        status: 'active',
        pre_batch: {
          mc_awal: preBatchData.mcAwal,
          berat_awal_kg: preBatchData.beratAwal,
          jml_kompor: preBatchData.jmlKompor || 2,
          tipe_gas_kg: preBatchData.tipeGas || 12,
          jml_tabung: preBatchData.jmlTabung || 2,
          mode_blower: preBatchData.modeBlower,
          // Duty cycle setting — kunci utama untuk training ML
          duty_on_mnt: preBatchData.dutyOnMnt ?? null,
          duty_off_mnt: preBatchData.dutyOffMnt ?? null,
          durasi_rencana_mnt: preBatchData.durasiRencana || 360,
          catatan: preBatchData.catatan || '',
        },
        post_batch: null,
        summary: null,
      });
      console.log(`✅ Batch ${batchId} started in Firebase`);
    } catch (err) {
      console.error('❌ Start batch error:', err);
    }
  }

  /**
   * Complete a batch — saves post-batch data
   * @param {string} batchId
   * @param {object} postBatchData
   */
  async function completeBatch(batchId, postBatchData) {
    if (!isReady()) return;
    try {
      await db.ref(`batches/${batchId}`).update({
        end_time: firebase.database.ServerValue.TIMESTAMP,
        status: 'completed',
        post_batch: {
          mc_akhir: postBatchData.mcAkhir,
          berat_mesh_kg: postBatchData.beratMesh,
          berat_brontol_kg: postBatchData.beratBrontol,
          gas_terpakai_kg: postBatchData.gasTerpakai,
          catatan: postBatchData.catatan || '',
        },
        summary: {
          total_susut_kg: postBatchData.susutKg,
          susut_persen: postBatchData.susutPersen,
          target_mc_tercapai: postBatchData.targetTercapai,
          efisiensi_score: postBatchData.efisiensiScore,
          durasi_aktual_mnt: postBatchData.durasiAktual,
          // Data blower dari ESP32 (via oven/batch/result)
          blower_on_total_mnt: postBatchData.blowerOnTotal ?? null,
          blower_siklus: postBatchData.blowerSiklus ?? null,
          // Ringkasan suhu selama batch (akumulator dari MQTT telemetry)
          suhu_avg_produk_kiri: postBatchData.suhuAvgLeft   ? parseFloat(postBatchData.suhuAvgLeft.toFixed(1))   : null,
          suhu_avg_produk_kanan: postBatchData.suhuAvgRight ? parseFloat(postBatchData.suhuAvgRight.toFixed(1)) : null,
          suhu_avg_pembakaran: postBatchData.suhuAvgBurner  ? parseFloat(postBatchData.suhuAvgBurner.toFixed(1)) : null,
          suhu_max_pembakaran: postBatchData.suhuMaxBurner  ? parseFloat(postBatchData.suhuMaxBurner.toFixed(1)) : null,
          suhu_min_pembakaran: postBatchData.suhuMinBurner  ? parseFloat(postBatchData.suhuMinBurner.toFixed(1)) : null,
        },
      });
      console.log(`✅ Batch ${batchId} completed in Firebase`);
    } catch (err) {
      console.error('❌ Complete batch error:', err);
    }
  }

  /**
   * Update batch dengan data blower dari ESP32 (oven/batch/result payload)
   * Dipanggil saat dashboard menerima MQTT topic oven/batch/result
   * @param {string} batchId
   * @param {object} blowerData - { blowerOnTotal, blowerSiklus, dutyOnMnt, dutyOffMnt, mode }
   */
  async function updateBatchBlowerStats(batchId, blowerData) {
    if (!isReady() || !batchId) return;
    try {
      await db.ref(`batches/${batchId}/blower_stats`).set({
        blower_on_total_mnt: blowerData.blowerOnTotal ?? null,
        blower_siklus: blowerData.blowerSiklus ?? null,
        duty_on_mnt_aktual: blowerData.dutyOnMnt ?? null,
        duty_off_mnt_aktual: blowerData.dutyOffMnt ?? null,
        mode_aktual: blowerData.mode ?? null,
        recorded_at: firebase.database.ServerValue.TIMESTAMP,
      });
      console.log(`✅ Blower stats updated for batch ${batchId}`);
    } catch (err) {
      console.error('❌ Update blower stats error:', err);
    }
  }

  /**
   * Get all batches (with optional limit)
   * @param {number} limit - max batches to retrieve
   * @returns {Promise<object>}
   */
  async function getBatches(limit = 50) {
    if (!isReady()) return null;
    try {
      const snapshot = await db
        .ref('batches')
        .orderByChild('start_time')
        .limitToLast(limit)
        .once('value');
      return snapshot.val();
    } catch (err) {
      console.error('❌ Get batches error:', err);
      return null;
    }
  }

  /**
   * Get a single batch by ID
   * @param {string} batchId
   * @returns {Promise<object>}
   */
  async function getBatch(batchId) {
    if (!isReady()) return null;
    try {
      const snapshot = await db.ref(`batches/${batchId}`).once('value');
      return snapshot.val();
    } catch (err) {
      console.error('❌ Get batch error:', err);
      return null;
    }
  }

  /**
   * Get active batches only
   * @returns {Promise<object>}
   */
  async function getActiveBatches() {
    if (!isReady()) return null;
    try {
      const snapshot = await db
        .ref('batches')
        .orderByChild('status')
        .equalTo('active')
        .once('value');
      return snapshot.val();
    } catch (err) {
      console.error('❌ Get active batches error:', err);
      return null;
    }
  }

  // ===== TELEMETRY =====

  /**
   * Save a telemetry data point
   * This is typically done by ESP32, but dashboard can also push
   * @param {string} machineId
   * @param {object} data - { suhu_produk_kiri, suhu_produk_kanan, suhu_pembakaran, blower1, blower2 }
   */
  async function saveTelemetry(machineId, data) {
    if (!isReady()) return;
    try {
      // Update "latest" telemetry for real-time display
      await db.ref(`telemetry/${machineId}/latest`).set({
        ...data,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      });
    } catch (err) {
      console.error('❌ Save telemetry error:', err);
    }
  }

  /**
   * Save telemetry to batch log (time-series)
   * @param {string} batchId
   * @param {object} data
   */
  async function logTelemetryToBatch(batchId, data) {
    if (!isReady()) return;
    try {
      await db.ref(`telemetry_logs/${batchId}`).push({
        ...data,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      });
    } catch (err) {
      console.error('❌ Log telemetry error:', err);
    }
  }

  /**
   * Listen for latest telemetry from a machine
   * @param {string} machineId
   * @param {function} callback
   */
  function onTelemetryUpdate(machineId, callback) {
    if (!isReady()) return;
    db.ref(`telemetry/${machineId}/latest`).on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) callback(data);
    });
  }

  // ===== ALARMS =====

  /**
   * Save an alarm event
   * @param {string} machineId
   * @param {object} alarmData - { batch_id, type, message }
   */
  async function saveAlarm(machineId, alarmData) {
    if (!isReady()) return;
    try {
      await db.ref(`alarms/${machineId}`).push({
        ...alarmData,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      });
    } catch (err) {
      console.error('❌ Save alarm error:', err);
    }
  }

  /**
   * Get recent alarms for a machine
   * @param {string} machineId
   * @param {number} limit
   * @returns {Promise<object>}
   */
  async function getAlarms(machineId, limit = 20) {
    if (!isReady()) return null;
    try {
      const snapshot = await db
        .ref(`alarms/${machineId}`)
        .orderByChild('timestamp')
        .limitToLast(limit)
        .once('value');
      return snapshot.val();
    } catch (err) {
      console.error('❌ Get alarms error:', err);
      return null;
    }
  }

  /**
   * Listen for new alarms in real-time
   * @param {string} machineId
   * @param {function} callback
   */
  function onNewAlarm(machineId, callback) {
    if (!isReady()) return;
    // Only listen for new alarms (after page load)
    const ref = db.ref(`alarms/${machineId}`).orderByChild('timestamp').limitToLast(1);
    let firstLoad = true;
    ref.on('child_added', (snapshot) => {
      if (firstLoad) {
        firstLoad = false;
        return; // Skip existing alarms on first load
      }
      callback(snapshot.val());
    });
  }

  // ===== BATCH HISTORY =====

  /**
   * Get batch history for display
   * @param {number} limit
   * @returns {Promise<Array>} sorted array of batches (newest first)
   */
  async function getBatchHistory(limit = 30) {
    if (!isReady()) return [];
    try {
      const snapshot = await db
        .ref('batches')
        .orderByChild('start_time')
        .limitToLast(limit)
        .once('value');

      const data = snapshot.val();
      if (!data) return [];

      // Convert to array and sort newest first
      return Object.entries(data)
        .map(([id, batch]) => ({ id, ...batch }))
        .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
    } catch (err) {
      console.error('❌ Get batch history error:', err);
      return [];
    }
  }

  // ===== SEED DEFAULT DATA =====

  /**
   * Seed the default Dryer 01 machine if it doesn't exist
   */
  async function seedDefaultData() {
    if (!isReady()) return;
    try {
      const machine = await db.ref('machines/dryer01').once('value');
      if (!machine.exists()) {
        await saveMachine('dryer01', {
          name: 'Dryer 01',
          capacity_kg: 400,
          vol_burner: '45 × 110 × 60',
          vol_product: '90 × 108.5 × 177',
          rpm_blower: 2800,
          status: 'active',
        });
        console.log('✅ Default machine seeded');
      }
    } catch (err) {
      console.error('❌ Seed error:', err);
    }
  }

  // ===== PUBLIC API =====
  return {
    init,
    isReady,
    // Machines
    saveMachine,
    getMachines,
    onMachinesChange,
    // Operators
    saveOperator,
    getOperators,
    // Batches
    startBatch,
    completeBatch,
    updateBatchBlowerStats,
    getBatch,
    getBatches,
    getActiveBatches,
    getBatchHistory,
    // Telemetry
    saveTelemetry,
    logTelemetryToBatch,
    onTelemetryUpdate,
    // Alarms
    saveAlarm,
    getAlarms,
    onNewAlarm,
    // Seed
    seedDefaultData,
  };
})();
