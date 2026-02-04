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

// Configuration
const COST_PER_KWH = 0.35;
const BATTERY_CAPACITY = 60;
const INITIAL_BATTERY = 20;

// Session tracking
let sessionData = {
  startBattery: INITIAL_BATTERY,
  startTime: null,
  maxPower: 0
};

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
  
  // Check CitrineOS status periodically
  setInterval(checkCitrineStatus, 30000);
  
  // Poll for station updates when CitrineOS is active
  setInterval(pollStationStatus, 10000);
});

// Initialize CitrineOS status indicator
function initCitrineIndicator() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;
  
  // Check if indicator already exists
  if (document.getElementById('citrineIndicator')) return;
  
  const indicator = document.createElement('div');
  indicator.id = 'citrineIndicator';
  indicator.className = 'citrine-indicator';
  indicator.innerHTML = `
    <span class="citrine-dot"></span>
    <span class="citrine-label">CitrineOS</span>
  `;
  indicator.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: #6b7280; margin-top: 2px;';
  headerRight.appendChild(indicator);
}

function updateCitrineIndicator() {
  const indicator = document.getElementById('citrineIndicator');
  if (!indicator) return;
  
  const dot = indicator.querySelector('.citrine-dot');
  const label = indicator.querySelector('.citrine-label');
  
  if (citrineStatus.available) {
    dot.style.cssText = 'width: 6px; height: 6px; border-radius: 50%; background: #10b981;';
    label.textContent = 'CitrineOS';
    label.style.color = '#10b981';
  } else {
    dot.style.cssText = 'width: 6px; height: 6px; border-radius: 50%; background: #9ca3af;';
    label.textContent = 'CitrineOS';
    label.style.color = '#9ca3af';
  }
}

// Poll station status from backend (fallback when webhooks fail)
async function pollStationStatus() {
  if (!selectedStation) return;
  
  try {
    const response = await fetch(`/api/stations/${selectedStation.id}`);
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
    userMenu.innerHTML = `
      <button class="user-menu-btn" onclick="toggleUserMenu()">
        <span class="user-avatar">${(currentUser.firstName?.[0] || currentUser.email[0]).toUpperCase()}</span>
        <span class="user-name">${currentUser.firstName || 'User'}</span>
        <span class="dropdown-icon">▼</span>
      </button>
      <div class="user-dropdown hidden" id="userDropdown">
        <a href="/profile.html" class="dropdown-item">👤 Profile & Wallet</a>
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
}

function toggleUserMenu() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
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
    reserveBtn.innerHTML = '📅 Reserve Slot';
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
    showToast('Station is currently in use', 'error');
    return;
  }
  
  let modal = document.getElementById('reservationModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reservationModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📅 Reserve Charging Slot</h3>
          <button class="close-btn" onclick="closeReservationModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 15px; color: #666;">
            Station: <strong id="reservationStationName">--</strong>
          </p>
          <div id="reservationSlots" class="reservation-slots">
            <p>Loading available slots...</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('reservationStationName').textContent = selectedStation.name;
  modal.classList.remove('hidden');
  loadAvailableSlots();
}

function closeReservationModal() {
  const modal = document.getElementById('reservationModal');
  if (modal) modal.classList.add('hidden');
}

async function loadAvailableSlots() {
  if (!selectedStation) return;
  
  const container = document.getElementById('reservationSlots');
  container.innerHTML = '<p>Loading...</p>';
  
  try {
    const response = await fetch(`/api/reservations/slots/${selectedStation.id}`);
    const data = await response.json();
    
    if (data.slots.length === 0) {
      container.innerHTML = '<p>No slots available</p>';
      return;
    }
    
    const upcomingSlots = data.slots.filter(s => s.available).slice(0, 12);
    
    if (upcomingSlots.length === 0) {
      container.innerHTML = '<p>No available slots in next 6 hours</p>';
      return;
    }
    
    container.innerHTML = upcomingSlots.map(slot => {
      const date = new Date(slot.time);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      return `
        <button class="slot-btn" onclick="makeReservation('${slot.time}')">
          <span class="slot-time">${timeStr}</span>
          <span class="slot-date">${dateStr}</span>
          <span class="slot-duration">30 min</span>
        </button>
      `;
    }).join('');
  } catch (error) {
    container.innerHTML = '<p>Error loading slots</p>';
  }
}

async function makeReservation(startTime) {
  if (!selectedStation || !currentUser) return;
  
  try {
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        chargerId: selectedStation.id,
        startTime: startTime
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Reservation confirmed!', 'success', '✅');
      closeReservationModal();
    } else {
      showToast(data.error || 'Failed to reserve', 'error');
    }
  } catch (error) {
    showToast('Network error', 'error');
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
  const status = document.getElementById('connectionStatus');
  if (!status) return;
  
  const dot = status.querySelector('.dot');
  const text = status.querySelector('span:last-child');
  
  if (dot) dot.className = `dot ${online ? 'online' : 'offline'}`;
  if (text) text.textContent = online ? 'Connected' : 'Reconnecting...';
}

function updateHeaderStats() {
  const statsBadge = document.getElementById('statsBadge');
  if (!statsBadge) return;
  
  const totalStations = stations.length;
  const activeStations = stations.filter(s => s.status === 'Charging').length;
  const availableStations = stations.filter(s => s.status === 'Available' && s.connected).length;
  
  if (totalStations === 0) {
    statsBadge.textContent = 'Loading...';
  } else {
    statsBadge.textContent = `${totalStations} Stations • ${activeStations} Active • ${availableStations} Available`;
  }
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
  
  // Determine connection status
  const isCitrineConnected = citrineStationStatus[selectedStation.id]?.connected;
  const hasRecentHeartbeat = selectedStation.lastHeartbeat && 
    (Date.now() - selectedStation.lastHeartbeat) < 120000;
  const isConnected = selectedStation.connected || isCitrineConnected || hasRecentHeartbeat;
  
  // Update status badge
  let status = selectedStation.status || 'Offline';
  
  if (isConnected) {
    switch (selectedStation.status) {
      case 'Preparing':
        status = '🔌 Ready - Plug Connected';
        break;
      case 'Available':
        status = '✓ Available';
        break;
      case 'Charging':
        status = '⚡ Charging';
        break;
      case 'Finishing':
        status = 'Finishing...';
        break;
      case 'Suspended':
        status = '⏸ Paused';
        break;
      case 'Faulted':
        status = '⚠️ Error';
        break;
      default:
        status = selectedStation.status || 'Unknown';
    }
    
    if (selectedStation.lastHeartbeat) {
      const secondsAgo = Math.floor((Date.now() - selectedStation.lastHeartbeat) / 1000);
      if (secondsAgo < 15) {
        status += ' • Active';
      } else if (secondsAgo < 60) {
        status += ` • ${secondsAgo}s ago`;
      }
    }
  } else {
    status = 'Offline';
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
    if (costEl) costEl.textContent = `€${(Math.max(0, energy) * COST_PER_KWH).toFixed(2)}`;
    
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
        startBtn.textContent = '⏳ Not Available';
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
  
  if (chargingTimer) {
    clearInterval(chargingTimer);
    chargingTimer = null;
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
  
  if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
    showToast('Please enter a valid card number', 'error', '❌');
    return;
  }
  
  const payBtn = document.getElementById('payBtn');
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = 'Processing...';
  }
  
  try {
    const response = await fetch('/api/payment/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardNumber, expiry, cvv })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Payment authorized', 'success', '✅');
      closePayment();
      await startCharging(result.token);
    } else {
      showToast(result.message || 'Payment failed', 'error', '❌');
    }
  } catch (error) {
    showToast('Payment error', 'error', '❌');
    console.error(error);
  } finally {
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = 'Authorize & Start Charging';
    }
  }
}

// Charging control
async function startCharging(paymentToken) {
  if (!selectedStation) return;
  
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = '⚡ Starting...';
  }
  
  sessionData = {
    startBattery: INITIAL_BATTERY,
    startTime: new Date(),
    maxPower: 0
  };
  
  try {
    const response = await fetch(`/api/stations/${selectedStation.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idTag: paymentToken })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast('Charging started successfully', 'success', '⚡');
      if (navigator.vibrate) navigator.vibrate(200);
    } else {
      showToast(result.error || 'Failed to start', 'error', '❌');
    }
  } catch (error) {
    showToast('Connection error', 'error', '❌');
    console.error(error);
  } finally {
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = '⚡ Start Charging';
    }
  }
}

async function stopCharging() {
  if (!selectedStation) return;
  
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) {
    stopBtn.disabled = true;
    stopBtn.textContent = '⏹ Stopping...';
  }
  
  try {
    const response = await fetch(`/api/stations/${selectedStation.id}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast('Charging stopped', 'success', '✅');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } else {
      showToast(result.error || 'Failed to stop', 'error', '❌');
    }
  } catch (error) {
    showToast('Connection error', 'error', '❌');
    console.error(error);
  } finally {
    if (stopBtn) {
      stopBtn.disabled = false;
      stopBtn.textContent = '⏹ Stop Charging';
    }
  }
}

// Session Summary
function showSessionSummary(transaction) {
  if (!transaction) return;
  
  const energy = parseFloat(transaction.energy) || 0;
  const cost = energy * COST_PER_KWH;
  
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
  if (summaryCost) summaryCost.textContent = `€${cost.toFixed(2)}`;
  
  const summaryModal = document.getElementById('summaryModal');
  if (summaryModal) summaryModal.classList.remove('hidden');
  
  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
}

function closeSummary() {
  const summaryModal = document.getElementById('summaryModal');
  if (summaryModal) summaryModal.classList.add('hidden');
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
    const response = await fetch(`/api/stations/${stationId}/citrine-status`, {
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

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Service worker registration failed - that's okay for demo
  });
}
