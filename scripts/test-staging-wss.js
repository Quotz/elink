const WebSocket = require('ws');

// Test connection to staging server
const wsUrl = 'wss://staging.elink.mk/ocpp/30001233';
const protocols = ['ocpp1.6'];

console.log(`Testing connection to: ${wsUrl}`);
console.log(`With protocols: ${protocols.join(', ')}`);

const ws = new WebSocket(wsUrl, protocols, {
  handshakeTimeout: 10000,
  rejectUnauthorized: false // For testing self-signed certs
});

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully!');
  console.log('Protocol:', ws.protocol);
  
  // Send BootNotification
  const bootMsg = [2, "test-001", "BootNotification", {
    chargePointVendor: "TestVendor",
    chargePointModel: "TestModel",
    chargePointSerialNumber: "TEST123",
    firmwareVersion: "1.0.0"
  }];
  
  console.log('Sending BootNotification...');
  ws.send(JSON.stringify(bootMsg));
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());
  
  try {
    const msg = JSON.parse(data);
    if (msg[0] === 3 && msg[2] && msg[2].status === 'Accepted') {
      console.log('✅ BootNotification accepted!');
      console.log(`Interval: ${msg[2].interval}s`);
      
      // Close after successful test
      setTimeout(() => {
        console.log('Closing connection...');
        ws.close();
        process.exit(0);
      }, 1000);
    }
  } catch (e) {
    console.error('Parse error:', e);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Connection closed: ${code} ${reason}`);
  process.exit(code === 1000 ? 0 : 1);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.error('❌ Timeout - no response within 15s');
  ws.terminate();
  process.exit(1);
}, 15000);
