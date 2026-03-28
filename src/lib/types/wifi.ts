export interface WifiNetwork {
  ssid: string;
  bssid: string;
  channel: string;
  signal: number;
  security: string;
  isInsecure: boolean;
  noise?: number;
  snr?: number;
  phyMode?: string;
  channelWidth?: string;
  channelBand?: string;
  vendor?: string;
}

export interface CurrentConnection {
  ssid: string;
  bssid: string;
  channel: string;
  signal: number;
  ip: string;
  interface: string;
}
