var _wsReconnectDelay = 3000;
var _wsReconnectAttempts = 0;
var _wsMaxDelay = 60000;

function connectWebSocket() {
  var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = protocol + '//' + window.location.host + '/live';
  if (authToken) {
    wsUrl += '?token=' + encodeURIComponent(authToken);
  }
  ws = new WebSocket(wsUrl);

  ws.onopen = function() {
    console.log('WebSocket connected');
    _wsReconnectDelay = 3000;
    _wsReconnectAttempts = 0;
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
            // Only show summary if this was our own session (has idTag = full data from server)
            var wasOwner = selectedStation.currentTransaction.idTag && currentUser &&
              selectedStation.currentTransaction.idTag === currentUser.id;
            if (wasOwner) showSessionSummary(updated.lastTransaction || selectedStation.currentTransaction);
          }
          if (connectionPhase === 'awaiting_car' && updated.currentTransaction) {
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
    _wsReconnectAttempts++;

    // Exponential backoff with jitter
    var jitter = Math.random() * 1000;
    var delay = Math.min(_wsReconnectDelay + jitter, _wsMaxDelay);
    _wsReconnectDelay = Math.min(_wsReconnectDelay * 2, _wsMaxDelay);

    setTimeout(connectWebSocket, delay);
  };

  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
}

function reconnectWebSocket() {
  if (ws) {
    ws.close();
    // onclose handler will auto-reconnect with current authToken
  }
}

async function pollStationStatus() {
  if (!selectedStation) return;
  try {
    var response = await fetchWithAuth('/api/stations/' + encodeURIComponent(selectedStation.id));
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
