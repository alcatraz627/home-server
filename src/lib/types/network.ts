export interface TracerouteHop {
  hop: number;
  host: string;
  ip: string;
  rtt: string[];
}

export interface ArpEntry {
  ip: string;
  mac: string;
  interface: string;
  vendor: string;
}

export interface SSLCertInfo {
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

export interface InterfaceStats {
  name: string;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

export interface HttpInspection {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timing: {
    total: number;
  };
}

export interface PingResult {
  ip: string;
  alive: boolean;
  time: number;
}

export interface BandwidthSample {
  timestamp: number;
  interfaces: Record<string, { bytesInPerSec: number; bytesOutPerSec: number }>;
}
