/**
 * Simple TCP Diagnostics Server
 * Listens on port 8899 for raw diagnostic data from chargers
 */

const net = require('net');
const fs = require('fs');
const path = require('path');

const DIAGNOSTICS_PORT = 8899;
const LOGS_DIR = path.join(__dirname, '..', 'data', 'diagnostics-tcp');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const server = net.createServer((socket) => {
  const clientIp = socket.remoteAddress;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `diag_${clientIp}_${timestamp}.log`;
  const filepath = path.join(LOGS_DIR, filename);
  
  console.log(`[TCP-Diagnostics] Connection from ${clientIp}`);
  
  let dataBuffer = '';
  
  socket.on('data', (data) => {
    dataBuffer += data.toString();
    console.log(`[TCP-Diagnostics] Received ${data.length} bytes from ${clientIp}`);
  });
  
  socket.on('end', () => {
    console.log(`[TCP-Diagnostics] Connection closed from ${clientIp}`);
    if (dataBuffer.length > 0) {
      fs.writeFileSync(filepath, dataBuffer);
      console.log(`[TCP-Diagnostics] Saved to ${filename} (${dataBuffer.length} bytes)`);
    }
  });
  
  socket.on('error', (err) => {
    console.error(`[TCP-Diagnostics] Error from ${clientIp}:`, err.message);
  });
  
  // Send acknowledgment
  socket.write('OK\n');
});

server.listen(DIAGNOSTICS_PORT, '0.0.0.0', () => {
  console.log(`[TCP-Diagnostics] Server listening on port ${DIAGNOSTICS_PORT}`);
});

module.exports = server;
