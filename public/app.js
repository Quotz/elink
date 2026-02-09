// State
let map;
let markers = {};
let stations = [];
let selectedStation = null;
let ws = null;
let chargingStartTime = null;
let chargingTimer = null;
let citrineStatus = { available: false };
let citrineStationStatus = {};
let citrineCheckInterval = null;

// Demo strategy
const DEMO_CHARGER_ID = '30004496';

// Configuration - pricePerKwh comes from station data, fallback to default
const DEFAULT_COST_PER_KWH = 0.15;
const BATTERY_CAPACITY = 60;
const INITIAL_BATTERY = 20;

// Session tracking
let sessionData = {
  startBattery: INITIAL_BATTERY,
  startTime: null,
  maxPower: 0
};

// Connection phase state
let connectionPhase = null; // null | 'awaiting_car' | 'started' | 'timeout'

// Auth state
let currentUser = null;
let authToken = localStorage.getItem('accessToken');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  connectWebSocket();
  setupCardFormatting();
  checkCitrineStatus();
  updateHeaderStats();
  initAuth();
  initReservationUI();
  initCitrineIndicator();
  initSearch();
  
  // Check CitrineOS status periodically
  setInterval(checkCitrineStatus, 30000);
  
  // Poll for station updates when CitrineOS is active
  setInterval(pollStationStatus, 10000);
});

// CitrineOS indicator (status tracked internally, no visible UI element)
function initCitrineIndicator() {}
function updateCitrineIndicator() {}

// Poll station status from backend (fallback when webhooks fail)
async function pollStationStatus() {
  if (!selectedStation) return;
  
  try {
    const response = await fetch(`/api/stations/${encodeURIComponent(selectedStation.id)}`);
    if (response.ok) {
      const data = await response.json();
      // Merge updated data into selected station
      const stationIndex = stations.findIndex(s => s.id === selectedStation.id);
      if (stationIndex >= 0) {
        stations[stationIndex] = { ...stations[stationIndex], ...data };
        selectedStation = stations[stationIndex];
        updatePanel();
        updateMarkers();
      }
    }
  } catch (error) {
    console.error('[Poll] Error fetching station status:', error);
  }
}

// Auth initialization
function initAuth() {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    currentUser = JSON.parse(userStr);
  }
  updateAuthUI();
}

function updateAuthUI() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  // Remove existing user menu
  const existingMenu = document.getElementById('userMenu');
  if (existingMenu) existingMenu.remove();

  const userMenu = document.createElement('div');
  userMenu.id = 'userMenu';
  userMenu.className = 'user-menu';

  if (currentUser) {
    const adminLink = currentUser.role === 'admin'
      ? '<a href="/admin.html" class="dropdown-item">⚙️ Admin Panel</a>'
      : '';
    userMenu.innerHTML = `
      <button class="user-menu-btn" onclick="toggleUserMenu()">
        <span class="user-avatar">${(currentUser.firstName?.[0] || currentUser.email[0]).toUpperCase()}</span>
        <span class="user-name">${currentUser.firstName || 'User'}</span>
        <span class="dropdown-icon">▼</span>
      </button>
      <div class="user-dropdown hidden" id="userDropdown">
        <a href="/profile.html" class="dropdown-item">👤 Profile & Wallet</a>
        ${adminLink}
        <div class="dropdown-divider"></div>
        <div class="dropdown-item" style="gap:10px;cursor:default">
          <button class="toggle-btn" id="langToggle" onclick="event.stopPropagation();toggleLanguage()">MK</button>
          <button class="toggle-btn" id="currencyToggle" onclick="event.stopPropagation();toggleCurrency()">MKD</button>
        </div>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick="logout()">🚪 Logout</button>
      </div>
    `;
  } else {
    userMenu.innerHTML = `
      <button class="btn btn-login" onclick="window.location.href='/login.html'">
        Sign In
      </button>
    `;
  }
  headerRight.appendChild(userMenu);

  // Update bottom nav profile label
  const profileLabel = document.getElementById('navProfileLabel');
  if (profileLabel) {
    profileLabel.textContent = currentUser ? t('profile') : t('sign_in');
  }

  // Update toggle UI labels
  if (typeof updateToggleUI === 'function') updateToggleUI();
}

function toggleUserMenu() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-menu')) {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.add('hidden');
  }
});

// Bottom Navigation
function navMap() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('navMapBtn').classList.add('active');
  closePanel();
  const searchBar = document.getElementById('searchBar');
  if (searchBar) searchBar.style.display = '';
  const searchResults = document.getElementById('searchResults');
  if (searchResults) searchResults.classList.add('hidden');
}

function navSearch() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('navSearchBtn').classList.add('active');
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    const searchBar = document.getElementById('searchBar');
    if (searchBar) searchBar.style.display = '';
    searchInput.focus();
  }
}

function navProfile() {
  if (currentUser) {
    window.location.href = '/profile.html';
  } else {
    window.location.href = '/login.html';
  }
}

function logout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.reload();
}

function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
}

// Reservation UI
function initReservationUI() {
  // Add reservation button to station panel if user is logged in
  const actionButtons = document.getElementById('actions');
  if (actionButtons && !document.getElementById('reserveBtn')) {
    const reserveBtn = document.createElement('button');
    reserveBtn.id = 'reserveBtn';
    reserveBtn.className = 'btn btn-secondary';
    reserveBtn.style.cssText = 'margin-top: 10px; width: 100%; display: none;';
    reserveBtn.innerHTML = `📅 ${t('reserve_30_min')}`;
    reserveBtn.onclick = showReservationModal;
    actionButtons.appendChild(reserveBtn);
  }
}

function showReservationModal() {
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  if (!selectedStation) return;

  if (selectedStation.currentTransaction) {
    showToast(t('station_in_use'), 'error');
    return;
  }

  let modal = document.getElementById('reservationModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reservationModal';
    modal.className = 'modal hidden';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${t('reserve_charger')}</h3>
        <button class="close-btn" onclick="closeReservationModal()">&times;</button>
      </div>
      <div class="modal-body" style="text-align:center; padding: 20px;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">📅</div>
        <p style="margin-bottom: 6px; font-weight: 600; font-size: 1.05rem;">
          ${selectedStation.name}
        </p>
        <p style="color: var(--gray-500, #6b7280); margin-bottom: 20px; font-size: 0.9rem;">
          ${t('reserve_description')}
        </p>
        <button class="btn btn-primary" id="reserveNowBtn" onclick="makeReservationNow()" style="width: 100%; padding: 14px;">
          ${t('reserve_for_30')}
        </button>
        <p style="margin-top: 12px; font-size: 0.75rem; color: var(--gray-500, #6b7280);">
          ${t('one_active_reservation')}
        </p>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closeReservationModal() {
  const modal = document.getElementById('reservationModal');
  if (modal) modal.classList.add('hidden');
}

async function makeReservationNow() {
  if (!selectedStation || !currentUser) return;

  const btn = document.getElementById('reserveNowBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = t('reserving');
  }

  try {
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ chargerId: selectedStation.id })
    });

    const data = await response.json();

    if (response.ok) {
      showToast(t('reserved_success'), 'success');
      closeReservationModal();
    } else {
      showToast(data.error || t('failed_to_reserve'), 'error');
    }
  } catch (error) {
    showToast(t('network_error'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = t('reserve_for_30');
    }
  }
}

// Initialize Leaflet map
function initMap() {
  map = L.map('map').setView([42.0000, 21.4254], 14);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
  
  map.on('click', () => {
    if (selectedStation && !selectedStation.currentTransaction) {
      closePanel();
    }
  });
}

// WebSocket connection for real-time updates
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/live`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus(true);
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Handle connection phase messages
    if (data.type === 'connection_phase') {
      if (selectedStation && data.stationId === selectedStation.id) {
        connectionPhase = data.phase;
        updateConnectionPhaseUI(data);
      }
      return;
    }

    if (data.type === 'init' || data.type === 'update') {
      stations = data.stations;
      updateMarkers();
      updateHeaderStats();

      if (selectedStation) {
        const updated = stations.find(s => s.id === selectedStation.id);
        if (updated) {
          if (selectedStation.currentTransaction && !updated.currentTransaction) {
            showSessionSummary(selectedStation.currentTransaction);
          }
          // If connection phase was active but charging started (e.g. after WS reconnect)
          if (connectionPhase && updated.currentTransaction) {
            hideConnectionPhaseUI();
          }
          selectedStation = updated;
          updatePanel();
        }
      }
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus(false);
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function updateConnectionStatus(online) {
  const dot = document.getElementById('connectionDot');
  if (dot) dot.className = `dot ${online ? 'online' : 'offline'}`;
}

function updateHeaderStats() {
  // Stats are no longer shown in header (decluttered for mobile)
}

// Update map markers
function updateMarkers() {
  stations.forEach(station => {
    if (markers[station.id]) {
      updateMarkerStyle(station);
    } else {
      createMarker(station);
    }
  });
}

function createMarker(station) {
  const statusClass = getStatusClass(station);
  
  const icon = L.divIcon({
    className: 'custom-marker-wrapper',
    html: `<div class="custom-marker ${statusClass}">⚡</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
  
  const marker = L.marker([station.lat, station.lng], { icon })
    .addTo(map)
    .on('click', () => selectStation(station.id));
  
  markers[station.id] = marker;
}

function updateMarkerStyle(station) {
  const statusClass = getStatusClass(station);
  const marker = markers[station.id];
  
  if (!marker) return;
  
  const icon = L.divIcon({
    className: 'custom-marker-wrapper',
    html: `<div class="custom-marker ${statusClass}">⚡</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
  
  marker.setIcon(icon);
}

function getStatusClass(station) {
  // Consider station connected if either local connection OR CitrineOS says it's connected
  const isConnected = station.connected || 
    (citrineStationStatus[station.id]?.connected) ||
    (station.lastHeartbeat && (Date.now() - station.lastHeartbeat) < 120000);
  
  if (!isConnected) return 'offline';
  if (station.status === 'Charging') return 'charging';
  if (station.status === 'Available' || station.status === 'Preparing') return 'available';
  return 'offline';
}

// Station selection and panel
async function selectStation(stationId) {
  selectedStation = stations.find(s => s.id === stationId);
  if (!selectedStation) return;
  
  map.panTo([selectedStation.lat, selectedStation.lng]);
  
  if (selectedStation.currentTransaction && !sessionData.startTime) {
    sessionData.startTime = new Date(selectedStation.currentTransaction.startTime);
    sessionData.startBattery = INITIAL_BATTERY;
    sessionData.maxPower = 0;
  }
  
  // Fetch latest CitrineOS status for this station
  await fetchCitrineStationStatus(stationId);
  
  updatePanel();
  openPanel();
}

function updatePanel() {
  if (!selectedStation) return;
  
  const stationName = document.getElementById('stationName');
  const stationPower = document.getElementById('stationPower');
  const stationAddress = document.getElementById('stationAddress');
  const statusBadge = document.getElementById('stationStatus');
  
  if (stationName) stationName.textContent = selectedStation.name;
  if (stationPower) stationPower.textContent = `${selectedStation.power} kW`;
  if (stationAddress) {
    let addressText = selectedStation.address || '--';
    if (selectedStation.vendor && selectedStation.model) {
      addressText += ` • ${selectedStation.vendor} ${selectedStation.model}`;
    }
    stationAddress.textContent = addressText;
  }
  const stationPrice = document.getElementById('stationPrice');
  if (stationPrice) {
    const price = selectedStation.pricePerKwh || DEFAULT_COST_PER_KWH;
    stationPrice.textContent = typeof formatPricePerKwh === 'function' ? formatPricePerKwh(price) : `€${price.toFixed(2)}/kWh`;
  }
  
  // Determine connection status
  const isCitrineConnected = citrineStationStatus[selectedStation.id]?.connected;
  const hasRecentHeartbeat = selectedStation.lastHeartbeat && 
    (Date.now() - selectedStation.lastHeartbeat) < 120000;
  const isConnected = selectedStation.connected || isCitrineConnected || hasRecentHeartbeat;
  
  // Update status badge
  let status = selectedStation.status || t('offline');
  
  if (isConnected) {
    switch (selectedStation.status) {
      case 'Preparing':
        status = `🔌 ${t('status_ready_plug')}`;
        break;
      case 'Available':
        status = `✓ ${t('available')}`;
        break;
      case 'Charging':
        status = `⚡ ${t('charging')}`;
        break;
      case 'Finishing':
        status = t('status_finishing');
        break;
      case 'Suspended':
        status = `⏸ ${t('status_paused')}`;
        break;
      case 'Faulted':
        status = `⚠️ ${t('status_error')}`;
        break;
      default:
        status = selectedStation.status || 'Unknown';
    }
    
    if (selectedStation.lastHeartbeat) {
      const secondsAgo = Math.floor((Date.now() - selectedStation.lastHeartbeat) / 1000);
      if (secondsAgo < 15) {
        status += ` • ${t('status_active')}`;
      } else if (secondsAgo < 60) {
        status += ` • ${secondsAgo}s ago`;
      }
    }
  } else {
    status = t('offline');
  }

  if (statusBadge) {
    statusBadge.textContent = status;
    const statusClass = isConnected ? (selectedStation.status || 'available').toLowerCase() : 'offline';
    statusBadge.className = `status-badge ${statusClass}`;
  }
  
  // Update charging display
  const chargingDisplay = document.getElementById('chargingDisplay');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const reserveBtn = document.getElementById('reserveBtn');
  
  if (selectedStation.currentTransaction) {
    // If connection phase overlay is still showing, hide it now that charging is active
    if (connectionPhase) {
      hideConnectionPhaseUI();
    }
    if (chargingDisplay) chargingDisplay.classList.remove('hidden');
    if (startBtn) startBtn.classList.add('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
    if (reserveBtn) reserveBtn.style.display = 'none';
    
    const tx = selectedStation.currentTransaction;
    const power = tx.power || 0;
    const energy = parseFloat(tx.energy) || 0;
    const voltage = tx.voltage || 0;
    const current = tx.current || 0;
    const soc = tx.soc || 0;
    const temperature = tx.temperature || 0;
    
    const dataAge = Date.now() - (selectedStation.lastHeartbeat || Date.now());
    const isDataFresh = dataAge < 15000;
    const hasActiveFlow = power > 100;
    
    const currentPowerEl = document.getElementById('currentPower');
    if (currentPowerEl) {
      currentPowerEl.textContent = (power / 1000).toFixed(1);
      const powerElement = currentPowerEl.parentElement;
      if (powerElement) {
        powerElement.style.opacity = !isDataFresh ? '0.6' : (!hasActiveFlow && tx.energy > 0) ? '0.8' : '1';
      }
    }
    
    const energyEl = document.getElementById('energyDelivered');
    if (energyEl) energyEl.textContent = Math.max(0, energy).toFixed(2);
    
    const costEl = document.getElementById('costAmount');
    const pricePerKwh = (selectedStation && selectedStation.pricePerKwh) || DEFAULT_COST_PER_KWH;
    const costEur = Math.max(0, energy) * pricePerKwh;
    if (costEl) costEl.textContent = typeof formatPrice === 'function' ? formatPrice(costEur) : `€${costEur.toFixed(2)}`;
    
    updateBatteryIndicator(energy, soc);
    
    if (power > sessionData.maxPower) {
      sessionData.maxPower = power;
    }
    
    updateTechnicalData(voltage, current, temperature, dataAge);
    
    if (!chargingTimer) {
      chargingStartTime = new Date(selectedStation.currentTransaction.startTime);
      chargingTimer = setInterval(updateChargingTime, 1000);
    }
    updateChargingTime();
    
  } else {
    if (chargingDisplay) chargingDisplay.classList.add('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    
    if (chargingTimer) {
      clearInterval(chargingTimer);
      chargingTimer = null;
    }
    
    sessionData = {
      startBattery: INITIAL_BATTERY,
      startTime: null,
      maxPower: 0
    };
    
    // Show start button if station is available via any connection method
    if (isConnected && 
        (selectedStation.status === 'Available' || selectedStation.status === 'Preparing')) {
      if (startBtn) {
        startBtn.classList.remove('hidden');
        startBtn.disabled = false;
      }
      if (reserveBtn) reserveBtn.style.display = 'block';
    } else if (isConnected) {
      if (startBtn) {
        startBtn.classList.remove('hidden');
        startBtn.disabled = true;
        startBtn.textContent = `⏳ ${t('not_available')}`;
      }
      if (reserveBtn) reserveBtn.style.display = 'none';
    } else {
      if (startBtn) startBtn.classList.add('hidden');
      if (reserveBtn) reserveBtn.style.display = 'none';
    }
  }
}

function updateBatteryIndicator(energy, soc) {
  let batteryPercent;
  let isRealData = false;
  
  if (soc > 0 && soc <= 100) {
    batteryPercent = soc;
    isRealData = true;
  } else {
    const energyAsPercent = (energy / BATTERY_CAPACITY) * 100;
    batteryPercent = Math.min(sessionData.startBattery + energyAsPercent, 100);
  }
  
  batteryPercent = Math.max(0, Math.min(100, batteryPercent));
  
  const batteryText = document.getElementById('batteryPercent');
  const batteryFill = document.getElementById('batteryFill');
  
  if (batteryText) {
    batteryText.textContent = isRealData ? `${batteryPercent.toFixed(0)}%` : `~${batteryPercent.toFixed(0)}%`;
  }
  
  if (batteryFill) {
    batteryFill.style.width = `${batteryPercent}%`;
    
    if (batteryPercent >= 80) {
      batteryFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
    } else if (batteryPercent >= 50) {
      batteryFill.style.background = 'linear-gradient(90deg, #3b82f6, #60a5fa)';
    } else if (batteryPercent >= 20) {
      batteryFill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    } else {
      batteryFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    }
  }
}

function updateChargingTime() {
  if (!chargingStartTime) return;
  
  const now = new Date();
  const diff = Math.floor((now - chargingStartTime) / 1000);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  
  const timeStr = hours > 0 
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  const chargingTimeEl = document.getElementById('chargingTime');
  if (chargingTimeEl) chargingTimeEl.textContent = timeStr;
}

function openPanel() {
  const panel = document.getElementById('stationPanel');
  if (panel) panel.classList.add('open');
}

function closePanel() {
  const panel = document.getElementById('stationPanel');
  if (panel) panel.classList.remove('open');
  selectedStation = null;
  connectionPhase = null;
  hideConnectionPhaseUI();

  if (chargingTimer) {
    clearInterval(chargingTimer);
    chargingTimer = null;
  }
}

// Navigate to station using native maps
function navigateToStation() {
  if (!selectedStation) return;
  const { lat, lng, name } = selectedStation;
  const label = encodeURIComponent(name || 'Charging Station');
  // Try native maps first, fall back to Google Maps
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&q=${label}`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  }
}

// Payment flow
function showPayment() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.remove('hidden');
  
  const cardNumber = document.getElementById('cardNumber');
  if (cardNumber) cardNumber.focus();
}

function closePayment() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.add('hidden');
  
  const cardNum = document.getElementById('cardNumber');
  const cardExpiry = document.getElementById('cardExpiry');
  const cardCvv = document.getElementById('cardCvv');
  
  if (cardNum) cardNum.value = '';
  if (cardExpiry) cardExpiry.value = '';
  if (cardCvv) cardCvv.value = '';
}

async function processPayment() {
  const cardNumber = document.getElementById('cardNumber')?.value;
  const expiry = document.getElementById('cardExpiry')?.value;
  const cvv = document.getElementById('cardCvv')?.value;
  const cardError = document.getElementById('cardError');

  // Validate card number
  const digits = (cardNumber || '').replace(/\s/g, '');
  if (digits.length < 16) {
    if (cardError) { cardError.textContent = 'Please enter a valid 16-digit card number'; cardError.style.display = 'block'; }
    return;
  }

  // Validate expiry
  if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) {
    if (cardError) { cardError.textContent = 'Please enter a valid expiry date (MM/YY)'; cardError.style.display = 'block'; }
    return;
  }

  // Validate CVV
  if (!cvv || cvv.length < 3) {
    if (cardError) { cardError.textContent = 'Please enter a valid security code'; cardError.style.display = 'block'; }
    return;
  }

  if (cardError) cardError.style.display = 'none';

  const payBtn = document.getElementById('payBtn');
  const payBtnText = document.getElementById('payBtnText');
  if (payBtn) {
    payBtn.disabled = true;
    if (payBtnText) payBtnText.textContent = 'Processing...';
  }
  
  try {
    const response = await fetch('/api/payment/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardNumber, expiry, cvv })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast(t('payment_authorized'), 'success', '✅');
      closePayment();
      await startCharging(result.token);
    } else {
      showToast(result.message || t('payment_error'), 'error', '❌');
    }
  } catch (error) {
    showToast(t('payment_error'), 'error', '❌');
    console.error(error);
  } finally {
    if (payBtn) {
      payBtn.disabled = false;
      if (payBtnText) payBtnText.textContent = 'Authorize & Start Charging';
    }
  }
}

// Charging control
async function startCharging(paymentToken) {
  if (!selectedStation) return;

  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.classList.add('hidden');
  }

  sessionData = {
    startBattery: INITIAL_BATTERY,
    startTime: new Date(),
    maxPower: 0
  };

  try {
    const response = await fetch(`/api/stations/${encodeURIComponent(selectedStation.id)}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idTag: paymentToken })
    });

    const result = await response.json();

    if (response.ok) {
      if (result.status === 'connecting') {
        // Show connection phase UI — WebSocket will drive subsequent transitions
        showConnectionPhaseUI(result);
      } else if (result.status === 'started') {
        // Direct start (already-simulated station)
        showToast(t('charging_started'), 'success');
        if (navigator.vibrate) navigator.vibrate(200);
      }
    } else {
      showToast(result.error || t('start_failed'), 'error');
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.classList.remove('hidden');
      }
    }
  } catch (error) {
    showToast(t('network_error'), 'error');
    console.error(error);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.classList.remove('hidden');
    }
  }
}

// Connection phase UI functions
function showConnectionPhaseUI(result) {
  const overlay = document.getElementById('connectionPhaseOverlay');
  const chargingDisplay = document.getElementById('chargingDisplay');
  if (!overlay) return;

  if (chargingDisplay) chargingDisplay.classList.add('hidden');
  overlay.classList.remove('hidden');
  overlay.classList.remove('fade-out');

  connectionPhase = 'awaiting_car';
  const waitTime = result.isDemoCharger ? 20 : 30;

  overlay.innerHTML = `
    <div class="connection-phase-content">
      <div class="car-plug-animation">
        <div class="car-icon">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 17h14"/>
            <path d="M6 17V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10"/>
            <rect x="3" y="14" width="18" height="3" rx="1"/>
            <circle cx="7" cy="19" r="1.5"/>
            <circle cx="17" cy="19" r="1.5"/>
            <path d="M12 8v3"/>
            <path d="M10.5 9.5h3"/>
          </svg>
        </div>
        <div class="plug-connector-line">
          <div class="plug-pulse"></div>
        </div>
        <div class="charger-icon">&#9889;</div>
      </div>
      <h3 class="connection-phase-title">${t('awaiting_car_connection')}</h3>
      <p class="connection-phase-subtitle">${t('please_plug_in')}</p>
      <div class="connection-progress">
        <div class="connection-progress-bar" style="animation-duration: ${waitTime}s"></div>
      </div>
    </div>
  `;

  overlay._countdownInterval = null;
}

function updateConnectionPhaseUI(data) {
  const overlay = document.getElementById('connectionPhaseOverlay');
  if (!overlay || overlay.classList.contains('hidden')) return;

  const title = overlay.querySelector('.connection-phase-title');
  const subtitle = overlay.querySelector('.connection-phase-subtitle');

  switch (data.phase) {
    case 'awaiting_car':
      // Already showing initial state
      break;

    case 'started':
      // Demo charger succeeded - show success
      if (overlay._countdownInterval) clearInterval(overlay._countdownInterval);
      if (title) title.textContent = t('charging_started');
      if (subtitle) subtitle.textContent = t('vehicle_now_charging');
      // Replace animation with success checkmark
      const animEl = overlay.querySelector('.car-plug-animation');
      if (animEl) {
        animEl.outerHTML = `
          <div class="checkmark-circle success">
            <div class="checkmark">&#9889;</div>
          </div>
        `;
      }
      const progressBar = overlay.querySelector('.connection-progress');
      if (progressBar) progressBar.style.display = 'none';
      if (navigator.vibrate) navigator.vibrate(200);
      showToast(t('charging_started'), 'success');
      // Auto-hide after 1.5s
      setTimeout(() => hideConnectionPhaseUI(), 1500);
      break;

    case 'timeout':
      // Non-demo charger timed out - show timeout, then reset
      if (overlay._countdownInterval) clearInterval(overlay._countdownInterval);
      if (title) title.textContent = t('connection_timed_out');
      if (subtitle) subtitle.textContent = t('no_vehicle_detected');
      // Replace animation with timeout icon
      const animEl2 = overlay.querySelector('.car-plug-animation');
      if (animEl2) {
        animEl2.outerHTML = `
          <div class="timeout-circle">
            <div class="timeout-icon">&#9203;</div>
          </div>
        `;
      }
      const progressBar2 = overlay.querySelector('.connection-progress');
      if (progressBar2) progressBar2.style.display = 'none';
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      // Auto-hide after 3s, restore Start button
      setTimeout(() => {
        hideConnectionPhaseUI();
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.classList.remove('hidden');
          startBtn.innerHTML = `&#9889; ${t('start_charging')}`;
        }
      }, 3000);
      break;
  }
}

function hideConnectionPhaseUI() {
  const overlay = document.getElementById('connectionPhaseOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    if (overlay._countdownInterval) {
      clearInterval(overlay._countdownInterval);
      overlay._countdownInterval = null;
    }
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('fade-out');
      overlay.innerHTML = '';
    }, 500);
  }
  connectionPhase = null;
}

async function stopCharging() {
  if (!selectedStation) return;
  
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) {
    stopBtn.disabled = true;
    stopBtn.textContent = `⏹ ${t('stopping')}`;
  }
  
  try {
    const response = await fetch(`/api/stations/${encodeURIComponent(selectedStation.id)}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast(t('charging_stopped'), 'success', '✅');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } else {
      showToast(result.error || t('failed_to_stop'), 'error', '❌');
    }
  } catch (error) {
    showToast(t('connection_error'), 'error', '❌');
    console.error(error);
  } finally {
    if (stopBtn) {
      stopBtn.disabled = false;
      stopBtn.textContent = `⏹ ${t('stop_charging')}`;
    }
  }
}

// Session Summary
function showSessionSummary(transaction) {
  if (!transaction) return;
  
  const energy = parseFloat(transaction.energy) || 0;
  const pricePerKwh = (selectedStation && selectedStation.pricePerKwh) || DEFAULT_COST_PER_KWH;
  const cost = energy * pricePerKwh;
  
  const startTime = new Date(transaction.startTime);
  const endTime = new Date();
  const durationMs = endTime - startTime;
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  
  const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  
  const durationHours = durationMs / 3600000;
  const avgPower = durationHours > 0 ? (energy / durationHours).toFixed(1) : 0;
  
  const summaryEnergy = document.getElementById('summaryEnergy');
  const summaryDuration = document.getElementById('summaryDuration');
  const summaryAvgPower = document.getElementById('summaryAvgPower');
  const summaryCost = document.getElementById('summaryCost');
  
  if (summaryEnergy) summaryEnergy.textContent = `${energy.toFixed(2)} kWh`;
  if (summaryDuration) summaryDuration.textContent = durationStr;
  if (summaryAvgPower) summaryAvgPower.textContent = `${avgPower} kW`;
  if (summaryCost) summaryCost.textContent = typeof formatPrice === 'function' ? formatPrice(cost) : `€${cost.toFixed(2)}`;
  
  const summaryModal = document.getElementById('summaryModal');
  if (summaryModal) summaryModal.classList.remove('hidden');
  
  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
}

function closeSummary() {
  const summaryModal = document.getElementById('summaryModal');
  if (summaryModal) summaryModal.classList.add('hidden');
}

// Card brand detection
function detectCardBrand(number) {
  const n = number.replace(/\s/g, '');
  if (/^4/.test(n)) return { brand: 'visa', icon: '\uD83C\uDDE8\uD83C\uDDE8' }; // placeholder
  if (/^5[1-5]/.test(n)) return { brand: 'mastercard', icon: '' };
  if (/^(6304|6759|6761|6762|6763)/.test(n)) return { brand: 'maestro', icon: '' };
  return { brand: '', icon: '' };
}

// Card input formatting
function setupCardFormatting() {
  const cardInput = document.getElementById('cardNumber');
  if (cardInput) {
    cardInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
      let formatted = '';
      for (let i = 0; i < value.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += value[i];
      }
      e.target.value = formatted;

      // Update card brand icon
      const brandEl = document.getElementById('cardBrandIcon');
      if (brandEl) {
        const { brand } = detectCardBrand(value);
        if (brand === 'visa') brandEl.textContent = 'VISA';
        else if (brand === 'mastercard') brandEl.textContent = 'MC';
        else if (brand === 'maestro') brandEl.textContent = 'MST';
        else brandEl.textContent = '';
        brandEl.style.fontWeight = '700';
        brandEl.style.fontSize = brand ? '14px' : '24px';
        brandEl.style.color = brand === 'visa' ? '#1a1f71' : brand === 'mastercard' ? '#eb001b' : '#0099df';
      }

      // Clear errors on input
      const errEl = document.getElementById('cardError');
      if (errEl) errEl.style.display = 'none';
    });
  }

  const expiryInput = document.getElementById('cardExpiry');
  if (expiryInput) {
    expiryInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
      }
      e.target.value = value;
    });
  }
}

// Technical data panel
function updateTechnicalData(voltage, current, temperature, dataAge) {
  const techPanel = document.getElementById('technicalData');
  
  const hasTechData = voltage > 0 || current > 0 || temperature > 0;
  
  if (techPanel) {
    techPanel.style.display = hasTechData ? 'block' : 'none';
  }
  
  if (hasTechData) {
    const techVoltage = document.getElementById('techVoltage');
    const techCurrent = document.getElementById('techCurrent');
    const techTemperature = document.getElementById('techTemperature');
    const techMaxPower = document.getElementById('techMaxPower');
    const techDataAge = document.getElementById('techDataAge');
    
    if (techVoltage) {
      if (voltage > 0) {
        techVoltage.textContent = `${voltage.toFixed(1)} V`;
        techVoltage.style.color = voltage >= 200 && voltage <= 250 ? '#10b981' : '#f59e0b';
      } else {
        techVoltage.textContent = '-- V';
        techVoltage.style.color = '#6b7280';
      }
    }
    
    if (techCurrent) {
      if (current > 0) {
        techCurrent.textContent = `${current.toFixed(1)} A`;
        techCurrent.style.color = current <= 32 ? '#10b981' : '#f59e0b';
      } else {
        techCurrent.textContent = '-- A';
        techCurrent.style.color = '#6b7280';
      }
    }
    
    if (techTemperature) {
      if (temperature > 0) {
        techTemperature.textContent = `${temperature.toFixed(1)} °C`;
        techTemperature.style.color = temperature < 50 ? '#10b981' : temperature < 70 ? '#f59e0b' : '#ef4444';
      } else {
        techTemperature.textContent = '-- °C';
        techTemperature.style.color = '#6b7280';
      }
    }
    
    if (techMaxPower) {
      techMaxPower.textContent = `${(sessionData.maxPower / 1000).toFixed(1)} kW`;
    }
    
    if (techDataAge) {
      const ageSeconds = Math.floor(dataAge / 1000);
      techDataAge.textContent = `${ageSeconds} s`;
      techDataAge.style.color = ageSeconds < 10 ? '#10b981' : ageSeconds < 30 ? '#f59e0b' : '#ef4444';
    }
  }
}

function toggleTechnicalData() {
  const content = document.getElementById('techContent');
  const icon = document.getElementById('techToggleIcon');
  
  if (content && icon) {
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    icon.textContent = isHidden ? '▲' : '▼';
  }
}

// Toast notifications
function showToast(message, type = '', icon = 'ℹ️') {
  let toast = document.getElementById('toast');
  
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast hidden';
    toast.innerHTML = '<span class="toast-icon"></span><span id="toastMessage"></span>';
    document.body.appendChild(toast);
  }
  
  const toastMessage = document.getElementById('toastMessage') || toast.querySelector('span:last-child');
  const toastIcon = toast.querySelector('.toast-icon');
  
  if (toastIcon) toastIcon.textContent = icon;
  if (toastMessage) toastMessage.textContent = message;
  
  toast.className = `toast ${type}`;
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// CitrineOS Integration Functions

async function checkCitrineStatus() {
  try {
    const response = await fetch('/api/citrine/health');
    if (response.ok) {
      const data = await response.json();
      citrineStatus = data;
    } else {
      citrineStatus = { available: false };
    }
  } catch (error) {
    citrineStatus = { available: false };
  }
  updateCitrineIndicator();
}

async function fetchCitrineStationStatus(stationId) {
  if (!citrineStatus.available) return;
  
  try {
    const response = await fetch(`/api/stations/${encodeURIComponent(stationId)}/citrine-status`, {
      headers: authToken ? getAuthHeaders() : { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      citrineStationStatus[stationId] = data;
    }
  } catch (error) {
    console.error('Failed to fetch Citrine status:', error);
  }
}

async function syncWithCitrineOS(stationId) {
  const syncBtn = document.getElementById('citrineSyncBtn');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = '🔄 Syncing...';
  }
  
  try {
    const response = await fetch(`/api/citrine/stations/${stationId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      showToast('Station synced with CitrineOS', 'success', '✅');
      await fetchCitrineStationStatus(stationId);
      updatePanel();
    } else {
      showToast('Sync failed', 'error', '❌');
    }
  } catch (error) {
    showToast('Sync error: ' + error.message, 'error', '❌');
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Sync with CitrineOS';
    }
  }
}

// Station search
function initSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!input || !results) return;

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 1) {
      results.classList.add('hidden');
      return;
    }

    const matches = stations.filter(s =>
      (s.name && s.name.toLowerCase().includes(query)) ||
      (s.address && s.address.toLowerCase().includes(query)) ||
      (s.id && s.id.toLowerCase().includes(query))
    );

    if (matches.length === 0) {
      results.innerHTML = `<div style="padding:14px;text-align:center;color:#999;font-size:0.85rem">${t('no_stations_found')}</div>`;
    } else {
      results.innerHTML = matches.map(s => {
        const isOnline = s.connected || (s.lastHeartbeat && (Date.now() - s.lastHeartbeat) < 120000);
        const statusText = s.currentTransaction ? t('charging') : isOnline ? t('available') : t('offline');
        const statusColor = s.currentTransaction ? '#ef6c00;background:#fff3e0' : isOnline ? '#2e7d32;background:#e8f5e9' : '#666;background:#f5f5f5';
        return `<div class="search-result-item" onclick="searchSelectStation('${s.id}')">
          <div>
            <div class="search-result-name">${s.name}</div>
            <div class="search-result-address">${s.address || ''} &bull; ${s.power} kW</div>
          </div>
          <span class="search-result-status" style="color:${statusColor}">${statusText}</span>
        </div>`;
      }).join('');
    }
    results.classList.remove('hidden');
  });

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) {
      results.classList.add('hidden');
    }
  });
}

function searchSelectStation(id) {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').classList.add('hidden');
  selectStation(id);
}

// Register service worker for PWA with auto-update detection
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          window.location.reload();
        }
      });
    });
  }).catch(() => {});

  // Reload when a new service worker takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
