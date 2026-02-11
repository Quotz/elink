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

function getAuthHeaders() {
  return {
    'Authorization': 'Bearer ' + authToken,
    'Content-Type': 'application/json'
  };
}
