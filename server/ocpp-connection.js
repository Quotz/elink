const { handleOCPPMessage } = require('./ocpp-handler');
const store = require('./store');
const { broadcastUpdate } = require('./websocket');

function init(ocppWss) {
  // Timeout monitor - check for offline chargers every 30 seconds
  // Only applies to direct OCPP connections, not CitrineOS-polled or simulated stations
  setInterval(() => {
    const stations = store.getStations();
    const now = Date.now();
    const TIMEOUT_MS = 40000;

    stations.forEach(station => {
      if (station.connected && station.lastHeartbeat && station.connectionSource === 'ocpp') {
        const timeSinceLastHeartbeat = now - station.lastHeartbeat;
        if (timeSinceLastHeartbeat > TIMEOUT_MS) {
          console.log(`[OCPP] Charger ${station.id} timed out (${Math.floor(timeSinceLastHeartbeat / 1000)}s since last heartbeat)`);
          store.updateStation(station.id, { connected: false, status: 'Offline' });
          broadcastUpdate();
        }
      }
    });
  }, 30000);

  // OCPP WebSocket connection handler
  ocppWss.on('connection', (ws) => {
    let chargerId = ws.chargerId;
    let isIdentified = ws.isIdentified;

    console.log(`[OCPP] WebSocket connected${chargerId ? ` (path ID: ${chargerId})` : ' (waiting for BootNotification)'}]`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        const messageType = message[0];

        if (!isIdentified && messageType === 2) {
          const [, messageId, action, payload] = message;
          if (action === 'BootNotification' && payload.chargePointSerialNumber) {
            chargerId = payload.chargePointSerialNumber;
            ws.chargerId = chargerId;
            isIdentified = true;

            console.log(`[OCPP] Identified charger from BootNotification: ${chargerId}`);

            store.setChargerConnection(chargerId, ws);
            store.updateStation(chargerId, {
              connected: true,
              lastHeartbeat: Date.now(),
              connectedAt: Date.now(),
              demoMode: false,
              connectionSource: 'ocpp',
              vendor: payload.chargePointVendor,
              model: payload.chargePointModel,
              serialNumber: payload.chargePointSerialNumber,
              firmwareVersion: payload.firmwareVersion
            });
            broadcastUpdate();
          }
        }

        if (!chargerId) {
          console.log(`[OCPP] Message from unidentified charger:`, JSON.stringify(message));
          return;
        }

        console.log(`[OCPP] ${chargerId} ->`, JSON.stringify(message));
        handleOCPPMessage(chargerId, message, ws, broadcastUpdate);
      } catch (err) {
        console.error(`[OCPP] Parse error:`, err);
      }
    });

    ws.on('close', () => {
      if (chargerId) {
        console.log(`[OCPP] Charger disconnected: ${chargerId}`);
        store.setChargerConnection(chargerId, null);
        store.updateStation(chargerId, { connected: false, status: 'Offline' });
        broadcastUpdate();
      } else {
        console.log(`[OCPP] Unidentified charger disconnected`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[OCPP] Error${chargerId ? ` from ${chargerId}` : ''}:`, err);
    });
  });
}

module.exports = { init };
