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
 * Request diagnostic information from charger
 * @param {string} chargerId - The charger ID
 * @param {string} location - URL where the charger should upload diagnostics
 * @returns {Promise<Object>}
 */
async function getDiagnostics(chargerId, location) {
  return new Promise((resolve, reject) => {
    const payload = { location };
    
    const success = sendToCharger(chargerId, 'GetDiagnostics', payload);
    
    if (!success) {
      reject(new Error('Failed to send GetDiagnostics command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('GetDiagnostics request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: 'Diagnostics upload requested' });
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

/**
 * Update firmware on the charger
 * @param {string} chargerId - The charger ID
 * @param {string} location - URL of the firmware file
 * @param {string} retrieveDate - ISO 8601 formatted date/time when to retrieve firmware
 * @returns {Promise<Object>}
 */
async function updateFirmware(chargerId, location, retrieveDate) {
  return new Promise((resolve, reject) => {
    const payload = { 
      location,
      retrieveDate: retrieveDate || new Date().toISOString()
    };
    
    const success = sendToCharger(chargerId, 'UpdateFirmware', payload);
    
    if (!success) {
      reject(new Error('Failed to send UpdateFirmware command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('UpdateFirmware request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: 'Firmware update requested' });
  });
}

/**
 * Set charging profile (smart charging)
 * @param {string} chargerId - The charger ID
 * @param {number} connectorId - Connector ID (0 for all connectors)
 * @param {Object} chargingProfile - Charging profile object
 * @returns {Promise<Object>}
 */
async function setChargingProfile(chargerId, connectorId, chargingProfile) {
  return new Promise((resolve, reject) => {
    const payload = { 
      connectorId,
      csChargingProfiles: chargingProfile
    };
    
    const success = sendToCharger(chargerId, 'SetChargingProfile', payload);
    
    if (!success) {
      reject(new Error('Failed to send SetChargingProfile command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('SetChargingProfile request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: 'Charging profile set' });
  });
}

/**
 * Clear charging profile
 * @param {string} chargerId - The charger ID
 * @param {number} profileId - Optional profile ID to clear
 * @returns {Promise<Object>}
 */
async function clearChargingProfile(chargerId, profileId = null) {
  return new Promise((resolve, reject) => {
    const payload = {};
    if (profileId !== null) {
      payload.id = profileId;
    }
    
    const success = sendToCharger(chargerId, 'ClearChargingProfile', payload);
    
    if (!success) {
      reject(new Error('Failed to send ClearChargingProfile command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('ClearChargingProfile request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: 'Charging profile cleared' });
  });
}

/**
 * Reserve a charger for a specific user
 * @param {string} chargerId - The charger ID
 * @param {number} connectorId - Connector ID to reserve
 * @param {string} idTag - User ID tag
 * @param {string} expiryDate - ISO 8601 formatted expiry date
 * @returns {Promise<Object>}
 */
async function reserveNow(chargerId, connectorId, idTag, expiryDate) {
  return new Promise((resolve, reject) => {
    const reservationId = Math.floor(Math.random() * 1000000);
    const payload = {
      connectorId,
      expiryDate,
      idTag,
      reservationId
    };
    
    const success = sendToCharger(chargerId, 'ReserveNow', payload);
    
    if (!success) {
      reject(new Error('Failed to send ReserveNow command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('ReserveNow request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: 'Reservation requested', reservationId });
  });
}

/**
 * Cancel a reservation
 * @param {string} chargerId - The charger ID
 * @param {number} reservationId - Reservation ID to cancel
 * @returns {Promise<Object>}
 */
async function cancelReservation(chargerId, reservationId) {
  return new Promise((resolve, reject) => {
    const payload = { reservationId };
    
    const success = sendToCharger(chargerId, 'CancelReservation', payload);
    
    if (!success) {
      reject(new Error('Failed to send CancelReservation command'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('CancelReservation request timed out'));
    }, 30000);
    
    resolve({ status: 'requested', message: 'Reservation cancellation requested' });
  });
}

module.exports = {
  getConfiguration,
  changeConfiguration,
  triggerMessage,
  getDiagnostics,
  reset,
  unlockConnector,
  updateFirmware,
  setChargingProfile,
  clearChargingProfile,
  reserveNow,
  cancelReservation
};
