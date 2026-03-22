import dgram from 'node:dgram';
import os from 'node:os';
import { createLogger } from './logger';

const log = createLogger('wiz');

export interface WizBulb {
  ip: string;
  mac: string;
  state: boolean;
  brightness: number;
  color: { r: number; g: number; b: number } | null;
  colorTemp: number | null;
  sceneId: number | null;
  // Enhanced info
  moduleName: string | null;
  fwVersion: string | null;
  signal: number | null;
  rssi: number | null;
}

const WIZ_PORT = 38899;
const DISCOVERY_TIMEOUT = 3000;

/** Discover all Wiz bulbs on the local network */
export async function discoverBulbs(): Promise<WizBulb[]> {
  const localIp = getLocalIp();
  const message = JSON.stringify({
    method: 'registration',
    params: {
      phoneMac: 'AAAAAAAAAAAA',
      register: false,
      phoneIp: localIp,
      id: '1',
    },
  });

  const bulbs = new Map<string, WizBulb>();
  const socket = dgram.createSocket('udp4');

  return new Promise((resolve) => {
    socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.result?.mac) {
          bulbs.set(data.result.mac, parseBulbResult(rinfo.address, data.result));
        }
      } catch {
        /* ignore */
      }
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      const buf = Buffer.from(message);
      socket.send(buf, 0, buf.length, WIZ_PORT, '255.255.255.255');
    });

    setTimeout(() => {
      socket.close();
      const discovered = Array.from(bulbs.values());
      log.info('Bulb discovery complete', { count: discovered.length });
      resolve(discovered);
    }, DISCOVERY_TIMEOUT);
  });
}

/** Get current state of a specific bulb (includes full pilot data) */
export async function getBulbState(ip: string): Promise<WizBulb | null> {
  const response = await sendUdp(ip, { method: 'getPilot', params: {} });
  if (!response?.result) return null;
  return parseBulbResult(ip, response.result);
}

/** Get system config from bulb (firmware, model, etc.) */
export async function getBulbSystemConfig(ip: string): Promise<Record<string, any> | null> {
  const response = await sendUdp(ip, { method: 'getSystemConfig', params: {} });
  return response?.result || null;
}

/** Set bulb state (on/off, brightness, color, etc.) */
export async function setBulbState(
  ip: string,
  params: { state?: boolean; dimming?: number; r?: number; g?: number; b?: number; temp?: number; sceneId?: number },
): Promise<boolean> {
  const response = await sendUdp(ip, { method: 'setPilot', params });
  const success = response?.result?.success === true;
  if (success) {
    log.info('Bulb state changed', { ip, params });
  } else {
    log.warn('Bulb state change failed', { ip, params });
  }
  return success;
}

function parseBulbResult(ip: string, r: any): WizBulb {
  return {
    ip,
    mac: r.mac || '',
    state: r.state ?? false,
    brightness: r.dimming ?? 100,
    color: r.r != null ? { r: r.r, g: r.g, b: r.b } : null,
    colorTemp: r.temp ?? null,
    sceneId: r.sceneId ?? null,
    moduleName: r.moduleName ?? null,
    fwVersion: r.fwVersion ?? null,
    signal: r.signal ?? null,
    rssi: r.rssi ?? null,
  };
}

function sendUdp(ip: string, message: object, timeout = 2000): Promise<any> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const buf = Buffer.from(JSON.stringify(message));
    let resolved = false;

    socket.on('message', (msg) => {
      if (!resolved) {
        resolved = true;
        socket.close();
        try {
          resolve(JSON.parse(msg.toString()));
        } catch {
          resolve(null);
        }
      }
    });

    socket.send(buf, 0, buf.length, WIZ_PORT, ip, (err) => {
      if (err && !resolved) {
        resolved = true;
        socket.close();
        log.error('UDP send error', { ip, error: err.message });
        resolve(null);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.close();
        resolve(null);
      }
    }, timeout);
  });
}

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '0.0.0.0';
}

/** Well-known Wiz scene IDs */
export const WIZ_SCENES: Record<number, string> = {
  1: 'Ocean',
  2: 'Romance',
  3: 'Sunset',
  4: 'Party',
  5: 'Fireplace',
  6: 'Cozy',
  7: 'Forest',
  8: 'Pastel Colors',
  9: 'Wake Up',
  10: 'Bedtime',
  11: 'Warm White',
  12: 'Daylight',
  13: 'Cool White',
  14: 'Night Light',
  15: 'Focus',
  16: 'Relax',
  17: 'True Colors',
  18: 'TV Time',
  19: 'Plant Growth',
  20: 'Spring',
  21: 'Summer',
  22: 'Fall',
  23: 'Deep Dive',
  24: 'Jungle',
  25: 'Mojito',
  26: 'Club',
  27: 'Christmas',
  28: 'Halloween',
  29: 'Candlelight',
  30: 'Golden White',
  31: 'Pulse',
  32: 'Steampunk',
};
