/**
 * SugarDry IoT Dashboard — Main Application
 * Coconut Sugar Dryer monitoring system
 * UNSOED x Central Agro Lestari
 */

// ===== STATE =====
const state = {
  currentPage: 'monitoring',
  batchActive: false,
  batchId: null,
  batchStartTime: null,
  batchEstimatedEnd: null, // timestamp when planned duration ends
  batchTimerFired: false,  // prevent re-triggering
  batchAlarmAudioCtx: null, // Web Audio context for alarm
  batchAlarmInterval: null, // interval for repeating alarm beep
  esp32Online: false,       // true when ESP32 is connected to MQTT broker
  temperatures: {
    left: 0,
    right: 0,
    burner: 0,
  },
  prevTemps: { left: 0, right: 0, burner: 0 },
  blower1: false,
  blower2: false,
  blowerForceOff: false, // manual override: prevent simulation from turning blowers back ON
  blowerMode: '—',
  dutyCycle: '—',
  blowerOnMnt: 30,   // duty ON dalam menit (untuk simulasi Custom & Efisien)
  blowerOffMnt: 10,  // duty OFF dalam menit
  alarms: [],
  chartRange: 5, // minutes
  tempHistory: [], // { time, left, right, burner }

  // === Akumulator Suhu per-Batch (untuk summary ke Firebase) ===
  tempAcc: {
    leftSum: 0, leftCount: 0,
    rightSum: 0, rightCount: 0,
    burnerSum: 0, burnerCount: 0,
    burnerMax: -Infinity, burnerMin: Infinity,
  },

  // === Data Blower dari ESP32 (oven/batch/result) ===
  batchBlowerStats: {
    blowerOnTotal: null,  // menit total blower ON
    blowerSiklus: null,   // jumlah siklus ON→OFF
    dutyOnMnt: null,      // duty ON aktual dari ESP32
    dutyOffMnt: null,     // duty OFF aktual dari ESP32
    mode: null,
  },
};


// ===== DOM REFS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== NAVIGATION =====
function initNavigation() {
  $$('.nav-item[data-page]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  // Mobile menu
  $('#mobileMenuBtn').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
    $('#sidebarOverlay').classList.toggle('active');
  });

  $('#sidebarOverlay').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('active');
  });
}

function navigateTo(page) {
  state.currentPage = page;

  // Update sidebar nav items
  $$('.nav-item').forEach((n) => n.classList.remove('active'));
  const sidebarNav = $(`.nav-item[data-page="${page}"]`);
  if (sidebarNav) sidebarNav.classList.add('active');

  // Update mobile bottom nav items
  $$('.mob-nav-item').forEach((n) => n.classList.remove('active'));
  const mobileNav = $(`.mob-nav-item[data-page="${page}"]`);
  if (mobileNav) mobileNav.classList.add('active');

  // Update pages
  $$('.page').forEach((p) => p.classList.remove('active'));
  $(`#page-${page}`).classList.add('active');

  // Update header title
  const titles = {
    monitoring: ['Real-time Monitoring', 'Mesin: Dryer 01'],
    'pre-batch': ['Input Pre-Batch', 'Isi data sebelum memulai pengovenan'],
    'post-batch': ['Input Post-Batch', 'Catat hasil setelah pengovenan selesai'],
    'batch-history': ['Riwayat Batch', 'Histori semua sesi pengovenan'],
    'register-machine': ['Daftar Mesin', 'Kelola mesin oven terdaftar'],
    'troubleshoot': ['Troubleshoot', 'Kontrol manual & diagnostik hardware'],
  };

  // Load batch history when navigating to that page
  if (page === 'batch-history') loadBatchHistory();
  // Update sensor readings on troubleshoot page
  if (page === 'troubleshoot') updateTroubleshootSensors();

  const [title, subtitle] = titles[page] || ['Dashboard', ''];
  $('#pageTitle').textContent = title;
  $('#pageSubtitle').textContent = subtitle;

  // Close mobile sidebar
  $('#sidebar').classList.remove('open');
  $('#sidebarOverlay').classList.remove('active');
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  $('#headerClock').textContent = `${h}:${m}:${s}`;
}

// ===== TEMPERATURE SIMULATION =====
// Realistic temperature simulation for demo purposes
function generateTemperature(base, variance, current) {
  if (current === 0) return base + (Math.random() - 0.5) * variance;
  // Random walk with mean-reversion
  const drift = (base - current) * 0.02; // pull toward base
  const noise = (Math.random() - 0.5) * variance * 0.15;
  return Math.max(20, current + drift + noise);
}

function updateSimulatedData() {
  if (!state.batchActive) {
    // Idle state - ambient temp
    state.temperatures.left = generateTemperature(28, 4, state.temperatures.left);
    state.temperatures.right = generateTemperature(27, 4, state.temperatures.right);
    state.temperatures.burner = generateTemperature(30, 6, state.temperatures.burner);
  } else {
    // Active drying
    state.temperatures.left = generateTemperature(72, 8, state.temperatures.left);
    state.temperatures.right = generateTemperature(70, 8, state.temperatures.right);
    state.temperatures.burner = generateTemperature(155, 15, state.temperatures.burner);
  }

  // Record for chart
  state.tempHistory.push({
    time: new Date(),
    left: state.temperatures.left,
    right: state.temperatures.right,
    burner: state.temperatures.burner,
  });

  // Keep history within reasonable limit (max 1 hour @ 2s intervals = 1800)
  if (state.tempHistory.length > 1800) {
    state.tempHistory.shift();
  }
}

// ===== UPDATE UI =====
function updateTemperatureDisplay() {
  const { left, right, burner } = state.temperatures;

  // Values
  $('#tempLeft').innerHTML = `${left.toFixed(1)}<span class="unit">°C</span>`;
  $('#tempRight').innerHTML = `${right.toFixed(1)}<span class="unit">°C</span>`;
  $('#tempBurner').innerHTML = `${burner.toFixed(1)}<span class="unit">°C</span>`;

  // Trends
  updateTrend('trendLeft', left, state.prevTemps.left);
  updateTrend('trendRight', right, state.prevTemps.right);
  updateTrend('trendBurner', burner, state.prevTemps.burner);

  state.prevTemps = { ...state.temperatures };
}

function updateTrend(elemId, current, previous) {
  const diff = current - previous;
  const el = $(`#${elemId}`);
  if (Math.abs(diff) < 0.3) {
    el.className = 'stat-trend stable';
    el.innerHTML = '<span>→</span> <span>Stabil</span>';
  } else if (diff > 0) {
    el.className = 'stat-trend up';
    el.innerHTML = `<span>↑</span> <span>+${diff.toFixed(1)}°C</span>`;
  } else {
    el.className = 'stat-trend down';
    el.innerHTML = `<span>↓</span> <span>${diff.toFixed(1)}°C</span>`;
  }
}

function updateBlowerDisplay() {
  const updateBlower = (num, isOn) => {
    const icon = $(`#blower${num}Icon`);
    const status = $(`#blower${num}Status`);
    icon.className = `blower-icon ${isOn ? 'on' : 'off'}`;
    status.className = `blower-status ${isOn ? 'on' : 'off'}`;
    status.textContent = isOn ? 'ON' : 'OFF';
  };

  updateBlower(1, state.blower1);
  updateBlower(2, state.blower2);
  $('#activeBlowerMode').textContent = state.blowerMode;
  $('#activeDutyCycle').textContent = state.dutyCycle;
}

function updateBatchDuration() {
  if (!state.batchActive || !state.batchStartTime) return;
  const elapsed = Date.now() - state.batchStartTime;
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  $('#batchDuration').textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ===== BATCH COUNTDOWN TIMER =====
function updateBatchCountdown() {
  const countdownEl = $('#batchCountdown');
  if (!state.batchActive || !state.batchEstimatedEnd) {
    if (countdownEl) countdownEl.textContent = '—';
    return;
  }

  const remaining = state.batchEstimatedEnd - Date.now();

  if (remaining <= 0) {
    // Timer expired
    if (countdownEl) {
      countdownEl.textContent = '00:00:00';
      countdownEl.classList.add('countdown-expired');
    }

    // Trigger alarm only once
    if (!state.batchTimerFired) {
      state.batchTimerFired = true;
      onBatchTimerExpired();
    }
    return;
  }

  // Show remaining time
  const rh = Math.floor(remaining / 3600000);
  const rm = Math.floor((remaining % 3600000) / 60000);
  const rs = Math.floor((remaining % 60000) / 1000);
  if (countdownEl) {
    countdownEl.textContent = `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}:${String(rs).padStart(2, '0')}`;
    countdownEl.classList.remove('countdown-expired');

    // Warn when < 5 minutes remaining
    if (remaining < 300000) {
      countdownEl.classList.add('countdown-warning');
    } else {
      countdownEl.classList.remove('countdown-warning');
    }
  }
}

function onBatchTimerExpired() {
  // 1. Add alarm entry
  addAlarm('danger', `⏰ Waktu estimasi batch #${state.batchId} sudah habis! Segera matikan kompor dan blower.`);

  // 2. Show toast
  showToast('⏰ Waktu estimasi pengovenan habis!', '🔔');

  // 3. Start browser alarm sound (repeating beep)
  startAlarmSound();

  // 4. Send MQTT alarm to ESP32 (trigger physical siren)
  if (typeof MQTTService !== 'undefined' && MQTTService.publish) {
    MQTTService.publish('oven/troubleshoot/alarm', 'ON');
  }

  // 5. Show fullscreen modal
  showBatchCompleteModal();
}

// --- Browser Alarm Sound using Web Audio API ---
function startAlarmSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.batchAlarmAudioCtx = new AudioCtx();

    function playBeep() {
      if (!state.batchAlarmAudioCtx) return;
      const ctx = state.batchAlarmAudioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Two-tone alarm: 800Hz then 600Hz
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }

    playBeep(); // immediate first beep
    state.batchAlarmInterval = setInterval(playBeep, 1500); // repeat every 1.5s
  } catch (e) {
    console.warn('Web Audio API not available for alarm sound:', e);
  }
}

function stopAlarmSound() {
  if (state.batchAlarmInterval) {
    clearInterval(state.batchAlarmInterval);
    state.batchAlarmInterval = null;
  }
  if (state.batchAlarmAudioCtx) {
    state.batchAlarmAudioCtx.close().catch(() => {});
    state.batchAlarmAudioCtx = null;
  }
}

// --- Batch Complete Modal ---
function showBatchCompleteModal() {
  const modal = $('#batchCompleteModal');
  if (modal) {
    // Update batch ID in modal
    const bcmId = $('#bcmBatchId');
    if (bcmId) bcmId.textContent = `#${state.batchId}`;

    modal.classList.add('active');
    // Pulse animation on the modal icon
    const icon = modal.querySelector('.bcm-icon');
    if (icon) icon.classList.add('pulse');
  }
}

function dismissBatchCompleteModal() {
  const modal = $('#batchCompleteModal');
  if (modal) modal.classList.remove('active');

  // Stop browser alarm
  stopAlarmSound();

  // Stop physical siren via MQTT
  if (typeof MQTTService !== 'undefined' && MQTTService.publish) {
    MQTTService.publish('oven/troubleshoot/alarm', 'OFF');
  }
}

function batchCompleteAction(action) {
  if (action === 'stop-alarm') {
    // Just stop the alarm, keep modal open
    stopAlarmSound();
    if (typeof MQTTService !== 'undefined' && MQTTService.publish) {
      MQTTService.publish('oven/troubleshoot/alarm', 'OFF');
    }
    showToast('Alarm dimatikan', '🔕');
    // Disable the stop-alarm button
    const btn = $('#bcmStopAlarm');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  } else if (action === 'stop-blower') {
    // Set force-off flag so simulation loop won't override back to ON
    state.blowerForceOff = true;
    state.blower1 = false;
    state.blower2 = false;
    updateBlowerDisplay();

    // Send MQTT command to physically turn off blowers
    if (typeof MQTTService !== 'undefined' && MQTTService.publish) {
      const sent1 = MQTTService.publish('oven/troubleshoot/ssr1', 'OFF');
      const sent2 = MQTTService.publish('oven/troubleshoot/ssr2', 'OFF');
      if (sent1 && sent2) {
        addAlarm('info', 'Blower dimatikan oleh operator (batch selesai). MQTT dikirim.');
        showToast('Blower #1 & #2 dimatikan ✅', '🌀');
      } else {
        addAlarm('warning', 'Blower dimatikan di dashboard, tapi MQTT offline — perintah antri.');
        showToast('Blower OFF (dashboard). MQTT offline!', '⚠️');
      }
    } else {
      addAlarm('info', 'Blower dimatikan oleh operator (simulasi).');
      showToast('Blower #1 & #2 dimatikan', '🌀');
    }

    // Disable the stop-blower button
    const btn = $('#bcmStopBlower');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  } else if (action === 'go-post') {
    dismissBatchCompleteModal();
    navigateTo('post-batch');
  } else if (action === 'dismiss') {
    dismissBatchCompleteModal();
  }
}

function updateOvenStatus() {
  const badge = $('#ovenStatusBadge');
  const icon = $('#ovenStatusIcon');
  const text = $('#ovenStatusText');

  if (state.batchActive) {
    badge.className = 'header-badge badge-active';
    icon.textContent = '🔥';
    text.textContent = 'Aktif';
  } else {
    badge.className = 'header-badge badge-idle';
    icon.textContent = '⏸';
    text.textContent = 'Idle';
  }
}

// ===== CHART =====
let tempChart = null;

function initChart() {
  const ctx = $('#tempChart').getContext('2d');

  tempChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'R. Produk Kiri',
          borderColor: '#3498DB',
          backgroundColor: 'rgba(52, 152, 219, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.35,
          fill: true,
          data: [],
        },
        {
          label: 'R. Produk Kanan',
          borderColor: '#E67E22',
          backgroundColor: 'rgba(230, 126, 34, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.35,
          fill: true,
          data: [],
        },
        {
          label: 'R. Pembakaran',
          borderColor: '#E74C3C',
          backgroundColor: 'rgba(231, 76, 60, 0.05)',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.35,
          fill: true,
          data: [],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
            color: '#6B7280',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(26, 29, 38, 0.92)',
          titleFont: { family: "'Inter', sans-serif", size: 12 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function (context) {
              return ` ${context.dataset.label}: ${context.parsed.y.toFixed(1)}°C`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'HH:mm:ss',
            displayFormats: { second: 'HH:mm:ss', minute: 'HH:mm' },
          },
          grid: {
            color: 'rgba(232, 236, 241, 0.6)',
            drawBorder: false,
          },
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            color: '#9CA3AF',
            maxRotation: 0,
            maxTicksLimit: 8,
          },
        },
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(232, 236, 241, 0.6)',
            drawBorder: false,
          },
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            color: '#9CA3AF',
            callback: (v) => `${v}°C`,
          },
        },
      },
      animation: {
        duration: 300,
        easing: 'easeOutQuart',
      },
    },
  });
}

function updateChart() {
  if (!tempChart) return;

  const rangeMs = state.chartRange * 60 * 1000;
  const now = Date.now();
  const filtered = state.tempHistory.filter((d) => now - d.time.getTime() < rangeMs);

  tempChart.data.datasets[0].data = filtered.map((d) => ({ x: d.time, y: d.left }));
  tempChart.data.datasets[1].data = filtered.map((d) => ({ x: d.time, y: d.right }));
  tempChart.data.datasets[2].data = filtered.map((d) => ({ x: d.time, y: d.burner }));

  tempChart.update('none');
}

function initChartControls() {
  $$('.chart-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.chart-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.chartRange = parseInt(btn.dataset.range);
    });
  });
}

// ===== ALARM =====
function addAlarm(type, message) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  state.alarms.unshift({ type, message, time: timeStr });
  if (state.alarms.length > 20) state.alarms.pop();

  renderAlarms();
}

function renderAlarms() {
  const list = $('#alarmList');

  if (state.alarms.length === 0) {
    list.innerHTML = `
      <div class="alarm-empty">
        <div style="font-size:2rem; margin-bottom:8px;">✅</div>
        Tidak ada alarm aktif
      </div>`;
    return;
  }

  list.innerHTML = state.alarms
    .map(
      (a) => `
    <div class="alarm-item">
      <div class="alarm-dot ${a.type}"></div>
      <div class="alarm-content">
        <div class="alarm-msg">${a.message}</div>
        <div class="alarm-time">${a.time}</div>
      </div>
    </div>`
    )
    .join('');
}

// ===== TOAST =====
function showToast(message, icon = '✅') {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span style="font-size:1.2rem;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===== FORMS =====
function initForms() {
  // Batch history refresh
  const refreshBtn = $('#refreshHistoryBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadBatchHistory());
  }

  // Show/hide custom blower fields when mode changes
  const modeSelect = $('#preModeBlower');
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      const isCustom = modeSelect.value === 'Custom';
      $('#customOnGroup').style.display  = isCustom ? 'block' : 'none';
      $('#customOffGroup').style.display = isCustom ? 'block' : 'none';
      // Toggle required attribute so browser validation works correctly
      $('#preCustomOn').required  = isCustom;
      $('#preCustomOff').required = isCustom;
    });
  }

  // Pre-batch form
  $('#preBatchForm').addEventListener('submit', (e) => {
    e.preventDefault();

    // === GUARD: Block batch if ESP32 not online (live mode) ===
    const isLiveMode = typeof CONFIG !== 'undefined' && CONFIG.mode !== 'simulation';
    if (isLiveMode && !state.esp32Online) {
      showToast('❌ ESP32 tidak terdeteksi! Hubungkan ESP32 ke WiFi & MQTT terlebih dahulu.', '⚠️');
      addAlarm('danger', '⚠️ Batch tidak bisa dimulai — ESP32 offline. Cek koneksi WiFi & MQTT pada ESP32.');
      return; // abort submit
    }

    const mc = parseFloat($('#preMCAwal').value);
    const weight = parseFloat($('#preBeratAwal').value);
    const mode = $('#preModeBlower').value;
    const operator = $('#preOperator').value;
    // Parse custom ON/OFF — gunakan Number() agar tidak ada silent fallback
    const customOn  = Math.max(1, parseInt($('#preCustomOn').value,  10) || 15);
    const customOff = Math.max(1, parseInt($('#preCustomOff').value, 10) || 10);

    // Debug: verifikasi nilai yang akan dikirim ke ESP32
    if (mode === 'Custom') {
      console.log(`[PRE-BATCH] Custom mode — ON: ${customOn} mnt, OFF: ${customOff} mnt`);
    }

    // Start batch
    state.batchActive = true;
    state.batchId = `B${String(Date.now()).slice(-6)}`;
    state.batchStartTime = Date.now();
    state.blowerMode = mode;
    state.blower1 = true;
    state.blower2 = true;

    // Set duty cycle based on mode — simpan juga nilai numerik untuk simulasi
    if (mode === 'Turbo') {
      state.dutyCycle = 'ON 100%';
      state.blowerOnMnt  = null; // always ON, no cycling
      state.blowerOffMnt = null;
    } else if (mode === 'Efisien') {
      let onMnt;
      if (mc < 2)       { onMnt = 20; }
      else if (mc <= 3) { onMnt = 25; }
      else              { onMnt = 30; }
      state.blowerOnMnt  = onMnt;
      state.blowerOffMnt = 10;
      state.dutyCycle = `ON ${onMnt} / OFF 10`;
    } else if (mode === 'Custom') {
      state.blowerOnMnt  = customOn;
      state.blowerOffMnt = customOff;
      state.dutyCycle = `ON ${customOn} / OFF ${customOff}`;
    } else {
      state.dutyCycle    = '—';
      state.blowerOnMnt  = 30;
      state.blowerOffMnt = 10;
    }

    // Update UI
    $('#batchId').textContent = `#${state.batchId}`;
    $('#batchMC').textContent = `${mc}%`;
    $('#batchMode').textContent = mode;
    $('#batchWeight').textContent = `${weight} kg`;
    $('#pageSubtitle').textContent = `Mesin: Dryer 01 — Batch #${state.batchId}`;

    updateOvenStatus();
    updateBlowerDisplay();

    // Add to post-batch select
    const opt = document.createElement('option');
    opt.value = state.batchId;
    opt.textContent = `#${state.batchId} — ${operator} — ${new Date().toLocaleDateString('id-ID')}`;
    $('#postBatchSelect').appendChild(opt);

    // === FIREBASE: Save pre-batch data ===
    const durasiMenit = parseInt($('#preDurasi').value) || 360;
    FirebaseService.startBatch(state.batchId, {
      machineId: $('#preSelectMachine').value || CONFIG.defaultMachineId,
      operator,
      mcAwal: mc,
      beratAwal: weight,
      jmlKompor: parseInt($('#preJmlKompor').value) || 2,
      tipeGas: parseInt($('#preTipeGas').value) || 12,
      jmlTabung: parseInt($('#preJmlTabung').value) || 2,
      modeBlower: mode,
      // Duty cycle yang dipakai — kunci untuk ML training
      dutyOnMnt:  mode === 'Custom' ? customOn  : (mode === 'Turbo' ? null : null),
      dutyOffMnt: mode === 'Custom' ? customOff : (mode === 'Turbo' ? null : null),
      durasiRencana: durasiMenit,
      catatan: $('#preCatatan').value || '',
    });

    // Reset akumulator suhu untuk batch baru
    state.tempAcc = {
      leftSum: 0, leftCount: 0,
      rightSum: 0, rightCount: 0,
      burnerSum: 0, burnerCount: 0,
      burnerMax: -Infinity, burnerMin: Infinity,
    };
    // Reset blower stats
    state.batchBlowerStats = {
      blowerOnTotal: null, blowerSiklus: null,
      dutyOnMnt: null, dutyOffMnt: null, mode: null,
    };
    // Reset blower simulation cycle untuk batch baru
    blowerCycleTimer = 0;
    blowerPhase = 'on';


    // Set estimated end time for countdown
    state.batchEstimatedEnd = Date.now() + (durasiMenit * 60 * 1000);
    state.batchTimerFired = false;

    // Update countdown display label
    const cdLabel = $('#batchCountdownLabel');
    if (cdLabel) cdLabel.textContent = `Sisa: ${durasiMenit} mnt`;

    // Re-enable modal buttons for new batch
    const bcmStop = $('#bcmStopAlarm');
    const bcmBlower = $('#bcmStopBlower');
    if (bcmStop) { bcmStop.disabled = false; bcmStop.style.opacity = '1'; }
    if (bcmBlower) { bcmBlower.disabled = false; bcmBlower.style.opacity = '1'; }

    // === MQTT: Notify ESP32 ===
    const batchPayload = {
      batchId: state.batchId,
      mode,
      mc_awal: mc,
      berat_awal: weight,
      custom_on:  mode === 'Custom' ? customOn  : null,
      custom_off: mode === 'Custom' ? customOff : null,
    };
    console.log('[MQTT] sendBatchStart payload:', JSON.stringify(batchPayload));
    MQTTService.sendBatchStart(batchPayload);

    addAlarm('info', `Batch #${state.batchId} dimulai oleh ${operator}. Mode: ${mode}.`);
    showToast(`Batch #${state.batchId} berhasil dimulai!`, '🔥');

    navigateTo('monitoring');
  });

  // Post-batch form - auto calculations
  const calcFields = ['postMCAkhir', 'postBeratMesh', 'postBeratBrontol', 'postGasTerpakai'];
  calcFields.forEach((id) => {
    $(`#${id}`).addEventListener('input', calculatePostBatch);
  });

  $('#postBatchForm').addEventListener('submit', (e) => {
    e.preventDefault();

    // Calculate values for Firebase
    const mcAkhir = parseFloat($('#postMCAkhir').value) || 0;
    const beratMesh = parseFloat($('#postBeratMesh').value) || 0;
    const beratBrontol = parseFloat($('#postBeratBrontol').value) || 0;
    const gasTerpakai = parseFloat($('#postGasTerpakai').value) || 0;
    const beratAwal = parseFloat($('#batchWeight').textContent) || 400;
    const beratAkhir = beratMesh + beratBrontol;
    const susutKg = beratAwal - beratAkhir;
    const susutPersen = beratAwal > 0 ? (susutKg / beratAwal) * 100 : 0;
    const targetTercapai = mcAkhir < 1;
    const efisiensiScore = beratAkhir > 0 && gasTerpakai > 0 ? gasTerpakai / beratAkhir : 0;
    const durasiAktual = state.batchStartTime ? Math.round((Date.now() - state.batchStartTime) / 60000) : 0;

    // === FIREBASE: Save post-batch data ===
    FirebaseService.completeBatch(state.batchId, {
      mcAkhir,
      beratMesh,
      beratBrontol,
      gasTerpakai,
      susutKg,
      susutPersen,
      targetTercapai,
      efisiensiScore,
      durasiAktual,
      catatan: $('#postCatatan').value || '',
      // Data blower dari ESP32 (sudah diterima via MQTT oven/batch/result)
      blowerOnTotal: state.batchBlowerStats.blowerOnTotal,
      blowerSiklus:  state.batchBlowerStats.blowerSiklus,
      // Ringkasan suhu selama batch
      suhuAvgLeft:   state.tempAcc.leftCount   > 0 ? state.tempAcc.leftSum   / state.tempAcc.leftCount   : null,
      suhuAvgRight:  state.tempAcc.rightCount  > 0 ? state.tempAcc.rightSum  / state.tempAcc.rightCount  : null,
      suhuAvgBurner: state.tempAcc.burnerCount > 0 ? state.tempAcc.burnerSum / state.tempAcc.burnerCount : null,
      suhuMaxBurner: state.tempAcc.burnerMax > -Infinity ? state.tempAcc.burnerMax : null,
      suhuMinBurner: state.tempAcc.burnerMin < Infinity  ? state.tempAcc.burnerMin : null,
    });


    // === MQTT: Notify ESP32 ===
    MQTTService.sendBatchStop(state.batchId);

    state.batchActive = false;
    state.blower1 = false;
    state.blower2 = false;
    state.blowerMode = '—';
    state.dutyCycle = '—';
    state.batchEstimatedEnd = null;
    state.batchTimerFired = false;
    state.blowerForceOff = false; // reset for next batch
    stopAlarmSound();

    // Reset countdown display
    const cdEl = $('#batchCountdown');
    if (cdEl) {
      cdEl.textContent = '—';
      cdEl.classList.remove('countdown-expired', 'countdown-warning');
    }

    updateOvenStatus();
    updateBlowerDisplay();

    addAlarm('success', `Batch #${state.batchId} selesai. Hasil telah disimpan.`);
    showToast('Hasil batch berhasil disimpan!', '📊');

    // Reset batch display
    $('#batchId').textContent = '#—';
    $('#batchDuration').textContent = '00:00:00';
    $('#batchMC').textContent = '—%';
    $('#batchMode').textContent = '—';
    $('#batchWeight').textContent = '— kg';

    navigateTo('monitoring');
  });

  // Register machine
  $('#addMachineBtn').addEventListener('click', () => {
    $('#registerMachineCard').style.display = 'block';
    $('#registerMachineCard').scrollIntoView({ behavior: 'smooth' });
  });

  $('#cancelRegisterBtn').addEventListener('click', () => {
    $('#registerMachineCard').style.display = 'none';
  });

  $('#registerMachineForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = $('#regNamaMesin').value;
    const capacity = $('#regKapasitas').value;
    const volBakar = $('#regVolBakar').value || '—';
    const volProduk = $('#regVolProduk').value || '—';
    const rpm = $('#regRPM').value || '—';
    const machineId = name.toLowerCase().replace(/\s/g, '');

    const tbody = $('#machineTableBody');
    const rowCount = tbody.children.length + 1;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-family: var(--font-mono); font-weight: 600;">#${String(rowCount).padStart(3, '0')}</td>
      <td>${name}</td>
      <td>${capacity}</td>
      <td>${volBakar}</td>
      <td>${volProduk}</td>
      <td>${rpm}</td>
      <td><span class="blower-status on">Aktif</span></td>
    `;
    tbody.appendChild(row);

    // Add to pre-batch select
    const opt = document.createElement('option');
    opt.value = machineId;
    opt.textContent = name;
    $('#preSelectMachine').appendChild(opt);

    // === FIREBASE: Save machine ===
    FirebaseService.saveMachine(machineId, {
      name,
      capacity_kg: parseInt(capacity) || 0,
      vol_burner: volBakar,
      vol_product: volProduk,
      rpm_blower: parseInt(rpm) || 0,
      status: 'active',
    });

    showToast(`Mesin "${name}" berhasil didaftarkan!`, '⚙️');
    $('#registerMachineCard').style.display = 'none';
    e.target.reset();
  });
}

function calculatePostBatch() {
  const mcAkhir = parseFloat($('#postMCAkhir').value) || 0;
  const beratMesh = parseFloat($('#postBeratMesh').value) || 0;
  const beratBrontol = parseFloat($('#postBeratBrontol').value) || 0;
  const gasTerpakai = parseFloat($('#postGasTerpakai').value) || 0;

  // Get pre-batch weight from state (simplified)
  const beratAwal = parseFloat($('#batchWeight').textContent) || 400;
  const beratAkhirTotal = beratMesh + beratBrontol;
  const susutKg = beratAwal - beratAkhirTotal;
  const susutPct = beratAwal > 0 ? (susutKg / beratAwal) * 100 : 0;
  const targetTercapai = mcAkhir < 1;
  const efisiensi = beratAkhirTotal > 0 && gasTerpakai > 0 ? (gasTerpakai / beratAkhirTotal).toFixed(3) : '—';

  $('#calcSusutKg').textContent = susutKg > 0 ? `${susutKg.toFixed(1)} kg` : '—';
  $('#calcSusutPct').textContent = susutPct > 0 ? `${susutPct.toFixed(1)}%` : '—';
  $('#calcTargetMC').textContent = mcAkhir > 0 ? (targetTercapai ? '✅ Ya' : '❌ Belum') : '—';
  $('#calcTargetMC').style.color = targetTercapai ? '#27AE60' : '#E74C3C';
  $('#calcEfisiensi').textContent = efisiensi !== '—' ? `${efisiensi} kg/kg` : '—';
}

// ===== BLOWER SIMULATION =====
// Simulates blower duty cycling in Efisien & Custom mode.
// Tick runs every 2 seconds → 1 menit = 30 ticks.
let blowerCycleTimer = 0;
let blowerPhase = 'on'; // 'on' or 'off'

function updateBlowerSimulation() {
  if (!state.batchActive) return;

  // Manual override: blower paksa OFF, jangan dikembalikan
  if (state.blowerForceOff) return;

  // Turbo mode: selalu ON, tidak ada cycling
  if (state.blowerMode === 'Turbo') {
    state.blower1 = true;
    state.blower2 = true;
    return;
  }

  // Efisien & Custom: keduanya pakai nilai blowerOnMnt / blowerOffMnt dari state
  const TICKS_PER_MINUTE = 30; // 1 tick = 2 detik → 30 ticks = 60 detik = 1 menit
  const onMnt  = state.blowerOnMnt  || 30;
  const offMnt = state.blowerOffMnt || 10;
  const maxTicks = blowerPhase === 'on'
    ? onMnt  * TICKS_PER_MINUTE
    : offMnt * TICKS_PER_MINUTE;

  if (state.blowerMode === 'Efisien' || state.blowerMode === 'Custom') {
    blowerCycleTimer++;

    if (blowerCycleTimer >= maxTicks) {
      blowerCycleTimer = 0;
      if (blowerPhase === 'on') {
        blowerPhase = 'off';
        state.blower1 = false;
        state.blower2 = false;
        addAlarm('info',
          `🌀 Blower OFF — fase pendinginan [${state.blowerMode}] (ON ${onMnt} mnt → OFF ${offMnt} mnt)`);
      } else {
        blowerPhase = 'on';
        state.blower1 = true;
        state.blower2 = true;
        addAlarm('info',
          `🌀 Blower ON — fase pengeringan [${state.blowerMode}] (ON ${onMnt} mnt / OFF ${offMnt} mnt)`);
      }
    }
  }
}

// ===== DEMO: Random alarm events =====
function maybeGenerateAlarm() {
  if (!state.batchActive) return;
  const rand = Math.random();
  if (rand < 0.005) {
    addAlarm('warning', `Suhu R. Pembakaran mendekati batas atas (${state.temperatures.burner.toFixed(1)}°C)`);
  } else if (rand < 0.008) {
    addAlarm('info', `Suhu rata-rata produk: ${((state.temperatures.left + state.temperatures.right) / 2).toFixed(1)}°C`);
  }
}

// ===== MAIN LOOP =====
function tick() {
  updateClock();

  // Only run simulation when in simulation mode
  const isLive = typeof CONFIG !== 'undefined' && CONFIG.mode !== 'simulation';
  if (!isLive) {
    updateSimulatedData();
    updateBlowerSimulation();
    maybeGenerateAlarm();
  }

  updateTemperatureDisplay();
  updateBlowerDisplay();
  updateBatchDuration();
  updateBatchCountdown();
  updateChart();
}

// ===== SERVICE INTEGRATION =====

/**
 * Initialize MQTT message handlers
 * Routes incoming MQTT messages to update dashboard state
 */
function initMQTTHandlers() {
  // Temperature updates from ESP32 — update UI immediately on receipt
  MQTTService.on(CONFIG.topics.suhuProdukKiri, (payload) => {
    state.temperatures.left = parseFloat(payload);
    updateTemperatureDisplay();
    if (state.currentPage === 'troubleshoot') updateTroubleshootSensors();
  });
  MQTTService.on(CONFIG.topics.suhuProdukKanan, (payload) => {
    state.temperatures.right = parseFloat(payload);
    updateTemperatureDisplay();
    if (state.currentPage === 'troubleshoot') updateTroubleshootSensors();
  });
  MQTTService.on(CONFIG.topics.suhuPembakaran, (payload) => {
    state.temperatures.burner = parseFloat(payload);
    updateTemperatureDisplay();
    if (state.currentPage === 'troubleshoot') updateTroubleshootSensors();
  });

  // Blower status — update UI immediately
  MQTTService.on(CONFIG.topics.blowerStatus, (payload) => {
    const on = payload === 'ON';
    state.blower1 = on;
    state.blower2 = on;
    updateBlowerDisplay();
  });
  MQTTService.on(CONFIG.topics.blowerDutyCycle, (payload) => {
    state.dutyCycle = payload;
    updateBlowerDisplay();
  });

  // Alarm from ESP32
  MQTTService.on(CONFIG.topics.alarmStatus, (payload) => {
    if (payload !== 'NORMAL') {
      addAlarm('danger', `⚠️ ESP32 Alarm: ${payload}`);
      FirebaseService.saveAlarm(CONFIG.defaultMachineId, {
        batch_id: state.batchId,
        type: payload,
        message: `Alarm dari ESP32: ${payload}`,
      });
    }
  });

  // Record telemetry into history for chart + akumulasi suhu per-batch
  MQTTService.on('*', () => {
    state.tempHistory.push({
      time: new Date(),
      left: state.temperatures.left,
      right: state.temperatures.right,
      burner: state.temperatures.burner,
    });
    if (state.tempHistory.length > (CONFIG.telemetry?.maxHistoryPoints || 1800)) {
      state.tempHistory.shift();
    }

    // Akumulasi suhu hanya saat batch aktif dan nilai valid (bukan 0 dari inisialisasi)
    if (state.batchActive) {
      const { left, right, burner } = state.temperatures;
      if (left > 0) {
        state.tempAcc.leftSum   += left;
        state.tempAcc.leftCount++;
      }
      if (right > 0) {
        state.tempAcc.rightSum  += right;
        state.tempAcc.rightCount++;
      }
      if (burner > 0) {
        state.tempAcc.burnerSum  += burner;
        state.tempAcc.burnerCount++;
        if (burner > state.tempAcc.burnerMax) state.tempAcc.burnerMax = burner;
        if (burner < state.tempAcc.burnerMin) state.tempAcc.burnerMin = burner;
      }
    }
  });

  // Batch result dari ESP32 (dikirim saat handleBatchStop)
  // Payload: { batchId, durasi_aktual, blower_on_total, blower_siklus, duty_on_mnt, duty_off_mnt, mode }
  MQTTService.on(CONFIG.topics.batchResult, (payload) => {
    try {
      const data = JSON.parse(payload);
      // Simpan ke state untuk dipakai saat completeBatch
      state.batchBlowerStats = {
        blowerOnTotal: data.blower_on_total ?? null,
        blowerSiklus:  data.blower_siklus  ?? null,
        dutyOnMnt:     data.duty_on_mnt    ?? null,
        dutyOffMnt:    data.duty_off_mnt   ?? null,
        mode:          data.mode           ?? null,
      };
      console.log('[BATCH RESULT] Blower stats dari ESP32:', state.batchBlowerStats);

      // Juga langsung save ke Firebase jika batch ID cocok
      if (data.batchId && FirebaseService.isReady()) {
        FirebaseService.updateBatchBlowerStats(data.batchId, state.batchBlowerStats);
      }
    } catch (e) {
      console.warn('[BATCH RESULT] Gagal parse payload:', payload, e);
    }
  });


  // ESP32 online/offline status (via retained MQTT topic with LWT)
  // NOTE: We cannot blindly trust the retained "ONLINE" message — it may be stale from a previous session.
  // Solution: when ONLINE is received, send a PING and start a 6-second verification timeout.
  // If ESP32 responds with PONG/STATUS within 6s → genuinely online.
  // If no response → stale retained message, mark offline.
  MQTTService.on('oven/esp32/status', (payload) => {
    if (payload.trim() === 'ONLINE') {
      // Show "verifying" state while we wait for PONG
      const dot  = $('#esp32Status');
      const text = $('#esp32StatusText');
      if (dot)  dot.style.background  = '#F39C12'; // orange = verifying
      if (text) text.textContent = 'ESP32: Memverifikasi...';

      // Clear any existing verify timer
      if (window._esp32VerifyTimer) { clearTimeout(window._esp32VerifyTimer); }

      // Send PING to confirm ESP32 is actually alive
      MQTTService.publish('oven/troubleshoot/command', 'PING');

      // 6-second timeout: if no PONG/STATUS reply → stale message → offline
      window._esp32VerifyTimer = setTimeout(() => {
        window._esp32VerifyTimer = null;
        state.esp32Online = false;
        updateESP32Status();
        tsLog('warning', '⚠️ ESP32 tidak merespons PING — dianggap offline (pesan lama di broker)');
      }, 6000);

    } else {
      // "OFFLINE" — either LWT fired or explicit publish
      if (window._esp32VerifyTimer) { clearTimeout(window._esp32VerifyTimer); window._esp32VerifyTimer = null; }
      state.esp32Online = false;
      updateESP32Status();
      tsLog('warning', '⚠️ ESP32 terputus dari broker MQTT');
      addAlarm('warning', '⚠️ ESP32 offline — koneksi ke hardware terputus.');
    }
  });

  // Connection status UI
  MQTTService.onStatusChange((connected, extra) => {
    const dot = $('#mqttStatus');
    const text = $('#mqttStatusText');
    if (connected) {
      dot.className = 'status-dot';
      dot.style.background = '';
      text.textContent = 'MQTT: Terhubung';

      // Auto-request STATUS dari ESP32 saat pertama connect (delay 1.5s agar subscribe selesai)
      setTimeout(() => {
        MQTTService.publish('oven/troubleshoot/command', 'STATUS');
        tsLog('info', 'Auto-request STATUS ESP32 saat connect...');
        // Set placeholder "menunggu" di panel koneksi
        ['rssi','ssid','ip','mqtt','uptime','heap'].forEach(k => {
          const el = $(`#tsDiag-${k}`);
          if (el && el.textContent.includes('—')) el.textContent = '...';
        });
      }, 1500);

      // Auto-refresh STATUS setiap 30 detik
      if (window._statusInterval) clearInterval(window._statusInterval);
      window._statusInterval = setInterval(() => {
        if (MQTTService.isConnected()) {
          MQTTService.publish('oven/troubleshoot/command', 'STATUS');
        }
      }, 30000);

    } else {
      dot.className = 'status-dot offline';
      text.textContent = extra === 'reconnecting' ? 'MQTT: Reconnecting...' : 'MQTT: Terputus';
      if (window._statusInterval) {
        clearInterval(window._statusInterval);
        window._statusInterval = null;
      }
      // Also mark ESP32 offline when broker connection drops
      if (window._esp32VerifyTimer) { clearTimeout(window._esp32VerifyTimer); window._esp32VerifyTimer = null; }
      state.esp32Online = false;
      updateESP32Status();
      // Reset panel koneksi saat disconnect
      ['rssi','ssid','ip','mqtt','uptime','heap'].forEach(k => {
        const el = $(`#tsDiag-${k}`);
        if (el) el.textContent = '—';
      });
    }
  });
}

/**
 * Update ESP32 online/offline indicator in sidebar
 */
function updateESP32Status() {
  const dot  = $('#esp32Status');
  const text = $('#esp32StatusText');
  const btn  = $('#startBatchBtn');
  const isLiveMode = typeof CONFIG !== 'undefined' && CONFIG.mode !== 'simulation';

  if (!dot || !text) return;

  if (state.esp32Online) {
    dot.style.background = 'var(--clr-success)';
    text.textContent = 'ESP32: Online ✅';
    // Re-enable the start batch button
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.title = ''; }
  } else {
    dot.style.background = isLiveMode ? 'var(--clr-danger, #E74C3C)' : 'var(--clr-text-muted)';
    text.textContent = isLiveMode ? 'ESP32: Offline ⚠️' : 'ESP32: —';
    // Visually warn that batch can't start (but don't fully disable — guard is in submit handler)
    if (btn && isLiveMode) {
      btn.title = 'ESP32 harus online sebelum batch bisa dimulai';
    }
  }
}

/**
 * Update sidebar status indicators
 */
function updateServiceStatus() {
  const mode = typeof CONFIG !== 'undefined' ? CONFIG.mode : 'simulation';
  const badge = $('#dataSourceBadge');
  const fbDot = $('#firebaseStatus');
  const fbText = $('#firebaseStatusText');

  if (badge) {
    if (mode === 'simulation') {
      badge.textContent = '🧪 Mode: Simulasi';
      badge.style.background = 'var(--clr-warning-light)';
      badge.style.color = 'var(--clr-warning)';
    } else {
      badge.textContent = '📡 Mode: Live';
      badge.style.background = 'var(--clr-success-light)';
      badge.style.color = 'var(--clr-accent-dark)';
    }
  }

  if (fbDot && fbText) {
    if (FirebaseService.isReady()) {
      fbDot.style.background = 'var(--clr-success)';
      fbText.textContent = 'Firebase: Terhubung';
    } else {
      fbDot.style.background = 'var(--clr-text-muted)';
      fbText.textContent = 'Firebase: Tidak aktif';
    }
  }
}

/**
 * Load batch history from Firebase and render as table
 */
async function loadBatchHistory() {
  const container = $('#historyContent');
  if (!container) return;

  if (!FirebaseService.isReady()) {
    container.innerHTML = `
      <div class="alarm-empty">
        <div style="font-size:2rem; margin-bottom:8px;">🔌</div>
        <div style="font-weight:600; margin-bottom:4px;">Firebase Tidak Terhubung</div>
        <div style="font-size:0.8rem;">Isi konfigurasi Firebase di <code>config.js</code> untuk melihat riwayat batch</div>
      </div>`;
    return;
  }

  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--clr-text-muted);">⏳ Memuat data...</div>';

  try {
    const batches = await FirebaseService.getBatchHistory(30);

    if (!batches || batches.length === 0) {
      container.innerHTML = `
        <div class="alarm-empty">
          <div style="font-size:2rem; margin-bottom:8px;">📋</div>
          <div style="font-weight:600; margin-bottom:4px;">Belum ada riwayat batch</div>
          <div style="font-size:0.8rem;">Riwayat akan muncul setelah Anda menyelesaikan batch pertama</div>
        </div>`;
      return;
    }

    // Mobile: use card layout; Desktop: use table
    const isMobile = window.innerWidth < 640;

    if (isMobile) {
      // Mobile card layout — much easier to read on small screens
      let html = '<div style="display:flex;flex-direction:column;gap:12px;">';
      batches.forEach((b) => {
        const startDate = b.start_time
          ? new Date(b.start_time).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
          : '—';
        const pre = b.pre_batch || {};
        const sum = b.summary || {};
        const statusClass = b.status === 'completed' ? 'on' : b.status === 'active' ? 'on' : 'off';
        const statusLabel = b.status === 'completed' ? 'Selesai' : b.status === 'active' ? 'Aktif' : b.status;

        html += `
          <div style="background:var(--clr-bg);border-radius:var(--radius-md);padding:14px;border:1px solid var(--clr-border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <span style="font-family:var(--font-mono);font-weight:700;font-size:0.95rem;color:var(--clr-text);">#${b.id}</span>
              <span class="blower-status ${statusClass}">${statusLabel}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.8rem;">
              <div><span style="color:var(--clr-text-muted);display:block;">Operator</span><strong>${b.operator_name || '—'}</strong></div>
              <div><span style="color:var(--clr-text-muted);display:block;">Mulai</span><strong>${startDate}</strong></div>
              <div><span style="color:var(--clr-text-muted);display:block;">MC Awal</span><strong>${pre.mc_awal != null ? pre.mc_awal + '%' : '—'}</strong></div>
              <div><span style="color:var(--clr-text-muted);display:block;">Mode Blower</span><strong>${pre.mode_blower || '—'}</strong></div>
              <div><span style="color:var(--clr-text-muted);display:block;">Berat Awal</span><strong>${pre.berat_awal_kg ? pre.berat_awal_kg + ' kg' : '—'}</strong></div>
              <div><span style="color:var(--clr-text-muted);display:block;">MC Akhir</span><strong>${sum.target_mc_tercapai != null ? (b.post_batch?.mc_akhir + '%') : '—'}</strong></div>
              <div><span style="color:var(--clr-text-muted);display:block;">Susut</span><strong>${sum.susut_persen != null ? sum.susut_persen.toFixed(1) + '%' : '—'}</strong></div>
            </div>
          </div>`;
      });
      html += '</div>';
      container.innerHTML = html;
    } else {
      // Desktop: normal table
      let html = `<div class="table-wrapper"><table>
        <thead><tr>
          <th>Batch ID</th><th>Operator</th><th>Mulai</th>
          <th>MC Awal</th><th>Mode</th><th>Berat (kg)</th>
          <th>MC Akhir</th><th>Susut (%)</th><th>Status</th>
        </tr></thead><tbody>`;

      batches.forEach((b) => {
        const startDate = b.start_time
          ? new Date(b.start_time).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
          : '—';
        const pre = b.pre_batch || {};
        const sum = b.summary || {};
        const statusClass = b.status === 'completed' ? 'on' : b.status === 'active' ? 'on' : 'off';
        const statusLabel = b.status === 'completed' ? 'Selesai' : b.status === 'active' ? 'Aktif' : b.status;

        html += `<tr>
          <td style="font-family:var(--font-mono);font-weight:600;">#${b.id}</td>
          <td>${b.operator_name || '—'}</td>
          <td>${startDate}</td>
          <td>${pre.mc_awal != null ? pre.mc_awal + '%' : '—'}</td>
          <td>${pre.mode_blower || '—'}</td>
          <td>${pre.berat_awal_kg || '—'}</td>
          <td>${sum.target_mc_tercapai != null ? (b.post_batch?.mc_akhir + '%') : '—'}</td>
          <td>${sum.susut_persen != null ? sum.susut_persen.toFixed(1) + '%' : '—'}</td>
          <td><span class="blower-status ${statusClass}">${statusLabel}</span></td>
        </tr>`;
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;
    }
  } catch (err) {
    console.error('❌ Load batch history error:', err);
    container.innerHTML = `<div class="alarm-empty"><div style="font-size:2rem;">❌</div>Gagal memuat data</div>`;
  }
}

// ===== TROUBLESHOOT =====

// Troubleshoot state
const tsState = {
  ssr1: false,
  ssr2: false,
  alarm: false,
  logs: [],
};

/**
 * Add entry to troubleshoot command log
 */
function tsLog(type, message) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  tsState.logs.unshift({ type, message, time: timeStr });
  if (tsState.logs.length > 50) tsState.logs.pop();

  const container = $('#tsLogContainer');
  if (!container) return;

  const typeClass = {
    info: 'ts-log-info',
    success: 'ts-log-success',
    warning: 'ts-log-warning',
    error: 'ts-log-error',
  };

  const entry = document.createElement('div');
  entry.className = `ts-log-entry ${typeClass[type] || 'ts-log-info'}`;
  entry.innerHTML = `<span class="ts-log-time">${timeStr}</span><span class="ts-log-msg">${message}</span>`;
  container.insertBefore(entry, container.firstChild);

  // Keep max 30 entries in DOM
  while (container.children.length > 30) {
    container.removeChild(container.lastChild);
  }
}

/**
 * Toggle individual output (SSR1, SSR2, Alarm)
 */
function troubleshootToggle(device, turnOn) {
  try {
    // Safety: warn if batch is active — use toast instead of confirm() (mobile-safe)
    if (state.batchActive) {
      addAlarm('warning', `⚠️ Kontrol manual [${device.toUpperCase()}] saat batch aktif!`);
      showToast('⚠️ Hati-hati: batch sedang aktif!', '⚠️');
      // Continue anyway — operator needs to be able to stop things
    }

    tsState[device] = turnOn;

  // Map device to MQTT topic
  const topicMap = {
    ssr1: 'oven/troubleshoot/ssr1',
    ssr2: 'oven/troubleshoot/ssr2',
    alarm: 'oven/troubleshoot/alarm',
  };

  const nameMap = {
    ssr1: 'SSR #1 (Blower 1)',
    ssr2: 'SSR #2 (Blower 2)',
    alarm: 'Alarm Sirine',
  };

  // Send MQTT command
  const topic = topicMap[device];
  const payload = turnOn ? 'ON' : 'OFF';
  const sent = MQTTService.publish(topic, payload);

  // Update UI
  const badge = $(`#tsStatus-${device}`);
  const card = $(`#tsCard-${device}`);
  if (badge) {
    badge.textContent = turnOn ? 'ON' : 'OFF';
    badge.className = `ts-status-badge ${turnOn ? 'on' : 'off'}`;
  }
  if (card) {
    card.classList.toggle('active', turnOn);
  }

  // Update "All" status
  updateAllStatus();

  // Log
  const statusText = turnOn ? 'ON' : 'OFF';
  if (sent) {
    tsLog('success', `${nameMap[device]} → ${statusText} (MQTT sent)`);
  } else {
    tsLog('warning', `${nameMap[device]} → ${statusText} (MQTT offline — command queued)`);
  }

    showToast(`${nameMap[device]}: ${statusText}`, turnOn ? '✅' : '🔴');
  } catch (err) {
    console.error('[troubleshootToggle] Error:', err);
    showToast('❌ Error: ' + err.message, '❌');
  }
}

/**
 * Toggle all outputs simultaneously
 */
function troubleshootToggleAll(turnOn) {
  // Warn via toast instead of confirm (mobile-safe)
  if (state.batchActive) {
    addAlarm('warning', '⚠️ Semua output dikontrol manual saat batch aktif!');
    showToast('⚠️ Batch aktif — kontrol manual dijalankan', '⚠️');
  }

  troubleshootToggle('ssr1', turnOn);
  troubleshootToggle('ssr2', turnOn);
  troubleshootToggle('alarm', turnOn);
}

/**
 * Update the "All" card status
 */
function updateAllStatus() {
  const allOn = tsState.ssr1 && tsState.ssr2 && tsState.alarm;
  const badge = $('#tsStatus-all');
  const card = $('#tsCard-all');
  if (badge) {
    badge.textContent = allOn ? 'ALL ON' : 'OFF';
    badge.className = `ts-status-badge ${allOn ? 'on' : 'off'}`;
  }
  if (card) {
    card.classList.toggle('active', allOn);
  }
}

/**
 * Execute quick diagnostic actions
 */
function troubleshootAction(action) {
  try {
    const actionMap = {
      'ping': { topic: 'oven/troubleshoot/command', payload: 'PING', label: 'Ping ESP32' },
      'restart': { topic: 'oven/troubleshoot/command', payload: 'RESTART', label: 'Restart ESP32' },
      'read-sensors': { topic: 'oven/troubleshoot/command', payload: 'READ_SENSORS', label: 'Baca semua sensor' },
      'status': { topic: 'oven/troubleshoot/command', payload: 'STATUS', label: 'Request status lengkap' },
    };

    const cmd = actionMap[action];
    if (!cmd) return;

    // Use toast warning instead of confirm() for mobile compatibility
    if (action === 'restart') {
      showToast('🔄 Restart ESP32 dikirim...', '⚠️');
    }

    const sent = MQTTService.publish(cmd.topic, cmd.payload);
    if (sent) {
      tsLog('info', `Perintah dikirim: ${cmd.label}`);
    } else {
      tsLog('error', `Gagal mengirim: ${cmd.label} — MQTT tidak terhubung`);
    }
  } catch (err) {
    console.error('[troubleshootAction] Error:', err);
  }
}

/**
 * Update sensor readings on troubleshoot page from current state
 */
function updateTroubleshootSensors() {
  const { left, right, burner } = state.temperatures;
  const tc1El = $('#tsSensor-tc1');
  const tc2El = $('#tsSensor-tc2');
  const tc3El = $('#tsSensor-tc3');

  if (tc1El) tc1El.innerHTML = `<span class="ts-sensor-temp">${left.toFixed(1)}</span><span class="ts-sensor-unit">°C</span>`;
  if (tc2El) tc2El.innerHTML = `<span class="ts-sensor-temp">${right.toFixed(1)}</span><span class="ts-sensor-unit">°C</span>`;
  if (tc3El) tc3El.innerHTML = `<span class="ts-sensor-temp">${burner.toFixed(1)}</span><span class="ts-sensor-unit">°C</span>`;
}

/**
 * Initialize troubleshoot event listeners
 */
function initTroubleshoot() {
  // Clear log button
  const clearBtn = $('#tsClearLogBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const container = $('#tsLogContainer');
      if (container) container.innerHTML = '';
      tsState.logs = [];
      tsLog('info', 'Log dibersihkan.');
    });
  }

  // === Troubleshoot toggle buttons (data-ts-device) ===
  $$('[data-ts-device]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const device = btn.dataset.tsDevice;
      const turnOn = btn.dataset.tsState === 'on';
      troubleshootToggle(device, turnOn);
    });
  });

  // === Troubleshoot all toggle buttons (data-ts-all) ===
  $$('[data-ts-all]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const turnOn = btn.dataset.tsAll === 'on';
      troubleshootToggleAll(turnOn);
    });
  });

  // === Troubleshoot quick action buttons (data-ts-action) ===
  $$('[data-ts-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      troubleshootAction(btn.dataset.tsAction);
    });
  });

  // === Batch complete modal buttons (data-bcm-action) ===
  $$('[data-bcm-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      batchCompleteAction(btn.dataset.bcmAction);
    });
  });

  // Listen for troubleshoot response from ESP32
  if (typeof MQTTService !== 'undefined' && MQTTService.on) {
    MQTTService.on('oven/troubleshoot/response', (payload) => {
      try {
        const data = JSON.parse(payload);

        // PONG or TS_EXIT: confirm ESP32 is online, clear verify timer
        if (data.response === 'TS_EXIT' || data.response === 'PONG') {
          if (data.response === 'PONG') {
            // PONG confirms ESP32 is genuinely alive
            if (window._esp32VerifyTimer) { clearTimeout(window._esp32VerifyTimer); window._esp32VerifyTimer = null; }
            state.esp32Online = true;
            updateESP32Status();
            tsLog('success', `✅ ESP32 online & merespons — PONG diterima (uptime: ${data.uptime_ms ?? '?'}ms)`);
          } else {
            tsLog('info', `ESP32: TS_EXIT`);
          }
          return;
        }

        // Any valid STATUS response also confirms ESP32 is online
        if (window._esp32VerifyTimer) { clearTimeout(window._esp32VerifyTimer); window._esp32VerifyTimer = null; }
        if (!state.esp32Online) {
          state.esp32Online = true;
          updateESP32Status();
        }
        tsLog('success', `✅ Status ESP32 diterima`);

        // Update panel koneksi
        if (data.rssi !== undefined) {
          const el = $('#tsDiag-rssi');
          if (el) el.textContent = `${data.rssi} dBm`;
        }
        if (data.ssid) {
          const el = $('#tsDiag-ssid');
          if (el) el.textContent = data.ssid;
        }
        if (data.ip) {
          const el = $('#tsDiag-ip');
          if (el) el.textContent = data.ip;
        }
        if (data.mqtt) {
          const el = $('#tsDiag-mqtt');
          if (el) el.textContent = data.mqtt;
        }
        if (data.uptime) {
          const el = $('#tsDiag-uptime');

          if (el) el.textContent = data.uptime;
        }
        if (data.heap) {
          const el = $('#tsDiag-heap');
          if (el) el.textContent = data.heap;
        }

        // Update suhu dari status response juga
        if (data.temp_left  !== undefined) state.temperatures.left   = data.temp_left;
        if (data.temp_right !== undefined) state.temperatures.right  = data.temp_right;
        if (data.temp_burner!== undefined) state.temperatures.burner = data.temp_burner;

      } catch (e) {
        tsLog('info', `ESP32: ${payload}`);
      }
    });
  }
}

/**
 * Initialize mobile bottom navigation
 */
function initMobileNav() {
  $$('.mob-nav-item[data-page]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

/**
 * Initialize swipe-to-open sidebar gesture for mobile
 * Swipe right from the left edge (≤40px) to open, swipe left to close
 */
function initTouchSwipe() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;
  const EDGE_THRESHOLD = 40;   // px from left edge to trigger open
  const SWIPE_DISTANCE = 60;   // minimum horizontal swipe distance

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
  }, { passive: true });

  document.addEventListener('touchmove', () => {
    touchMoved = true;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!touchMoved) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
    if (!isHorizontal) return;

    const sidebar = $('#sidebar');
    const overlay = $('#sidebarOverlay');

    // Swipe RIGHT from left edge → open sidebar
    if (dx > SWIPE_DISTANCE && touchStartX <= EDGE_THRESHOLD) {
      sidebar.classList.add('open');
      overlay.classList.add('active');
    }
    // Swipe LEFT anywhere → close sidebar if open
    if (dx < -SWIPE_DISTANCE && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }
  }, { passive: true });
}

// ===== INIT =====
function init() {
  initNavigation();
  initChart();
  initChartControls();
  initForms();
  updateClock();

  initMobileNav();
  initTouchSwipe();  // swipe gesture for sidebar
  initTroubleshoot();

  // Initialize services
  const mode = typeof CONFIG !== 'undefined' ? CONFIG.mode : 'simulation';

  // Firebase init (works in all modes for data persistence)
  FirebaseService.init();
  if (FirebaseService.isReady()) {
    FirebaseService.seedDefaultData();
  }

  // MQTT init (only in live/hybrid mode)
  if (mode !== 'simulation') {
    MQTTService.init();
    initMQTTHandlers();
  } else {
    // Set MQTT status to show simulation mode
    const mqttDot = $('#mqttStatus');
    const mqttText = $('#mqttStatusText');
    if (mqttDot) { mqttDot.className = 'status-dot offline'; mqttDot.style.background = 'var(--clr-text-muted)'; }
    if (mqttText) mqttText.textContent = 'MQTT: Simulasi';
  }

  // Update status indicators
  updateServiceStatus();

  // Seed initial temperature history (idle state) — for simulation
  if (mode === 'simulation') {
    for (let i = 60; i > 0; i--) {
      const time = new Date(Date.now() - i * 2000);
      state.tempHistory.push({
        time,
        left: 26 + (Math.random() - 0.5) * 3,
        right: 25.5 + (Math.random() - 0.5) * 3,
        burner: 28 + (Math.random() - 0.5) * 4,
      });
    }
  }

  // Fast loop every 1 second — clock & timers (smooth seconds)
  setInterval(() => {
    updateClock();
    updateBatchDuration();
    updateBatchCountdown();
  }, 1000);

  // Main loop every 2 seconds — sensor data, simulation, chart
  setInterval(() => {
    tick();
    // Also update troubleshoot sensors if on that page
    if (state.currentPage === 'troubleshoot') updateTroubleshootSensors();
  }, 2000);

  // Initial render
  tick();

  console.log('%c🥥 SugarDry IoT Dashboard v2.0', 'color: #E67E22; font-size: 16px; font-weight: bold;');
  console.log('%cUNSOED × Central Agro Lestari', 'color: #27AE60; font-size: 12px;');
  console.log(`%c📡 Mode: ${mode}`, 'color: #3498DB; font-size: 12px;');
}

// Start
document.addEventListener('DOMContentLoaded', init);
