const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const simulator = require('../simulator');
const citrineClient = require('../citrine-client');
const { sendToCharger } = require('../ocpp-handler');
const { authenticateToken } = require('../auth');
const { broadcastUpdate, broadcastConnectionPhase } = require('../websocket');
const { DEMO_CHARGER_ID, DEMO_AWAIT_SECONDS, DEFAULT_AWAIT_SECONDS, USE_CITRINE_POLLING } = require('../config');

// Prevent double-tap on start
const startingStations = new Set();
// Track pending connection timeouts for cleanup
const pendingConnectionTimeouts = new Map();

// Start charging
router.post('/stations/:id/start', authenticateToken, async (req, res) => {
  const { id } = req.params;
  console.log(`[Start] Request for ${id}, user: ${req.user.id}`);

  const station = store.getStation(id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (!station.connected) return res.status(400).json({ error: 'Charger is offline' });
  if (startingStations.has(id)) return res.status(429).json({ error: 'Start already in progress' });

  const effectiveIdTag = req.user.id;

  if (id === DEMO_CHARGER_ID) {
    console.log(`[Start] Demo charger ${id}: ${DEMO_AWAIT_SECONDS}s await`);
    startingStations.add(id);
    res.json({ status: 'connecting', isDemoCharger: true });
    broadcastConnectionPhase(id, 'awaiting_car');

    const timeout = setTimeout(() => {
      pendingConnectionTimeouts.delete(id);
      const fresh = store.getStation(id);
      console.log(`[Start] Demo await complete for ${id}, connected: ${fresh?.connected}, src: ${fresh?.connectionSource}`);

      if (!fresh || !fresh.connected) {
        console.error(`[Start] Station ${id} offline after await`);
        broadcastConnectionPhase(id, 'timeout');
        startingStations.delete(id);
        return;
      }

      if (fresh.connectionSource !== 'simulation') {
        const cr = simulator.simulateConnect(id);
        if (cr.error) {
          console.error(`[Start] simulateConnect failed for ${id}: ${cr.error}`);
          broadcastConnectionPhase(id, 'timeout');
          startingStations.delete(id);
          return;
        }
      }

      const sr = simulator.simulateStart(id, { idTag: effectiveIdTag });
      if (sr.error) {
        console.error(`[Start] simulateStart failed for ${id}: ${sr.error}`);
        broadcastConnectionPhase(id, 'timeout');
        startingStations.delete(id);
        return;
      }

      console.log(`[Start] Charging started on ${id}, txId: ${sr.transactionId}`);
      broadcastConnectionPhase(id, 'started');
      broadcastUpdate();
      startingStations.delete(id);
    }, DEMO_AWAIT_SECONDS * 1000);

    pendingConnectionTimeouts.set(id, timeout);
  } else {
    startingStations.add(id);
    res.json({ status: 'connecting', isDemoCharger: false });
    broadcastConnectionPhase(id, 'awaiting_car');

    const timeout = setTimeout(() => {
      pendingConnectionTimeouts.delete(id);
      broadcastConnectionPhase(id, 'timeout');
      startingStations.delete(id);
    }, DEFAULT_AWAIT_SECONDS * 1000);

    pendingConnectionTimeouts.set(id, timeout);
  }
});

// Stop charging
router.post('/stations/:id/stop', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const station = store.getStation(id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (!station.currentTransaction) return res.status(400).json({ error: 'No active transaction' });

  // Only session owner or admin can stop
  if (req.user.id !== station.currentTransaction.idTag && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not your charging session' });
  }

  if (station.connectionSource === 'simulation') {
    const result = simulator.simulateStop(id);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    broadcastUpdate();
    return res.json({ status: 'stopped', message: 'Charging stopped', session: result.session });
  }

  if (USE_CITRINE_POLLING) {
    try {
      const result = await citrineClient.remoteStopTransaction(id, station.currentTransaction.id);
      res.json({ status: 'requested', message: 'Stop command sent via CitrineOS', result });
    } catch (error) {
      console.error('[Stop] CitrineOS error:', error);
      res.status(500).json({ error: 'Failed to send command via CitrineOS' });
    }
  } else {
    const success = sendToCharger(id, 'RemoteStopTransaction', {
      transactionId: station.currentTransaction.id
    });
    if (success) {
      res.json({ status: 'requested', message: 'Stop command sent to charger' });
    } else {
      res.status(500).json({ error: 'Failed to send command' });
    }
  }
});

// Mock payment endpoint
router.post('/payment/process', (req, res) => {
  const { cardNumber } = req.body;
  setTimeout(() => {
    if (cardNumber && cardNumber.replace(/\s/g, '').length >= 16) {
      const token = 'PAY-' + uuidv4().substring(0, 8).toUpperCase();
      res.json({ success: true, token, message: 'Payment authorized (DEMO)' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid card number' });
    }
  }, 1000);
});

module.exports = router;
