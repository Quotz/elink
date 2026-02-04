// State
let map;
let markers = {};
let stations = [];
let selectedStation = null;
let ws = null;
let chargingStartTime = null;
let chargingTimer = null;
let citrineStatus = { available: false }; // Track CitrineOS connection status
let citrineStationStatus = {}; // Per-station CitrineOS status cache

// Configuration
const COST_PER_KWH = 0.35; // €0.35 per kWh (typical price in Macedonia)
const BATTERY_CAPACITY = 60; // Assume 60kWh battery for calculation
const INITIAL_BATTERY = 20; // Start at 20%

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
  checkCitrineStatus(); // Check CitrineOS connection
  updateHeaderStats(); // Initial stats
  initAuth(); // Setup auth UI
  initReservationUI(); // Setup reservation button
  
  // Check CitrineOS status periodically
  setInterval(checkCitrineStatus, 30000);
});

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
  
  // Keep the stats badge and connection status
  const statsBadge = document.getElementById('statsBadge');
  const connectionStatus = document.getElementById('connectionStatus');
  
  // Check if user menu already exists
  let userMenu = document.getElementById('userMenu');
  
  if (currentUser) {
    if (!userMenu) {
      userMenu = document.createElement('div');
      userMenu.id = 'userMenu';
      userMenu.className = 'user-menu';
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
      headerRight.appendChild(userMenu);
    }
  } else {
    if (!userMenu) {
      userMenu = document.createElement('div');
      userMenu.id = 'userMenu';
      userMenu.className = 'user-menu';
      userMenu.innerHTML = `
        <button class="btn btn-login" onclick="window.location.href='/login.html'">
          Sign In
        </button>
      `;
      headerRight.appendChild(userMenu);
    }
  }
}

function toggleUserMenu() {
  const dropdown = document.getElementById('userDropdown');
  dropdown.classList.toggle('hidden');
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
  const actionButtons = document.querySelector('.action-buttons');
  if (actionButtons && !document.getElementById('reserveBtn')) {
    const reserveBtn = document.createElement('button');
    reserveBtn.id = 'reserveBtn';
    reserveBtn.className = 'btn btn-secondary';
    reserveBtn.style.cssText = 'margin-top: 10px; width: 100%;';
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
  
  // Check if station is available
  if (selectedStation.currentTransaction) {
    showToast('Station is currently in use', 'error');
    return;
  }
  
  // Create and show reservation modal
  let modal = document.getElementById('reservationModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reservationModal';
    modal.className = 'modal';
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
    
    // Filter to show only next 12 slots (6 hours)
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
  // Center on Skopje
  map = L.map('map').setView([42.0000, 21.4254], 14);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
  
  // Handle map click to close panel
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
      
      // Update selected station if panel is open
      if (selectedStation) {
        const updated = stations.find(s => s.id === selectedStation.id);
        if (updated) {
          // Check if charging just stopped
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
    // Reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function updateConnectionStatus(online) {
  const status = document.getElementById('connectionStatus');
  const dot = status.querySelector('.dot');
  const text = status.querySelector('span:last-child');
  
  dot.className = `dot ${online ? 'online' : 'offline'}`;
  text.textContent = online ? 'Connected' : 'Reconnecting...';
}

function updateHeaderStats() {
  const statsBadge = document.getElementById('statsBadge');
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
      // Update existing marker
      updateMarkerStyle(station);
    } else {
      // Create new marker
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
  
  const icon = L.divIcon({
    className: 'custom-marker-wrapper',
    html: `<div class="custom-marker ${statusClass}">⚡</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
  
  marker.setIcon(icon);
}

function getStatusClass(station) {
  if (!station.connected) return 'offline';
  if (station.status === 'Charging') return 'charging';
  if (station.status === 'Available') return 'available';
  return 'offline';
}

// Station selection and panel
function selectStation(stationId) {
  selectedStation = stations.find(s => s.id === stationId);
  if (!selectedStation) return;
  
  // Center map on station
  map.panTo([selectedStation.lat, selectedStation.lng]);
  
  // Reset session data when selecting a station
  if (selectedStation.currentTransaction && !sessionData.startTime) {
    sessionData.startTime = new Date(selectedStation.currentTransaction.startTime);
    sessionData.startBattery = INITIAL_BATTERY;
    sessionData.maxPower = 0;
  }
  
  updatePanel();
  openPanel();
}

function updatePanel() {
  if (!selectedStation) return;
  
  // Update basic info
  document.getElementById('stationName').textContent = selectedStation.name;
  document.getElementById('stationPower').textContent = `${selectedStation.power} kW`;
  document.getElementById('stationAddress').textContent = selectedStation.address;
  
  // Update vendor/model info if available
  if (selectedStation.vendor && selectedStation.model) {
    const vendorInfo = `${selectedStation.vendor} ${selectedStation.model}`;
    document.getElementById('stationAddress').textContent = `${selectedStation.address} • ${vendorInfo}`;
  }
  
  // Update status badge with last seen time and helpful text
  const statusBadge = document.getElementById('stationStatus');
  let status = selectedStation.connected ? selectedStation.status : 'Offline';
  
  // Add helpful context for specific states
  if (selectedStation.connected) {
    if (selectedStation.status === 'Preparing') {
      status = '🔌 Cable Connected - Ready to Start';
    } else if (selectedStation.status === 'Available') {
      status = '✓ Available';
    } else if (selectedStation.status === 'Charging') {
      status = '⚡ Charging';
    } else if (selectedStation.status === 'Finishing') {
      status = 'Finishing Session...';
    } else if (selectedStation.status === 'Suspended') {
      status = '⏸ Charging Paused';
    } else if (selectedStation.status === 'Faulted') {
      status = '⚠️ Charger Error';
    }
    
    // Add last seen time for connected chargers
    if (selectedStation.lastHeartbeat) {
      const timeSinceLastSeen = Date.now() - selectedStation.lastHeartbeat;
      const secondsAgo = Math.floor(timeSinceLastSeen / 1000);
      
      let lastSeenText = '';
      if (secondsAgo < 15) {
        lastSeenText = ' • Active';
      } else if (secondsAgo < 30) {
        lastSeenText = ` • ${secondsAgo}s ago`;
      }
      status += lastSeenText;
    }
  }
  
  statusBadge.textContent = status;
  statusBadge.className = `status-badge ${selectedStation.connected ? selectedStation.status.toLowerCase() : 'offline'}`;
  
  // Update charging display
  const chargingDisplay = document.getElementById('chargingDisplay');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (selectedStation.currentTransaction) {
    // Charging in progress
    chargingDisplay.classList.remove('hidden');
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    
    // Update stats
    const tx = selectedStation.currentTransaction;
    const power = tx.power || 0;
    const energy = parseFloat(tx.energy) || 0;
    const voltage = tx.voltage || 0;
    const current = tx.current || 0;
    const soc = tx.soc || 0;
    const temperature = tx.temperature || 0;
    
    // Validate data quality
    const dataAge = Date.now() - (selectedStation.lastHeartbeat || Date.now());
    const isDataFresh = dataAge < 15000; // Data less than 15 seconds old
    const hasActiveFlow = power > 100; // At least 100W
    
    // Display power with validation
    const powerKw = (power / 1000).toFixed(1);
    document.getElementById('currentPower').textContent = powerKw;
    
    // Show data quality indicator
    const powerElement = document.getElementById('currentPower').parentElement;
    if (!isDataFresh) {
      powerElement.style.opacity = '0.6';
      powerElement.title = 'Data may be stale';
    } else if (!hasActiveFlow && tx.energy > 0) {
      powerElement.style.opacity = '0.8';
      powerElement.title = 'Charging may be paused';
    } else {
      powerElement.style.opacity = '1';
      powerElement.title = '';
    }
    
    // Validate and display energy
    if (energy >= 0) {
      document.getElementById('energyDelivered').textContent = energy.toFixed(2);
    } else {
      document.getElementById('energyDelivered').textContent = '0.00';
      console.warn('[UI] Negative energy detected, displaying 0');
    }
    
    // Update cost
    const cost = Math.max(0, energy * COST_PER_KWH);
    document.getElementById('costAmount').textContent = `€${cost.toFixed(2)}`;
    
    // Update battery indicator with real or estimated SoC
    updateBatteryIndicator(energy, soc);
    
    // Track max power
    if (power > sessionData.maxPower) {
      sessionData.maxPower = power;
    }
    
    // Update technical data panel
    updateTechnicalData(voltage, current, temperature, dataAge);
    
    // Start timer if not running
    if (!chargingTimer) {
      chargingStartTime = new Date(selectedStation.currentTransaction.startTime);
      chargingTimer = setInterval(updateChargingTime, 1000);
    }
    updateChargingTime();
    
  } else {
    // Not charging
    chargingDisplay.classList.add('hidden');
    stopBtn.classList.add('hidden');
    
    // Clear timer
    if (chargingTimer) {
      clearInterval(chargingTimer);
      chargingTimer = null;
    }
    
    // Reset session data
    sessionData = {
      startBattery: INITIAL_BATTERY,
      startTime: null,
      maxPower: 0
    };
    
    // Show/hide start button based on availability
    // Allow starting from both "Available" (idle) and "Preparing" (cable plugged in)
    if (selectedStation.connected && 
        (selectedStation.status === 'Available' || selectedStation.status === 'Preparing')) {
      startBtn.classList.remove('hidden');
      startBtn.disabled = false;
    } else if (selectedStation.connected) {
      startBtn.classList.remove('hidden');
      startBtn.disabled = true;
    } else {
      startBtn.classList.add('hidden');
    }
  }
}

function updateBatteryIndicator(energy, soc) {
  let batteryPercent;
  let isRealData = false;
  
  // Use real SoC if available from the charger/EV
  if (soc > 0 && soc <= 100) {
    batteryPercent = soc;
    isRealData = true;
  } else {
    // Fall back to calculated estimate based on energy delivered
    const energyAsPercent = (energy / BATTERY_CAPACITY) * 100;
    batteryPercent = Math.min(sessionData.startBattery + energyAsPercent, 100);
  }
  
  // Ensure valid range
  batteryPercent = Math.max(0, Math.min(100, batteryPercent));
  
  // Update display with indicator of data source
  const batteryText = document.getElementById('batteryPercent');
  if (isRealData) {
    batteryText.textContent = `${batteryPercent.toFixed(0)}%`;
    batteryText.title = 'Real-time battery level from vehicle';
  } else {
    batteryText.textContent = `~${batteryPercent.toFixed(0)}%`;
    batteryText.title = 'Estimated battery level (vehicle data unavailable)';
  }
  
  // Update visual fill
  const batteryFill = document.getElementById('batteryFill');
  batteryFill.style.width = `${batteryPercent}%`;
  
  // Color coding based on battery level
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

function updateChargingTime() {
  if (!chargingStartTime) return;
  
  const now = new Date();
  const diff = Math.floor((now - chargingStartTime) / 1000);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  
  let timeStr;
  if (hours > 0) {
    timeStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  document.getElementById('chargingTime').textContent = timeStr;
}

function openPanel() {
  document.getElementById('stationPanel').classList.add('open');
}

function closePanel() {
  document.getElementById('stationPanel').classList.remove('open');
  selectedStation = null;
  
  if (chargingTimer) {
    clearInterval(chargingTimer);
    chargingTimer = null;
  }
}

// Payment flow
function showPayment() {
  document.getElementById('paymentModal').classList.remove('hidden');
  document.getElementById('cardNumber').focus();
}

function closePayment() {
  document.getElementById('paymentModal').classList.add('hidden');
  // Clear form
  document.getElementById('cardNumber').value = '';
  document.getElementById('cardExpiry').value = '';
  document.getElementById('cardCvv').value = '';
}

async function processPayment() {
  const cardNumber = document.getElementById('cardNumber').value;
  const expiry = document.getElementById('cardExpiry').value;
  const cvv = document.getElementById('cardCvv').value;
  
  if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
    showToast('Please enter a valid card number', 'error', '❌');
    return;
  }
  
  const payBtn = document.getElementById('payBtn');
  payBtn.disabled = true;
  payBtn.textContent = 'Processing...';
  
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
    payBtn.disabled = false;
    payBtn.textContent = 'Authorize & Start Charging';
  }
}

// Charging control
async function startCharging(paymentToken) {
  if (!selectedStation) return;
  
  const startBtn = document.getElementById('startBtn');
  startBtn.disabled = true;
  startBtn.textContent = '⚡ Starting...';
  
  // Reset session data
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
      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
    } else {
      showToast(result.error || 'Failed to start', 'error', '❌');
    }
  } catch (error) {
    showToast('Connection error', 'error', '❌');
    console.error(error);
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = '⚡ Start Charging';
  }
}

async function stopCharging() {
  if (!selectedStation) return;
  
  const stopBtn = document.getElementById('stopBtn');
  stopBtn.disabled = true;
  stopBtn.textContent = '⏹ Stopping...';
  
  try {
    const response = await fetch(`/api/stations/${selectedStation.id}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast('Charging stopped', 'success', '✅');
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } else {
      showToast(result.error || 'Failed to stop', 'error', '❌');
    }
  } catch (error) {
    showToast('Connection error', 'error', '❌');
    console.error(error);
  } finally {
    stopBtn.disabled = false;
    stopBtn.textContent = '⏹ Stop Charging';
  }
}

// Session Summary
function showSessionSummary(transaction) {
  if (!transaction) return;
  
  const energy = parseFloat(transaction.energy) || 0;
  const cost = energy * COST_PER_KWH;
  
  // Calculate duration
  const startTime = new Date(transaction.startTime);
  const endTime = new Date();
  const durationMs = endTime - startTime;
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  
  let durationStr;
  if (hours > 0) {
    durationStr = `${hours}h ${minutes}m`;
  } else {
    durationStr = `${minutes}m`;
  }
  
  // Calculate average power (energy / time in hours)
  const durationHours = durationMs / 3600000;
  const avgPower = durationHours > 0 ? (energy / durationHours).toFixed(1) : 0;
  
  // Update summary modal
  document.getElementById('summaryEnergy').textContent = `${energy.toFixed(2)} kWh`;
  document.getElementById('summaryDuration').textContent = durationStr;
  document.getElementById('summaryAvgPower').textContent = `${avgPower} kW`;
  document.getElementById('summaryCost').textContent = `€${cost.toFixed(2)}`;
  
  // Show modal
  document.getElementById('summaryModal').classList.remove('hidden');
  
  // Haptic feedback
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100, 50, 200]);
  }
}

function closeSummary() {
  document.getElementById('summaryModal').classList.add('hidden');
}

// Card input formatting
function setupCardFormatting() {
  const cardInput = document.getElementById('cardNumber');
  cardInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < value.length && i < 16; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += value[i];
    }
    e.target.value = formatted;
  });
  
  const expiryInput = document.getElementById('cardExpiry');
  expiryInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    e.target.value = value;
  });
}

// Technical data panel
function updateTechnicalData(voltage, current, temperature, dataAge) {
  const techPanel = document.getElementById('technicalData');
  
  // Show panel if we have any technical data
  const hasTechData = voltage > 0 || current > 0 || temperature > 0;
  
  if (hasTechData) {
    techPanel.style.display = 'block';
    
    // Update voltage
    if (voltage > 0) {
      document.getElementById('techVoltage').textContent = `${voltage.toFixed(1)} V`;
      document.getElementById('techVoltage').style.color = voltage >= 200 && voltage <= 250 ? '#10b981' : '#f59e0b';
    } else {
      document.getElementById('techVoltage').textContent = '-- V';
      document.getElementById('techVoltage').style.color = '#6b7280';
    }
    
    // Update current
    if (current > 0) {
      document.getElementById('techCurrent').textContent = `${current.toFixed(1)} A`;
      document.getElementById('techCurrent').style.color = current <= 32 ? '#10b981' : '#f59e0b';
    } else {
      document.getElementById('techCurrent').textContent = '-- A';
      document.getElementById('techCurrent').style.color = '#6b7280';
    }
    
    // Update temperature
    if (temperature > 0) {
      document.getElementById('techTemperature').textContent = `${temperature.toFixed(1)} °C`;
      if (temperature < 50) {
        document.getElementById('techTemperature').style.color = '#10b981'; // Green - safe
      } else if (temperature < 70) {
        document.getElementById('techTemperature').style.color = '#f59e0b'; // Yellow - warm
      } else {
        document.getElementById('techTemperature').style.color = '#ef4444'; // Red - hot
      }
    } else {
      document.getElementById('techTemperature').textContent = '-- °C';
      document.getElementById('techTemperature').style.color = '#6b7280';
    }
    
    // Update max power
    const maxPowerKw = (sessionData.maxPower / 1000).toFixed(1);
    document.getElementById('techMaxPower').textContent = `${maxPowerKw} kW`;
    
    // Update data age
    const ageSeconds = Math.floor(dataAge / 1000);
    document.getElementById('techDataAge').textContent = `${ageSeconds} s`;
    if (ageSeconds < 10) {
      document.getElementById('techDataAge').style.color = '#10b981'; // Fresh
    } else if (ageSeconds < 30) {
      document.getElementById('techDataAge').style.color = '#f59e0b'; // Aging
    } else {
      document.getElementById('techDataAge').style.color = '#ef4444'; // Stale
    }
  } else {
    techPanel.style.display = 'none';
  }
}

function toggleTechnicalData() {
  const content = document.getElementById('techContent');
  const icon = document.getElementById('techToggleIcon');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    icon.textContent = '▲';
  } else {
    content.style.display = 'none';
    icon.textContent = '▼';
  }
}

// Toast notifications
function showToast(message, type = '', icon = 'ℹ️') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = toast.querySelector('.toast-icon');
  
  toastIcon.textContent = icon;
  toastMessage.textContent = message;
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
}

async function fetchCitrineStationStatus(stationId) {
  if (!citrineStatus.available) return;
  try {
    const response = await fetch(`/api/stations/${stationId}/citrine-status`);
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
