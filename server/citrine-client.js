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

  // Remote Commands

  async remoteStartTransaction(stationId, connectorId = 1, idTag) {
    const payload = {
      connectorId,
      idTag: idTag || 'ANONYMOUS'
    };

    const response = await this.client.post(
      `/api/v1/charging-stations/${stationId}/remote-start`,
      payload
    );
    return response.data;
  }

  async remoteStopTransaction(stationId, transactionId) {
    const payload = { transactionId };

    const response = await this.client.post(
      `/api/v1/charging-stations/${stationId}/remote-stop`,
      payload
    );
    return response.data;
  }

  async reset(stationId, type = 'Soft') {
    const response = await this.client.post(
      `/api/v1/charging-stations/${stationId}/reset`,
      { type }
    );
    return response.data;
  }

  async unlockConnector(stationId, connectorId = 1) {
    const response = await this.client.post(
      `/api/v1/charging-stations/${stationId}/unlock-connector`,
      { connectorId }
    );
    return response.data;
  }

  async getConfiguration(stationId) {
    const response = await this.client.get(
      `/api/v1/charging-stations/${stationId}/configuration`
    );
    return response.data;
  }

  async changeConfiguration(stationId, key, value) {
    const response = await this.client.post(
      `/api/v1/charging-stations/${stationId}/configuration`,
      { key, value }
    );
    return response.data;
  }

  // Transaction Management

  async getTransaction(transactionId) {
    const response = await this.client.get(`/api/v1/transactions/${transactionId}`);
    return response.data;
  }

  async listTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await this.client.get(`/api/v1/transactions?${query}`);
    return response.data;
  }

  async getActiveTransactions(stationId) {
    const response = await this.client.get(
      `/api/v1/charging-stations/${stationId}/transactions/active`
    );
    return response.data;
  }

  // Meter Values

  async getMeterValues(transactionId) {
    const response = await this.client.get(
      `/api/v1/transactions/${transactionId}/meter-values`
    );
    return response.data;
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

  // Get all connected charging stations from CitrineOS
  async getConnectedStations() {
    try {
      // Try to get status for our known station
      const response = await this.client.get(`/ocpp/1.6/evdriver/chargingStatus?identifier=30001233`);
      return response.data;
    } catch (error) {
      // If endpoint doesn't exist, return empty
      return null;
    }
  }

  // Webhook/Event Management
  // Note: CitrineOS can send webhooks for events - configure webhook URL in CitrineOS

  // Sync eLink station with CitrineOS
  async syncStation(station) {
    try {
      // Check if station exists in CitrineOS
      let citrineStation;
      try {
        citrineStation = await this.getChargingStation(station.id);
      } catch (err) {
        // Station doesn't exist, create it
        citrineStation = null;
      }

      if (!citrineStation) {
        // Create new station in CitrineOS
        citrineStation = await this.createChargingStation({
          id: station.id,
          vendor: station.vendor,
          model: station.model,
          serialNumber: station.serialNumber,
          firmwareVersion: station.firmwareVersion,
          lat: station.lat,
          lng: station.lng,
          address: station.address
        });
        console.log(`[CitrineOS] Created station: ${station.id}`);
      } else {
        // Update existing station
        citrineStation = await this.updateChargingStation(station.id, {
          vendorName: station.vendor,
          model: station.model,
          firmwareVersion: station.firmwareVersion
        });
        console.log(`[CitrineOS] Updated station: ${station.id}`);
      }

      return {
        success: true,
        citrineId: citrineStation.id,
        data: citrineStation
      };
    } catch (error) {
      console.error(`[CitrineOS] Failed to sync station ${station.id}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
module.exports = new CitrineOSClient();
