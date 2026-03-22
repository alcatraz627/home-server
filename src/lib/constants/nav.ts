export interface NavItem {
  href: string;
  label: string;
  desc: string;
  icon: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { href: '/', label: 'Dashboard', desc: 'System overview', icon: '◆' },
      { href: '/files', label: 'Files', desc: 'Transfer & manage', icon: '◫' },
      { href: '/processes', label: 'Processes', desc: 'System monitor', icon: '▦' },
      { href: '/terminal', label: 'Terminal', desc: 'Shell access', icon: '▶' },
    ],
  },
  {
    id: 'smart-home',
    label: 'Smart Home',
    items: [
      { href: '/lights', label: 'Lights', desc: 'Smart home', icon: '◉' },
      { href: '/peripherals', label: 'Peripherals', desc: 'WiFi & Bluetooth', icon: '⊙' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    items: [
      { href: '/tailscale', label: 'Tailscale', desc: 'VPN network', icon: '⬡' },
      { href: '/wifi', label: 'WiFi Scanner', desc: 'Network scan', icon: '⊚' },
      { href: '/packets', label: 'Packets', desc: 'Packet sniffer', icon: '⊝' },
      { href: '/network', label: 'Network Tools', desc: 'Net toolkit', icon: '⊙' },
      { href: '/wol', label: 'Wake-on-LAN', desc: 'Wake devices', icon: '⊕' },
      { href: '/dns', label: 'DNS Lookup', desc: 'Domain resolver', icon: '⊘' },
      { href: '/ports', label: 'Port Scanner', desc: 'Scan ports', icon: '⊗' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { href: '/tasks', label: 'Tasks', desc: 'Automation', icon: '⚙' },
      { href: '/backups', label: 'Backups', desc: 'Data protection', icon: '⟲' },
      { href: '/keeper', label: 'Keeper', desc: 'Feature tracker', icon: '◈' },
      { href: '/bookmarks', label: 'Bookmarks', desc: 'Link manager', icon: '⊡' },
      { href: '/kanban', label: 'Kanban', desc: 'Project board', icon: '▥' },
      { href: '/apps', label: 'Apps', desc: 'Launch programs', icon: '⊞' },
      { href: '/qr', label: 'QR Code', desc: 'Generate QR codes', icon: '⊞' },
      { href: '/speedtest', label: 'Speed Test', desc: 'Bandwidth test', icon: '⊛' },
      { href: '/clipboard', label: 'Clipboard', desc: 'Sync clipboard', icon: '⊟' },
      { href: '/screenshots', label: 'Screenshots', desc: 'Screen gallery', icon: '⊠' },
      { href: '/benchmarks', label: 'Benchmarks', desc: 'System bench', icon: '⊜' },
    ],
  },
  {
    id: 'info',
    label: 'Info',
    items: [
      { href: '/docs', label: 'Docs', desc: 'Documentation', icon: '◧' },
      { href: '/showcase', label: 'Showcase', desc: 'Design system', icon: '◎' },
    ],
  },
];
