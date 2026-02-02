/**
 * CitrineOS integration routes
 */

const express = require('express');
const router = express.Router();
const citrineClient = require('../citrine-client');
const db = require('../database');
const { authenticateToken, requireRole } = require('../auth');

// Note: '../database' and '../citrine-client' are correct since we're in server/routes/

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
router.post('/stations/:id/sync', authenticateToken, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const store = require('../store');
    const station = store.getStation(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found in eLink' });
    }

    // Check ownership for non-admins
    if (req.user.role === 'owner') {
      const owner = await db.getChargerOwner(station.id);
      if (!owner || owner.user_id !== req.user.id) {
        return res.status(403).json({ error: 'You do not own this charger' });
      }
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
    switch (event) {
      case 'transaction.started':
        // Store transaction in local DB
        await db.createTransaction({
          userId: data.idTag, // This might need mapping
          chargerId: data.stationId,
          idTag: data.idTag,
          startMeter: data.meterStart
        });
        break;

      case 'transaction.stopped':
        // Update transaction in local DB
        // await db.completeTransaction({...})
        break;

      case 'status.changed':
        // Update station status in store
        const store = require('../store');
        store.updateStation(data.stationId, {
          status: data.status,
          connected: data.status !== 'Offline'
        });
        break;

      case 'meter.values':
        // Store meter values
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
