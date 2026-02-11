const { sendToCharger } = require('./ocpp-handler');
const store = require('./store');

/**
 * OCPP Commands Module
 * Provides high-level functions to send OCPP commands to chargers
 */

/**
 * Get charger configuration
 * @param {string} chargerId - The charger ID
 * @param {Array<string>} keys - Optional array of specific configuration keys to retrieve
 * @returns {Promise<Object>} - Returns configuration data
 */
async function getConfiguration(chargerId, keys = []) {
  return new Promise((resolve, reject) => {
    const payload = keys.length > 0 ? { key: keys } : {};
    
    const success = sendToCharger(chargerId, 'GetConfiguration', payload);
    
    if (!success) {
      reject(new Error('Failed to send GetConfiguration command'));
      return;
    }
    
    // Store promise in pending commands
    const timeout = setTimeout(() => {
      reject(new Error('GetConfiguration request timed out'));
    }, 30000); // 30 second timeout
    
    // The response will be handled in ocpp-handler's handleChargerResponse
    // For now, return success - we'll enhance this with proper promise resolution later
    resolve({ status: 'requested', message: 'Configuration request sent to charger' });
  });
}

/**
 * Change a charger configuration value
 * @param {string} chargerId - The charger ID
 * @param {string} key - Configuration key to change
 * @param {string} value - New value for the configuration
 * @returns {Promise<Object>}
 */
async function changeConfiguration(chargerId, key, value) {
  return new Promise((resolve, reject) => {
    const payload = { key, value };
    
    const success = sendToCharger(chargerId, 'ChangeConfiguration', payload);
    
    if (!success) {
      reject(new Error('Failed to send ChangeConfiguration command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('ChangeConfiguration request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: `Configuration change requested for ${key}` });
  });
}

/**
 * Trigger a specific message from the charger
 * @param {string} chargerId - The charger ID
 * @param {string} requestedMessage - Type of message to trigger (e.g., 'StatusNotification', 'BootNotification', 'MeterValues')
 * @param {number} connectorId - Optional connector ID
 * @returns {Promise<Object>}
 */
async function triggerMessage(chargerId, requestedMessage, connectorId = null) {
  return new Promise((resolve, reject) => {
    const payload = { requestedMessage };
    if (connectorId !== null) {
      payload.connectorId = connectorId;
    }
    
    const success = sendToCharger(chargerId, 'TriggerMessage', payload);
    
    if (!success) {
      reject(new Error('Failed to send TriggerMessage command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('TriggerMessage request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: `Triggered ${requestedMessage}` });
  });
}

/**
 * Reset (reboot) the charger
 * @param {string} chargerId - The charger ID
 * @param {string} type - Reset type: 'Hard' or 'Soft'
 * @returns {Promise<Object>}
 */
async function reset(chargerId, type = 'Soft') {
  return new Promise((resolve, reject) => {
    const payload = { type }; // 'Hard' or 'Soft'
    
    const success = sendToCharger(chargerId, 'Reset', payload);
    
    if (!success) {
      reject(new Error('Failed to send Reset command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('Reset request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: `${type} reset requested` });
  });
}

/**
 * Unlock a connector
 * @param {string} chargerId - The charger ID
 * @param {number} connectorId - Connector ID to unlock
 * @returns {Promise<Object>}
 */
async function unlockConnector(chargerId, connectorId = 1) {
  return new Promise((resolve, reject) => {
    const payload = { connectorId };
    
    const success = sendToCharger(chargerId, 'UnlockConnector', payload);
    
    if (!success) {
      reject(new Error('Failed to send UnlockConnector command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('UnlockConnector request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: `Unlock requested for connector ${connectorId}` });
  });
}

module.exports = {
  getConfiguration,
  changeConfiguration,
  triggerMessage,
  reset,
  unlockConnector
};
