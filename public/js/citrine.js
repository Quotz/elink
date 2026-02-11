function initCitrineIndicator() {}
function updateCitrineIndicator() {}

async function checkCitrineStatus() {
  try {
    var response = await fetch('/api/citrine/health');
    if (response.ok) {
      citrineStatus = await response.json();
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
    var response = await fetch('/api/stations/' + encodeURIComponent(stationId) + '/citrine-status', {
      headers: authToken ? getAuthHeaders() : { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      citrineStationStatus[stationId] = await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch Citrine status:', error);
  }
}

async function syncWithCitrineOS(stationId) {
  var syncBtn = document.getElementById('citrineSyncBtn');
  if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = '🔄 Syncing...'; }
  try {
    var response = await fetch('/api/citrine/stations/' + stationId + '/sync', {
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
    if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = '🔄 Sync with CitrineOS'; }
  }
}
