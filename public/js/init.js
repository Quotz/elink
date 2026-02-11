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

  setInterval(checkCitrineStatus, 30000);
  setInterval(pollStationStatus, 10000);
});
