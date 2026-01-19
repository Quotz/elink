const store = require('./store');
const { v4: uuidv4 } = require('uuid');

// OCPP 1.6 message types
const CALL = 2;
const CALLRESULT = 3;
const CALLERROR = 4;

// Pending requests (for matching responses)
const pendingRequests = new Map();

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
  let response = {};
  
  switch (action) {
    case 'BootNotification':
      // Charger is booting up
      store.updateStation(chargerId, {
        vendor: payload.chargePointVendor,
        model: payload.chargePointModel,
        serialNumber: payload.chargePointSerialNumber,
        firmwareVersion: payload.firmwareVersion,
        connected: true,
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
        store.updateStation(chargerId, {
          status: 'Available',
          lastTransaction: {
            ...station.currentTransaction,
            stopTime: payload.timestamp || new Date().toISOString(),
            meterStop: payload.meterStop,
            energyDelivered: energyDelivered.toFixed(2),
            reason: payload.reason
          },
          currentTransaction: null
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
        
        sampledValues.forEach((sample) => {
          const value = parseFloat(sample.value);
          const measurand = sample.measurand || 'Energy.Active.Import.Register';
          
          if (measurand === 'Power.Active.Import' || measurand === 'Power.Active.Import.L1') {
            power = value; // Usually in W
          } else if (measurand === 'Energy.Active.Import.Register') {
            meterValue = value; // Usually in Wh
          }
        });
        
        const currentStation = store.getStation(chargerId);
        if (currentStation && currentStation.currentTransaction) {
          energy = (meterValue - currentStation.currentTransaction.meterStart) / 1000; // Wh to kWh
          store.updateStation(chargerId, {
            currentTransaction: {
              ...currentStation.currentTransaction,
              meterValue: meterValue,
              power: power,
              energy: energy.toFixed(2)
            }
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
    }
    
    broadcastUpdate();
  }
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
