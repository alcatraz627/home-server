import { execSync } from 'node:child_process';

export interface TailscaleDevice {
  hostname: string;
  ipv4: string;
  os: string;
  online: boolean;
  isSelf: boolean;
  exitNode: boolean;
  tags: string[];
}

const TAILSCALE_CLI =
  process.platform === 'darwin' ? '/Applications/Tailscale.app/Contents/MacOS/Tailscale' : 'tailscale';

export function getTailscaleStatus(): { devices: TailscaleDevice[]; error?: string } {
  try {
    const raw = execSync(`${TAILSCALE_CLI} status --json`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    const data = JSON.parse(raw);

    const devices: TailscaleDevice[] = [];

    // Self
    const self = data.Self;
    if (self) {
      devices.push(parsePeer(self, true));
    }

    // Peers
    const peers = data.Peer;
    if (peers && typeof peers === 'object') {
      for (const peer of Object.values(peers) as any[]) {
        devices.push(parsePeer(peer, false));
      }
    }

    return { devices };
  } catch (err: any) {
    return { devices: [], error: err.message || 'Failed to get Tailscale status' };
  }
}

function parsePeer(peer: any, isSelf: boolean): TailscaleDevice {
  const ips: string[] = peer.TailscaleIPs || [];
  return {
    hostname: (peer.HostName || peer.DNSName || 'unknown').replace(/\.$/, ''),
    ipv4: ips.find((ip: string) => !ip.includes(':')) || '',
    os: peer.OS || '',
    online: peer.Online ?? true,
    isSelf,
    exitNode: peer.ExitNode ?? false,
    tags: peer.Tags || [],
  };
}
