/**
 * Demo Simulation Engine
 * Simulates OCPP charger behavior for demo/presentation purposes.
 * Produces identical data to real OCPP chargers - frontend sees no difference.
 */

const store = require('./store');
const { broadcastUpdate: broadcastFn } = require('./websocket');

// Active simulation state per station
const simState = new Map();

/**
 * Simulate a charger connecting (like BootNotification)
 */
function simulateConnect(id) {
  const station = store.getStation(id);
  if (!station) return { error: 'Station not found', status: 404 };

  // Don't override real OCPP connections
  if (station.connected && station.connectionSource === 'ocpp') {
    return { error: 'Already connected via real OCPP', status: 409 };
  }

  // Stop any existing simulation for this station
  simulateDisconnect(id);

  store.updateStation(id, {
    connected: true,
    status: 'Available',
    lastHeartbeat: Date.now(),
    connectedAt: Date.now(),
    connectionSource: 'simulation',
    demoMode: false,
    vendor: station.vendor || 'Unknown',
    model: station.model || 'Unknown'
  });

  // Keep-alive heartbeat to prevent timeout monitor from marking offline
  const heartbeatInterval = setInterval(() => {
    const s = store.getStation(id);
    if (s && s.connectionSource === 'simulation') {
      store.updateStation(id, { lastHeartbeat: Date.now() });
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 10000);

  simState.set(id, { heartbeatInterval, meterInterval: null });

  broadcastFn();
  return { success: true, stationId: id, status: 'connected' };
}

/**
 * Start a simulated charging session
 */
function simulateStart(id, options = {}) {
  const station = store.getStation(id);
  if (!station) return { error: 'Station not found', status: 404 };
  if (!station.connected) return { error: 'Station not connected', status: 400 };
  if (station.currentTransaction) return { error: 'Already charging', status: 400 };

  const state = simState.get(id);
  if (!state) return { error: 'Station not simulated - connect first', status: 400 };

  const transactionId = Math.floor(Math.random() * 1000000);
  const meterStart = Math.floor(Math.random() * 50000) + 100000;

  store.updateStation(id, {
    status: 'Charging',
    currentTransaction: {
      id: transactionId,
      idTag: options.idTag || 'DEMO-USER-001',
      startTime: new Date().toISOString(),
      meterStart: meterStart,
      meterValue: meterStart,
      power: 0,
      energy: 0,
      voltage: 0,
      current: 0,
      soc: options.startSoc || 20,
      temperature: 25
    }
  });

  // Start meter value simulation timer (every 2 seconds)
  const meterInterval = setInterval(() => {
    simulateMeterTick(id);
  }, 2000);

  state.meterInterval = meterInterval;

  broadcastFn();
  return { success: true, stationId: id, transactionId, status: 'charging' };
}

/**
 * Simulate realistic meter value updates
 */
function simulateMeterTick(stationId) {
  const station = store.getStation(stationId);
  if (!station || !station.currentTransaction) {
    // Transaction was stopped externally
    const state = simState.get(stationId);
    if (state && state.meterInterval) {
      clearInterval(state.meterInterval);
      state.meterInterval = null;
    }
    return;
  }

  const tx = station.currentTransaction;
  const ratedPowerW = station.power * 1000;
  const elapsedMs = Date.now() - new Date(tx.startTime).getTime();
  const elapsedSec = elapsedMs / 1000;

  // Phase 1: Ramp-up (first 30 seconds)
  const RAMP_DURATION = 30;
  let targetPowerW;
  if (elapsedSec < RAMP_DURATION) {
    targetPowerW = ratedPowerW * (elapsedSec / RAMP_DURATION);
  } else {
    targetPowerW = ratedPowerW;
  }

  // SoC-based tapering (mimics real EV behavior)
  const currentSoc = tx.soc || 20;
  if (currentSoc > 90) {
    targetPowerW *= 0.25;
  } else if (currentSoc > 80) {
    targetPowerW *= 0.50;
  }

  // Small random fluctuation (+/- 3%)
  const fluctuation = 1 + (Math.random() - 0.5) * 0.06;
  const powerW = Math.round(targetPowerW * fluctuation);

  // Energy increment for 2-second tick
  const energyIncrementWh = (powerW * 2) / 3600;
  const newMeterValue = tx.meterValue + energyIncrementWh;
  const totalEnergyKwh = (newMeterValue - tx.meterStart) / 1000;

  // Voltage simulation
  const isDC = station.power >= 50;
  const baseVoltage = isDC ? 400 : 230;
  const voltage = baseVoltage + (Math.random() - 0.5) * 10;

  // Current from power/voltage
  const current = voltage > 0 ? powerW / voltage : 0;

  // SoC increment (assumed 60kWh battery)
  const batteryCapacityWh = 60000;
  const socIncrement = (energyIncrementWh / batteryCapacityWh) * 100;
  const newSoc = Math.min(100, currentSoc + socIncrement);

  // Temperature slowly rises
  const temp = Math.min(45, 25 + (elapsedSec / 600) * 15 + (Math.random() - 0.5) * 2);

  // Build meter reading (same shape as ocpp-handler.js)
  const meterReading = {
    timestamp: new Date().toISOString(),
    power: powerW,
    voltage: parseFloat(voltage.toFixed(1)),
    current: parseFloat(current.toFixed(1)),
    soc: parseFloat(newSoc.toFixed(1)),
    temperature: parseFloat(temp.toFixed(1)),
    energy: totalEnergyKwh.toFixed(2)
  };

  const meterHistory = station.meterHistory || [];
  meterHistory.push(meterReading);
  if (meterHistory.length > 100) meterHistory.shift();

  store.updateStation(stationId, {
    currentTransaction: {
      ...tx,
      meterValue: newMeterValue,
      power: powerW,
      energy: totalEnergyKwh.toFixed(2),
      voltage: parseFloat(voltage.toFixed(1)),
      current: parseFloat(current.toFixed(1)),
      soc: parseFloat(newSoc.toFixed(1)),
      temperature: parseFloat(temp.toFixed(1))
    },
    meterHistory
  });

  broadcastFn();
}

/**
 * Stop a simulated charging session
 */
function simulateStop(id) {
  const station = store.getStation(id);
  if (!station) return { error: 'Station not found', status: 404 };
  if (!station.currentTransaction) return { error: 'No active transaction', status: 400 };

  const state = simState.get(id);
  if (state && state.meterInterval) {
    clearInterval(state.meterInterval);
    state.meterInterval = null;
  }

  const tx = station.currentTransaction;
  const energyDelivered = (tx.meterValue - tx.meterStart) / 1000;
  const stopTime = new Date().toISOString();
  const durationMs = new Date(stopTime) - new Date(tx.startTime);
  const durationHours = durationMs / 3600000;
  const pricePerKwh = station.pricePerKwh || 0.15;

  const completedSession = {
    ...tx,
    stopTime,
    meterStop: tx.meterValue,
    energyDelivered: energyDelivered.toFixed(2),
    reason: 'Remote',
    duration: durationMs,
    avgPower: durationHours > 0 ? (energyDelivered / durationHours).toFixed(2) : 0,
    cost: (energyDelivered * pricePerKwh).toFixed(2)
  };

  const sessionHistory = station.sessionHistory || [];
  sessionHistory.unshift(completedSession);
  if (sessionHistory.length > 50) sessionHistory.pop();

  store.updateStation(id, {
    status: 'Available',
    currentTransaction: null,
    lastTransaction: completedSession,
    sessionHistory,
    meterHistory: []
  });

  broadcastFn();
  return { success: true, stationId: id, status: 'stopped', session: completedSession };
}

/**
 * Disconnect a simulated charger
 */
function simulateDisconnect(id) {
  const state = simState.get(id);
  if (!state) return { success: true, stationId: id, status: 'already_disconnected' };

  // Stop charging if active
  const station = store.getStation(id);
  if (station && station.currentTransaction && station.connectionSource === 'simulation') {
    simulateStop(id);
  }

  // Clear all intervals
  if (state.heartbeatInterval) clearInterval(state.heartbeatInterval);
  if (state.meterInterval) clearInterval(state.meterInterval);
  simState.delete(id);

  if (station && station.connectionSource === 'simulation') {
    store.updateStation(id, {
      connected: false,
      status: 'Offline',
      connectionSource: null
    });
    broadcastFn();
  }

  return { success: true, stationId: id, status: 'disconnected' };
}

/**
 * One-click demo setup: connect all offline stations, start one charging
 */
function setupDemoScenario() {
  const results = [];
  const allStations = store.getStations();

  for (const station of allStations) {
    // Skip if already connected by any means (real OCPP, CitrineOS, etc.)
    if (station.connected) {
      results.push({ id: station.id, action: 'skipped', reason: `already connected (${station.connectionSource || 'unknown'})` });
      continue;
    }

    const connectResult = simulateConnect(station.id);
    results.push({ id: station.id, action: 'connected', ...connectResult });
  }

  // Start charging on one station to show visual variety on the map
  const chargingCandidate = allStations.find(s => s.id === 'SKP-AC-002');
  if (chargingCandidate) {
    const startResult = simulateStart('SKP-AC-002', { idTag: 'DEMO-EV-DRIVER', startSoc: 35 });
    results.push({ id: 'SKP-AC-002', action: 'charging_started', ...startResult });
  }

  return { results, message: 'Demo scenario activated' };
}

/**
 * Get current simulation status
 */
function getStatus() {
  const activeSimulations = [];

  for (const [stationId, state] of simState) {
    const station = store.getStation(stationId);
    if (!station) continue;

    const sim = {
      stationId,
      connected: station.connected,
      charging: !!station.currentTransaction
    };

    if (station.currentTransaction) {
      const tx = station.currentTransaction;
      sim.elapsedSeconds = Math.floor((Date.now() - new Date(tx.startTime).getTime()) / 1000);
      sim.powerW = tx.power || 0;
      sim.energyKwh = tx.energy || '0';
      sim.soc = tx.soc || 0;
    }

    activeSimulations.push(sim);
  }

  return {
    activeSimulations,
    totalSimulated: simState.size,
    totalCharging: activeSimulations.filter(s => s.charging).length
  };
}

/**
 * Stop all simulations (cleanup)
 */
function stopAll() {
  for (const [id] of simState) {
    simulateDisconnect(id);
  }
}

module.exports = {
  simulateConnect,
  simulateStart,
  simulateStop,
  simulateDisconnect,
  setupDemoScenario,
  getStatus,
  stopAll
};
