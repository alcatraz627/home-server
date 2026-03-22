import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execSync, exec } from 'child_process';
import os from 'os';
import net from 'net';
import { sanitizeShellArg, validateRequired } from '$lib/server/security';

// ---- OUI vendor lookup (common prefixes) ----
const OUI_MAP: Record<string, string> = {
  '00:50:56': 'VMware',
  '00:0c:29': 'VMware',
  '00:1a:11': 'Google',
  '3c:5a:b4': 'Google',
  'f4:f5:d8': 'Google',
  '00:17:88': 'Philips Hue',
  'ec:b5:fa': 'Philips Hue',
  'b8:27:eb': 'Raspberry Pi',
  'dc:a6:32': 'Raspberry Pi',
  'e4:5f:01': 'Raspberry Pi',
  'd8:3a:dd': 'Raspberry Pi',
  '2c:cf:67': 'Raspberry Pi',
  'ac:de:48': 'Apple',
  '00:1c:b3': 'Apple',
  'a4:83:e7': 'Apple',
  '14:98:77': 'Apple',
  '3c:22:fb': 'Apple',
  '6c:96:cf': 'Apple',
  '78:7b:8a': 'Apple',
  '88:66:a5': 'Apple',
  'a8:51:ab': 'Apple',
  'f0:18:98': 'Apple',
  '7c:d1:c3': 'Apple',
  'bc:d0:74': 'Apple',
  '44:2a:60': 'Apple',
  'a0:99:9b': 'Apple',
  'a8:20:66': 'Apple',
  '00:25:00': 'Apple',
  'f8:ff:c2': 'Apple',
  'b0:be:83': 'Apple',
  '20:ee:28': 'Apple',
  'c8:89:f3': 'Apple',
  '50:ed:3c': 'Apple',
  '48:d7:05': 'Apple',
  'fc:fc:48': 'Apple',
  'b8:e8:56': 'Apple',
  'a4:5e:60': 'Apple',
  '34:36:3b': 'Apple',
  '18:65:90': 'Apple',
  '84:38:35': 'Apple',
  '8c:85:90': 'Apple',
  '00:16:cb': 'Apple',
  '00:03:93': 'Apple',
  '38:f9:d3': 'Apple',
  'c0:b6:58': 'Apple',
  '04:f7:e4': 'Apple',
  'c8:69:cd': 'Apple',
  '00:1e:c2': 'Apple',
  '54:26:96': 'Apple',
  'c4:2a:d0': 'Apple',
  '9c:f3:87': 'Apple',
  '00:1b:63': 'Apple',
  '00:23:12': 'Apple',
  '30:35:ad': 'Apple',
  '18:af:61': 'Apple',
  'a4:b1:97': 'Apple',
  '00:11:24': 'Apple',
  'fc:e9:98': 'Apple',
  '3c:06:30': 'Apple',
  '70:3e:ac': 'Apple',
  '74:da:38': 'Edimax',
  'b0:6e:bf': 'TP-Link',
  '50:c7:bf': 'TP-Link',
  '60:e3:27': 'TP-Link',
  'c0:25:e9': 'TP-Link',
  '00:1f:1f': 'Edimax',
  'f0:9f:c2': 'Ubiquiti',
  '68:d7:9a': 'Ubiquiti',
  '24:5a:4c': 'Ubiquiti',
  '04:18:d6': 'Ubiquiti',
  '78:8a:20': 'Ubiquiti',
  '44:d9:e7': 'Ubiquiti',
  'b4:fb:e4': 'Ubiquiti',
  'fc:ec:da': 'Ubiquiti',
  '18:e8:29': 'Ubiquiti',
  '74:83:c2': 'Ubiquiti',
  'ac:8b:a9': 'Ubiquiti',
  '00:27:22': 'Ubiquiti',
  '00:15:6d': 'Ubiquiti',
  '80:2a:a8': 'Ubiquiti',
  '00:26:5a': 'D-Link',
  '1c:7e:e5': 'D-Link',
  'c8:d3:a3': 'D-Link',
  '00:1e:58': 'D-Link',
  '28:10:7b': 'D-Link',
  '1c:bd:b9': 'D-Link',
  'c4:a8:1d': 'D-Link',
  'e8:de:27': 'TP-Link',
  '10:27:f5': 'TP-Link',
  '08:00:27': 'VirtualBox',
  'aa:bb:cc': 'Private',
  '00:1a:2b': 'Ayecom',
  'b4:75:0e': 'Belkin',
  '94:10:3e': 'Belkin',
  'ec:1a:59': 'Belkin',
  '00:1c:df': 'Belkin',
  '08:86:3b': 'Belkin',
  'c4:41:1e': 'Belkin',
  '30:23:03': 'Belkin',
  '58:ef:68': 'Belkin',
  '00:24:e4': 'Withings',
  '30:b4:9e': 'TP-Link',
  '48:22:54': 'TP-Link',
  '54:c8:0f': 'TP-Link',
  'e8:94:f6': 'TP-Link',
  '6c:5a:b5': 'TP-Link',
  'cc:32:e5': 'TP-Link',
  '14:cc:20': 'TP-Link',
  '98:da:c4': 'TP-Link',
  '00:23:cd': 'TP-Link',
  'f4:ec:38': 'TP-Link',
  'a0:f3:c1': 'TP-Link',
  '30:b5:c2': 'TP-Link',
  '18:a6:f7': 'TP-Link',
  'ac:84:c6': 'TP-Link',
  '64:70:02': 'TP-Link',
  '90:f6:52': 'TP-Link',
  'd8:0d:17': 'TP-Link',
  '5c:e9:31': 'TP-Link',
  '00:24:01': 'D-Link',
  '00:26:b8': 'Actiontec',
  'a0:63:91': 'Netgear',
  '20:0c:c8': 'Netgear',
  '28:c6:8e': 'Netgear',
  '30:46:9a': 'Netgear',
  '4c:60:de': 'Netgear',
  '6c:b0:ce': 'Netgear',
  '84:1b:5e': 'Netgear',
  'a4:2b:8c': 'Netgear',
  'b0:7f:b9': 'Netgear',
  'c4:3d:c7': 'Netgear',
  'c8:9e:43': 'Netgear',
  'e0:46:9a': 'Netgear',
  '00:14:6c': 'Netgear',
  '00:1b:2f': 'Netgear',
  '00:1e:2a': 'Netgear',
  '00:1f:33': 'Netgear',
  '00:22:3f': 'Netgear',
  '00:24:b2': 'Netgear',
  '00:26:f2': 'Netgear',
  '20:4e:7f': 'Netgear',
  '2c:b0:5d': 'Netgear',
  '44:94:fc': 'Netgear',
  '00:50:f2': 'Microsoft',
  '60:45:bd': 'Microsoft',
  '28:18:78': 'Microsoft',
  '7c:1e:52': 'Microsoft',
  '98:5f:d3': 'Microsoft',
  'c8:3f:26': 'Microsoft',
  '00:0d:3a': 'Microsoft',
  '00:12:5a': 'Microsoft',
  '00:15:5d': 'Microsoft',
  '00:17:fa': 'Microsoft',
  '00:1d:d8': 'Microsoft',
  '00:22:48': 'Microsoft',
  '00:25:ae': 'Microsoft',
  'b8:31:b5': 'Microsoft',
  '7c:ed:8d': 'Microsoft',
  '58:82:a8': 'Microsoft',
  '28:cd:c1': 'Raspberry Pi',
  '70:b3:d5': 'IEEE',
  'b8:f0:09': 'Amazon',
  '18:74:2e': 'Amazon',
  '40:b4:cd': 'Amazon',
  '44:65:0d': 'Amazon',
  '68:37:e9': 'Amazon',
  '74:75:48': 'Amazon',
  '84:d6:d0': 'Amazon',
  'a0:02:dc': 'Amazon',
  'ac:63:be': 'Amazon',
  'f0:27:2d': 'Amazon',
  'fc:65:de': 'Amazon',
  '00:fc:8b': 'Amazon',
  '0c:47:c9': 'Amazon',
  '34:d2:70': 'Amazon',
  '38:f7:3d': 'Amazon',
  '4c:ef:c0': 'Amazon',
  '50:dc:e7': 'Amazon',
  'cc:f7:35': 'Amazon',
  '34:7e:5c': 'Samsung',
  '00:1a:8a': 'Samsung',
  '00:21:19': 'Samsung',
  '00:23:39': 'Samsung',
  '00:26:37': 'Samsung',
  '08:08:c2': 'Samsung',
  '10:d5:42': 'Samsung',
  '14:49:e0': 'Samsung',
  '18:3a:2d': 'Samsung',
  '1c:5a:3e': 'Samsung',
  '24:4b:03': 'Samsung',
  '28:98:7b': 'Samsung',
  '2c:ae:2b': 'Samsung',
  '30:cd:a7': 'Samsung',
  '34:23:ba': 'Samsung',
  '38:01:46': 'Samsung',
  '3c:62:00': 'Samsung',
  '40:16:3b': 'Samsung',
  '44:6d:6c': 'Samsung',
  '4c:bc:98': 'Samsung',
  '50:01:bb': 'Samsung',
  '54:92:be': 'Samsung',
  '58:c3:8b': 'Samsung',
  '5c:2e:59': 'Samsung',
  '5c:f7:e6': 'Samsung',
  '60:af:6d': 'Samsung',
  '64:b5:c6': 'Samsung',
  '6c:2f:2c': 'Samsung',
  '70:f9:27': 'Samsung',
  '78:ab:bb': 'Samsung',
  '7c:0a:3f': 'Samsung',
  '80:18:a7': 'Samsung',
  '84:25:db': 'Samsung',
  '88:32:9b': 'Samsung',
  '8c:71:f8': 'Samsung',
  '90:18:7c': 'Samsung',
  '94:01:c2': 'Samsung',
  '98:0c:82': 'Samsung',
  '9c:e6:e7': 'Samsung',
  'a0:82:1f': 'Samsung',
  'a8:06:00': 'Samsung',
  'ac:5f:3e': 'Samsung',
  'b4:07:f9': 'Samsung',
  'b4:79:a7': 'Samsung',
  'b8:c6:8e': 'Samsung',
  'bc:44:86': 'Samsung',
  'c0:97:27': 'Samsung',
  'c4:73:1e': 'Samsung',
  'cc:07:ab': 'Samsung',
  'd0:22:be': 'Samsung',
  'd0:87:e2': 'Samsung',
  'd4:87:d8': 'Samsung',
  'e4:7c:f9': 'Samsung',
  'e8:50:8b': 'Samsung',
  'ec:1f:72': 'Samsung',
  'f0:25:b7': 'Samsung',
  'f4:42:8f': 'Samsung',
  'f8:04:2e': 'Samsung',
  'fc:a1:3e': 'Samsung',
  '64:a2:f9': 'OnePlus',
  '94:65:2d': 'OnePlus',
  'c0:ee:fb': 'OnePlus',
};

function lookupVendor(mac: string): string {
  const prefix = mac.toLowerCase().substring(0, 8);
  return OUI_MAP[prefix] || '';
}

// ---- ARP table ----
interface ArpEntry {
  ip: string;
  mac: string;
  interface: string;
  vendor: string;
}

function parseArpTable(): ArpEntry[] {
  try {
    const output = execSync('arp -a 2>/dev/null', { timeout: 5000 }).toString();
    const entries: ArpEntry[] = [];
    for (const line of output.split('\n')) {
      // Format: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
      const m = line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([\da-f:]+)\s+on\s+(\S+)/i);
      if (m) {
        const mac = m[2];
        if (mac === '(incomplete)' || mac === 'ff:ff:ff:ff:ff:ff') continue;
        entries.push({
          ip: m[1],
          mac,
          interface: m[3],
          vendor: lookupVendor(mac),
        });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

// ---- Traceroute ----
interface TracerouteHop {
  hop: number;
  host: string;
  ip: string;
  rtt: string[];
}

function runTraceroute(target: string): { hops: TracerouteHop[]; raw: string } {
  const platform = os.platform();
  const cmd = platform === 'darwin' ? 'traceroute' : 'tracepath';
  const safeTarget = sanitizeShellArg(target);
  try {
    const output = execSync(`${cmd} -m 20 ${safeTarget} 2>&1`, { timeout: 30000 }).toString();

    const hops: TracerouteHop[] = [];
    for (const line of output.split('\n')) {
      // traceroute format: " 1  gateway (192.168.1.1)  1.234 ms  1.456 ms  1.789 ms"
      const m = line.match(/^\s*(\d+)\s+(.+)/);
      if (!m) continue;
      const hop = parseInt(m[1], 10);
      const rest = m[2];

      if (rest.trim() === '* * *') {
        hops.push({ hop, host: '*', ip: '*', rtt: ['*', '*', '*'] });
        continue;
      }

      const hostMatch = rest.match(/(\S+)\s+\((\d+\.\d+\.\d+\.\d+)\)/);
      const host = hostMatch?.[1] || rest.split(/\s+/)[0] || '*';
      const ip = hostMatch?.[2] || '';
      const rtts = [...rest.matchAll(/([\d.]+)\s*ms/g)].map((r) => `${r[1]} ms`);

      hops.push({ hop, host, ip, rtt: rtts.length ? rtts : ['*'] });
    }

    return { hops, raw: output };
  } catch (e: any) {
    return { hops: [], raw: e.message || 'Traceroute failed' };
  }
}

// ---- Whois ----
function runWhois(target: string): string {
  const safeTarget = sanitizeShellArg(target);
  try {
    return execSync(`whois ${safeTarget} 2>&1`, { timeout: 15000 }).toString();
  } catch (e: any) {
    return e.message || 'Whois lookup failed';
  }
}

// ---- Bandwidth stats ----
interface InterfaceStats {
  name: string;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

function getNetworkStats(): InterfaceStats[] {
  const platform = os.platform();
  const stats: InterfaceStats[] = [];

  try {
    if (platform === 'darwin') {
      const output = execSync('netstat -ib 2>/dev/null', { timeout: 5000 }).toString();
      const lines = output.trim().split('\n');
      // Header: Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/\s+/);
        if (parts.length < 11) continue;
        const name = parts[0];
        // Skip duplicates and link-local
        if (stats.some((s) => s.name === name)) continue;
        if (name.startsWith('utun') || name.startsWith('awdl') || name.startsWith('llw')) continue;
        const bytesIn = parseInt(parts[6], 10) || 0;
        const bytesOut = parseInt(parts[9], 10) || 0;
        const packetsIn = parseInt(parts[4], 10) || 0;
        const packetsOut = parseInt(parts[7], 10) || 0;
        if (bytesIn === 0 && bytesOut === 0) continue;
        stats.push({ name, bytesIn, bytesOut, packetsIn, packetsOut });
      }
    } else {
      const output = execSync('cat /proc/net/dev 2>/dev/null', { timeout: 3000 }).toString();
      const lines = output.trim().split('\n');
      for (let i = 2; i < lines.length; i++) {
        const m = lines[i].match(/^\s*(\S+):\s*(.*)/);
        if (!m) continue;
        const name = m[1];
        const nums = m[2].split(/\s+/).map(Number);
        stats.push({
          name,
          bytesIn: nums[0] || 0,
          packetsIn: nums[1] || 0,
          bytesOut: nums[8] || 0,
          packetsOut: nums[9] || 0,
        });
      }
    }
  } catch {}

  return stats;
}

// ---- SSL Certificate ----
interface SSLCertInfo {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  sans: string[];
  serial: string;
  signatureAlgo: string;
  isExpired: boolean;
  daysRemaining: number;
}

function inspectSSLCert(domain: string): SSLCertInfo | string {
  const safeDomain = sanitizeShellArg(domain);
  try {
    const output = execSync(
      `echo | openssl s_client -connect ${safeDomain}:443 -servername ${safeDomain} 2>/dev/null | openssl x509 -noout -text -dates -subject -issuer -serial 2>/dev/null`,
      { timeout: 10000 },
    ).toString();

    const subject = output.match(/subject=\s*(.*)/)?.[1]?.trim() || output.match(/Subject:\s*(.*)/)?.[1]?.trim() || '';
    const issuer = output.match(/issuer=\s*(.*)/)?.[1]?.trim() || output.match(/Issuer:\s*(.*)/)?.[1]?.trim() || '';
    const validFrom =
      output.match(/notBefore=(.*)/)?.[1]?.trim() || output.match(/Not Before:\s*(.*)/)?.[1]?.trim() || '';
    const validTo =
      output.match(/notAfter=(.*)/)?.[1]?.trim() || output.match(/Not After\s*:\s*(.*)/)?.[1]?.trim() || '';
    const serial =
      output.match(/serial=\s*(.*)/)?.[1]?.trim() ||
      output.match(/Serial Number:\s*\n?\s*([\da-f:]+)/i)?.[1]?.trim() ||
      '';
    const signatureAlgo = output.match(/Signature Algorithm:\s*(.*)/)?.[1]?.trim() || '';

    // SANs
    const sanBlock = output.match(/Subject Alternative Name:\s*\n\s*(.*)/)?.[1] || '';
    const sans = sanBlock
      .split(',')
      .map((s) => s.trim().replace(/^DNS:/, ''))
      .filter(Boolean);

    const expDate = new Date(validTo);
    const now = new Date();
    const daysRemaining = Math.floor((expDate.getTime() - now.getTime()) / 86400000);
    const isExpired = daysRemaining < 0;

    return { subject, issuer, validFrom, validTo, sans, serial, signatureAlgo, isExpired, daysRemaining };
  } catch (e: any) {
    return `SSL inspection failed: ${e.message}`;
  }
}

// ---- Ping sweep ----
function pingSweep(
  subnet: string,
  callback: (results: Array<{ ip: string; alive: boolean; time: number }>) => void,
): Promise<Array<{ ip: string; alive: boolean; time: number }>> {
  // Parse subnet like 192.168.1.0/24
  const m = subnet.match(/^(\d+\.\d+\.\d+)\.\d+\/(\d+)$/);
  if (!m) return Promise.resolve([]);

  const base = m[1];
  const cidr = parseInt(m[2], 10);
  if (cidr !== 24) return Promise.resolve([]); // only /24 for safety

  const results: Array<{ ip: string; alive: boolean; time: number }> = [];
  const promises: Promise<void>[] = [];

  for (let i = 1; i <= 254; i++) {
    const ip = `${base}.${i}`;
    promises.push(
      new Promise<void>((resolve) => {
        const start = Date.now();
        const socket = net.createConnection({ host: ip, port: 80, timeout: 1000 });
        socket.on('connect', () => {
          results.push({ ip, alive: true, time: Date.now() - start });
          socket.destroy();
          resolve();
        });
        socket.on('timeout', () => {
          // Try ping as fallback
          exec(`ping -c 1 -W 1 ${ip} 2>/dev/null`, (err, stdout) => {
            const alive = !err && stdout.includes('1 packets received');
            const timeMatch = stdout?.match(/time[=<](\d+\.?\d*)/);
            results.push({ ip, alive, time: alive ? parseFloat(timeMatch?.[1] || '0') : 0 });
            resolve();
          });
          socket.destroy();
        });
        socket.on('error', () => {
          // Port 80 failed, try ping
          exec(`ping -c 1 -W 1 ${ip} 2>/dev/null`, (err, stdout) => {
            const alive = !err && (stdout.includes('1 packets received') || stdout.includes('1 received'));
            const timeMatch = stdout?.match(/time[=<](\d+\.?\d*)/);
            results.push({ ip, alive, time: alive ? parseFloat(timeMatch?.[1] || '0') : 0 });
            resolve();
          });
          socket.destroy();
        });
      }),
    );
  }

  return Promise.all(promises).then(() =>
    results.sort((a, b) => {
      const aNum = parseInt(a.ip.split('.')[3], 10);
      const bNum = parseInt(b.ip.split('.')[3], 10);
      return aNum - bNum;
    }),
  );
}

// ---- HTTP Header Inspector ----
interface HttpInspection {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timing: {
    total: number;
  };
}

async function inspectHttpHeaders(url: string): Promise<HttpInspection | string> {
  try {
    const start = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    const total = Date.now() - start;

    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      headers[k] = v;
    });

    // Consume body to finish
    await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      timing: { total },
    };
  } catch (e: any) {
    return `HTTP inspection failed: ${e.message}`;
  }
}

export const GET: RequestHandler = async ({ url }) => {
  const tool = url.searchParams.get('tool');

  if (tool === 'arp') {
    return json({ entries: parseArpTable() });
  }

  if (tool === 'bandwidth') {
    return json({ stats: getNetworkStats() });
  }

  return json({ error: 'Unknown tool' }, { status: 400 });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { tool } = body;

  if (!tool || typeof tool !== 'string') {
    return json({ error: 'tool is required' }, { status: 400 });
  }

  if (tool === 'traceroute') {
    const target = sanitizeShellArg(body.target?.replace(/[^a-zA-Z0-9.\-:]/g, '') || '');
    if (!target) return json({ error: 'Target is required' }, { status: 400 });
    const result = runTraceroute(target);
    return json(result);
  }

  if (tool === 'whois') {
    const target = sanitizeShellArg(body.target?.replace(/[^a-zA-Z0-9.\-:]/g, '') || '');
    if (!target) return json({ error: 'Target is required' }, { status: 400 });
    const result = runWhois(target);
    return json({ result });
  }

  if (tool === 'ping-sweep') {
    const subnet = body.subnet?.replace(/[^0-9./]/g, '') || '';
    if (!subnet) return json({ error: 'Subnet is required' }, { status: 400 });
    const results = await pingSweep(subnet, () => {});
    return json({ results });
  }

  if (tool === 'ssl') {
    const domain = sanitizeShellArg(body.domain?.replace(/[^a-zA-Z0-9.\-]/g, '') || '');
    if (!domain) return json({ error: 'Domain is required' }, { status: 400 });
    const result = inspectSSLCert(domain);
    if (typeof result === 'string') return json({ error: result }, { status: 500 });
    return json({ cert: result });
  }

  if (tool === 'http-headers') {
    const targetUrl = body.url;
    if (!targetUrl || typeof targetUrl !== 'string') return json({ error: 'URL is required' }, { status: 400 });
    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      return json({ error: 'Invalid URL format' }, { status: 400 });
    }
    const result = await inspectHttpHeaders(targetUrl);
    if (typeof result === 'string') return json({ error: result }, { status: 500 });
    return json({ inspection: result });
  }

  return json({ error: 'Unknown tool' }, { status: 400 });
};
