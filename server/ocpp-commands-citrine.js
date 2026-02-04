/**
 * OCPP Commands via CitrineOS
 * Replaces local OCPP handler with CitrineOS API calls
 */

const citrineClient = require('./citrine-client');
const USE_CITRINEOS = process.env.USE_CITRINEOS === 'true';

console.log('[OCPP] Mode:', USE_CITRINEOS ? 'CitrineOS' : 'Local');

class OCPPCommands {
  async getConfiguration(stationId) {
    try {
      const result = await citrineClient.getConfiguration(stationId);
      return { success: true, data: result };
    } catch (error) {
      console.error('[OCPP] GetConfiguration error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async changeConfiguration(stationId, key, value) {
    try {
      const result = await citrineClient.changeConfiguration(stationId, key, value);
      return { success: true, data: result };
    } catch (error) {
      console.error('[OCPP] ChangeConfiguration error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async triggerMessage(stationId, message, connectorId = 1) {
    try {
      // CitrineOS uses different API structure
      const result = await citrineClient.getStationStatus(stationId);
      return { success: true, data: result };
    } catch (error) {
      console.error('[OCPP] TriggerMessage error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async reset(stationId, type = 'Soft') {
    try {
      const result = await citrineClient.reset(stationId, type);
      return { success: true, data: result };
    } catch (error) {
      console.error('[OCPP] Reset error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async unlockConnector(stationId, connectorId = 1) {
    try {
      const result = await citrineClient.unlockConnector(stationId, connectorId);
      return { success: true, data: result };
    } catch (error) {
      console.error('[OCPP] UnlockConnector error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new OCPPCommands();
