import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn, execSync } from 'child_process';
import os from 'os';

interface PacketEntry {
  id: number;
  timestamp: string;
  source: string;
  destination: string;
  protocol: string;
  size: string;
  raw: string;
}

// In-memory capture state
let captureProcess: ReturnType<typeof spawn> | null = null;
let capturedPackets: PacketEntry[] = [];
let captureRunning = false;
let packetCounter = 0;

function getInterfaces(): string[] {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const output = execSync('ifconfig -l 2>/dev/null', { timeout: 3000 }).toString().trim();
      return output.split(/\s+/).filter((i) => !i.startsWith('utun') && !i.startsWith('awdl'));
    } else {
      const output = execSync("ip -o link show 2>/dev/null | awk -F': ' '{print $2}'", {
        timeout: 3000,
      }).toString();
      return output
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }
  } catch {
    return ['en0', 'eth0', 'lo0'];
  }
}

function parseTcpdumpLine(line: string): PacketEntry | null {
  // Typical tcpdump output:
  // 12:34:56.789012 IP 192.168.1.1.443 > 192.168.1.2.54321: Flags [P.], seq 1:100, ...length 99
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('tcpdump:') || trimmed.startsWith('listening')) return null;

  const tsMatch = trimmed.match(/^(\d{2}:\d{2}:\d{2}\.\d+)/);
  const timestamp = tsMatch?.[1] || '';

  // Try to extract protocol
  let protocol = 'OTHER';
  if (trimmed.includes(' IP ') || trimmed.includes(' IP6 ')) {
    protocol = trimmed.includes(' IP6 ') ? 'IPv6' : 'IP';
  }
  if (trimmed.includes(' ARP')) protocol = 'ARP';
  if (trimmed.includes(' ICMP')) protocol = 'ICMP';

  // Extract source > destination
  let source = '';
  let destination = '';
  const ipMatch = trimmed.match(/(?:IP|IP6)\s+(\S+)\s+>\s+(\S+?):/);
  if (ipMatch) {
    source = ipMatch[1];
    destination = ipMatch[2];
  } else {
    const arpMatch = trimmed.match(/ARP,\s+\w+\s+(\S+)\s+.*?(\d+\.\d+\.\d+\.\d+)/);
    if (arpMatch) {
      source = arpMatch[1];
      destination = arpMatch[2];
    }
  }

  // Extract length
  const lenMatch = trimmed.match(/length\s+(\d+)/);
  const size = lenMatch ? `${lenMatch[1]} B` : '';

  packetCounter++;
  return {
    id: packetCounter,
    timestamp,
    source,
    destination,
    protocol,
    size,
    raw: trimmed,
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action');

  if (action === 'interfaces') {
    return json({ interfaces: getInterfaces() });
  }

  if (action === 'status') {
    return json({
      running: captureRunning,
      packetCount: capturedPackets.length,
    });
  }

  if (action === 'packets') {
    const since = parseInt(url.searchParams.get('since') || '0', 10);
    const newPackets = capturedPackets.filter((p) => p.id > since);
    return json({
      packets: newPackets,
      running: captureRunning,
      total: capturedPackets.length,
    });
  }

  return json({ error: 'Unknown action' }, { status: 400 });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { action } = body;

  if (action === 'start') {
    if (captureRunning) {
      return json({ error: 'Capture already running' }, { status: 400 });
    }

    const iface = body.interface || 'en0';
    const filter = body.filter || '';
    const count = body.count || 100;

    // Reset
    capturedPackets = [];
    packetCounter = 0;
    captureRunning = true;

    const args = ['-l', '-n', '-i', iface, '-c', String(count)];
    if (filter) args.push(...filter.split(/\s+/));

    try {
      captureProcess = spawn('tcpdump', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      captureProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const entry = parseTcpdumpLine(line);
          if (entry) {
            capturedPackets.push(entry);
            // Keep last 2000 packets max
            if (capturedPackets.length > 2000) {
              capturedPackets = capturedPackets.slice(-1500);
            }
          }
        }
      });

      captureProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        // tcpdump prints info to stderr, skip those
        if (text && !text.startsWith('tcpdump:') && !text.startsWith('listening')) {
          const entry = parseTcpdumpLine(text);
          if (entry) capturedPackets.push(entry);
        }
      });

      captureProcess.on('close', () => {
        captureRunning = false;
        captureProcess = null;
      });

      captureProcess.on('error', (err) => {
        captureRunning = false;
        captureProcess = null;
      });

      return json({ success: true, message: `Capture started on ${iface}` });
    } catch (e: any) {
      captureRunning = false;
      return json({ error: `Failed to start capture: ${e.message}` }, { status: 500 });
    }
  }

  if (action === 'stop') {
    if (captureProcess) {
      captureProcess.kill('SIGTERM');
      captureProcess = null;
    }
    captureRunning = false;
    return json({ success: true, message: 'Capture stopped' });
  }

  if (action === 'clear') {
    capturedPackets = [];
    packetCounter = 0;
    return json({ success: true });
  }

  return json({ error: 'Unknown action' }, { status: 400 });
};
