/**
 * In-memory store for charging stations
 * In production, this would be a database
 */

// Pre-configured stations - UPDATE THESE with your actual charger IDs and locations
const stations = {
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
      lastTransaction: null
    };
    
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
    return true;
  }
};
