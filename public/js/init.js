document.addEventListener('DOMContentLoaded', function() {
  initMap();
  connectWebSocket();
  setupCardFormatting();
  checkCitrineStatus();
  updateHeaderStats();
  initAuth();
  initReservationUI();
  initCitrineIndicator();
  initSearch();

  var citrineInterval = setInterval(checkCitrineStatus, 30000);
  var pollInterval = setInterval(pollStationStatus, 10000);

  // Pause polling when tab is hidden to save battery
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      clearInterval(citrineInterval);
      clearInterval(pollInterval);
    } else {
      checkCitrineStatus();
      pollStationStatus();
      citrineInterval = setInterval(checkCitrineStatus, 30000);
      pollInterval = setInterval(pollStationStatus, 10000);
    }
  });

  // Dismiss splash screen
  var splash = document.getElementById('splashScreen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(function() { splash.remove(); }, 300);
  }

  // Deep linking: check hash for station ID
  var hash = window.location.hash;
  if (hash && hash.indexOf('#station=') === 0) {
    var deepLinkStationId = decodeURIComponent(hash.substring(9));
    var _dlCheck = setInterval(function() {
      if (stations.length > 0) {
        clearInterval(_dlCheck);
        selectStation(deepLinkStationId);
      }
    }, 200);
    setTimeout(function() { clearInterval(_dlCheck); }, 5000);
  }

  // Restore station from profile round-trip
  var returnStation = sessionStorage.getItem('elink_returnStation');
  if (returnStation && !hash) {
    sessionStorage.removeItem('elink_returnStation');
    var _rsCheck = setInterval(function() {
      if (stations.length > 0) {
        clearInterval(_rsCheck);
        selectStation(returnStation);
      }
    }, 200);
    setTimeout(function() { clearInterval(_rsCheck); }, 5000);
  }

  // Back button handler
  window.addEventListener('popstate', function(event) {
    var paymentModal = document.getElementById('paymentModal');
    var stopConfirmModal = document.getElementById('stopConfirmModal');
    var reservationModal = document.getElementById('reservationModal');

    // Close modals first
    if (paymentModal && !paymentModal.classList.contains('hidden')) {
      closePayment(); return;
    }
    if (stopConfirmModal && !stopConfirmModal.classList.contains('hidden')) {
      closeStopConfirm(); return;
    }
    if (reservationModal && !reservationModal.classList.contains('hidden')) {
      closeReservationModal(); return;
    }

    // Close panel (skipHistory=true since this IS the popstate)
    var panel = document.getElementById('stationPanel');
    if (panel && panel.classList.contains('open')) {
      closePanel(true);
    }
  });
});
