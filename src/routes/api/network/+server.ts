import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import type { RequestHandler } from './$types';
import { execSync, exec, spawnSync } from 'child_process';
import os from 'os';
import net from 'net';
import { sanitizeShellArg, validateRequired } from '$lib/server/security';
import { lookupVendor } from '$lib/server/oui';
import { TRACEROUTE_MAX_HOPS, TRACEROUTE_TIMEOUT_MS } from '$lib/constants/limits';
import type { ArpEntry, TracerouteHop, InterfaceStats, SSLCertInfo, HttpInspection } from '$lib/types/network';

// ---- ARP table ----

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
function runTraceroute(target: string): { hops: TracerouteHop[]; raw: string } {
  const platform = os.platform();
  const cmd = platform === 'darwin' ? 'traceroute' : 'tracepath';
  try {
    const args =
      platform === 'darwin' ? ['-m', String(TRACEROUTE_MAX_HOPS), target] : ['-m', String(TRACEROUTE_MAX_HOPS), target];
    const result = spawnSync(cmd, args, { timeout: TRACEROUTE_TIMEOUT_MS, encoding: 'utf-8' });
    const output = (result.stdout || '') + (result.stderr || '');

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
  } catch (e: unknown) {
    return { hops: [], raw: errorMessage(e) || 'Traceroute failed' };
  }
}

// ---- Whois ----
function runWhois(target: string): string {
  try {
    const result = spawnSync('whois', [target], { timeout: 15000, encoding: 'utf-8' });
    return (result.stdout || '') + (result.stderr || '') || 'No whois data';
  } catch (e: unknown) {
    return errorMessage(e) || 'Whois lookup failed';
  }
}

// ---- Bandwidth stats ----
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
function inspectSSLCert(domain: string): SSLCertInfo | string {
  // Validate domain contains only safe characters (alphanumeric, dots, hyphens)
  if (!/^[a-zA-Z0-9.\-]+$/.test(domain)) return 'Invalid domain';
  try {
    // Use spawnSync for the first stage, pipe stdout to second
    const sClient = spawnSync('openssl', ['s_client', '-connect', `${domain}:443`, '-servername', domain], {
      timeout: 10000,
      encoding: 'utf-8',
      input: '', // equivalent to `echo |`
    });
    const certPem = sClient.stdout || '';
    const x509 = spawnSync('openssl', ['x509', '-noout', '-text', '-dates', '-subject', '-issuer', '-serial'], {
      timeout: 5000,
      encoding: 'utf-8',
      input: certPem,
    });
    const output = x509.stdout || '';

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
  } catch (e: unknown) {
    return `SSL inspection failed: ${errorMessage(e)}`;
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
  } catch (e: unknown) {
    return `HTTP inspection failed: ${errorMessage(e)}`;
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
