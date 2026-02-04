/**
 * CitrineOS integration routes
 */

const express = require('express');
const router = express.Router();
const citrineClient = require('../citrine-client');
const db = require('../database');
const { authenticateToken, requireRole } = require('../auth');

// Note: '../database' and '../citrine-client' are correct since we're in server/routes/

// Broadcast function for WebSocket updates (set by index.js)
let broadcastUpdate = null;

function setBroadcastUpdate(fn) {
  broadcastUpdate = fn;
}

function notifyClients() {
  if (broadcastUpdate) {
    broadcastUpdate();
  }
}

// Health check
router.get('/health', async (req, res) => {
  const health = await citrineClient.healthCheck();
  res.json(health);
});

// Get all stations from CitrineOS (admin only)
router.get('/stations', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const stations = await citrineClient.listChargingStations();
    res.json({ stations });
  } catch (error) {
    console.error('[CitrineOS] List stations error:', error);
    res.status(500).json({ error: 'Failed to fetch stations from CitrineOS' });
  }
});

// Get specific station from CitrineOS
router.get('/stations/:id', authenticateToken, async (req, res) => {
  try {
    const station = await citrineClient.getChargingStation(req.params.id);
    res.json(station);
  } catch (error) {
    console.error('[CitrineOS] Get station error:', error);
    res.status(500).json({ error: 'Failed to fetch station from CitrineOS' });
  }
});

// Sync eLink station to CitrineOS
// NOTE: Public endpoint for demo - in production, require authentication
router.post('/stations/:id/sync', async (req, res) => {
  try {
    const store = require('../store');
    const station = store.getStation(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found in eLink' });
    }

    const result = await citrineClient.syncStation(station);
    
    if (result.success) {
      // Save mapping to database
      await db.createCitrineMapping({
        elinkChargerId: station.id,
        citrineChargerId: result.citrineId
      });
    }

    res.json(result);
  } catch (error) {
    console.error('[CitrineOS] Sync error:', error);
    res.status(500).json({ error: 'Failed to sync station' });
  }
});

// Get station status from CitrineOS
router.get('/stations/:id/status', authenticateToken, async (req, res) => {
  try {
    const status = await citrineClient.getStationStatus(req.params.id);
    res.json(status);
  } catch (error) {
    console.error('[CitrineOS] Get status error:', error);
    res.status(500).json({ error: 'Failed to fetch station status' });
  }
});

// Remote start via CitrineOS
router.post('/stations/:id/remote-start', authenticateToken, async (req, res) => {
  try {
    const { connectorId, idTag } = req.body;
    
    const result = await citrineClient.remoteStartTransaction(
      req.params.id,
      connectorId || 1,
      idTag || req.user.id
    );

    res.json(result);
  } catch (error) {
    console.error('[CitrineOS] Remote start error:', error);
    res.status(500).json({ error: 'Failed to start charging' });
  }
});

// Remote stop via CitrineOS
router.post('/stations/:id/remote-stop', authenticateToken, async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }

    const result = await citrineClient.remoteStopTransaction(req.params.id, transactionId);
    res.json(result);
  } catch (error) {
    console.error('[CitrineOS] Remote stop error:', error);
    res.status(500).json({ error: 'Failed to stop charging' });
  }
});

// Get station configuration from CitrineOS
router.get('/stations/:id/configuration', authenticateToken, async (req, res) => {
  try {
    const config = await citrineClient.getConfiguration(req.params.id);
    res.json(config);
  } catch (error) {
    console.error('[CitrineOS] Get configuration error:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Update station configuration
router.post('/stations/:id/configuration', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { key, value } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value required' });
    }

    const result = await citrineClient.changeConfiguration(req.params.id, key, value);
    res.json(result);
  } catch (error) {
    console.error('[CitrineOS] Change configuration error:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// List transactions from CitrineOS
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { stationId, userId, startDate, endDate, limit } = req.query;
    
    const params = {};
    if (stationId) params.stationId = stationId;
    if (userId) params.userId = userId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (limit) params.limit = parseInt(limit);

    const transactions = await citrineClient.listTransactions(params);
    res.json({ transactions });
  } catch (error) {
    console.error('[CitrineOS] List transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get specific transaction
router.get('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await citrineClient.getTransaction(req.params.id);
    res.json(transaction);
  } catch (error) {
    console.error('[CitrineOS] Get transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Webhook endpoint for CitrineOS events
router.post('/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    console.log('[CitrineOS Webhook]', event, data);

    // Handle various CitrineOS events
    // Handle CitrineOS OCPP events
    const store = require('../store');
    
    switch (event) {
      case 'StatusNotification':
        // Map OCPP status to eLink status
        const statusMap = {
          'Available': 'Available',
          'Preparing': 'Preparing',
          'Charging': 'Charging',
          'SuspendedEV': 'Suspended',
          'SuspendedEVSE': 'Suspended',
          'Finishing': 'Finishing',
          'Reserved': 'Reserved',
          'Unavailable': 'Offline',
          'Faulted': 'Faulted'
        };
        const elinkStatus = statusMap[data.status] || data.status;
        const isConnected = data.status !== 'Unavailable' && data.status !== 'Faulted';
        
        store.updateStation(data.stationId, {
          status: elinkStatus,
          connected: isConnected,
          lastHeartbeat: Date.now()
        });
        console.log(`[CitrineOS] StatusNotification: ${data.stationId} is now ${elinkStatus}`);
        break;

      case 'BootNotification':
        store.updateStation(data.stationId, {
          vendor: data.chargePointVendor,
          model: data.chargePointModel,
          firmwareVersion: data.firmwareVersion,
          connected: true,
          lastHeartbeat: Date.now()
        });
        console.log(`[CitrineOS] BootNotification: ${data.stationId} connected`);
        break;

      case 'StartTransaction':
        store.updateStation(data.stationId, {
          currentTransaction: {
            id: String(data.transactionId),
            idTag: data.idTag,
            connectorId: data.connectorId,
            startTime: Date.now(),
            startMeter: data.meterStart
          },
          status: 'Charging'
        });
        console.log(`[CitrineOS] StartTransaction: ${data.stationId} tx ${data.transactionId}`);
        break;

      case 'StopTransaction':
        const station = store.getStation(data.stationId);
        store.updateStation(data.stationId, {
          currentTransaction: null,
          lastTransaction: {
            id: String(data.transactionId),
            energy: data.meterStop ? (data.meterStop - (station?.currentTransaction?.startMeter || 0)) / 1000 : 0,
            startTime: station?.currentTransaction?.startTime,
            endTime: Date.now()
          },
          status: 'Available'
        });
        console.log(`[CitrineOS] StopTransaction: ${data.stationId} tx ${data.transactionId}`);
        break;

      case 'Heartbeat':
        store.updateStation(data.stationId, {
          connected: true,
          lastHeartbeat: Date.now()
        });
        console.log(`[CitrineOS] Heartbeat: ${data.stationId}`);
        break;

      case 'MeterValues':
        // Store meter values - handled via polling for now
        break;

      default:
        console.log('[CitrineOS Webhook] Unhandled event:', event);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[CitrineOS Webhook] Error:', error);
    // Still return 200 to acknowledge receipt
    res.json({ received: true, error: error.message });
  }
});

module.exports = router;
module.exports.setBroadcastUpdate = setBroadcastUpdate;
