import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import type { RequestHandler } from './$types';
import { execSync } from 'child_process';
import os from 'os';
import { getPrimaryInterface } from '$lib/server/network-utils';

interface WifiNetwork {
  ssid: string;
  bssid: string;
  channel: string;
  signal: number;
  security: string;
  isInsecure: boolean;
  noise?: number;
  snr?: number;
  phyMode?: string;
  channelWidth?: string;
  channelBand?: string;
  vendor?: string;
}

interface CurrentConnection {
  ssid: string;
  bssid: string;
  channel: string;
  signal: number;
  ip: string;
  interface: string;
}

/** Extract channel width from system_profiler channel string like "44 (5GHz, 40MHz)" */
function extractChannelWidth(channelStr: string): string | undefined {
  const match = channelStr.match(/(\d+MHz)/);
  return match?.[1] || undefined;
}

/** Extract band from channel info */
function extractChannelBand(channelStr: string): string | undefined {
  if (channelStr.includes('5GHz') || channelStr.includes('5 GHz')) return '5 GHz';
  if (channelStr.includes('6GHz') || channelStr.includes('6 GHz')) return '6 GHz';
  if (channelStr.includes('2.4GHz') || channelStr.includes('2.4 GHz')) return '2.4 GHz';
  // Infer from channel number
  const ch = parseInt(channelStr);
  if (ch >= 1 && ch <= 14) return '2.4 GHz';
  if (ch >= 32 && ch <= 177) return '5 GHz';
  return undefined;
}

/** Simple OUI vendor lookup from first 3 octets of BSSID */
const OUI_TABLE: Record<string, string> = {
  '00:1A:2B': 'Ayecom',
  '00:50:F2': 'Microsoft',
  '00:0C:29': 'VMware',
  '00:1B:63': 'Apple',
  '3C:22:FB': 'Apple',
  '70:56:81': 'Apple',
  'A8:51:5B': 'Apple',
  'AC:BC:32': 'Apple',
  'F0:B3:EC': 'Apple',
  'DC:A6:32': 'Raspberry Pi',
  '28:CD:C1': 'Raspberry Pi',
  'B8:27:EB': 'Raspberry Pi',
  'E4:5F:01': 'Raspberry Pi',
  '00:14:22': 'Dell',
  '00:1E:68': 'Quanta',
  '00:25:00': 'Apple',
  '10:DD:B1': 'Apple',
  '14:7D:DA': 'Apple',
  '18:AF:8F': 'Apple',
  '20:78:F0': 'Apple',
  '38:F9:D3': 'Apple',
  '40:CB:C0': 'Apple',
  '5C:F9:38': 'Apple',
  '78:7B:8A': 'Apple',
  '84:FC:FE': 'Apple',
  '88:66:A5': 'Apple',
  '8C:85:90': 'Apple',
  '94:E9:79': 'Apple',
  'A4:D1:D2': 'Apple',
  'C8:69:CD': 'Apple',
  'D0:03:4B': 'Apple',
  'F4:5C:89': 'Apple',
  'FC:E9:98': 'Apple',
  '00:17:88': 'Philips',
  '44:39:C4': 'Universal Global Scientific',
  '50:C7:BF': 'TP-Link',
  '60:32:B1': 'TP-Link',
  'B0:4E:26': 'TP-Link',
  'C0:06:C3': 'TP-Link',
  'E8:48:B8': 'TP-Link',
  '08:36:C9': 'NETGEAR',
  '20:E5:2A': 'NETGEAR',
  '6C:B0:CE': 'NETGEAR',
  'A4:2B:8C': 'NETGEAR',
  'E4:F4:C6': 'NETGEAR',
  '00:24:B2': 'NETGEAR',
  '04:A1:51': 'NETGEAR',
  '34:68:95': 'Linksys',
  '58:EF:68': 'Linksys',
  'C0:56:27': 'Linksys',
  '00:1D:7E': 'Linksys',
  '14:91:82': 'Linksys',
  '10:DA:43': 'NETGEAR',
  '2C:B0:5D': 'NETGEAR',
  '00:18:E7': 'Asus',
  '08:60:6E': 'Asus',
  '1C:87:2C': 'Asus',
  '2C:FD:A1': 'Asus',
  '50:46:5D': 'Asus',
  'B0:6E:BF': 'Asus',
  'F8:32:E4': 'Asus',
  '00:26:F2': 'NETGEAR',
  '3C:37:86': 'NETGEAR',
  '00:23:69': 'Cisco',
  '00:24:14': 'Cisco',
  '00:90:0B': 'Cisco',
  'EC:44:76': 'Cisco',
  '70:3A:CB': 'Google',
  '94:EB:2C': 'Google',
  'F4:F5:D8': 'Google',
  '54:60:09': 'Google',
  '24:5A:4C': 'Ubiquiti',
  '68:D7:9A': 'Ubiquiti',
  '78:8A:20': 'Ubiquiti',
  'B4:FB:E4': 'Ubiquiti',
  'E0:63:DA': 'Ubiquiti',
  'FC:EC:DA': 'Ubiquiti',
  '6C:0B:84': 'Wiz',
  'D8:A0:11': 'Wiz',
  '44:4F:8E': 'Wiz',
  '00:1A:22': 'eQ-3',
  '34:CE:00': 'Xiaomi',
  '64:CC:2E': 'Xiaomi',
  '78:11:DC': 'Xiaomi',
  '7C:49:EB': 'Xiaomi',
  '04:CF:8C': 'Xiaomi',
  '28:6C:07': 'Xiaomi',
  'EC:FA:BC': 'Amazon',
  '40:B4:CD': 'Amazon',
  '68:54:FD': 'Amazon',
  'A0:02:DC': 'Amazon',
  '74:C2:46': 'Amazon',
  '00:FC:8B': 'Amazon',
  '44:00:49': 'Samsung',
  '8C:77:12': 'Samsung',
  'CC:3A:61': 'Samsung',
  'F0:5B:7B': 'Samsung',
  '08:AE:D6': 'Samsung',
};

function lookupVendor(bssid: string): string | undefined {
  const oui = bssid.substring(0, 8).toUpperCase();
  return OUI_TABLE[oui];
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
      const wifiIface = getPrimaryInterface();
      let ip = '';
      try {
        const ifOut = execSync(`ifconfig ${wifiIface} 2>/dev/null`, { timeout: 3000 }).toString();
        ip = ifOut.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/)?.[1] || '';
      } catch {}

      if (ssid) {
        return { ssid, bssid, channel, signal: rssi, ip, interface: wifiIface };
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
        networks = nearbyNetworks.map((net: any) => {
          const channelInfo = net?.spairport_network_channel || '';
          const signal = parseInt(net?.spairport_signal_noise_ratio || net?.spairport_network_signal || '-70') || -70;
          const noise = parseInt(net?.spairport_network_noise || '0') || undefined;
          const bssid = net?.spairport_network_bssid || '';

          return {
            ssid: net?._name || '(Hidden)',
            bssid,
            channel: channelInfo.split?.(' ')?.[0] || '',
            signal,
            security: net?.spairport_security_mode || 'NONE',
            isInsecure: !net?.spairport_security_mode || net?.spairport_security_mode === 'Open',
            noise,
            snr: noise !== undefined ? signal - noise : undefined,
            phyMode: net?.spairport_network_phymode || undefined,
            channelWidth: extractChannelWidth(channelInfo),
            channelBand: extractChannelBand(channelInfo),
            vendor: bssid ? lookupVendor(bssid) : undefined,
          };
        });
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
  } catch (e: unknown) {
    error = `WiFi scan failed: ${errorMessage(e) || 'Unknown error'}`;
  }

  const current = getCurrentConnection();

  return json({ networks, current, error });
};
