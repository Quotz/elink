/**
 * CitrineOS integration client
 * REST API client for CitrineOS OCPP server
 */

const axios = require('axios');

class CitrineOSClient {
  constructor() {
    this.baseURL = process.env.CITRINEOS_URL || 'http://localhost:8080';
    this.apiKey = process.env.CITRINEOS_API_KEY;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'X-API-Key': this.apiKey })
      }
    });

    // Request/response interceptors for logging
    this.client.interceptors.request.use(
      config => {
        console.log(`[CitrineOS] ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      error => {
        console.error('[CitrineOS] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('[CitrineOS] Response error:', error.response?.status, error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Check if CitrineOS is available
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return { available: true, status: response.data };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  // Charging Station (Charger) Management
  
  async createChargingStation(stationData) {
    const payload = {
      id: stationData.id,
      vendorName: stationData.vendor || 'Unknown',
      model: stationData.model || 'Unknown',
      serialNumber: stationData.serialNumber,
      firmwareVersion: stationData.firmwareVersion,
      location: {
        latitude: stationData.lat,
        longitude: stationData.lng,
        address: stationData.address
      }
    };

    const response = await this.client.post('/api/v1/charging-stations', payload);
    return response.data;
  }

  async getChargingStation(stationId) {
    const response = await this.client.get(`/api/v1/charging-stations/${stationId}`);
    return response.data;
  }

  async listChargingStations() {
    const response = await this.client.get('/api/v1/charging-stations');
    return response.data;
  }

  async updateChargingStation(stationId, updates) {
    const response = await this.client.patch(`/api/v1/charging-stations/${stationId}`, updates);
    return response.data;
  }

  // Remote Commands (OCPP 1.6 via CitrineOS REST API)
  // URL pattern: POST /ocpp/1.6/{module}/{action}?identifier={stationId}&tenantId=1

  async remoteStartTransaction(stationId, connectorId = 1, idTag) {
    const payload = {
      connectorId,
      idTag: idTag || 'ANONYMOUS'
    };

    console.log(`[CitrineOS] RemoteStartTransaction for ${stationId}, connector ${connectorId}, idTag ${payload.idTag}`);
    const response = await this.client.post(
      `/ocpp/1.6/evdriver/remoteStartTransaction`,
      payload,
      { params: { identifier: stationId, tenantId: 1 } }
    );
    return response.data;
  }

  async remoteStopTransaction(stationId, transactionId) {
    const payload = { transactionId: Number(transactionId) };

    console.log(`[CitrineOS] RemoteStopTransaction for ${stationId}, txId ${transactionId}`);
    const response = await this.client.post(
      `/ocpp/1.6/evdriver/remoteStopTransaction`,
      payload,
      { params: { identifier: stationId, tenantId: 1 } }
    );
    return response.data;
  }

  async reset(stationId, type = 'Soft') {
    const response = await this.client.post(
      `/ocpp/1.6/configuration/reset`,
      { type },
      { params: { identifier: stationId, tenantId: 1 } }
    );
    return response.data;
  }

  async unlockConnector(stationId, connectorId = 1) {
    const response = await this.client.post(
      `/ocpp/1.6/evdriver/unlockConnector`,
      { connectorId },
      { params: { identifier: stationId, tenantId: 1 } }
    );
    return response.data;
  }

  async getConfiguration(stationId) {
    const response = await this.client.post(
      `/ocpp/1.6/configuration/getConfiguration`,
      {},
      { params: { identifier: stationId, tenantId: 1 } }
    );
    return response.data;
  }

  async changeConfiguration(stationId, key, value) {
    const response = await this.client.post(
      `/ocpp/1.6/configuration/changeConfiguration`,
      { key, value },
      { params: { identifier: stationId, tenantId: 1 } }
    );
    return response.data;
  }

  // Transaction Management

  async getTransaction(transactionId) {
    const response = await this.client.get(`/data/transactions/transaction`, {
      params: { transactionId, tenantId: 1 }
    });
    return response.data;
  }

  async getActiveTransactions(stationId) {
    // CitrineOS doesn't support querying transactions by stationId
    // Active transactions are tracked via OCPP messages (StartTransaction/StopTransaction)
    // handled by ocpp-handler.js and citrine webhook
    return [];
  }

  // Meter Values (via variable attributes)

  async getMeterValues(stationId) {
    try {
      const response = await this.client.get(`/data/monitoring/variableAttribute`, {
        params: { stationId, tenantId: 1 }
      });
      return response.data;
    } catch (error) {
      return [];
    }
  }

  // Status

  async getStationStatus(stationId) {
    // Query CitrineOS for connector status via variable attributes
    try {
      const response = await this.client.get(`/data/monitoring/variableAttribute`, {
        params: {
          stationId: stationId,
          tenantId: 1,
          component_name: 'Connector',
          variable_name: 'AvailabilityState'
        }
      });
      return response.data;
    } catch (error) {
      // If no data found, return empty status
      return { connectors: [{ status: 'Unknown' }] };
    }
  }

  // Check if station is connected to CitrineOS
  // Uses a simple health check approach - if CitrineOS is up, we assume charger is connected
  // For MVP demo: Just return true to show station as available
  async isStationConnected(stationId) {
    try {
      const health = await this.healthCheck();
      if (health.available) {
        // CitrineOS is running, assume charger is connected for demo
        // In production, this would check actual connection status
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Webhook/Event Management
  // Note: CitrineOS can send webhooks for events - configure webhook URL in CitrineOS

  // Sync eLink station with CitrineOS
  async syncStation(station) {
    // For demo: Just return success without calling CitrineOS
    // CitrineOS doesn't have the charging station management endpoints we need
    console.log(`[CitrineOS] Sync requested for station ${station.id} (demo mode - no actual sync)`);
    return {
      success: true,
      citrineId: station.id,
      data: { id: station.id, status: 'synced' }
    };
  }
}

// Singleton instance
module.exports = new CitrineOSClient();
