async function startCharging(paymentToken) {
  if (!selectedStation) return;
  var startBtn = document.getElementById('startBtn');
  if (startBtn) { startBtn.disabled = true; startBtn.classList.add('hidden'); }

  sessionData = { startBattery: INITIAL_BATTERY, startTime: new Date(), maxPower: 0 };

  try {
    var response = await fetch('/api/stations/' + encodeURIComponent(selectedStation.id) + '/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

async function stopCharging() {
  if (!selectedStation) return;
  var stopBtn = document.getElementById('stopBtn');
  if (stopBtn) { stopBtn.disabled = true; stopBtn.textContent = '\u23F9 ' + t('stopping'); }

  try {
    var response = await fetch('/api/stations/' + encodeURIComponent(selectedStation.id) + '/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
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
