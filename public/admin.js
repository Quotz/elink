// State
let stations = [];
let ws = null;
let mapPicker = null;
let mapMarker = null;
let editMode = false;
let currentEditId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadStations();
  connectWebSocket();
});

// Load stations from API
async function loadStations() {
  try {
    const response = await fetch('/api/stations');
    stations = await response.json();
    renderStations();
    updateStats();
  } catch (error) {
    showToast('Failed to load stations', 'error');
    console.error(error);
  }
}

// WebSocket connection for real-time updates
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/live`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'init' || data.type === 'update') {
      stations = data.stations;
      renderStations();
      updateStats();
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // Reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Render stations table
function renderStations() {
  const tbody = document.getElementById('stationsBody');
  
  if (stations.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          <div class="empty-state">
            <div class="empty-state-icon">📍</div>
            <p>No charging stations configured yet</p>
            <p style="font-size: 13px; margin-top: 5px;">Click "Add New Charger" to get started</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = stations.map(station => {
    const statusClass = getStatusClass(station);
    const statusText = station.connected ? station.status : 'Offline';
    
    return `
      <tr>
        <td><strong>${station.id}</strong></td>
        <td>${station.name}</td>
        <td>
          <span class="status-dot status-${statusClass}"></span>
          ${statusText}
        </td>
        <td>${station.power} kW</td>
        <td>${station.lat.toFixed(4)}, ${station.lng.toFixed(4)}</td>
        <td>${station.address}</td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-primary btn-small" onclick="openEditModal('${station.id}')">
              ✏️ Edit
            </button>
            <button class="btn btn-danger btn-small" onclick="deleteStation('${station.id}')" 
                    ${station.connected ? 'disabled title="Cannot delete connected charger"' : ''}>
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getStatusClass(station) {
  if (!station.connected) return 'offline';
  if (station.status === 'Charging') return 'charging';
  if (station.status === 'Available') return 'online';
  return 'offline';
}

// Update header stats
function updateStats() {
  const total = stations.length;
  const online = stations.filter(s => s.connected).length;
  const charging = stations.filter(s => s.status === 'Charging').length;
  
  document.getElementById('totalStations').textContent = total;
  document.getElementById('onlineStations').textContent = online;
  document.getElementById('chargingStations').textContent = charging;
}

// Open add modal
function openAddModal() {
  editMode = false;
  currentEditId = null;
  
  document.getElementById('modalTitle').textContent = 'Add New Charger';
  document.getElementById('saveBtn').textContent = 'Add Charger';
  document.getElementById('chargerId').disabled = false;
  
  // Reset form
  document.getElementById('chargerForm').reset();
  
  // Set default coordinates (Skopje)
  document.getElementById('chargerLat').value = '42.0000';
  document.getElementById('chargerLng').value = '21.4254';
  
  // Open modal
  document.getElementById('editModal').classList.add('active');
  
  // Initialize map
  setTimeout(() => {
    initMapPicker(42.0000, 21.4254);
  }, 100);
}

// Open edit modal
function openEditModal(stationId) {
  editMode = true;
  currentEditId = stationId;
  
  const station = stations.find(s => s.id === stationId);
  if (!station) return;
  
  document.getElementById('modalTitle').textContent = 'Edit Charger';
  document.getElementById('saveBtn').textContent = 'Save Changes';
  document.getElementById('chargerId').disabled = true;
  
  // Fill form
  document.getElementById('chargerId').value = station.id;
  document.getElementById('chargerName').value = station.name;
  document.getElementById('chargerPower').value = station.power;
  document.getElementById('chargerAddress').value = station.address;
  document.getElementById('chargerLat').value = station.lat;
  document.getElementById('chargerLng').value = station.lng;
  
  // Open modal
  document.getElementById('editModal').classList.add('active');
  
  // Initialize map
  setTimeout(() => {
    initMapPicker(station.lat, station.lng);
  }, 100);
}

// Close modal
function closeModal() {
  document.getElementById('editModal').classList.remove('active');
  
  // Destroy map
  if (mapPicker) {
    mapPicker.remove();
    mapPicker = null;
    mapMarker = null;
  }
}

// Initialize map picker
function initMapPicker(lat, lng) {
  // Destroy existing map if any
  if (mapPicker) {
    mapPicker.remove();
  }
  
  // Create map
  mapPicker = L.map('mapPicker').setView([lat, lng], 14);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(mapPicker);
  
  // Add marker
  mapMarker = L.marker([lat, lng], { draggable: true }).addTo(mapPicker);
  
  // Update coordinates when marker is dragged
  mapMarker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    document.getElementById('chargerLat').value = pos.lat.toFixed(6);
    document.getElementById('chargerLng').value = pos.lng.toFixed(6);
  });
  
  // Update marker when clicking on map
  mapPicker.on('click', (e) => {
    const pos = e.latlng;
    mapMarker.setLatLng(pos);
    document.getElementById('chargerLat').value = pos.lat.toFixed(6);
    document.getElementById('chargerLng').value = pos.lng.toFixed(6);
  });
  
  // Update marker when coordinates are typed
  document.getElementById('chargerLat').addEventListener('input', updateMarkerFromInputs);
  document.getElementById('chargerLng').addEventListener('input', updateMarkerFromInputs);
}

function updateMarkerFromInputs() {
  const lat = parseFloat(document.getElementById('chargerLat').value);
  const lng = parseFloat(document.getElementById('chargerLng').value);
  
  if (!isNaN(lat) && !isNaN(lng) && mapMarker && mapPicker) {
    mapMarker.setLatLng([lat, lng]);
    mapPicker.setView([lat, lng]);
  }
}

// Save charger
async function saveCharger(event) {
  event.preventDefault();
  
  const id = document.getElementById('chargerId').value.trim();
  const name = document.getElementById('chargerName').value.trim();
  const power = parseFloat(document.getElementById('chargerPower').value);
  const address = document.getElementById('chargerAddress').value.trim();
  const lat = parseFloat(document.getElementById('chargerLat').value);
  const lng = parseFloat(document.getElementById('chargerLng').value);
  
  const data = { id, name, power, address, lat, lng };
  
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  try {
    let response;
    
    if (editMode) {
      // Update existing
      response = await fetch(`/api/stations/${currentEditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      // Create new
      response = await fetch('/api/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
    
    if (response.ok) {
      showToast(editMode ? 'Charger updated successfully' : 'Charger added successfully', 'success');
      closeModal();
      await loadStations();
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to save charger', 'error');
    }
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

// Delete station
async function deleteStation(stationId) {
  const station = stations.find(s => s.id === stationId);
  
  if (!station) return;
  
  if (station.connected) {
    showToast('Cannot delete a connected charger', 'error');
    return;
  }
  
  if (!confirm(`Are you sure you want to delete "${station.name}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/stations/${stationId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showToast('Charger deleted successfully', 'success');
      await loadStations();
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to delete charger', 'error');
    }
  } catch (error) {
    showToast('Connection error', 'error');
    console.error(error);
  }
}

// Toast notifications
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  
  if (type === 'success') {
    toastIcon.textContent = '✅';
  } else if (type === 'error') {
    toastIcon.textContent = '❌';
  } else {
    toastIcon.textContent = 'ℹ️';
  }
  
  toastMessage.textContent = message;
  toast.className = `toast ${type} active`;
  
  setTimeout(() => {
    toast.classList.remove('active');
  }, 3000);
}

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// Close modal on background click
document.getElementById('editModal').addEventListener('click', (e) => {
  if (e.target.id === 'editModal') {
    closeModal();
  }
});
