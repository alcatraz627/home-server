import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import { LOGS_DIR, getRequests, updateRequest } from './keeper';
import { createLogger } from './logger';

const log = createLogger('agent-runner');

// --- Types ---

interface ActiveAgent {
  process: ChildProcess;
  logPath: string;
  startedAt: string;
}

// --- State ---

const activeAgents = new Map<string, ActiveAgent>();

// --- Helpers ---

function logPath(requestId: string): string {
  return path.join(LOGS_DIR, `${requestId}.log`);
}

export function getActiveAgent(requestId: string): ActiveAgent | undefined {
  return activeAgents.get(requestId);
}

export function isAgentRunning(requestId: string): boolean {
  return activeAgents.has(requestId);
}

export function getRunningAgentIds(): string[] {
  return Array.from(activeAgents.keys());
}

// --- Agent lifecycle ---

export async function startAgent(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (activeAgents.has(requestId)) {
    log.warn('Agent already running', { requestId });
    return { ok: false, error: 'Agent is already running for this request' };
  }

  // Build context from request
  const requests = await getRequests();
  const req = requests.find((r) => r.id === requestId);
  if (!req) {
    log.warn('Request not found for agent start', { requestId });
    return { ok: false, error: 'Request not found' };
  }

  const contextParts = [`# Task: ${req.title}`, ``, `## Goal`, req.goal];
  if (req.details) {
    contextParts.push('', '## Details', req.details);
  }
  const context = contextParts.join('\n');

  // Ensure log dir exists
  await fs.mkdir(LOGS_DIR, { recursive: true });

  const logFile = logPath(requestId);

  // Check if claude CLI exists
  let claudePath: string;
  try {
    const which = spawn('which', ['claude']);
    const result = await new Promise<string>((resolve, reject) => {
      let out = '';
      which.stdout.on('data', (d) => (out += d.toString()));
      which.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject()));
      which.on('error', reject);
    });
    claudePath = result;
  } catch {
    log.error('claude CLI not found');
    return { ok: false, error: 'claude CLI not found. Install it first: npm install -g @anthropic-ai/claude-code' };
  }

  log.info('Agent started', { requestId, title: req.title });

  const logStream = createWriteStream(logFile, { flags: 'a' });
  const startMarker = `\n--- Agent started at ${new Date().toISOString()} ---\n\n`;
  logStream.write(startMarker);

  const proc = spawn(claudePath, ['-p', context, '--output-format', 'stream-json'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  // Pipe output to log file
  proc.stdout?.on('data', (data: Buffer) => {
    logStream.write(data);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    logStream.write(`[stderr] ${data.toString()}`);
  });

  proc.on('close', async (code) => {
    const endMarker = `\n--- Agent exited with code ${code} at ${new Date().toISOString()} ---\n`;
    logStream.write(endMarker);
    logStream.end();
    activeAgents.delete(requestId);
    log.info('Agent exited', { requestId, code });

    // Update status based on exit code
    if (code === 0) {
      await updateRequest(requestId, { status: 'done' });
    } else {
      await updateRequest(requestId, { status: 'halted' });
    }
  });

  proc.on('error', async (err) => {
    log.error('Agent process error', err);
    logStream.write(`\n[error] Failed to run agent: ${err.message}\n`);
    logStream.end();
    activeAgents.delete(requestId);
    await updateRequest(requestId, { status: 'halted' });
  });

  activeAgents.set(requestId, {
    process: proc,
    logPath: logFile,
    startedAt: new Date().toISOString(),
  });

  // Update request status to running
  await updateRequest(requestId, { status: 'running' });

  return { ok: true };
}

export async function stopAgent(requestId: string): Promise<boolean> {
  const agent = activeAgents.get(requestId);
  if (!agent) return false;

  log.info('Agent stop requested', { requestId });
  agent.process.kill('SIGTERM');
  // Give it a moment then force kill
  setTimeout(() => {
    if (activeAgents.has(requestId)) {
      agent.process.kill('SIGKILL');
    }
  }, 5000);

  return true;
}

export async function sendMessageToAgent(requestId: string, message: string): Promise<boolean> {
  const agent = activeAgents.get(requestId);
  if (!agent || !agent.process.stdin?.writable) return false;

  log.debug('Sending message to agent', { requestId, messageLength: message.length });
  agent.process.stdin.write(message + '\n');
  return true;
}

export async function getLogContent(requestId: string, offset: number = 0): Promise<{ content: string; size: number }> {
  const file = logPath(requestId);
  if (!existsSync(file)) {
    return { content: '', size: 0 };
  }

  const stat = await fs.stat(file);
  if (offset >= stat.size) {
    return { content: '', size: stat.size };
  }

  const fd = await fs.open(file, 'r');
  const buf = Buffer.alloc(stat.size - offset);
  await fd.read(buf, 0, buf.length, offset);
  await fd.close();

  return { content: buf.toString('utf-8'), size: stat.size };
}

export async function resumeAgent(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (activeAgents.has(requestId)) {
    log.warn('Agent already running for resume', { requestId });
    return { ok: false, error: 'Agent is already running for this request' };
  }

  const requests = await getRequests();
  const req = requests.find((r) => r.id === requestId);
  if (!req) {
    return { ok: false, error: 'Request not found' };
  }

  log.info('Agent resuming', { requestId, title: req.title });

  // Build context with existing log as prefix
  const existingLog = await getLogContent(requestId);

  const contextParts = [`# Task: ${req.title}`, ``, `## Goal`, req.goal];
  if (req.details) {
    contextParts.push('', '## Details', req.details);
  }
  if (existingLog.content) {
    contextParts.push('', '## Previous Session Log', '```', existingLog.content.slice(-8000), '```');
    contextParts.push('', 'Continue from where the previous session left off.');
  }
  const context = contextParts.join('\n');

  // Ensure log dir exists
  await fs.mkdir(LOGS_DIR, { recursive: true });

  const logFile = logPath(requestId);

  let claudePath: string;
  try {
    const which = spawn('which', ['claude']);
    const result = await new Promise<string>((resolve, reject) => {
      let out = '';
      which.stdout.on('data', (d) => (out += d.toString()));
      which.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject()));
      which.on('error', reject);
    });
    claudePath = result;
  } catch {
    return { ok: false, error: 'claude CLI not found. Install it first: npm install -g @anthropic-ai/claude-code' };
  }

  const logStream = createWriteStream(logFile, { flags: 'a' });
  const startMarker = `\n--- Agent resumed at ${new Date().toISOString()} ---\n\n`;
  logStream.write(startMarker);

  const proc = spawn(claudePath, ['-p', context, '--output-format', 'stream-json'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  proc.stdout?.on('data', (data: Buffer) => {
    logStream.write(data);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    logStream.write(`[stderr] ${data.toString()}`);
  });

  proc.on('close', async (code) => {
    const endMarker = `\n--- Agent exited with code ${code} at ${new Date().toISOString()} ---\n`;
    logStream.write(endMarker);
    logStream.end();
    activeAgents.delete(requestId);
    log.info('Resumed agent exited', { requestId, code });

    if (code === 0) {
      await updateRequest(requestId, { status: 'done' });
    } else {
      await updateRequest(requestId, { status: 'halted' });
    }
  });

  proc.on('error', async (err) => {
    log.error('Resumed agent process error', err);
    logStream.write(`\n[error] Failed to run agent: ${err.message}\n`);
    logStream.end();
    activeAgents.delete(requestId);
    await updateRequest(requestId, { status: 'halted' });
  });

  activeAgents.set(requestId, {
    process: proc,
    logPath: logFile,
    startedAt: new Date().toISOString(),
  });

  await updateRequest(requestId, { status: 'running' });

  return { ok: true };
}
