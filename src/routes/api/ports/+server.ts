import { json } from '@sveltejs/kit';
import net from 'node:net';
import type { RequestHandler } from './$types';

const COMMON_SERVICES: Record<number, string> = {
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  465: 'SMTPS',
  587: 'SMTP (submission)',
  993: 'IMAPS',
  995: 'POP3S',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  5900: 'VNC',
  6379: 'Redis',
  8080: 'HTTP Proxy',
  8443: 'HTTPS Alt',
  27017: 'MongoDB',
};

const COMMON_PORTS = [
  21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 27017,
];

function scanPort(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { host, ports: portList, preset } = body;

  if (!host) {
    return json({ error: 'Host is required' }, { status: 400 });
  }

  let portsToScan: number[];

  if (preset === 'common') {
    portsToScan = COMMON_PORTS;
  } else if (portList) {
    // Parse range like "1-100" or comma-separated "80,443,8080"
    portsToScan = [];
    const parts = String(portList).split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number);
        if (isNaN(start) || isNaN(end) || start < 1 || end > 65535 || start > end) continue;
        // Limit range to 1024 ports
        const actualEnd = Math.min(end, start + 1023);
        for (let p = start; p <= actualEnd; p++) portsToScan.push(p);
      } else {
        const p = parseInt(trimmed);
        if (!isNaN(p) && p >= 1 && p <= 65535) portsToScan.push(p);
      }
    }
  } else {
    portsToScan = COMMON_PORTS;
  }

  if (portsToScan.length === 0) {
    return json({ error: 'No valid ports specified' }, { status: 400 });
  }

  // Limit to 1024 ports
  portsToScan = portsToScan.slice(0, 1024);

  // Scan with limited concurrency
  const concurrency = 20;
  const results: { port: number; open: boolean; service: string }[] = [];
  const batches = [];

  for (let i = 0; i < portsToScan.length; i += concurrency) {
    batches.push(portsToScan.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (port) => {
        const open = await scanPort(host, port, 1500);
        return { port, open, service: COMMON_SERVICES[port] || '' };
      }),
    );
    results.push(...batchResults);
  }

  results.sort((a, b) => a.port - b.port);

  return json({
    host,
    total: portsToScan.length,
    open: results.filter((r) => r.open).length,
    results,
  });
};
