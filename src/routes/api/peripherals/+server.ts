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
  noise: number | null;
  phyMode: string;
}

interface BluetoothDevice {
  name: string;
  address: string;
  connected: boolean;
  type: string;
  batteryLevel: number | null;
}

function getWifiNetworks(): WifiNetwork[] {
  try {
    if (isMac) {
      // Try system_profiler first (works on all macOS versions)
      const raw = execSync('system_profiler SPAirPortDataType -json 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 15000,
      });
      try {
        const data = JSON.parse(raw);
        const airportData = data?.SPAirPortDataType?.[0];
        const iface = airportData?.spairport_airport_interfaces?.[0];
        const networks = iface?.spairport_airport_other_local_wireless_networks || [];
        const current = iface?.spairport_current_network_information;
        const results: WifiNetwork[] = networks.map((net: any) => ({
          ssid: net?._name || '(hidden)',
          bssid: net?.spairport_network_bssid || '',
          rssi: parseInt(net?.spairport_signal_noise_ratio || net?.spairport_network_signal || '0') || -70,
          channel: parseInt(net?.spairport_network_channel?.split?.(' ')?.[0] || '0') || 0,
          security: net?.spairport_security_mode || 'Open',
          noise: net?.spairport_network_noise ? parseInt(net.spairport_network_noise) : null,
          phyMode: net?.spairport_network_phymode || '',
        }));
        // Add current network at the top
        if (current?._name) {
          results.unshift({
            ssid: current._name,
            bssid: current.spairport_network_bssid || '',
            rssi: parseInt(current.spairport_signal_noise_ratio || '-40') || -40,
            channel: parseInt(current.spairport_network_channel?.split?.(' ')?.[0] || '0') || 0,
            security: current.spairport_security_mode || 'WPA2',
            noise: current.spairport_network_noise ? parseInt(current.spairport_network_noise) : null,
            phyMode: current.spairport_network_phymode || '',
          });
        }
        return results;
      } catch {
        // Fallback: try airport binary (older macOS)
        try {
          const airportRaw = execSync(
            '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s 2>/dev/null',
            { encoding: 'utf-8', timeout: 10000 },
          );
          const lines = airportRaw.split('\n').filter((l: string) => l.trim());
          if (lines.length < 2) return [];
          return lines
            .slice(1)
            .map((line: string) => {
              const parts = line.trim().split(/\s+/);
              const ssid = parts.length > 6 ? parts.slice(0, parts.length - 6).join(' ') : parts[0] || '';
              const rest = parts.slice(parts.length - 6);
              return {
                ssid: ssid || '(hidden)',
                bssid: rest[0] || '',
                rssi: parseInt(rest[1]) || 0,
                channel: parseInt(rest[2]) || 0,
                security: rest.slice(5).join(' ') || 'Open',
                noise: null,
                phyMode: '',
              };
            })
            .filter((n: WifiNetwork) => n.bssid);
        } catch {
          return [];
        }
      }
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
          noise: null,
          phyMode: '',
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
          const bl = info?.device_batteryLevel ?? info?.device_batteryLevelMain;
          devices.push({
            name,
            address: info?.device_address || '',
            connected: true,
            type: info?.device_minorType || 'Unknown',
            batteryLevel: bl != null ? parseInt(String(bl).replace('%', '')) : null,
          });
        }
      }
      for (const dev of recentDevices) {
        for (const [name, info] of Object.entries(dev) as [string, any][]) {
          const bl = info?.device_batteryLevel ?? info?.device_batteryLevelMain;
          devices.push({
            name,
            address: info?.device_address || '',
            connected: false,
            type: info?.device_minorType || 'Unknown',
            batteryLevel: bl != null ? parseInt(String(bl).replace('%', '')) : null,
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

// --- USB Devices ---

interface USBDevice {
  name: string;
  vendor: string;
  serial: string;
  speed: string;
  bus: string;
  port: string;
}

function getUSBDevices(): USBDevice[] {
  try {
    if (isMac) {
      const raw = execSync('system_profiler SPUSBDataType -json 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 15000,
      });
      const data = JSON.parse(raw);
      const devices: USBDevice[] = [];

      function walkUSB(items: any[], busName = '') {
        for (const item of items) {
          if (item._name) {
            devices.push({
              name: item._name || 'Unknown',
              vendor: item.manufacturer || item.vendor_id || '',
              serial: item.serial_num || '',
              speed: item.device_speed || '',
              bus: busName,
              port: item.location_id || '',
            });
          }
          if (item._items) walkUSB(item._items, busName);
        }
      }

      const usbData = data?.SPUSBDataType || [];
      for (const controller of usbData) {
        if (controller._items) walkUSB(controller._items, controller._name || '');
      }
      return devices;
    }
    return [];
  } catch {
    return [];
  }
}

// --- Audio Devices ---

interface AudioDevice {
  name: string;
  type: 'input' | 'output';
  sampleRate: string;
}

function getAudioDevices(): AudioDevice[] {
  try {
    if (isMac) {
      const raw = execSync('system_profiler SPAudioDataType -json 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 15000,
      });
      const data = JSON.parse(raw);
      const devices: AudioDevice[] = [];
      const audioData = data?.SPAudioDataType || [];

      for (const item of audioData) {
        if (item._items) {
          for (const dev of item._items) {
            const inputs = dev.coreaudio_device_input || dev._items?.filter((i: any) => i.coreaudio_device_input);
            const outputs = dev.coreaudio_device_output || dev._items?.filter((i: any) => i.coreaudio_device_output);
            const sampleRate = dev.coreaudio_device_srate || dev._items?.[0]?.coreaudio_device_srate || '';

            if (dev.coreaudio_device_input) {
              devices.push({
                name: dev._name || 'Unknown',
                type: 'input',
                sampleRate: String(sampleRate),
              });
            }
            if (dev.coreaudio_device_output) {
              devices.push({
                name: dev._name || 'Unknown',
                type: 'output',
                sampleRate: String(sampleRate),
              });
            }
            // If neither flag but has a name, add as output by default
            if (!dev.coreaudio_device_input && !dev.coreaudio_device_output && dev._name) {
              devices.push({
                name: dev._name,
                type: 'output',
                sampleRate: String(sampleRate),
              });
            }
          }
        }
      }
      return devices;
    }
    return [];
  } catch {
    return [];
  }
}

// --- Battery ---

interface BatteryInfo {
  percentage: number;
  charging: boolean;
  timeRemaining: string;
  cycleCount: number | null;
}

function getBatteryInfo(): BatteryInfo | null {
  try {
    if (isMac) {
      const raw = execSync('pmset -g batt 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });

      const percentMatch = raw.match(/(\d+)%/);
      const chargingMatch = raw.match(/(AC Power|charging|charged)/i);
      const timeMatch = raw.match(/(\d+:\d+)\s*remaining/);
      const percentage = percentMatch ? parseInt(percentMatch[1]) : 0;
      const charging = !!chargingMatch;
      const timeRemaining = timeMatch ? timeMatch[1] : charging ? 'Charging' : 'N/A';

      // Try to get cycle count from system_profiler
      let cycleCount: number | null = null;
      try {
        const battRaw = execSync('system_profiler SPPowerDataType 2>/dev/null | grep "Cycle Count"', {
          encoding: 'utf-8',
          timeout: 5000,
        });
        const cycleMatch = battRaw.match(/Cycle Count:\s*(\d+)/);
        if (cycleMatch) cycleCount = parseInt(cycleMatch[1]);
      } catch {}

      return { percentage, charging, timeRemaining, cycleCount };
    }
    return null;
  } catch {
    return null;
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

// --- Displays ---

interface DisplayInfo {
  name: string;
  resolution: string;
  refreshRate: string;
  gpu: string;
  builtIn: boolean;
}

function getDisplays(): DisplayInfo[] {
  try {
    if (isMac) {
      const raw = execSync('system_profiler SPDisplaysDataType -json 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 15000,
      });
      const data = JSON.parse(raw);
      const displays: DisplayInfo[] = [];
      const gpuList = data?.SPDisplaysDataType || [];
      for (const gpu of gpuList) {
        const gpuName = gpu.sppci_model || gpu._name || 'Unknown GPU';
        const ndrvs = gpu.spdisplays_ndrvs || [];
        for (const disp of ndrvs) {
          const res = disp._spdisplays_resolution || disp.spdisplays_resolution || '';
          const refresh = disp._spdisplays_refresh || disp.spdisplays_refresh || '';
          const isBuiltIn =
            disp.spdisplays_connection_type === 'spdisplays_internal' ||
            (disp._name || '').toLowerCase().includes('built-in') ||
            (disp._name || '').toLowerCase().includes('retina');
          displays.push({
            name: disp._name || 'Unknown Display',
            resolution: res,
            refreshRate: refresh ? `${refresh} Hz` : '',
            gpu: gpuName,
            builtIn: isBuiltIn,
          });
        }
      }
      return displays;
    }
    return [];
  } catch {
    return [];
  }
}

// --- Network Interfaces ---

interface NetworkInterface {
  port: string;
  device: string;
  mac: string;
  ip: string;
  status: string;
}

function getNetworkInterfaces(): NetworkInterface[] {
  try {
    if (isMac) {
      const raw = execSync('networksetup -listallhardwareports 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 10000,
      });

      let ifconfigRaw = '';
      try {
        ifconfigRaw = execSync('ifconfig 2>/dev/null', {
          encoding: 'utf-8',
          timeout: 10000,
        });
      } catch {}

      // Parse ifconfig into a map: device -> { ip, status }
      const ifMap = new Map<string, { ip: string; status: string }>();
      const ifBlocks = ifconfigRaw.split(/^(?=\S)/m);
      for (const block of ifBlocks) {
        const devMatch = block.match(/^(\S+?):/);
        if (!devMatch) continue;
        const dev = devMatch[1];
        const ipMatch = block.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
        const statusMatch = block.match(/status:\s*(\S+)/);
        const isUp = block.includes('UP');
        ifMap.set(dev, {
          ip: ipMatch?.[1] || '',
          status: statusMatch?.[1] || (isUp ? 'active' : 'inactive'),
        });
      }

      const interfaces: NetworkInterface[] = [];
      const blocks = raw.split(/\n\n/).filter((b) => b.trim());
      for (const block of blocks) {
        const portMatch = block.match(/Hardware Port:\s*(.+)/);
        const devMatch = block.match(/Device:\s*(\S+)/);
        const macMatch = block.match(/Ethernet Address:\s*(\S+)/);
        if (portMatch && devMatch) {
          const dev = devMatch[1];
          const ifInfo = ifMap.get(dev);
          interfaces.push({
            port: portMatch[1],
            device: dev,
            mac: macMatch?.[1] || 'N/A',
            ip: ifInfo?.ip || '',
            status: ifInfo?.status || 'inactive',
          });
        }
      }
      return interfaces;
    }
    return [];
  } catch {
    return [];
  }
}

// --- System Info ---

interface SystemInfo {
  cpuBrand: string;
  cpuCores: number;
  cpuThreads: number;
  ram: string;
  macosVersion: string;
  serial: string;
  model: string;
}

function getSystemInfo(): SystemInfo | null {
  try {
    if (isMac) {
      let cpuBrand = '';
      try {
        cpuBrand = execSync('sysctl -n machdep.cpu.brand_string 2>/dev/null', {
          encoding: 'utf-8',
          timeout: 5000,
        }).trim();
      } catch {}

      let cpuThreads = 0;
      try {
        cpuThreads = parseInt(
          execSync('sysctl -n hw.ncpu 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 5000,
          }).trim(),
        );
      } catch {}

      const raw = execSync('system_profiler SPHardwareDataType -json 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 15000,
      });
      const data = JSON.parse(raw);
      const hw = data?.SPHardwareDataType?.[0] || {};

      let macosVersion = '';
      try {
        macosVersion = execSync('sw_vers -productVersion 2>/dev/null', {
          encoding: 'utf-8',
          timeout: 5000,
        }).trim();
      } catch {}

      return {
        cpuBrand: cpuBrand || hw.cpu_type || 'Unknown',
        cpuCores: parseInt(hw.number_processors?.replace?.(/.*?(\d+).*/, '$1') || '0') || 0,
        cpuThreads: cpuThreads || 0,
        ram: hw.physical_memory || 'Unknown',
        macosVersion,
        serial: hw.serial_number || 'Unknown',
        model: hw.machine_name || hw.model_name || 'Unknown',
      };
    }
    return null;
  } catch {
    return null;
  }
}

// --- Bluetooth connect/disconnect ---

function bluetoothAction(action: 'connect' | 'disconnect', address: string): { ok: boolean; error?: string } {
  if (!isMac) return { ok: false, error: 'Bluetooth control is only supported on macOS' };
  try {
    // Check if blueutil is available
    try {
      execSync('which blueutil', { encoding: 'utf-8', timeout: 3000 });
    } catch {
      return {
        ok: false,
        error: 'blueutil not found. Install it with: brew install blueutil',
      };
    }
    const flag = action === 'connect' ? '--connect' : '--disconnect';
    execSync(`blueutil ${flag} "${address}"`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message || `Failed to ${action}` };
  }
}

export const GET: RequestHandler = async () => {
  const wifi = getWifiNetworks();
  const bluetooth = getBluetoothDevices();
  const currentWifi = getCurrentWifi();
  const usb = getUSBDevices();
  const audio = getAudioDevices();
  const battery = getBatteryInfo();
  const displays = getDisplays();
  const networkInterfaces = getNetworkInterfaces();
  const systemInfo = getSystemInfo();
  return json({ wifi, bluetooth, currentWifi, usb, audio, battery, displays, networkInterfaces, systemInfo });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { action, address } = body;
  if (action === 'bt-connect' || action === 'bt-disconnect') {
    if (!address || typeof address !== 'string') {
      return json({ ok: false, error: 'Missing address' }, { status: 400 });
    }
    const btAction = action === 'bt-connect' ? 'connect' : 'disconnect';
    const result = bluetoothAction(btAction, address);
    return json(result, { status: result.ok ? 200 : 500 });
  }
  return json({ ok: false, error: 'Unknown action' }, { status: 400 });
};
