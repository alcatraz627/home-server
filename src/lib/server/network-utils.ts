import os from 'node:os';

/**
 * Detect the primary network interface name.
 * Returns 'en0' on macOS, 'eth0'/'wlan0' on Linux, or the first non-internal IPv4 interface.
 */
export function getPrimaryInterface(): string {
  const interfaces = os.networkInterfaces();
  const platform = os.platform();

  // Priority list by platform
  const priorities =
    platform === 'darwin' ? ['en0', 'en1', 'en2', 'en3'] : ['eth0', 'wlan0', 'enp0s3', 'ens33', 'ens160', 'wlp2s0'];

  // Check priority interfaces first
  for (const name of priorities) {
    const addrs = interfaces[name];
    if (addrs?.some((a) => a.family === 'IPv4' && !a.internal)) {
      return name;
    }
  }

  // Fallback: find any non-internal IPv4 interface
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (addrs?.some((a) => a.family === 'IPv4' && !a.internal)) {
      return name;
    }
  }

  return platform === 'darwin' ? 'en0' : 'eth0';
}

/**
 * Get the local IPv4 address of the primary interface.
 */
export function getLocalIp(): string {
  const iface = getPrimaryInterface();
  const addrs = os.networkInterfaces()[iface];
  if (addrs) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }

  // Fallback: search all interfaces
  for (const addrs of Object.values(os.networkInterfaces())) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }

  return '0.0.0.0';
}
