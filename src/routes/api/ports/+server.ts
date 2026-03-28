import { json } from '@sveltejs/kit';
import net from 'node:net';
import type { RequestHandler } from './$types';
import {
  PORT_SCAN_MAX_RANGE,
  PORT_SCAN_LARGE_CAP,
  PORT_SCAN_CONCURRENCY,
  PORT_SCAN_TIMEOUT_MS,
  PORT_SCAN_FULL_CONCURRENCY,
  PORT_SCAN_FULL_TIMEOUT_MS,
} from '$lib/constants/limits';

const COMMON_SERVICES: Record<number, string> = {
  20: 'FTP Data',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  67: 'DHCP Server',
  68: 'DHCP Client',
  69: 'TFTP',
  80: 'HTTP',
  88: 'Kerberos',
  110: 'POP3',
  111: 'RPCBind',
  119: 'NNTP',
  123: 'NTP',
  135: 'MS RPC',
  137: 'NetBIOS Name',
  138: 'NetBIOS Datagram',
  139: 'NetBIOS Session',
  143: 'IMAP',
  161: 'SNMP',
  389: 'LDAP',
  443: 'HTTPS',
  445: 'SMB',
  465: 'SMTPS',
  514: 'Syslog',
  515: 'LPD',
  587: 'SMTP (submission)',
  631: 'IPP/CUPS',
  636: 'LDAPS',
  873: 'rsync',
  993: 'IMAPS',
  995: 'POP3S',
  1080: 'SOCKS',
  1433: 'MSSQL',
  1521: 'Oracle DB',
  1883: 'MQTT',
  2049: 'NFS',
  2181: 'ZooKeeper',
  3000: 'Dev Server',
  3306: 'MySQL',
  3389: 'RDP',
  4443: 'HTTPS Alt',
  5000: 'Flask/Docker Registry',
  5173: 'Vite Dev',
  5432: 'PostgreSQL',
  5555: 'Home Server',
  5672: 'AMQP/RabbitMQ',
  5900: 'VNC',
  6379: 'Redis',
  6443: 'Kubernetes API',
  8080: 'HTTP Proxy',
  8443: 'HTTPS Alt',
  8883: 'MQTT TLS',
  9090: 'Prometheus',
  9200: 'Elasticsearch',
  9418: 'Git',
  11211: 'Memcached',
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

  if (preset === 'all') {
    // Full scan 1-65535 — use streaming response
    const concurrency = PORT_SCAN_FULL_CONCURRENCY;
    const timeout = PORT_SCAN_FULL_TIMEOUT_MS;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let openCount = 0;
        const total = 65535;
        for (let batch = 1; batch <= total; batch += concurrency) {
          const end = Math.min(batch + concurrency - 1, total);
          const ports = Array.from({ length: end - batch + 1 }, (_, i) => batch + i);
          const batchResults = await Promise.all(
            ports.map(async (port) => {
              const open = await scanPort(host, port, timeout);
              return { port, open, service: COMMON_SERVICES[port] || '' };
            }),
          );
          for (const r of batchResults) {
            if (r.open) {
              openCount++;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(r)}\n\n`));
            }
          }
          // Send progress every batch
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ _progress: true, scanned: end, total, open: openCount })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ _done: true, total, open: openCount })}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } else if (preset === 'common') {
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
        const actualEnd = Math.min(end, start + PORT_SCAN_MAX_RANGE);
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

  // For "all" mode, allow up to 65535 but use streaming via GET
  const isLargeRange = portsToScan.length > PORT_SCAN_LARGE_CAP;
  if (isLargeRange && body.preset !== 'all') {
    portsToScan = portsToScan.slice(0, PORT_SCAN_LARGE_CAP);
  }

  // Scan with limited concurrency
  const concurrency = PORT_SCAN_CONCURRENCY;
  const results: { port: number; open: boolean; service: string }[] = [];
  const batches = [];

  for (let i = 0; i < portsToScan.length; i += concurrency) {
    batches.push(portsToScan.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (port) => {
        const open = await scanPort(host, port, PORT_SCAN_TIMEOUT_MS);
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
