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
  temperatures: {
    left: 0,
    right: 0,
    burner: 0,
  },
  prevTemps: { left: 0, right: 0, burner: 0 },
  blower1: false,
  blower2: false,
  blowerMode: '—',
  dutyCycle: '—',
  alarms: [],
  chartRange: 5, // minutes
  tempHistory: [], // { time, left, right, burner }
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

  // Update nav items
  $$('.nav-item').forEach((n) => n.classList.remove('active'));
  $(`.nav-item[data-page="${page}"]`).classList.add('active');

  // Update pages
  $$('.page').forEach((p) => p.classList.remove('active'));
  $(`#page-${page}`).classList.add('active');

  // Update header title
  const titles = {
    monitoring: ['Real-time Monitoring', 'Mesin: Dryer 01'],
    'pre-batch': ['Input Pre-Batch', 'Isi data sebelum memulai pengovenan'],
    'post-batch': ['Input Post-Batch', 'Catat hasil setelah pengovenan selesai'],
    'register-machine': ['Daftar Mesin', 'Kelola mesin oven terdaftar'],
  };

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
  // Pre-batch form
  $('#preBatchForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const mc = parseFloat($('#preMCAwal').value);
    const weight = parseFloat($('#preBeratAwal').value);
    const mode = $('#preModeBlower').value;
    const operator = $('#preOperator').value;

    // Start batch
    state.batchActive = true;
    state.batchId = `B${String(Date.now()).slice(-6)}`;
    state.batchStartTime = Date.now();
    state.blowerMode = mode;
    state.blower1 = true;
    state.blower2 = true;

    // Set duty cycle based on mode
    if (mode === 'Turbo') {
      state.dutyCycle = 'ON 100%';
    } else if (mode === 'Efisien') {
      if (mc < 2) state.dutyCycle = 'ON 20 / OFF 10';
      else if (mc <= 3) state.dutyCycle = 'ON 25 / OFF 10';
      else state.dutyCycle = 'ON 30 / OFF 10';
    } else {
      state.dutyCycle = 'Custom';
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

    state.batchActive = false;
    state.blower1 = false;
    state.blower2 = false;
    state.blowerMode = '—';
    state.dutyCycle = '—';

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
    opt.value = name.toLowerCase().replace(/\s/g, '');
    opt.textContent = name;
    $('#preSelectMachine').appendChild(opt);

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
// Simulates blower cycling in Efisien mode
let blowerCycleTimer = 0;
let blowerPhase = 'on'; // 'on' or 'off'
const BLOWER_ON_DURATION = 30; // seconds (scaled from 30 minutes for demo)
const BLOWER_OFF_DURATION = 10; // seconds (scaled from 10 minutes for demo)

function updateBlowerSimulation() {
  if (!state.batchActive) return;
  if (state.blowerMode === 'Turbo') {
    state.blower1 = true;
    state.blower2 = true;
    return;
  }

  if (state.blowerMode === 'Efisien') {
    blowerCycleTimer++;
    const maxTime = blowerPhase === 'on' ? BLOWER_ON_DURATION : BLOWER_OFF_DURATION;

    if (blowerCycleTimer >= maxTime) {
      blowerCycleTimer = 0;
      if (blowerPhase === 'on') {
        blowerPhase = 'off';
        state.blower1 = false;
        state.blower2 = false;
        addAlarm('info', 'Blower OFF — fase pendinginan');
      } else {
        blowerPhase = 'on';
        state.blower1 = true;
        state.blower2 = true;
        addAlarm('info', 'Blower ON — fase pengeringan');
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
  updateSimulatedData();
  updateTemperatureDisplay();
  updateBlowerSimulation();
  updateBlowerDisplay();
  updateBatchDuration();
  updateChart();
  maybeGenerateAlarm();
}

// ===== INIT =====
function init() {
  initNavigation();
  initChart();
  initChartControls();
  initForms();
  updateClock();

  // Seed initial temperature history (idle state)
  for (let i = 60; i > 0; i--) {
    const time = new Date(Date.now() - i * 2000);
    state.tempHistory.push({
      time,
      left: 26 + (Math.random() - 0.5) * 3,
      right: 25.5 + (Math.random() - 0.5) * 3,
      burner: 28 + (Math.random() - 0.5) * 4,
    });
  }

  // Main loop every 2 seconds
  setInterval(tick, 2000);

  // Initial render
  tick();

  console.log('%c🥥 SugarDry IoT Dashboard v1.0', 'color: #E67E22; font-size: 16px; font-weight: bold;');
  console.log('%cUNSOED × Central Agro Lestari', 'color: #27AE60; font-size: 12px;');
}

// Start
document.addEventListener('DOMContentLoaded', init);
