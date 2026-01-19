// State
let map;
let markers = {};
let stations = [];
let selectedStation = null;
let ws = null;
let chargingStartTime = null;
let chargingTimer = null;

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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  connectWebSocket();
  setupCardFormatting();
  updateHeaderStats(); // Initial stats
});

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
  
  // Update status badge
  const statusBadge = document.getElementById('stationStatus');
  const status = selectedStation.connected ? selectedStation.status : 'Offline';
  statusBadge.textContent = status;
  statusBadge.className = `status-badge ${status.toLowerCase()}`;
  
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
    const power = selectedStation.currentTransaction.power || 0;
    const energy = parseFloat(selectedStation.currentTransaction.energy) || 0;
    
    document.getElementById('currentPower').textContent = (power / 1000).toFixed(1); // W to kW
    document.getElementById('energyDelivered').textContent = energy.toFixed(2);
    
    // Update cost
    const cost = energy * COST_PER_KWH;
    document.getElementById('costAmount').textContent = `€${cost.toFixed(2)}`;
    
    // Update battery indicator
    updateBatteryIndicator(energy);
    
    // Track max power
    if (power > sessionData.maxPower) {
      sessionData.maxPower = power;
    }
    
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
    if (selectedStation.connected && selectedStation.status === 'Available') {
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

function updateBatteryIndicator(energy) {
  // Calculate battery percentage
  // energy in kWh, assume starting at 20% and 60kWh battery
  const energyAsPercent = (energy / BATTERY_CAPACITY) * 100;
  let batteryPercent = Math.min(sessionData.startBattery + energyAsPercent, 100);
  
  // Update display
  document.getElementById('batteryPercent').textContent = `${batteryPercent.toFixed(0)}%`;
  document.getElementById('batteryFill').style.width = `${batteryPercent}%`;
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

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Service worker registration failed - that's okay for demo
  });
}
