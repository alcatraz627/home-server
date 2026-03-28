export type { WifiNetwork, CurrentConnection } from './types/wifi';
export type { DockerContainer } from './types/docker';
export type {
  TracerouteHop,
  ArpEntry,
  SSLCertInfo,
  InterfaceStats,
  HttpInspection,
  PingResult,
  BandwidthSample,
} from './types/network';
export type {
  KanbanCard,
  KanbanColumn,
  KanbanPriority,
  ChecklistItem,
  Reminder,
  ReminderPriority,
  ReminderChannel,
  Recurrence,
  RecurrencePattern,
  ItemLink,
  LinkableModule,
  LinkedRef,
  Tag,
} from './types/productivity';

export interface DeviceInfo {
  hostname: string;
  platform: string;
  arch: string;
}

export interface Widget {
  id: string;
  title: string;
  href: string;
  description: string;
  status: 'active' | 'coming-soon';
}
