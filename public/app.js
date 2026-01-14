// State
let map;
let markers = {};
let stations = [];
let selectedStation = null;
let ws = null;
let chargingStartTime = null;
let chargingTimer = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  connectWebSocket();
  setupCardFormatting();
});

// Initialize Leaflet map
function initMap() {
  // Center on Skopje - update these coordinates to your location
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
      
      // Update selected station if panel is open
      if (selectedStation) {
        const updated = stations.find(s => s.id === selectedStation.id);
        if (updated) {
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
    iconSize: [40, 40],
    iconAnchor: [20, 20]
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
    iconSize: [40, 40],
    iconAnchor: [20, 20]
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
    document.getElementById('currentPower').textContent = (power / 1000).toFixed(1); // W to kW
    document.getElementById('energyDelivered').textContent = selectedStation.currentTransaction.energy || '0.00';
    
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
    showToast('Please enter a valid card number', 'error');
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
      showToast('Payment authorized!', 'success');
      closePayment();
      await startCharging(result.token);
    } else {
      showToast(result.message || 'Payment failed', 'error');
    }
  } catch (error) {
    showToast('Payment error', 'error');
    console.error(error);
  } finally {
    payBtn.disabled = false;
    payBtn.textContent = 'Authorize & Start';
  }
}

// Charging control
async function startCharging(paymentToken) {
  if (!selectedStation) return;
  
  const startBtn = document.getElementById('startBtn');
  startBtn.disabled = true;
  startBtn.textContent = 'Starting...';
  
  try {
    const response = await fetch(`/api/stations/${selectedStation.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idTag: paymentToken })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast('Charging started!', 'success');
    } else {
      showToast(result.error || 'Failed to start', 'error');
    }
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = 'Start Charging';
  }
}

async function stopCharging() {
  if (!selectedStation) return;
  
  const stopBtn = document.getElementById('stopBtn');
  stopBtn.disabled = true;
  stopBtn.textContent = 'Stopping...';
  
  try {
    const response = await fetch(`/api/stations/${selectedStation.id}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast('Charging stopped', 'success');
    } else {
      showToast(result.error || 'Failed to stop', 'error');
    }
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  } finally {
    stopBtn.disabled = false;
    stopBtn.textContent = 'Stop Charging';
  }
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
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
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
