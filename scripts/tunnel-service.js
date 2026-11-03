// Persistent tunnel service with auto-reconnect and keepalive pings
const { spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const URL_FILE = path.join(__dirname, '..', 'TUNNEL_URL.txt');
let currentTunnelUrl = '';
let pingInterval = null;

function pingTunnel() {
  if (!currentTunnelUrl) return;
  try {
    https.get(currentTunnelUrl, (res) => {
      // drain data
      res.on('data', () => {});
    }).on('error', () => {});
  } catch {}
}

function startTunnel() {
  console.log('[Tunnel] Starting SSH tunnel to localhost.run...');
  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=4',
    '-R', '80:localhost:3000',
    'nokey@localhost.run'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9]+\.lhr\.life/i);
    if (match) {
      currentTunnelUrl = match[0];
      console.log(`\n==============================================`);
      console.log(`[Tunnel Active]: ${currentTunnelUrl}`);
      console.log(`==============================================\n`);
      fs.writeFileSync(URL_FILE, currentTunnelUrl, 'utf8');

      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(pingTunnel, 45000); // Ping every 45s to avoid activity timeout
    }
  });

  child.stderr.on('data', (data) => {
    const text = data.toString();
    if (!text.includes('Pseudo-terminal')) {
      process.stderr.write(`[Tunnel Log] ${text}`);
    }
  });

  child.on('close', (code) => {
    console.log(`[Tunnel] SSH connection closed (code ${code}). Reconnecting in 3 seconds...`);
    if (pingInterval) clearInterval(pingInterval);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();
