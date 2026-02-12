async function selectStation(stationId) {
  selectedStation = stations.find(function(s) { return s.id === stationId; });
  if (!selectedStation) return;
  map.panTo([selectedStation.lat, selectedStation.lng]);
  // Only track session data if this is our own charging session
  var isOwnSession = selectedStation.currentTransaction && selectedStation.currentTransaction.idTag &&
    currentUser && selectedStation.currentTransaction.idTag === currentUser.id;
  if (isOwnSession && !sessionData.startTime) {
    sessionData.startTime = new Date(selectedStation.currentTransaction.startTime);
    sessionData.startBattery = INITIAL_BATTERY;
    sessionData.maxPower = 0;
  }
  // Show panel immediately with skeleton placeholders
  showPanelSkeleton();
  openPanel();
  await fetchCitrineStationStatus(stationId);
  updatePanel();
}

function showPanelSkeleton() {
  if (!selectedStation) return;
  var stationName = document.getElementById('stationName');
  var stationPower = document.getElementById('stationPower');
  var stationAddress = document.getElementById('stationAddress');
  var stationPrice = document.getElementById('stationPrice');
  var statusBadge = document.getElementById('stationStatus');
  var startBtn = document.getElementById('startBtn');
  var stopBtn = document.getElementById('stopBtn');
  var chargingDisplay = document.getElementById('chargingDisplay');
  // Show name from cached data, skeleton for the rest
  if (stationName) stationName.textContent = selectedStation.name || 'Station';
  if (stationPower) stationPower.innerHTML = '<span class="skeleton" style="width:50px">&nbsp;</span>';
  if (stationAddress) stationAddress.innerHTML = '<span class="skeleton" style="width:120px">&nbsp;</span>';
  if (stationPrice) stationPrice.innerHTML = '<span class="skeleton" style="width:60px">&nbsp;</span>';
  if (statusBadge) { statusBadge.textContent = ''; statusBadge.className = 'status-badge'; statusBadge.innerHTML = '<span class="skeleton" style="width:70px">&nbsp;</span>'; }
  if (startBtn) startBtn.classList.add('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');
  if (chargingDisplay) chargingDisplay.classList.add('hidden');
}

function updatePanel() {
  if (!selectedStation) return;

  var stationName = document.getElementById('stationName');
  var stationPower = document.getElementById('stationPower');
  var stationAddress = document.getElementById('stationAddress');
  var statusBadge = document.getElementById('stationStatus');

  if (stationName) stationName.textContent = selectedStation.name;
  if (stationPower) stationPower.textContent = selectedStation.power + ' kW';
  if (stationAddress) {
    var addressText = selectedStation.address || '--';
    if (selectedStation.vendor && selectedStation.model) {
      addressText += ' \u2022 ' + selectedStation.vendor + ' ' + selectedStation.model;
    }
    stationAddress.textContent = addressText;
  }
  var stationPrice = document.getElementById('stationPrice');
  if (stationPrice) {
    var price = selectedStation.pricePerKwh || DEFAULT_COST_PER_KWH;
    stationPrice.textContent = typeof formatPricePerKwh === 'function' ? formatPricePerKwh(price) : '\u20AC' + price.toFixed(2) + '/kWh';
  }

  var isCitrineConnected = citrineStationStatus[selectedStation.id] && citrineStationStatus[selectedStation.id].connected;
  var hasRecentHeartbeat = selectedStation.lastHeartbeat && (Date.now() - selectedStation.lastHeartbeat) < 120000;
  var isConnected = selectedStation.connected || isCitrineConnected || hasRecentHeartbeat;

  var status = selectedStation.status || t('offline');
  var badgeClass = 'offline';
  if (isConnected) {
    switch (selectedStation.status) {
      case 'Preparing': status = '\uD83D\uDD0C ' + t('status_ready_plug'); badgeClass = 'preparing'; break;
      case 'Available': status = '\u2713 ' + t('available'); badgeClass = 'available'; break;
      case 'Charging':
        // Check if this is our session or someone else's
        var txOwner = selectedStation.currentTransaction && selectedStation.currentTransaction.idTag &&
          currentUser && selectedStation.currentTransaction.idTag === currentUser.id;
        if (txOwner) {
          status = '\u26A1 ' + t('charging'); badgeClass = 'charging';
        } else {
          status = '\u26A1 ' + t('station_occupied'); badgeClass = 'occupied';
        }
        break;
      case 'Finishing': status = t('status_finishing'); badgeClass = 'finishing'; break;
      case 'Suspended': status = '\u23F8 ' + t('status_paused'); badgeClass = 'suspended'; break;
      case 'Faulted': status = '\u26A0\uFE0F ' + t('status_error'); badgeClass = 'faulted'; break;
      default: status = selectedStation.status || 'Unknown'; badgeClass = (selectedStation.status || 'available').toLowerCase();
    }
  }

  if (statusBadge) {
    statusBadge.textContent = status;
    statusBadge.className = 'status-badge ' + badgeClass;
  }

  var chargingDisplay = document.getElementById('chargingDisplay');
  var startBtn = document.getElementById('startBtn');
  var stopBtn = document.getElementById('stopBtn');
  var reserveBtn = document.getElementById('reserveBtn');

  if (selectedStation.currentTransaction) {
    hideCostPreview();
    var tx = selectedStation.currentTransaction;
    // Determine if current user owns this session
    var isOwner = tx.idTag && currentUser && tx.idTag === currentUser.id;
    var isOccupied = tx.active && !isOwner;

    if (isOccupied) {
      // Non-owner: show "In Use" state
      if (connectionPhase === 'awaiting_car') hideConnectionPhaseUI();
      if (chargingDisplay) chargingDisplay.classList.add('hidden');
      if (startBtn) startBtn.classList.add('hidden');
      if (stopBtn) stopBtn.classList.add('hidden');
      if (reserveBtn) reserveBtn.style.display = 'none';
      if (chargingTimer) { clearInterval(chargingTimer); chargingTimer = null; }
      showOccupiedMessage();
    } else {
      // Owner: show full charging data
      hideOccupiedMessage();
      if (connectionPhase === 'awaiting_car') hideConnectionPhaseUI();
      if (chargingDisplay) chargingDisplay.classList.remove('hidden');
      if (startBtn) startBtn.classList.add('hidden');
      if (stopBtn) stopBtn.classList.remove('hidden');
      if (reserveBtn) reserveBtn.style.display = 'none';

      var power = tx.power || 0;
      var energy = parseFloat(tx.energy) || 0;
      var voltage = tx.voltage || 0;
      var current = tx.current || 0;
      var soc = tx.soc || 0;
      var temperature = tx.temperature || 0;
      var dataAge = Date.now() - (selectedStation.lastHeartbeat || Date.now());
      var isDataFresh = dataAge < 15000;
      var hasActiveFlow = power > 100;
      var txAge = Date.now() - new Date(tx.startTime).getTime();
      var awaitingData = power === 0 && energy === 0 && txAge < 30000;

      var currentPowerEl = document.getElementById('currentPower');
      if (currentPowerEl) {
        currentPowerEl.textContent = awaitingData ? '--' : (power / 1000).toFixed(1);
        var powerElement = currentPowerEl.parentElement;
        if (powerElement) {
          powerElement.style.opacity = awaitingData ? '0.5' : !isDataFresh ? '0.6' : (!hasActiveFlow && tx.energy > 0) ? '0.8' : '1';
        }
      }

      var energyEl = document.getElementById('energyDelivered');
      if (energyEl) energyEl.textContent = awaitingData ? '--' : Math.max(0, energy).toFixed(2);

      var costEl = document.getElementById('costAmount');
      var pricePerKwh = (selectedStation && selectedStation.pricePerKwh) || DEFAULT_COST_PER_KWH;
      var costEur = Math.max(0, energy) * pricePerKwh;
      if (costEl) costEl.textContent = awaitingData ? '--' : (typeof formatPrice === 'function' ? formatPrice(costEur) : '\u20AC' + costEur.toFixed(2));

      updateBatteryIndicator(energy, soc);
      if (power > sessionData.maxPower) sessionData.maxPower = power;
      updateTechnicalData(voltage, current, temperature, dataAge);

      if (!chargingTimer) {
        chargingStartTime = new Date(selectedStation.currentTransaction.startTime);
        chargingTimer = setInterval(updateChargingTime, 1000);
      }
      updateChargingTime();
    }
  } else {
    hideOccupiedMessage();
    if (chargingDisplay) chargingDisplay.classList.add('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    if (chargingTimer) { clearInterval(chargingTimer); chargingTimer = null; }
    sessionData = { startBattery: INITIAL_BATTERY, startTime: null, maxPower: 0 };

    if (isConnected && (selectedStation.status === 'Available' || selectedStation.status === 'Preparing')) {
      if (startBtn) { startBtn.classList.remove('hidden'); startBtn.disabled = false; }
      if (reserveBtn) reserveBtn.style.display = 'block';
      showCostPreview();
    } else if (isConnected) {
      hideCostPreview();
      if (startBtn) { startBtn.classList.remove('hidden'); startBtn.disabled = true; startBtn.textContent = '\u23F3 ' + t('not_available'); }
      if (reserveBtn) reserveBtn.style.display = 'none';
    } else {
      hideCostPreview();
      if (startBtn) startBtn.classList.add('hidden');
      if (reserveBtn) reserveBtn.style.display = 'none';
    }
  }
}

function updateBatteryIndicator(energy, soc) {
  var batteryPercent;
  var isRealData = false;
  if (soc > 0 && soc <= 100) { batteryPercent = soc; isRealData = true; }
  else { batteryPercent = Math.min(sessionData.startBattery + (energy / BATTERY_CAPACITY) * 100, 100); }
  batteryPercent = Math.max(0, Math.min(100, batteryPercent));

  var batteryText = document.getElementById('batteryPercent');
  var batteryFill = document.getElementById('batteryFill');
  if (batteryText) batteryText.textContent = isRealData ? batteryPercent.toFixed(0) + '%' : '~' + batteryPercent.toFixed(0) + '%';
  if (batteryFill) {
    batteryFill.style.width = batteryPercent + '%';
    if (batteryPercent >= 80) batteryFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
    else if (batteryPercent >= 50) batteryFill.style.background = 'linear-gradient(90deg, #3b82f6, #60a5fa)';
    else if (batteryPercent >= 20) batteryFill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    else batteryFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
  }
}

function updateChargingTime() {
  if (!chargingStartTime) return;
  var now = new Date();
  var diff = Math.floor((now - chargingStartTime) / 1000);
  var hours = Math.floor(diff / 3600);
  var minutes = Math.floor((diff % 3600) / 60);
  var seconds = diff % 60;
  var timeStr = hours > 0
    ? hours + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0')
    : minutes + ':' + seconds.toString().padStart(2, '0');
  var el = document.getElementById('chargingTime');
  if (el) el.textContent = timeStr;
}

var _panelPushedState = false;

function openPanel() {
  var panel = document.getElementById('stationPanel');
  if (panel) panel.classList.add('open');
  // Push browser history state for back button support
  if (selectedStation) {
    history.pushState({ panel: 'station', stationId: selectedStation.id }, '', '#station=' + encodeURIComponent(selectedStation.id));
    _panelPushedState = true;
  }
}

function closePanel(skipHistory) {
  var panel = document.getElementById('stationPanel');
  if (panel) panel.classList.remove('open');
  selectedStation = null;
  connectionPhase = null;
  hideConnectionPhaseUI();
  if (chargingTimer) { clearInterval(chargingTimer); chargingTimer = null; }
  // Navigate back if we pushed state (unless called from popstate)
  if (_panelPushedState && !skipHistory) {
    _panelPushedState = false;
    history.back();
  } else {
    _panelPushedState = false;
    // Clear hash without pushing history
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
  }
}

function navigateToStation() {
  if (!selectedStation) return;
  var lat = selectedStation.lat, lng = selectedStation.lng;
  var label = encodeURIComponent(selectedStation.name || 'Charging Station');
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) window.open('maps://maps.apple.com/?daddr=' + lat + ',' + lng + '&q=' + label, '_blank');
  else window.open('https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng, '_blank');
}

function showSessionSummary(transaction) {
  if (!transaction) return;
  // Prefer server-calculated energyDelivered (from meterStop), fall back to tracked energy
  var energy = parseFloat(transaction.energyDelivered) || parseFloat(transaction.energy) || 0;
  var pricePerKwh = (selectedStation && selectedStation.pricePerKwh) || DEFAULT_COST_PER_KWH;
  // Use server-calculated cost if available, otherwise compute locally
  var cost = transaction.cost ? parseFloat(transaction.cost) : energy * pricePerKwh;
  // Use server duration if available, otherwise compute from timestamps
  var durationMs = transaction.duration || (Date.now() - new Date(transaction.startTime).getTime());
  var hours = Math.floor(durationMs / 3600000);
  var minutes = Math.floor((durationMs % 3600000) / 60000);
  var durationStr = hours > 0 ? hours + 'h ' + minutes + 'm' : minutes + 'm';
  var avgPower = transaction.avgPower ? parseFloat(transaction.avgPower) : (durationMs > 0 ? (energy / (durationMs / 3600000)).toFixed(1) : 0);

  var el;
  el = document.getElementById('summaryEnergy'); if (el) el.textContent = energy.toFixed(2) + ' kWh';
  el = document.getElementById('summaryDuration'); if (el) el.textContent = durationStr;
  el = document.getElementById('summaryAvgPower'); if (el) el.textContent = avgPower + ' kW';
  el = document.getElementById('summaryCost'); if (el) el.textContent = typeof formatPrice === 'function' ? formatPrice(cost) : '\u20AC' + cost.toFixed(2);

  var summaryModal = document.getElementById('summaryModal');
  if (summaryModal) summaryModal.classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
}

function closeSummary() {
  var modal = document.getElementById('summaryModal');
  if (modal) modal.classList.add('hidden');
}

function showOccupiedMessage() {
  var el = document.getElementById('occupiedMessage');
  if (!el) {
    el = document.createElement('div');
    el.id = 'occupiedMessage';
    el.className = 'occupied-message';
    var actions = document.getElementById('actions');
    if (actions) actions.parentNode.insertBefore(el, actions);
  }
  el.innerHTML =
    '<div class="occupied-icon">&#128268;</div>' +
    '<h3>' + t('station_occupied') + '</h3>' +
    '<p>' + t('station_occupied_desc') + '</p>';
  el.classList.remove('hidden');
}

function hideOccupiedMessage() {
  var el = document.getElementById('occupiedMessage');
  if (el) el.classList.add('hidden');
}

function showCostPreview() {
  if (!selectedStation) return;
  var el = document.getElementById('costPreview');
  if (!el) {
    el = document.createElement('div');
    el.id = 'costPreview';
    el.className = 'cost-preview';
    var startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.parentNode.insertBefore(el, startBtn);
  }
  var price = selectedStation.pricePerKwh || DEFAULT_COST_PER_KWH;
  var power = selectedStation.power || 7;
  var hourCost = price * power;
  el.innerHTML = t('estimated_cost') + ': <strong>' +
    (typeof formatPrice === 'function' ? formatPrice(hourCost) : '\u20AC' + hourCost.toFixed(2)) +
    '/hr</strong> at ' + power + ' kW';
  el.classList.remove('hidden');
}

function hideCostPreview() {
  var el = document.getElementById('costPreview');
  if (el) el.classList.add('hidden');
}

function showConnectionPhaseUI(result) {
  var overlay = document.getElementById('connectionPhaseOverlay');
  var chargingDisplay = document.getElementById('chargingDisplay');
  if (!overlay) return;
  if (chargingDisplay) chargingDisplay.classList.add('hidden');
  overlay.classList.remove('hidden');
  overlay.classList.remove('fade-out');
  connectionPhase = 'awaiting_car';
  overlay.innerHTML = '<div class="connection-phase-content"><div class="car-plug-animation"><div class="car-icon"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14"/><path d="M6 17V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10"/><rect x="3" y="14" width="18" height="3" rx="1"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/><path d="M12 8v3"/><path d="M10.5 9.5h3"/></svg></div><div class="plug-connector-line"><div class="plug-pulse"></div></div><div class="charger-icon">&#9889;</div></div><h3 class="connection-phase-title">' + t('awaiting_car_connection') + '</h3><p class="connection-phase-subtitle">' + t('please_plug_in') + '</p></div>';
  overlay._countdownInterval = null;
}

function updateConnectionPhaseUI(data) {
  var overlay = document.getElementById('connectionPhaseOverlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  var title = overlay.querySelector('.connection-phase-title');
  var subtitle = overlay.querySelector('.connection-phase-subtitle');

  switch (data.phase) {
    case 'awaiting_car': break;
    case 'car_connected':
      if (overlay._countdownInterval) clearInterval(overlay._countdownInterval);
      if (title) title.textContent = t('plug_detected');
      if (subtitle) subtitle.textContent = t('initializing_session');
      var animElPlug = overlay.querySelector('.car-plug-animation');
      if (animElPlug) animElPlug.outerHTML = '<div class="checkmark-circle success"><div class="checkmark">&#128268;</div></div>';
      if (navigator.vibrate) navigator.vibrate(200);
      showToast(t('plug_detected'), 'success');
      break;
    case 'started':
      if (overlay._countdownInterval) clearInterval(overlay._countdownInterval);
      if (title) title.textContent = t('charging_started');
      if (subtitle) subtitle.textContent = t('vehicle_now_charging');
      var animEl = overlay.querySelector('.car-plug-animation');
      if (animEl) animEl.outerHTML = '<div class="checkmark-circle success"><div class="checkmark">&#9889;</div></div>';
      if (navigator.vibrate) navigator.vibrate(200);
      showToast(t('charging_started'), 'success');
      setTimeout(function() { hideConnectionPhaseUI(); }, 1500);
      break;
    case 'timeout':
      if (overlay._countdownInterval) clearInterval(overlay._countdownInterval);
      if (title) title.textContent = t('connection_timed_out');
      if (subtitle) subtitle.textContent = t('no_vehicle_detected');
      var animEl2 = overlay.querySelector('.car-plug-animation');
      if (animEl2) animEl2.outerHTML = '<div class="timeout-circle"><div class="timeout-icon">&#9203;</div></div>';
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setTimeout(function() {
        hideConnectionPhaseUI();
        var startBtn = document.getElementById('startBtn');
        if (startBtn) { startBtn.disabled = false; startBtn.classList.remove('hidden'); startBtn.innerHTML = '&#9889; ' + t('start_charging'); }
      }, 3000);
      break;
    case 'error':
      if (overlay._countdownInterval) clearInterval(overlay._countdownInterval);
      if (title) title.textContent = t('start_failed');
      if (subtitle) subtitle.textContent = t('charger_offline');
      var animElErr = overlay.querySelector('.car-plug-animation');
      if (animElErr) animElErr.outerHTML = '<div class="timeout-circle"><div class="timeout-icon">&#10060;</div></div>';
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(t('start_failed'), 'error');
      setTimeout(function() {
        hideConnectionPhaseUI();
        var startBtn = document.getElementById('startBtn');
        if (startBtn) { startBtn.disabled = false; startBtn.classList.remove('hidden'); startBtn.innerHTML = '&#9889; ' + t('start_charging'); }
      }, 3000);
      break;
  }
}

function hideConnectionPhaseUI() {
  var overlay = document.getElementById('connectionPhaseOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    if (overlay._countdownInterval) { clearInterval(overlay._countdownInterval); overlay._countdownInterval = null; }
    overlay.classList.add('fade-out');
    setTimeout(function() {
      overlay.classList.add('hidden');
      overlay.classList.remove('fade-out');
      overlay.innerHTML = '';
    }, 500);
  }
  connectionPhase = null;
}

function updateTechnicalData(voltage, current, temperature, dataAge) {
  var techPanel = document.getElementById('technicalData');
  var hasTechData = voltage > 0 || current > 0 || temperature > 0;
  if (techPanel) techPanel.style.display = hasTechData ? 'block' : 'none';
  if (!hasTechData) return;

  var techVoltage = document.getElementById('techVoltage');
  var techCurrent = document.getElementById('techCurrent');
  var techTemperature = document.getElementById('techTemperature');
  var techMaxPower = document.getElementById('techMaxPower');
  var techDataAge = document.getElementById('techDataAge');

  if (techVoltage) {
    if (voltage > 0) { techVoltage.textContent = voltage.toFixed(1) + ' V'; techVoltage.style.color = voltage >= 200 && voltage <= 250 ? '#10b981' : '#f59e0b'; }
    else { techVoltage.textContent = '-- V'; techVoltage.style.color = '#6b7280'; }
  }
  if (techCurrent) {
    if (current > 0) { techCurrent.textContent = current.toFixed(1) + ' A'; techCurrent.style.color = current <= 32 ? '#10b981' : '#f59e0b'; }
    else { techCurrent.textContent = '-- A'; techCurrent.style.color = '#6b7280'; }
  }
  if (techTemperature) {
    if (temperature > 0) { techTemperature.textContent = temperature.toFixed(1) + ' \u00B0C'; techTemperature.style.color = temperature < 50 ? '#10b981' : temperature < 70 ? '#f59e0b' : '#ef4444'; }
    else { techTemperature.textContent = '-- \u00B0C'; techTemperature.style.color = '#6b7280'; }
  }
  if (techMaxPower) techMaxPower.textContent = (sessionData.maxPower / 1000).toFixed(1) + ' kW';
  if (techDataAge) {
    var ageSeconds = Math.floor(dataAge / 1000);
    techDataAge.textContent = ageSeconds + ' s';
    techDataAge.style.color = ageSeconds < 10 ? '#10b981' : ageSeconds < 30 ? '#f59e0b' : '#ef4444';
  }
}

function toggleTechnicalData() {
  var content = document.getElementById('techContent');
  var icon = document.getElementById('techToggleIcon');
  if (content && icon) {
    var isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    icon.textContent = isHidden ? '\u25B2' : '\u25BC';
  }
}
