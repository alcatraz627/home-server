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
