import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import { execSync, spawnSync } from 'node:child_process';
import type { RequestHandler } from './$types';
import { sanitizeShellArg, isCommandAvailable } from '$lib/server/security';

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
    } else {
      // Linux: use bluetoothctl
      const raw = execSync('bluetoothctl devices 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 10000,
      });
      const devices: BluetoothDevice[] = [];
      for (const line of raw.split('\n').filter((l) => l.trim())) {
        // Format: Device AA:BB:CC:DD:EE:FF Device Name
        const m = line.match(/^Device\s+([\dA-Fa-f:]+)\s+(.+)/);
        if (!m) continue;
        const address = m[1];
        const name = m[2].trim();
        // Check if connected via bluetoothctl info
        let connected = false;
        let type = 'Unknown';
        let batteryLevel: number | null = null;
        try {
          const safeAddr = sanitizeShellArg(address);
          const btResult = spawnSync('bluetoothctl', ['info', safeAddr], {
            encoding: 'utf-8',
            timeout: 5000,
          });
          const info = btResult.stdout || '';
          connected = /Connected:\s*yes/i.test(info);
          const iconMatch = info.match(/Icon:\s*(.+)/);
          if (iconMatch) type = iconMatch[1].trim();
          const battMatch = info.match(/Battery Percentage:.*\((\d+)\)/);
          if (battMatch) batteryLevel = parseInt(battMatch[1]);
        } catch {}
        devices.push({ name, address, connected, type, batteryLevel });
      }
      return devices;
    }
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
    } else {
      // Linux: use lsusb
      const raw = execSync('lsusb 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 10000,
      });
      const devices: USBDevice[] = [];
      for (const line of raw.split('\n').filter((l) => l.trim())) {
        // Format: Bus 001 Device 003: ID 046d:c52b Logitech, Inc. Unifying Receiver
        const m = line.match(/^Bus\s+(\d+)\s+Device\s+(\d+):\s+ID\s+(\S+)\s+(.*)/);
        if (!m) continue;
        const bus = m[1];
        const port = m[2];
        const vendorId = m[3];
        const nameStr = m[4].trim();
        // Split vendor and device name (vendor is before first device name)
        const parts = nameStr.split(/\s+/);
        const vendor = parts.length > 1 ? parts.slice(0, -1).join(' ') : vendorId;
        const name = parts.length > 0 ? nameStr : 'Unknown';
        devices.push({
          name,
          vendor,
          serial: '',
          speed: '',
          bus: `Bus ${bus}`,
          port: `Device ${port}`,
        });
      }
      return devices;
    }
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
  const devices: AudioDevice[] = [];
  try {
    if (isMac) {
      const raw = execSync('system_profiler SPAudioDataType -json 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 15000,
      });
      const data = JSON.parse(raw);
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
    } else {
      // Linux: try pactl (PulseAudio/PipeWire) then aplay (ALSA)
      try {
        const raw = execSync('pactl list sinks short 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        for (const line of raw.trim().split('\n').filter(Boolean)) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            devices.push({ name: parts[1], type: 'output', sampleRate: '' });
          }
        }
        const sources = execSync('pactl list sources short 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        for (const line of sources.trim().split('\n').filter(Boolean)) {
          const parts = line.split('\t');
          if (parts.length >= 2 && !parts[1].includes('.monitor')) {
            devices.push({ name: parts[1], type: 'input', sampleRate: '' });
          }
        }
      } catch {
        // Fallback: ALSA
        try {
          const raw = execSync('aplay -l 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
          for (const line of raw.split('\n')) {
            const m = line.match(/^card \d+: (.+?) \[(.+?)\]/);
            if (m) devices.push({ name: m[2], type: 'output', sampleRate: '' });
          }
        } catch {}
        try {
          const raw = execSync('arecord -l 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
          for (const line of raw.split('\n')) {
            const m = line.match(/^card \d+: (.+?) \[(.+?)\]/);
            if (m) devices.push({ name: m[2], type: 'input', sampleRate: '' });
          }
        } catch {}
      }
      return devices;
    }
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
    } else {
      // Linux: /sys/class/power_supply/BAT*
      const fs = require('fs');
      const batDirs = [
        '/sys/class/power_supply/BAT0',
        '/sys/class/power_supply/BAT1',
        '/sys/class/power_supply/battery',
      ];
      for (const batDir of batDirs) {
        if (fs.existsSync(batDir)) {
          const readFile = (name: string) => {
            try {
              return fs.readFileSync(`${batDir}/${name}`, 'utf-8').trim();
            } catch {
              return '';
            }
          };
          const capacity = parseInt(readFile('capacity'), 10);
          const status = readFile('status'); // Charging, Discharging, Full, Not charging
          if (!isNaN(capacity)) {
            return {
              percentage: capacity,
              charging: status === 'Charging' || status === 'Full',
              timeRemaining: status === 'Full' ? 'Full' : status || 'Unknown',
              cycleCount: parseInt(readFile('cycle_count'), 10) || null,
            };
          }
        }
      }
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
    } else {
      // Linux: use nmcli to get current WiFi connection
      const raw = execSync('nmcli -t -f ACTIVE,SSID,SIGNAL dev wifi 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const active = raw.split('\n').find((l) => l.startsWith('yes:'));
      if (active) {
        const parts = active.split(':');
        const ssid = parts[1] || '';
        const signal = parseInt(parts[2] || '0');
        // nmcli signal is 0-100%, convert to approximate dBm (-30 to -90)
        const rssi = signal > 0 ? Math.round(-30 - (100 - signal) * 0.6) : 0;
        return { ssid, rssi };
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
  const displays: DisplayInfo[] = [];
  try {
    if (isMac) {
      const raw = execSync('system_profiler SPDisplaysDataType -json 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 15000,
      });
      const data = JSON.parse(raw);
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
    } else {
      // Linux: xrandr
      try {
        const raw = execSync('xrandr --current 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        let currentDisplay = '';
        for (const line of raw.split('\n')) {
          const connMatch = line.match(/^(\S+)\s+connected\s+(primary\s+)?(\d+x\d+)/);
          if (connMatch) {
            currentDisplay = connMatch[1];
            const resMatch = line.match(/(\d+x\d+)\+\d+\+\d+/);
            const rateMatch = line.match(/([\d.]+)\*/);
            displays.push({
              name: currentDisplay,
              resolution: resMatch?.[1] || connMatch[3],
              refreshRate: rateMatch ? `${rateMatch[1]} Hz` : '',
              gpu: '',
              builtIn: currentDisplay.toLowerCase().includes('edp') || currentDisplay.toLowerCase().includes('lvds'),
            });
          }
        }
      } catch {}
      return displays;
    }
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
  const interfaces: NetworkInterface[] = [];
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
    } else {
      // Linux: ip link show + ip addr
      try {
        const raw = execSync('ip -o link show 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        const addrRaw = execSync('ip -o -4 addr show 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });

        // Build IP map
        const ipMap = new Map<string, string>();
        for (const line of addrRaw.split('\n').filter(Boolean)) {
          const m = line.match(/^\d+:\s+(\S+)\s+.*inet\s+(\d+\.\d+\.\d+\.\d+)/);
          if (m) ipMap.set(m[1], m[2]);
        }

        for (const line of raw.split('\n').filter(Boolean)) {
          const m = line.match(/^\d+:\s+(\S+?)(?:@\S+)?:\s+<([^>]*)>.*link\/\w+\s+([\da-f:]+)/);
          if (m) {
            const dev = m[1];
            const flags = m[2];
            const mac = m[3];
            if (dev === 'lo') continue;
            interfaces.push({
              port: dev,
              device: dev,
              mac: mac || 'N/A',
              ip: ipMap.get(dev) || '',
              status: flags.includes('UP') ? 'active' : 'inactive',
            });
          }
        }
      } catch {}
      return interfaces;
    }
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
    } else {
      // Linux: use lscpu, /etc/os-release, free -b
      let cpuBrand = 'Unknown';
      let cpuCores = 0;
      let cpuThreads = 0;
      try {
        const lscpu = execSync('lscpu 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        const modelMatch = lscpu.match(/Model name:\s*(.*)/);
        if (modelMatch) cpuBrand = modelMatch[1].trim();
        const coreMatch = lscpu.match(/Core\(s\) per socket:\s*(\d+)/);
        const socketMatch = lscpu.match(/Socket\(s\):\s*(\d+)/);
        if (coreMatch && socketMatch) cpuCores = parseInt(coreMatch[1]) * parseInt(socketMatch[1]);
        const threadMatch = lscpu.match(/CPU\(s\):\s*(\d+)/);
        if (threadMatch) cpuThreads = parseInt(threadMatch[1]);
      } catch {}

      let ram = 'Unknown';
      try {
        const freeOut = execSync('free -b 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        const memMatch = freeOut.match(/Mem:\s+(\d+)/);
        if (memMatch) {
          const bytes = parseInt(memMatch[1]);
          const gb = (bytes / (1024 * 1024 * 1024)).toFixed(1);
          ram = `${gb} GB`;
        }
      } catch {}

      let osVersion = '';
      let model = 'Linux';
      try {
        const osRelease = execSync('cat /etc/os-release 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
        const prettyMatch = osRelease.match(/PRETTY_NAME="?([^"\n]+)"?/);
        if (prettyMatch) osVersion = prettyMatch[1];
        // Try to detect model (Pi, etc.)
        try {
          const dmModel = execSync('cat /sys/firmware/devicetree/base/model 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 3000,
          })
            .replace(/\0/g, '')
            .trim();
          if (dmModel) model = dmModel;
        } catch {
          try {
            const prodName = execSync('cat /sys/class/dmi/id/product_name 2>/dev/null', {
              encoding: 'utf-8',
              timeout: 3000,
            }).trim();
            if (prodName) model = prodName;
          } catch {}
        }
      } catch {}

      let serial = 'Unknown';
      try {
        const serialOut = execSync('cat /sys/class/dmi/id/product_serial 2>/dev/null', {
          encoding: 'utf-8',
          timeout: 3000,
        }).trim();
        if (serialOut) serial = serialOut;
      } catch {}

      return {
        cpuBrand,
        cpuCores,
        cpuThreads,
        ram,
        macosVersion: osVersion,
        serial,
        model,
      };
    }
  } catch {
    return null;
  }
}

// --- Bluetooth connect/disconnect ---

function bluetoothAction(action: 'connect' | 'disconnect', address: string): { ok: boolean; error?: string } {
  // Validate MAC address format to prevent injection
  const safeAddress = sanitizeShellArg(address);
  if (!/^[\dA-Fa-f]{2}([:-][\dA-Fa-f]{2}){5}$/.test(safeAddress)) {
    return { ok: false, error: 'Invalid Bluetooth MAC address format' };
  }

  try {
    if (isMac) {
      if (!isCommandAvailable('blueutil')) {
        return {
          ok: false,
          error: 'blueutil not found. Install it with: brew install blueutil',
        };
      }
      const flag = action === 'connect' ? '--connect' : '--disconnect';
      spawnSync('blueutil', [flag, safeAddress], {
        encoding: 'utf-8',
        timeout: 15000,
      });
      return { ok: true };
    } else {
      // Linux: use bluetoothctl
      if (!isCommandAvailable('bluetoothctl')) {
        return {
          ok: false,
          error: 'bluetoothctl not found. Install bluez: sudo apt install bluez',
        };
      }
      spawnSync('bluetoothctl', [action, safeAddress], {
        encoding: 'utf-8',
        timeout: 15000,
      });
      return { ok: true };
    }
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e) || `Failed to ${action}` };
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
