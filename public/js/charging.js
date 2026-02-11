function handleStartClick() {
  if (!currentUser) {
    showToast(t('sign_in_to_charge'), 'info');
    setTimeout(function() { window.location.href = '/login.html'; }, 1500);
    return;
  }
  showPayment();
}

async function startCharging(paymentToken) {
  if (!selectedStation) return;
  var startBtn = document.getElementById('startBtn');
  if (startBtn) { startBtn.disabled = true; startBtn.classList.add('hidden'); }

  sessionData = { startBattery: INITIAL_BATTERY, startTime: new Date(), maxPower: 0 };

  try {
    var response = await fetchWithAuth('/api/stations/' + encodeURIComponent(selectedStation.id) + '/start', {
      method: 'POST',
      body: JSON.stringify({ idTag: paymentToken })
    });
    var result = await response.json();
    if (response.ok) {
      if (result.status === 'connecting') {
        showConnectionPhaseUI(result);
      } else if (result.status === 'started') {
        showToast(t('charging_started'), 'success');
        if (navigator.vibrate) navigator.vibrate(200);
      }
    } else {
      showToast(result.error || t('start_failed'), 'error');
      if (startBtn) { startBtn.disabled = false; startBtn.classList.remove('hidden'); }
    }
  } catch (error) {
    showToast(t('network_error'), 'error');
    console.error(error);
    if (startBtn) { startBtn.disabled = false; startBtn.classList.remove('hidden'); }
  }
}

function stopCharging() {
  if (!selectedStation || !selectedStation.currentTransaction) return;
  var tx = selectedStation.currentTransaction;
  var energy = parseFloat(tx.energy) || 0;
  var pricePerKwh = (selectedStation && selectedStation.pricePerKwh) || DEFAULT_COST_PER_KWH;
  var cost = energy * pricePerKwh;
  var timeEl = document.getElementById('chargingTime');
  var duration = timeEl ? timeEl.textContent : '--';

  var statsEl = document.getElementById('stopConfirmStats');
  if (statsEl) {
    statsEl.innerHTML =
      '<div class="summary-stat"><span class="summary-stat-label">' + t('energy') + '</span><span class="summary-stat-value">' + energy.toFixed(2) + ' kWh</span></div>' +
      '<div class="summary-stat"><span class="summary-stat-label">' + t('duration') + '</span><span class="summary-stat-value">' + duration + '</span></div>' +
      '<div class="summary-stat"><span class="summary-stat-label">' + t('estimated_cost') + '</span><span class="summary-stat-value highlight">' + (typeof formatPrice === 'function' ? formatPrice(cost) : '\u20AC' + cost.toFixed(2)) + '</span></div>';
  }
  var modal = document.getElementById('stopConfirmModal');
  if (modal) modal.classList.remove('hidden');
}

function closeStopConfirm() {
  var modal = document.getElementById('stopConfirmModal');
  if (modal) modal.classList.add('hidden');
}

async function confirmAndStopCharging() {
  closeStopConfirm();
  if (!selectedStation) return;
  var stopBtn = document.getElementById('stopBtn');
  if (stopBtn) { stopBtn.disabled = true; stopBtn.textContent = '\u23F9 ' + t('stopping'); }

  try {
    var response = await fetchWithAuth('/api/stations/' + encodeURIComponent(selectedStation.id) + '/stop', {
      method: 'POST'
    });
    var result = await response.json();
    if (response.ok) {
      showToast(t('charging_stopped'), 'success', '\u2705');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } else {
      showToast(result.error || t('failed_to_stop'), 'error', '\u274C');
    }
  } catch (error) {
    showToast(t('connection_error'), 'error', '\u274C');
    console.error(error);
  } finally {
    if (stopBtn) { stopBtn.disabled = false; stopBtn.textContent = '\u23F9 ' + t('stop_charging'); }
  }
}
