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
    connectedAt: null,
    lastActivity: null,
    connectionHistory: []
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
    connectedAt: null,
    lastActivity: null,
    connectionHistory: []
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
        connectedAt: null,
        lastActivity: null,
        connectionHistory: []
      };
    }
    
    // Track activity timestamp on any update
    const now = new Date().toISOString();
    if (updates.connected !== undefined) {
      updates.lastActivity = now;
      if (updates.connected) {
        updates.connectedAt = now;
        // Add to connection history
        if (!stations[id].connectionHistory) stations[id].connectionHistory = [];
        stations[id].connectionHistory.push({
          connectedAt: now,
          disconnectedAt: null
        });
        // Keep only last 10 connection events
        if (stations[id].connectionHistory.length > 10) {
          stations[id].connectionHistory.shift();
        }
      } else {
        // Mark last connection as disconnected
        if (stations[id].connectionHistory && stations[id].connectionHistory.length > 0) {
          const lastConnection = stations[id].connectionHistory[stations[id].connectionHistory.length - 1];
          if (!lastConnection.disconnectedAt) {
            lastConnection.disconnectedAt = now;
          }
        }
        updates.connectedAt = null;
      }
    } else if (stations[id].connected) {
      // Update activity timestamp if charger is connected
      updates.lastActivity = now;
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
  
  getAdminStats() {
    const all = Object.values(stations);
    const connected = all.filter(s => s.connected);
    const disconnected = all.filter(s => !s.connected);
    
    return {
      total: all.length,
      connected: connected.map(s => s.id),
      disconnected: disconnected.map(s => s.id),
      all: all.map(s => ({
        ...s,
        uptime: s.connectedAt ? Math.floor((Date.now() - new Date(s.connectedAt).getTime()) / 1000) : 0
      }))
    };
  }
};
