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
      { href: '/', label: 'Dashboard', desc: 'System overview', icon: 'home' },
      { href: '/files', label: 'Files', desc: 'Transfer & manage', icon: 'folder' },
      { href: '/processes', label: 'Processes', desc: 'System monitor', icon: 'cpu' },
      { href: '/terminal', label: 'Terminal', desc: 'Shell access', icon: 'terminal' },
    ],
  },
  {
    id: 'smart-home',
    label: 'Smart Home',
    items: [
      { href: '/lights', label: 'Lights', desc: 'Smart home', icon: 'sun' },
      { href: '/peripherals', label: 'Peripherals', desc: 'WiFi & Bluetooth', icon: 'plug' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    items: [
      { href: '/tailscale', label: 'Tailscale', desc: 'VPN network', icon: 'network' },
      { href: '/wifi', label: 'WiFi Scanner', desc: 'Network scan', icon: 'wifi' },
      { href: '/packets', label: 'Packets', desc: 'Packet sniffer', icon: 'packet' },
      { href: '/network', label: 'Network Tools', desc: 'Net toolkit', icon: 'globe' },
      { href: '/wol', label: 'Wake-on-LAN', desc: 'Wake devices', icon: 'wol' },
      { href: '/dns', label: 'DNS Lookup', desc: 'Domain resolver', icon: 'dns' },
      { href: '/ports', label: 'Port Scanner', desc: 'Scan ports', icon: 'port' },
      { href: '/dns-trace', label: 'DNS Trace', desc: 'Path trace', icon: 'dns' },
      { href: '/services', label: 'Services', desc: 'Health monitor', icon: 'activity' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { href: '/tasks', label: 'Tasks', desc: 'Automation', icon: 'settings' },
      { href: '/backups', label: 'Backups', desc: 'Data protection', icon: 'rotate' },
      { href: '/keeper', label: 'Keeper', desc: 'Feature tracker', icon: 'bookmark' },
      { href: '/bookmarks', label: 'Bookmarks', desc: 'Link manager', icon: 'link' },
      { href: '/notes', label: 'Notes', desc: 'Block editor', icon: 'file-text' },
      { href: '/kanban', label: 'Kanban', desc: 'Project board', icon: 'kanban' },
      { href: '/apps', label: 'Apps', desc: 'Launch programs', icon: 'grid' },
      { href: '/qr', label: 'QR Code', desc: 'Generate QR codes', icon: 'qr' },
      { href: '/speedtest', label: 'Speed Test', desc: 'Bandwidth test', icon: 'speed' },
      { href: '/clipboard', label: 'Clipboard', desc: 'Sync clipboard', icon: 'clipboard' },
      { href: '/screenshots', label: 'Screenshots', desc: 'Screen gallery', icon: 'screenshot' },
      { href: '/benchmarks', label: 'Benchmarks', desc: 'System bench', icon: 'benchmark' },
      { href: '/docker', label: 'Docker', desc: 'Containers', icon: 'docker' },
      { href: '/databases', label: 'Databases', desc: 'DB & services', icon: 'database' },
    ],
  },
  {
    id: 'info',
    label: 'Info',
    items: [
      { href: '/logs', label: 'Logs', desc: 'App diagnostics', icon: 'file-text' },
      { href: '/docs', label: 'Docs', desc: 'Documentation', icon: 'file-text' },
      { href: '/notifications', label: 'Notifications', desc: 'Alert center', icon: 'bell' },
      { href: '/showcase', label: 'Showcase', desc: 'Design system', icon: 'palette' },
    ],
  },
];
