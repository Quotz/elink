/**
 * OCPP Connection Tester
 * Run this to test if your server accepts OCPP WebSocket connections
 * 
 * Usage: node test-ocpp.js wss://elink-production.up.railway.app/ocpp/001
 */

const WebSocket = require('ws');

const url = process.argv[2] || 'ws://localhost:3000/ocpp/TEST001';

console.log(`\n🔌 Testing OCPP connection to: ${url}\n`);

const ws = new WebSocket(url, ['ocpp1.6'], {
  headers: {
    'Sec-WebSocket-Protocol': 'ocpp1.6'
  }
});

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
  console.log('📤 Sending BootNotification...\n');
  
  // Send a BootNotification (OCPP CALL message)
  const bootNotification = [
    2,                                    // MessageTypeId: CALL
    "test-msg-001",                       // UniqueId
    "BootNotification",                   // Action
    {                                     // Payload
      chargePointVendor: "TestVendor",
      chargePointModel: "TestModel",
      chargePointSerialNumber: "TEST001",
      firmwareVersion: "1.0.0"
    }
  ];
  
  ws.send(JSON.stringify(bootNotification));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📥 Received:', JSON.stringify(message, null, 2));
  
  // Check if it's a CALLRESULT (3) for our BootNotification
  if (message[0] === 3 && message[1] === "test-msg-001") {
    const status = message[2]?.status;
    if (status === 'Accepted') {
      console.log('\n✅ SUCCESS! Server accepted BootNotification');
      console.log('🎉 Your OCPP server is working correctly!\n');
    } else {
      console.log(`\n⚠️  Server responded with status: ${status}\n`);
    }
  }
  
  // Close after receiving response
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 1000);
});

ws.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  
  if (error.message.includes('401')) {
    console.log('\n💡 Hint: Server requires authentication');
  } else if (error.message.includes('404')) {
    console.log('\n💡 Hint: Check the URL path - server may not recognize it');
  } else if (error.message.includes('ECONNREFUSED')) {
    console.log('\n💡 Hint: Server is not running or not accessible');
  } else if (error.message.includes('certificate')) {
    console.log('\n💡 Hint: SSL/TLS certificate issue');
  }
  
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔒 Connection closed: ${code} ${reason || ''}`);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('\n⏰ Timeout - no response received');
  ws.close();
  process.exit(1);
}, 10000);
