function initSearch() {
  var input = document.getElementById('searchInput');
  var results = document.getElementById('searchResults');
  if (!input || !results) return;

  input.addEventListener('input', function() {
    var query = input.value.trim().toLowerCase();
    if (query.length < 1) { results.classList.add('hidden'); return; }

    var matches = stations.filter(function(s) {
      return (s.name && s.name.toLowerCase().includes(query)) ||
        (s.address && s.address.toLowerCase().includes(query)) ||
        (s.id && s.id.toLowerCase().includes(query));
    });

    if (matches.length === 0) {
      results.innerHTML = '<div style="padding:14px;text-align:center;color:#999;font-size:0.85rem">' + t('no_stations_found') + '</div>';
    } else {
      results.innerHTML = matches.map(function(s) {
        var isOnline = s.connected || (s.lastHeartbeat && (Date.now() - s.lastHeartbeat) < 120000);
        var statusText = s.currentTransaction ? t('charging') : isOnline ? t('available') : t('offline');
        var statusColor = s.currentTransaction ? '#ef6c00;background:#fff3e0' : isOnline ? '#2e7d32;background:#e8f5e9' : '#666;background:#f5f5f5';
        return '<div class="search-result-item" onclick="searchSelectStation(\'' + s.id + '\')">' +
          '<div><div class="search-result-name">' + s.name + '</div>' +
          '<div class="search-result-address">' + (s.address || '') + ' &bull; ' + s.power + ' kW</div></div>' +
          '<span class="search-result-status" style="color:' + statusColor + '">' + statusText + '</span></div>';
      }).join('');
    }
    results.classList.remove('hidden');
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-bar')) results.classList.add('hidden');
  });
}

function searchSelectStation(id) {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').classList.add('hidden');
  selectStation(id);
}
