function initMap() {
  map = L.map('map').setView([42.0000, 21.4254], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
  map.on('click', function() {
    if (selectedStation && !selectedStation.currentTransaction) {
      closePanel();
    }
  });
}

function updateMarkers() {
  stations.forEach(function(station) {
    if (markers[station.id]) {
      updateMarkerStyle(station);
    } else {
      createMarker(station);
    }
  });
}

function createMarker(station) {
  var statusClass = getStatusClass(station);
  var icon = L.divIcon({
    className: 'custom-marker-wrapper',
    html: '<div class="custom-marker ' + statusClass + '">⚡</div>',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
  var marker = L.marker([station.lat, station.lng], { icon: icon })
    .addTo(map)
    .on('click', function() { selectStation(station.id); });
  markers[station.id] = marker;
}

function updateMarkerStyle(station) {
  var statusClass = getStatusClass(station);
  var marker = markers[station.id];
  if (!marker) return;
  var icon = L.divIcon({
    className: 'custom-marker-wrapper',
    html: '<div class="custom-marker ' + statusClass + '">⚡</div>',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
  marker.setIcon(icon);
}

function getStatusClass(station) {
  var isConnected = station.connected ||
    (citrineStationStatus[station.id] && citrineStationStatus[station.id].connected) ||
    (station.lastHeartbeat && (Date.now() - station.lastHeartbeat) < 120000);
  if (!isConnected) return 'offline';
  if (station.status === 'Charging') return 'charging';
  if (station.status === 'Available' || station.status === 'Preparing') return 'available';
  return 'offline';
}

function updateConnectionStatus(online) {
  var dot = document.getElementById('connectionDot');
  if (dot) dot.className = 'dot ' + (online ? 'online' : 'offline');
}

function updateHeaderStats() {
  // Stats are no longer shown in header (decluttered for mobile)
}
