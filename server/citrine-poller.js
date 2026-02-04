/**
 * CitrineOS Polling Service
 * Polls CitrineOS for charger status instead of relying on webhooks
 */

const citrineClient = require('./citrine-client');
const store = require('./store');

class CitrinePoller {
  constructor(broadcastFn) {
    this.broadcast = broadcastFn;
    this.interval = null;
    this.pollIntervalMs = 15000; // 15 seconds
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    
    console.log('[CitrinePoller] Starting polling service (15s interval)');
    this.isRunning = true;
    
    // Poll immediately
    this.pollAllStations();
    
    // Then poll every 15 seconds
    this.interval = setInterval(() => this.pollAllStations(), this.pollIntervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('[CitrinePoller] Stopped');
  }

  async pollAllStations() {
    try {
      // First check if CitrineOS is available
      const health = await citrineClient.healthCheck();
      if (!health.available) {
        console.log('[CitrinePoller] CitrineOS unavailable, skipping poll');
        return;
      }

      // Get all stations from eLink store
      const stations = store.getStations();
      
      for (const station of stations) {
        await this.pollStation(station.id);
      }
    } catch (error) {
      console.error('[CitrinePoller] Poll error:', error.message);
    }
  }

  async pollStation(stationId) {
    try {
      // Try to get active transactions first (indicates charging state)
      let hasActiveTransaction = false;
      try {
        const activeTx = await citrineClient.getActiveTransactions(stationId);
        hasActiveTransaction = activeTx && activeTx.length > 0;
      } catch (txError) {
        // Endpoint may not exist, continue without transaction data
        hasActiveTransaction = false;
      }
      
      // Get station status from CitrineOS
      let statusData = null;
      try {
        statusData = await citrineClient.getStationStatus(stationId);
      } catch (statusError) {
        // If status endpoint fails, station might not be registered
        console.log();
        throw statusError;
      }
      
      // Determine station state
      let newStatus = 'Available';
      let isConnected = true;
      
      if (hasActiveTransaction) {
        newStatus = 'Charging';
      } else if (statusData && statusData.connectors && statusData.connectors.length > 0) {
        const connector = statusData.connectors[0];
        // Map CitrineOS status to eLink status
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
        newStatus = statusMap[connector.status] || connector.status || 'Available';
        isConnected = connector.status !== 'Unavailable' && connector.status !== 'Faulted';
      }

      // Update station in store
      const station = store.getStation(stationId);
      if (station) {
        const updates = {
          connected: isConnected,
          status: newStatus,
          lastHeartbeat: Date.now()
        };

        // If there's an active transaction, update currentTransaction
        if (hasActiveTransaction && activeTx[0]) {
          const tx = activeTx[0];
          updates.currentTransaction = {
            id: String(tx.id || tx.transactionId),
            idTag: tx.idTag,
            connectorId: tx.connectorId || 1,
            startTime: tx.startTime || Date.now(),
            startMeter: tx.meterStart || 0
          };
        } else if (station.currentTransaction && newStatus !== 'Charging') {
          // Clear transaction if not charging
          updates.currentTransaction = null;
        }

        // Only update if something changed
        if (station.status !== newStatus || station.connected !== isConnected) {
          store.updateStation(stationId, updates);
          console.log(`[CitrinePoller] ${stationId}: ${station.status} -> ${newStatus} (connected: ${isConnected})`);
          
          // Broadcast update to all clients
          if (this.broadcast) {
            this.broadcast();
          }
        }
      }
    } catch (error) {
      // Station might not exist in CitrineOS yet, mark as offline
      const station = store.getStation(stationId);
      if (station && station.connected) {
        store.updateStation(stationId, {
          connected: false,
          status: 'Offline',
          lastHeartbeat: Date.now()
        });
        console.log(`[CitrinePoller] ${stationId}: marked offline (error: ${error.message})`);
        if (this.broadcast) {
          this.broadcast();
        }
      }
    }
  }
}

module.exports = CitrinePoller;
