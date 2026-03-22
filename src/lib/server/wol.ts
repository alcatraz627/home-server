import dgram from 'node:dgram';

/**
 * Send a Wake-on-LAN magic packet to the given MAC address.
 * The magic packet is 6 bytes of 0xFF followed by 16 repetitions of the MAC.
 */
export function sendMagicPacket(mac: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const macBytes = mac.replace(/[:-]/g, '').match(/.{2}/g);

    if (!macBytes || macBytes.length !== 6) {
      reject(new Error(`Invalid MAC address: ${mac}`));
      return;
    }

    const macBuffer = Buffer.from(macBytes.map((b) => parseInt(b, 16)));
    const magicPacket = Buffer.alloc(102);

    // 6 bytes of 0xFF
    for (let i = 0; i < 6; i++) magicPacket[i] = 0xff;

    // 16 repetitions of the MAC
    for (let i = 0; i < 16; i++) {
      macBuffer.copy(magicPacket, 6 + i * 6);
    }

    const socket = dgram.createSocket('udp4');
    socket.once('error', (err) => {
      socket.close();
      reject(err);
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(magicPacket, 0, magicPacket.length, 9, '255.255.255.255', (err) => {
        socket.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

/**
 * Ping a host to check if it's reachable. Returns true if reachable.
 */
export function pingHost(ip: string): Promise<boolean> {
  return new Promise((resolve) => {
    const { execSync } = require('node:child_process');
    try {
      execSync(`ping -c 1 -W 1 ${ip}`, { timeout: 3000, stdio: 'pipe' });
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}
