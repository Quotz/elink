// Shared application state
var map;
var markers = {};
var stations = [];
var selectedStation = null;
var ws = null;
var chargingStartTime = null;
var chargingTimer = null;
var citrineStatus = { available: false };
var citrineStationStatus = {};
var citrineCheckInterval = null;

// Demo strategy
var DEMO_CHARGER_ID = '30004496';

// Configuration
var DEFAULT_COST_PER_KWH = 0.15;
var BATTERY_CAPACITY = 60;
var INITIAL_BATTERY = 20;

// Session tracking
var sessionData = {
  startBattery: INITIAL_BATTERY,
  startTime: null,
  maxPower: 0
};

// Connection phase state
var connectionPhase = null;

// Auth state
var currentUser = null;
var authToken = localStorage.getItem('accessToken');
var _refreshPromise = null;

function getAuthHeaders() {
  return {
    'Authorization': 'Bearer ' + authToken,
    'Content-Type': 'application/json'
  };
}

// Token refresh wrapper - use instead of fetch() for authenticated API calls
async function fetchWithAuth(url, options) {
  options = options || {};
  options.headers = Object.assign({}, getAuthHeaders(), options.headers || {});

  var response = await fetch(url, options);

  if ((response.status === 401 || response.status === 403) && authToken) {
    if (!_refreshPromise) {
      _refreshPromise = _refreshAccessToken();
    }
    var refreshed = await _refreshPromise;
    _refreshPromise = null;

    if (refreshed) {
      options.headers = Object.assign({}, getAuthHeaders(), options.headers || {});
      return fetch(url, options);
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
      return response;
    }
  }
  return response;
}

// Focus trap for modals (accessibility)
function trapFocus(modal) {
  var focusable = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  first.focus();

  modal._trapHandler = function(e) {
    if (e.key === 'Escape') {
      var closeBtn = modal.querySelector('.close-btn');
      if (closeBtn) closeBtn.click();
      return;
    }
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  modal.addEventListener('keydown', modal._trapHandler);
}

function releaseFocus(modal, returnTarget) {
  if (modal && modal._trapHandler) {
    modal.removeEventListener('keydown', modal._trapHandler);
    modal._trapHandler = null;
  }
  if (returnTarget) returnTarget.focus();
}

async function _refreshAccessToken() {
  var refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;
  try {
    var res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshToken })
    });
    if (res.ok) {
      var data = await res.json();
      authToken = data.accessToken;
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    }
  } catch (e) { /* refresh failed */ }
  return false;
}
