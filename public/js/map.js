var _userLocationMarker = null;

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

  // Locate Me button
  var LocateControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function() {
      var btn = L.DomUtil.create('button', 'locate-btn');
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>';
      btn.title = 'Find my location';
      btn.type = 'button';
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, 'click', function() {
        btn.classList.add('locating');
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            btn.classList.remove('locating');
            var latlng = [pos.coords.latitude, pos.coords.longitude];
            map.setView(latlng, 16);
            if (_userLocationMarker) map.removeLayer(_userLocationMarker);
            _userLocationMarker = L.circleMarker(latlng, {
              radius: 8, fillColor: '#4285F4', fillOpacity: 1,
              color: 'white', weight: 3, opacity: 1
            }).addTo(map);
          },
          function() {
            btn.classList.remove('locating');
            showToast(t('location_unavailable'), 'error');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
      return btn;
    }
  });
  new LocateControl().addTo(map);
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
  if (station.status === 'Charging' || station.currentTransaction) {
    // Owner sees "charging", everyone else sees "occupied"
    if (station.currentTransaction && station.currentTransaction.idTag &&
        currentUser && station.currentTransaction.idTag === currentUser.id) {
      return 'charging';
    }
    return 'occupied';
  }
  if (station.status === 'Available' || station.status === 'Preparing') return 'available';
  return 'offline';
}

function updateConnectionStatus(online) {
  var banner = document.getElementById('connectionBanner');
  if (!banner) return;
  if (online) {
    banner.classList.add('hidden');
  } else if (_wsReconnectAttempts >= 2) {
    banner.classList.remove('hidden');
  }
}

function updateHeaderStats() {
  // Stats are no longer shown in header (decluttered for mobile)
}
