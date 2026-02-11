function initReservationUI() {
  var actionButtons = document.getElementById('actions');
  if (actionButtons && !document.getElementById('reserveBtn')) {
    var reserveBtn = document.createElement('button');
    reserveBtn.id = 'reserveBtn';
    reserveBtn.className = 'btn btn-secondary';
    reserveBtn.style.cssText = 'margin-top: 10px; width: 100%; display: none;';
    reserveBtn.innerHTML = '\uD83D\uDCC5 ' + t('reserve_30_min');
    reserveBtn.onclick = showReservationModal;
    actionButtons.appendChild(reserveBtn);
  }
}

function showReservationModal() {
  if (!currentUser) { window.location.href = '/login.html'; return; }
  if (!selectedStation) return;
  if (selectedStation.currentTransaction) { showToast(t('station_in_use'), 'error'); return; }

  var modal = document.getElementById('reservationModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reservationModal';
    modal.className = 'modal hidden';
    document.body.appendChild(modal);
  }

  modal.innerHTML =
    '<div class="modal-content"><div class="modal-header"><h3>' + t('reserve_charger') + '</h3>' +
    '<button class="close-btn" onclick="closeReservationModal()">&times;</button></div>' +
    '<div class="modal-body" style="text-align:center; padding: 20px;">' +
    '<div style="font-size: 2.5rem; margin-bottom: 12px;">\uD83D\uDCC5</div>' +
    '<p style="margin-bottom: 6px; font-weight: 600; font-size: 1.05rem;">' + selectedStation.name + '</p>' +
    '<p style="color: var(--gray-500, #6b7280); margin-bottom: 20px; font-size: 0.9rem;">' + t('reserve_description') + '</p>' +
    '<button class="btn btn-primary" id="reserveNowBtn" onclick="makeReservationNow()" style="width: 100%; padding: 14px;">' + t('reserve_for_30') + '</button>' +
    '<p style="margin-top: 12px; font-size: 0.75rem; color: var(--gray-500, #6b7280);">' + t('one_active_reservation') + '</p>' +
    '</div></div>';

  modal.classList.remove('hidden');
}

function closeReservationModal() {
  var modal = document.getElementById('reservationModal');
  if (modal) modal.classList.add('hidden');
}

async function makeReservationNow() {
  if (!selectedStation || !currentUser) return;
  var btn = document.getElementById('reserveNowBtn');
  if (btn) { btn.disabled = true; btn.textContent = t('reserving'); }

  try {
    var response = await fetchWithAuth('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({ chargerId: selectedStation.id })
    });
    var data = await response.json();
    if (response.ok) {
      showToast(t('reserved_success'), 'success');
      closeReservationModal();
    } else {
      showToast(data.error || t('failed_to_reserve'), 'error');
    }
  } catch (error) {
    showToast(t('network_error'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('reserve_for_30'); }
  }
}
