import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execSync } from 'child_process';
import os from 'os';

interface WifiNetwork {
  ssid: string;
  bssid: string;
  channel: string;
  signal: number;
  security: string;
  isInsecure: boolean;
}

interface CurrentConnection {
  ssid: string;
  bssid: string;
  channel: string;
  signal: number;
  ip: string;
  interface: string;
}

function parseMacOSAirportScan(output: string): WifiNetwork[] {
  const lines = output.trim().split('\n');
  if (lines.length < 2) return [];

  // The header line tells us column positions
  const header = lines[0];
  const ssidEnd = header.indexOf('BSSID');
  const bssidEnd = header.indexOf('RSSI');
  const rssiEnd = header.indexOf('CHANNEL');
  const channelEnd = header.indexOf('HT');
  const securityStart = header.indexOf('SECURITY');

  const networks: WifiNetwork[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const ssid = line.substring(0, ssidEnd).trim();
    const bssid = line.substring(ssidEnd, bssidEnd).trim();
    const rssi = parseInt(line.substring(bssidEnd, rssiEnd).trim(), 10);
    const channel = line.substring(rssiEnd, channelEnd).trim();
    const security = securityStart >= 0 ? line.substring(securityStart).trim() : 'Unknown';

    const isInsecure = security === 'NONE' || security === '' || security.toLowerCase() === 'open';

    networks.push({
      ssid: ssid || '(Hidden)',
      bssid,
      channel,
      signal: rssi,
      security: security || 'NONE',
      isInsecure,
    });
  }
  return networks;
}

function parseLinuxNmcli(output: string): WifiNetwork[] {
  const lines = output.trim().split('\n');
  const networks: WifiNetwork[] = [];
  for (const line of lines) {
    // nmcli -t -f SSID,BSSID,CHAN,SIGNAL,SECURITY dev wifi list
    const parts = line.split(':');
    if (parts.length < 5) continue;
    const ssid = parts[0] || '(Hidden)';
    const bssid = parts.slice(1, 7).join(':'); // BSSID has colons
    const remaining = parts.slice(7);
    const channel = remaining[0] || '';
    const signalPct = parseInt(remaining[1] || '0', 10);
    const security = remaining[2] || 'NONE';
    // Convert percentage to approximate dBm
    const signal = signalPct > 0 ? Math.round(-100 + signalPct * 0.6) : -100;

    const isInsecure = security === '' || security === '--' || security.toLowerCase().includes('open');

    networks.push({ ssid, bssid, channel, signal, security: security || 'NONE', isInsecure });
  }
  return networks;
}

function getCurrentConnection(): CurrentConnection | null {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      // Use system_profiler for current connection info (works on all macOS)
      let ssid = '',
        bssid = '',
        channel = '',
        rssi = -100;
      try {
        const spRaw = execSync('system_profiler SPAirPortDataType -json 2>/dev/null', {
          encoding: 'utf-8',
          timeout: 10000,
        });
        const data = JSON.parse(spRaw);
        const airportData = data?.SPAirPortDataType?.[0];
        const iface = airportData?.spairport_airport_interfaces?.[0];
        const current = iface?.spairport_current_network_information;
        if (current) {
          ssid = current._name || '';
          bssid = current.spairport_network_bssid || '';
          channel = current.spairport_network_channel?.split?.(' ')?.[0] || '';
          rssi = parseInt(current.spairport_signal_noise_ratio || '-40') || -40;
        }
      } catch {
        // Fallback: airport -I
        try {
          const airportPath =
            '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';
          const info = execSync(`${airportPath} -I 2>/dev/null`, { timeout: 5000 }).toString();
          ssid = info.match(/\s+SSID:\s*(.+)/)?.[1]?.trim() || '';
          bssid = info.match(/\s+BSSID:\s*(.+)/)?.[1]?.trim() || '';
          channel = info.match(/\s+channel:\s*(.+)/)?.[1]?.trim() || '';
          rssi = parseInt(info.match(/\s+agrCtlRSSI:\s*(-?\d+)/)?.[1] || '-100', 10);
        } catch {}
      }

      // Get IP from ifconfig
      let ip = '';
      try {
        const ifOut = execSync('ifconfig en0 2>/dev/null', { timeout: 3000 }).toString();
        ip = ifOut.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/)?.[1] || '';
      } catch {}

      if (ssid) {
        return { ssid, bssid, channel, signal: rssi, ip, interface: 'en0' };
      }
    } else {
      // Linux: nmcli
      const info = execSync('nmcli -t -f DEVICE,TYPE,STATE,CONNECTION dev 2>/dev/null', {
        timeout: 5000,
      }).toString();
      const wifiLine = info.split('\n').find((l) => l.includes('wifi') && l.includes('connected'));
      if (wifiLine) {
        const parts = wifiLine.split(':');
        const iface = parts[0];
        const connName = parts[3] || '';

        let ip = '';
        try {
          const ipOut = execSync(`ip -4 addr show ${iface} 2>/dev/null`, { timeout: 3000 }).toString();
          ip = ipOut.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/)?.[1] || '';
        } catch {}

        return { ssid: connName, bssid: '', channel: '', signal: 0, ip, interface: iface };
      }
    }
  } catch {}
  return null;
}

export const GET: RequestHandler = async () => {
  const platform = os.platform();
  let networks: WifiNetwork[] = [];
  let error: string | undefined;

  try {
    if (platform === 'darwin') {
      // Try system_profiler first (works on all macOS versions including Sequoia+)
      try {
        const spRaw = execSync('system_profiler SPAirPortDataType -json 2>/dev/null', {
          encoding: 'utf-8',
          timeout: 15000,
        });
        const data = JSON.parse(spRaw);
        const airportData = data?.SPAirPortDataType?.[0];
        const iface = airportData?.spairport_airport_interfaces?.[0];
        const nearbyNetworks = iface?.spairport_airport_other_local_wireless_networks || [];
        networks = nearbyNetworks.map((net: any) => ({
          ssid: net?._name || '(Hidden)',
          bssid: net?.spairport_network_bssid || '',
          channel: net?.spairport_network_channel?.split?.(' ')?.[0] || '',
          signal: parseInt(net?.spairport_signal_noise_ratio || net?.spairport_network_signal || '-70') || -70,
          security: net?.spairport_security_mode || 'NONE',
          isInsecure: !net?.spairport_security_mode || net?.spairport_security_mode === 'Open',
        }));
      } catch {
        // Fallback: airport binary (older macOS)
        const airportPath = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';
        const output = execSync(`${airportPath} -s 2>/dev/null`, { timeout: 10000 }).toString();
        networks = parseMacOSAirportScan(output);
      }
    } else {
      const output = execSync('nmcli -t -f SSID,BSSID,CHAN,SIGNAL,SECURITY dev wifi list 2>/dev/null', {
        timeout: 10000,
      }).toString();
      networks = parseLinuxNmcli(output);
    }
  } catch (e: any) {
    error = `WiFi scan failed: ${e.message || 'Unknown error'}`;
  }

  const current = getCurrentConnection();

  return json({ networks, current, error });
};
