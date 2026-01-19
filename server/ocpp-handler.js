const store = require('./store');
const { v4: uuidv4 } = require('uuid');

// OCPP 1.6 message types
const CALL = 2;
const CALLRESULT = 3;
const CALLERROR = 4;

// Pending requests (for matching responses)
const pendingRequests = new Map();

/**
 * Update charger activity timestamp and increment message count
 */
function updateChargerActivity(chargerId) {
  const station = store.getStation(chargerId);
  if (station) {
    const newMessageCount = (station.messageCount || 0) + 1;
    store.updateStation(chargerId, {
      lastHeartbeat: Date.now(),
      connected: true,
      messageCount: newMessageCount
    });
  }
}

/**
 * Handle incoming OCPP message from charger
 */
function handleOCPPMessage(chargerId, message, ws, broadcastUpdate) {
  const messageType = message[0];
  
  if (messageType === CALL) {
    // Request from charger
    const [, messageId, action, payload] = message;
    handleChargerRequest(chargerId, messageId, action, payload, ws, broadcastUpdate);
  } else if (messageType === CALLRESULT) {
    // Response to our request
    const [, messageId, payload] = message;
    handleChargerResponse(chargerId, messageId, payload, broadcastUpdate);
  } else if (messageType === CALLERROR) {
    // Error response
    const [, messageId, errorCode, errorDescription] = message;
    console.error(`[OCPP] Error from ${chargerId}: ${errorCode} - ${errorDescription}`);
    const pending = pendingRequests.get(messageId);
    if (pending) {
      pendingRequests.delete(messageId);
    }
  }
}

/**
 * Handle request initiated by charger
 */
function handleChargerRequest(chargerId, messageId, action, payload, ws, broadcastUpdate) {
  // Update activity for all messages
  updateChargerActivity(chargerId);
  
  let response = {};
  
  switch (action) {
    case 'BootNotification':
      // Charger is booting up
      store.updateStation(chargerId, {
        vendor: payload.chargePointVendor,
        model: payload.chargePointModel,
        serialNumber: payload.chargePointSerialNumber,
        firmwareVersion: payload.firmwareVersion,
        connectedAt: Date.now(),
        status: 'Available'
      });
      response = {
        status: 'Accepted',
        currentTime: new Date().toISOString(),
        interval: 300 // Heartbeat interval in seconds
      };
      break;
      
    case 'Heartbeat':
      response = {
        currentTime: new Date().toISOString()
      };
      break;
      
    case 'StatusNotification':
      // Charger reporting connector status
      const statusMap = {
        'Available': 'Available',
        'Preparing': 'Preparing',
        'Charging': 'Charging',
        'SuspendedEV': 'Suspended',
        'SuspendedEVSE': 'Suspended',
        'Finishing': 'Finishing',
        'Reserved': 'Reserved',
        'Unavailable': 'Unavailable',
        'Faulted': 'Faulted'
      };
      store.updateStation(chargerId, {
        status: statusMap[payload.status] || payload.status,
        errorCode: payload.errorCode,
        connectorId: payload.connectorId
      });
      response = {};
      break;
      
    case 'StartTransaction':
      // Charger confirms transaction started
      const transactionId = Math.floor(Math.random() * 1000000);
      store.updateStation(chargerId, {
        status: 'Charging',
        currentTransaction: {
          id: transactionId,
          idTag: payload.idTag,
          startTime: payload.timestamp || new Date().toISOString(),
          meterStart: payload.meterStart,
          meterValue: payload.meterStart,
          power: 0,
          energy: 0
        }
      });
      response = {
        transactionId: transactionId,
        idTagInfo: {
          status: 'Accepted'
        }
      };
      break;
      
    case 'StopTransaction':
      // Charger confirms transaction stopped
      const station = store.getStation(chargerId);
      if (station && station.currentTransaction) {
        const energyDelivered = (payload.meterStop - station.currentTransaction.meterStart) / 1000; // Convert Wh to kWh
        const stopTime = payload.timestamp || new Date().toISOString();
        const startTime = new Date(station.currentTransaction.startTime);
        const endTime = new Date(stopTime);
        const durationMs = endTime - startTime;
        const durationHours = durationMs / 3600000;
        
        const completedSession = {
          ...station.currentTransaction,
          stopTime,
          meterStop: payload.meterStop,
          energyDelivered: energyDelivered.toFixed(2),
          reason: payload.reason,
          duration: durationMs,
          avgPower: durationHours > 0 ? (energyDelivered / durationHours).toFixed(2) : 0,
          cost: (energyDelivered * 0.35).toFixed(2) // Calculate cost at €0.35/kWh
        };
        
        // Add to session history (keep last 50 sessions)
        const sessionHistory = station.sessionHistory || [];
        sessionHistory.unshift(completedSession); // Add to beginning
        if (sessionHistory.length > 50) {
          sessionHistory.pop(); // Remove oldest
        }
        
        store.updateStation(chargerId, {
          status: 'Available',
          lastTransaction: completedSession,
          currentTransaction: null,
          sessionHistory,
          meterHistory: [] // Clear meter history for next session
        });
      }
      response = {
        idTagInfo: {
          status: 'Accepted'
        }
      };
      break;
      
    case 'MeterValues':
      // Real-time meter data during charging
      if (payload.meterValue && payload.meterValue.length > 0) {
        const meterData = payload.meterValue[0];
        const sampledValues = meterData.sampledValue || [];
        
        let power = 0;
        let energy = 0;
        let meterValue = 0;
        let voltage = 0;
        let current = 0;
        let soc = 0; // State of Charge
        let temperature = 0;
        
        sampledValues.forEach((sample) => {
          const value = parseFloat(sample.value);
          const measurand = sample.measurand || 'Energy.Active.Import.Register';
          
          if (measurand === 'Power.Active.Import' || measurand === 'Power.Active.Import.L1') {
            power = value; // Usually in W
          } else if (measurand === 'Energy.Active.Import.Register') {
            meterValue = value; // Usually in Wh
          } else if (measurand === 'Voltage' || measurand === 'Voltage.L1') {
            voltage = value; // V
          } else if (measurand === 'Current.Import' || measurand === 'Current.Import.L1') {
            current = value; // A
          } else if (measurand === 'SoC') {
            soc = value; // %
          } else if (measurand === 'Temperature') {
            temperature = value; // Celsius
          }
        });
        
        const currentStation = store.getStation(chargerId);
        if (currentStation && currentStation.currentTransaction) {
          energy = (meterValue - currentStation.currentTransaction.meterStart) / 1000; // Wh to kWh
          
          // Store detailed meter reading
          const meterReading = {
            timestamp: meterData.timestamp || new Date().toISOString(),
            power,
            voltage,
            current,
            soc,
            temperature,
            energy: energy.toFixed(2)
          };
          
          // Keep last 100 readings
          const meterHistory = currentStation.meterHistory || [];
          meterHistory.push(meterReading);
          if (meterHistory.length > 100) {
            meterHistory.shift();
          }
          
          store.updateStation(chargerId, {
            currentTransaction: {
              ...currentStation.currentTransaction,
              meterValue: meterValue,
              power: power,
              energy: energy.toFixed(2),
              voltage,
              current,
              soc,
              temperature
            },
            meterHistory
          });
        }
      }
      response = {};
      break;
      
    case 'Authorize':
      // Charger checking if RFID tag is valid
      response = {
        idTagInfo: {
          status: 'Accepted' // Accept all tags for demo
        }
      };
      break;
      
    case 'DataTransfer':
      // Vendor-specific data
      response = {
        status: 'Accepted'
      };
      break;
      
    default:
      console.log(`[OCPP] Unknown action from ${chargerId}: ${action}`);
      response = {};
  }
  
  // Send response
  const responseMessage = [CALLRESULT, messageId, response];
  ws.send(JSON.stringify(responseMessage));
  console.log(`[OCPP] ${chargerId} <-`, JSON.stringify(responseMessage));
  
  // Broadcast update to browsers
  broadcastUpdate();
}

/**
 * Handle response from charger to our request
 */
function handleChargerResponse(chargerId, messageId, payload, broadcastUpdate) {
  // Update activity for responses too
  updateChargerActivity(chargerId);
  
  const pending = pendingRequests.get(messageId);
  if (pending) {
    console.log(`[OCPP] Response to ${pending.action}:`, payload);
    pendingRequests.delete(messageId);
    
    // Handle specific responses
    if (pending.action === 'RemoteStartTransaction') {
      if (payload.status === 'Accepted') {
        console.log(`[OCPP] ${chargerId} accepted RemoteStart`);
      } else {
        console.log(`[OCPP] ${chargerId} rejected RemoteStart: ${payload.status}`);
      }
    } else if (pending.action === 'RemoteStopTransaction') {
      if (payload.status === 'Accepted') {
        console.log(`[OCPP] ${chargerId} accepted RemoteStop`);
      }
    } else if (pending.action === 'GetConfiguration') {
      // Store configuration data
      if (payload.configurationKey) {
        const config = {};
        payload.configurationKey.forEach(item => {
          config[item.key] = {
            value: item.value,
            readonly: item.readonly || false
          };
        });
        store.updateStation(chargerId, { 
          configuration: config,
          capabilities: extractCapabilities(config)
        });
        console.log(`[OCPP] Stored configuration for ${chargerId}`);
      }
    } else if (pending.action === 'TriggerMessage') {
      console.log(`[OCPP] ${chargerId} trigger response: ${payload.status}`);
    }
    
    broadcastUpdate();
  }
}

/**
 * Extract capabilities from configuration
 */
function extractCapabilities(config) {
  const capabilities = {
    supportedFeatureProfiles: [],
    connectors: 1,
    smartCharging: false,
    reservation: false,
    localAuthList: false
  };
  
  // Detect supported features from configuration
  if (config.SupportedFeatureProfiles) {
    capabilities.supportedFeatureProfiles = config.SupportedFeatureProfiles.value.split(',');
  }
  
  if (config.NumberOfConnectors) {
    capabilities.connectors = parseInt(config.NumberOfConnectors.value) || 1;
  }
  
  // Check for smart charging support
  if (config.ChargeProfileMaxStackLevel) {
    capabilities.smartCharging = true;
  }
  
  // Check for reservation support
  if (capabilities.supportedFeatureProfiles.includes('Reservation')) {
    capabilities.reservation = true;
  }
  
  // Check for local auth list support
  if (config.LocalAuthListEnabled) {
    capabilities.localAuthList = config.LocalAuthListEnabled.value === 'true';
  }
  
  return capabilities;
}

/**
 * Send command to charger
 */
function sendToCharger(chargerId, action, payload) {
  const ws = store.getChargerConnection(chargerId);
  if (!ws || ws.readyState !== 1) {
    console.error(`[OCPP] Cannot send to ${chargerId}: not connected`);
    return false;
  }
  
  const messageId = uuidv4();
  const message = [CALL, messageId, action, payload];
  
  // Store pending request
  pendingRequests.set(messageId, {
    action,
    payload,
    timestamp: Date.now()
  });
  
  ws.send(JSON.stringify(message));
  console.log(`[OCPP] ${chargerId} <-`, JSON.stringify(message));
  
  return true;
}

module.exports = {
  handleOCPPMessage,
  sendToCharger
};
