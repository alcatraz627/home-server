import { json } from '@sveltejs/kit';
import { execSync } from 'node:child_process';
import type { RequestHandler } from './$types';

const isMac = process.platform === 'darwin';

interface WifiNetwork {
  ssid: string;
  bssid: string;
  rssi: number;
  channel: number;
  security: string;
}

interface BluetoothDevice {
  name: string;
  address: string;
  connected: boolean;
  type: string;
}

function getWifiNetworks(): WifiNetwork[] {
  try {
    if (isMac) {
      const raw = execSync(
        '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s',
        { encoding: 'utf-8', timeout: 10000 },
      );
      const lines = raw.split('\n').filter((l) => l.trim());
      if (lines.length < 2) return [];
      // Parse airport output — columns are space-aligned
      return lines
        .slice(1)
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const ssid = parts.length > 6 ? parts.slice(0, parts.length - 6).join(' ') : parts[0] || '';
          const rest = parts.slice(parts.length - 6);
          return {
            ssid: ssid || '(hidden)',
            bssid: rest[0] || '',
            rssi: parseInt(rest[1]) || 0,
            channel: parseInt(rest[2]) || 0,
            security: rest.slice(5).join(' ') || 'Open',
          };
        })
        .filter((n) => n.bssid);
    } else {
      const raw = execSync('nmcli dev wifi list 2>/dev/null || echo ""', {
        encoding: 'utf-8',
        timeout: 10000,
      });
      const lines = raw.split('\n').filter((l) => l.trim());
      if (lines.length < 2) return [];
      return lines.slice(1).map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          ssid: parts[1] || '(hidden)',
          bssid: parts[2] || '',
          rssi: parseInt(parts[6]) || 0,
          channel: parseInt(parts[4]) || 0,
          security: parts.slice(7).join(' ') || 'Open',
        };
      });
    }
  } catch {
    return [];
  }
}

function getBluetoothDevices(): BluetoothDevice[] {
  try {
    if (isMac) {
      const raw = execSync('system_profiler SPBluetoothDataType -json 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 10000,
      });
      const data = JSON.parse(raw);
      const btData = data?.SPBluetoothDataType?.[0];
      const devices: BluetoothDevice[] = [];
      const connectedDevices = btData?.device_connected || [];
      const recentDevices = btData?.device_not_connected || [];
      for (const dev of connectedDevices) {
        for (const [name, info] of Object.entries(dev) as [string, any][]) {
          devices.push({
            name,
            address: info?.device_address || '',
            connected: true,
            type: info?.device_minorType || 'Unknown',
          });
        }
      }
      for (const dev of recentDevices) {
        for (const [name, info] of Object.entries(dev) as [string, any][]) {
          devices.push({
            name,
            address: info?.device_address || '',
            connected: false,
            type: info?.device_minorType || 'Unknown',
          });
        }
      }
      return devices;
    }
    return [];
  } catch {
    return [];
  }
}

function getCurrentWifi(): { ssid: string; rssi: number } | null {
  try {
    if (isMac) {
      const raw = execSync(
        '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I',
        { encoding: 'utf-8', timeout: 5000 },
      );
      const ssidMatch = raw.match(/\bSSID:\s*(.+)/);
      const rssiMatch = raw.match(/agrCtlRSSI:\s*(-?\d+)/);
      if (ssidMatch) {
        return { ssid: ssidMatch[1].trim(), rssi: parseInt(rssiMatch?.[1] || '0') };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async () => {
  const wifi = getWifiNetworks();
  const bluetooth = getBluetoothDevices();
  const currentWifi = getCurrentWifi();
  return json({ wifi, bluetooth, currentWifi });
};
