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
  collapsed?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { href: '/', label: 'Dashboard', desc: 'System overview', icon: 'home' },
      { href: '/files', label: 'Files', desc: 'Transfer & manage', icon: 'folder' },
      { href: '/terminal', label: 'Terminal', desc: 'Shell access', icon: 'terminal' },
      { href: '/processes', label: 'Processes', desc: 'System monitor', icon: 'cpu' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { href: '/diagnostics', label: 'Diagnostics', desc: 'Status, logs & notifications', icon: 'activity' },
      { href: '/infrastructure', label: 'Infrastructure', desc: 'Docker, services & databases', icon: 'server' },
      { href: '/apps', label: 'Apps', desc: 'Launch programs', icon: 'grid' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    items: [
      { href: '/network', label: 'Network Toolkit', desc: 'DNS, traceroute, ports & more', icon: 'globe' },
      { href: '/tailscale', label: 'Tailscale', desc: 'VPN network', icon: 'network' },
      { href: '/wifi', label: 'WiFi Scanner', desc: 'Network scan', icon: 'wifi' },
      { href: '/packets', label: 'Packets', desc: 'Packet sniffer', icon: 'radio' },
    ],
  },
  {
    id: 'devices',
    label: 'Devices',
    items: [
      { href: '/lights', label: 'Lights', desc: 'Smart lighting', icon: 'sun' },
      { href: '/peripherals', label: 'Peripherals', desc: 'WiFi, Bluetooth, USB & more', icon: 'plug' },
    ],
  },
  {
    id: 'productivity',
    label: 'Productivity',
    items: [
      { href: '/notes', label: 'Notes', desc: 'Block editor', icon: 'file-text' },
      { href: '/kanban', label: 'Kanban', desc: 'Project board', icon: 'kanban' },
      { href: '/keeper', label: 'Keeper', desc: 'Feature tracker', icon: 'bookmark' },
      { href: '/bookmarks', label: 'Bookmarks', desc: 'Link manager', icon: 'link' },
      { href: '/messages', label: 'Messages', desc: 'iMessage reader', icon: 'message' },
      { href: '/reminders', label: 'Reminders', desc: 'Timed alerts', icon: 'bell' },
      { href: '/activity', label: 'Activity', desc: 'Cross-module event feed', icon: 'activity' },
    ],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    items: [
      { href: '/tools', label: 'Tools', desc: 'QR, clipboard, speed test & more', icon: 'sliders' },
      { href: '/backups', label: 'Backups', desc: 'Data protection', icon: 'rotate' },
      { href: '/tasks', label: 'Tasks', desc: 'Scheduled automation', icon: 'clock' },
    ],
  },
  {
    id: 'developer',
    label: 'Developer',
    collapsed: true,
    items: [{ href: '/developer', label: 'Dev Tools', desc: 'Shortcuts, internals & docs', icon: 'code' }],
  },
];
