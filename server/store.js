/**
 * Persistent store for charging stations
 * Data is saved to stations.json file
 */

const fs = require('fs');
const path = require('path');

const STATIONS_FILE = path.join(__dirname, 'stations.json');

// Load stations from file or use defaults
let stations = {};

function loadStations() {
  try {
    if (fs.existsSync(STATIONS_FILE)) {
      const data = fs.readFileSync(STATIONS_FILE, 'utf8');
      stations = JSON.parse(data);
      console.log(`[Store] Loaded ${Object.keys(stations).length} stations from file`);
    } else {
      // Initialize with default stations if file doesn't exist
      stations = getDefaultStations();
      saveStations();
      console.log('[Store] Created new stations file with defaults');
    }
  } catch (error) {
    console.error('[Store] Error loading stations:', error);
    stations = getDefaultStations();
  }
}

function saveStations() {
  try {
    fs.writeFileSync(STATIONS_FILE, JSON.stringify(stations, null, 2), 'utf8');
  } catch (error) {
    console.error('[Store] Error saving stations:', error);
  }
}

function getDefaultStations() {
  return {
    '001': {
      id: '001',
      name: 'Station 1 - 7kW',
      power: 7,
      lat: 41.9981,  // Update with your actual coordinates
      lng: 21.4254,  // Skopje area default
      address: 'Location 1',
      connected: false,
      status: 'Offline',
      vendor: null,
      model: null,
      currentTransaction: null,
      lastTransaction: null,
      lastHeartbeat: null,
      connectedAt: null,
      messageCount: 0,
      sessionHistory: [],
      configuration: null,
      capabilities: null,
      meterHistory: [],
      diagnostics: {}
    },
    '002': {
      id: '002',
      name: 'Station 2 - 22kW',
      power: 22,
      lat: 42.0024,  // Update with your actual coordinates
      lng: 21.4208,  // Skopje area default
      address: 'Location 2',
      connected: false,
      status: 'Offline',
      vendor: null,
      model: null,
      currentTransaction: null,
      lastTransaction: null,
      lastHeartbeat: null,
      connectedAt: null,
      messageCount: 0,
      sessionHistory: [],
      configuration: null,
      capabilities: null,
      meterHistory: [],
      diagnostics: {}
    }
  };
}

// Load stations on startup
loadStations();

// WebSocket connections for each charger
const chargerConnections = new Map();

module.exports = {
  getStations() {
    return Object.values(stations);
  },
  
  getStation(id) {
    return stations[id] || null;
  },
  
  updateStation(id, updates) {
    if (!stations[id]) {
      // Auto-create station if charger connects with unknown ID
      stations[id] = {
        id,
        name: `Station ${id}`,
        power: 0,
        lat: 42.0000,
        lng: 21.4300,
        address: 'Unknown location',
        connected: false,
        status: 'Offline',
        currentTransaction: null,
        lastTransaction: null,
        lastHeartbeat: null,
        connectedAt: null,
        messageCount: 0,
        sessionHistory: [],
        configuration: null,
        capabilities: null,
        meterHistory: [],
        diagnostics: {}
      };
    }
    
    stations[id] = {
      ...stations[id],
      ...updates,
      // Deep merge for currentTransaction
      currentTransaction: updates.currentTransaction !== undefined 
        ? updates.currentTransaction 
        : stations[id].currentTransaction
    };
    
    // Save persistent fields to file
    // Don't save runtime data (connected, status, transactions, etc.)
    if (updates.name || updates.power || updates.lat || updates.lng || updates.address || updates.pricePerKwh !== undefined) {
      saveStations();
    }
    
    return stations[id];
  },
  
  setChargerConnection(id, ws) {
    if (ws) {
      chargerConnections.set(id, ws);
    } else {
      chargerConnections.delete(id);
    }
  },
  
  getChargerConnection(id) {
    return chargerConnections.get(id);
  },
  
  createStation(stationData) {
    const id = stationData.id;
    if (stations[id]) {
      return null; // Station already exists
    }
    
    stations[id] = {
      id,
      name: stationData.name || `Station ${id}`,
      power: stationData.power || 0,
      lat: stationData.lat || 42.0000,
      lng: stationData.lng || 21.4300,
      address: stationData.address || 'Unknown location',
      connected: false,
      status: 'Offline',
      vendor: null,
      model: null,
      currentTransaction: null,
      lastTransaction: null,
      lastHeartbeat: null,
      connectedAt: null,
      messageCount: 0,
      sessionHistory: [],
      configuration: null,
      capabilities: null,
      meterHistory: [],
      diagnostics: {}
    };
    
    // Save to file
    saveStations();
    
    return stations[id];
  },
  
  deleteStation(id) {
    if (!stations[id]) {
      return false;
    }
    
    // Don't allow deletion of connected chargers
    if (stations[id].connected) {
      return false;
    }
    
    delete stations[id];
    
    // Save to file
    saveStations();
    
    return true;
  }
};
