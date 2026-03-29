import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import type { RequestHandler } from './$types';
import { execSync } from 'child_process';
import os from 'os';
import { getPrimaryInterface } from '$lib/server/network-utils';
import { lookupVendor } from '$lib/server/oui';
import type { WifiNetwork, CurrentConnection } from '$lib/types/wifi';

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

/** Scan via CoreWLAN Swift one-liner — returns real SSIDs on macOS Sonoma+ where system_profiler redacts them. */
function scanViaCoreWLAN(): WifiNetwork[] {
  const script = `
import CoreWLAN
import Foundation
if let iface = CWWiFiClient.shared().interface(),
   let networks = try? iface.scanForNetworks(withName: nil) {
  var arr: [[String: Any]] = []
  for n in networks {
    arr.append([
      "ssid": n.ssid ?? "",
      "bssid": n.bssid ?? "",
      "rssi": n.rssiValue,
      "channel": n.wlanChannel?.channelNumber ?? 0,
      "band": n.wlanChannel?.channelBand.rawValue ?? 0,
      "width": n.wlanChannel?.channelWidth.rawValue ?? 0,
      "noise": n.noiseMeasurement,
      "security": n.securityDescription
    ])
  }
  if let data = try? JSONSerialization.data(withJSONObject: arr),
     let str = String(data: data, encoding: .utf8) {
    print(str)
  }
}
extension CWNetwork {
  var securityDescription: String {
    if supportsSecurity(.wpa3Personal) || supportsSecurity(.wpa3Enterprise) { return "WPA3" }
    if supportsSecurity(.wpa2Personal) || supportsSecurity(.wpa2Enterprise) { return "WPA2" }
    if supportsSecurity(.wpaPersonal) || supportsSecurity(.wpaEnterprise) { return "WPA" }
    if supportsSecurity(.dynamicWEP) { return "WEP" }
    if supportsSecurity(.none) { return "NONE" }
    return "Unknown"
  }
}`;

  const output = execSync(`swift -e '${script.replace(/'/g, "'\\''")}'`, {
    encoding: 'utf-8',
    timeout: 20000,
  }).trim();
  if (!output) return [];

  const items: Array<{
    ssid: string;
    bssid: string;
    rssi: number;
    channel: number;
    band: number;
    width: number;
    noise: number;
    security: string;
  }> = JSON.parse(output);

  return items.map((n) => {
    const bandStr = n.band === 1 ? '2.4 GHz' : n.band === 2 ? '5 GHz' : n.band === 3 ? '6 GHz' : undefined;
    const widthStr =
      n.width === 1
        ? '20MHz'
        : n.width === 2
          ? '40MHz'
          : n.width === 3
            ? '80MHz'
            : n.width === 4
              ? '160MHz'
              : undefined;
    return {
      ssid: n.ssid || '(Hidden)',
      bssid: n.bssid,
      channel: String(n.channel),
      signal: n.rssi,
      security: n.security,
      isInsecure: n.security === 'NONE' || n.security === '',
      noise: n.noise || undefined,
      snr: n.noise ? n.rssi - n.noise : undefined,
      channelBand: bandStr,
      channelWidth: widthStr,
      vendor: n.bssid ? lookupVendor(n.bssid) || undefined : undefined,
    };
  });
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

        let ip = '',
          bssid = '',
          channel = '',
          signal = 0;
        try {
          const ipOut = execSync(`ip -4 addr show ${iface} 2>/dev/null`, { timeout: 3000 }).toString();
          ip = ipOut.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/)?.[1] || '';
        } catch {}
        // Get bssid, channel, signal from nmcli wifi list
        try {
          const wifiOut = execSync('nmcli -t -f ACTIVE,SSID,BSSID,CHAN,SIGNAL dev wifi 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 5000,
          });
          const active = wifiOut.split('\n').find((l) => l.startsWith('yes:'));
          if (active) {
            const wp = active.split(':');
            // BSSID occupies fields 2-7 (has colons)
            bssid = wp.slice(2, 8).join(':');
            channel = wp[8] || '';
            const pct = parseInt(wp[9] || '0');
            signal = pct > 0 ? Math.round(-100 + pct * 0.6) : -100;
          }
        } catch {}

        return { ssid: connName, bssid, channel, signal, ip, interface: iface };
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
      // Primary: CoreWLAN via Swift — shows real SSIDs on macOS Sonoma+ (system_profiler redacts them)
      try {
        networks = scanViaCoreWLAN();
      } catch {
        // Fallback: system_profiler (SSIDs may show as <redacted> on Sonoma+)
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
              vendor: bssid ? lookupVendor(bssid) || undefined : undefined,
            };
          });
        } catch {
          // Last resort: airport binary (removed in newer macOS)
          const airportPath =
            '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport';
          const output = execSync(`${airportPath} -s 2>/dev/null`, { timeout: 10000 }).toString();
          networks = parseMacOSAirportScan(output);
        }
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
