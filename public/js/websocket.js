function connectWebSocket() {
  var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = protocol + '//' + window.location.host + '/live';
  ws = new WebSocket(wsUrl);

  ws.onopen = function() {
    console.log('WebSocket connected');
    updateConnectionStatus(true);
  };

  ws.onmessage = function(event) {
    var data = JSON.parse(event.data);

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
        var updated = stations.find(function(s) { return s.id === selectedStation.id; });
        if (updated) {
          if (selectedStation.currentTransaction && !updated.currentTransaction) {
            showSessionSummary(selectedStation.currentTransaction);
          }
          if (connectionPhase && updated.currentTransaction) {
            hideConnectionPhaseUI();
          }
          selectedStation = updated;
          updatePanel();
        }
      }
    }
  };

  ws.onclose = function() {
    console.log('WebSocket disconnected');
    updateConnectionStatus(false);
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
}

async function pollStationStatus() {
  if (!selectedStation) return;
  try {
    var response = await fetch('/api/stations/' + encodeURIComponent(selectedStation.id));
    if (response.ok) {
      var data = await response.json();
      var stationIndex = stations.findIndex(function(s) { return s.id === selectedStation.id; });
      if (stationIndex >= 0) {
        stations[stationIndex] = Object.assign({}, stations[stationIndex], data);
        selectedStation = stations[stationIndex];
        updatePanel();
        updateMarkers();
      }
    }
  } catch (error) {
    console.error('[Poll] Error fetching station status:', error);
  }
}
