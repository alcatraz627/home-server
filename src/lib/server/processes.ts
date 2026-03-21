import { execSync } from 'node:child_process';

export interface ProcessInfo {
	pid: number;
	user: string;
	name: string;
	cpu: number;
	mem: number;
	startTime: string;
	command: string;
}

export function listProcesses(sortBy: string = 'cpu'): ProcessInfo[] {
	const raw = execSync('ps aux', { encoding: 'utf-8', timeout: 5000 });
	const lines = raw.trim().split('\n');

	// Skip header line
	const processes = lines.slice(1).map(parsePsLine).filter(Boolean) as ProcessInfo[];

	const sortFns: Record<string, (a: ProcessInfo, b: ProcessInfo) => number> = {
		cpu: (a, b) => b.cpu - a.cpu,
		mem: (a, b) => b.mem - a.mem,
		name: (a, b) => a.name.localeCompare(b.name),
		pid: (a, b) => a.pid - b.pid
	};

	processes.sort(sortFns[sortBy] || sortFns.cpu);
	return processes;
}

export function killProcess(pid: number, signal: string = 'TERM'): { ok: boolean; error?: string } {
	if (!Number.isInteger(pid) || pid <= 0) {
		return { ok: false, error: 'Invalid PID' };
	}

	const allowed = ['TERM', 'KILL', 'HUP', 'INT'];
	if (!allowed.includes(signal.toUpperCase())) {
		return { ok: false, error: `Signal must be one of: ${allowed.join(', ')}` };
	}

	try {
		execSync(`kill -${signal.toUpperCase()} ${pid}`, { encoding: 'utf-8', timeout: 3000 });
		return { ok: true };
	} catch (err: any) {
		return { ok: false, error: err.message || 'Failed to kill process' };
	}
}

function parsePsLine(line: string): ProcessInfo | null {
	// ps aux format: USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND
	const parts = line.trim().split(/\s+/);
	if (parts.length < 11) return null;

	const pid = parseInt(parts[1]);
	if (isNaN(pid)) return null;

	const command = parts.slice(10).join(' ');
	const name = command.split('/').pop()?.split(' ')[0] || command;

	return {
		pid,
		user: parts[0],
		cpu: parseFloat(parts[2]) || 0,
		mem: parseFloat(parts[3]) || 0,
		startTime: parts[8],
		command,
		name
	};
}
