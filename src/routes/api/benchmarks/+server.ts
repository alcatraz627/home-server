import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { CONFIG_DIR, PATHS } from '$lib/server/paths';
import { BENCHMARK_CPU_PRIME_LIMIT, BENCHMARK_MEMORY_SIZE_MB, BENCHMARK_DISK_SIZE_MB } from '$lib/constants/limits';

const FILE = PATHS.benchmarks;

interface BenchmarkResult {
  id: string;
  timestamp: string;
  cpu: { primes: number; timeMs: number; primesPerSec: number };
  memory: { sizeMB: number; timeMs: number; throughputMBps: number };
  disk: { sizeMB: number; writeMs: number; readMs: number; writeMBps: number; readMBps: number };
}

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function readResults(): BenchmarkResult[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeResults(results: BenchmarkResult[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(results, null, 2));
}

function benchmarkCPU(): { primes: number; timeMs: number; primesPerSec: number } {
  const N = BENCHMARK_CPU_PRIME_LIMIT;
  const start = performance.now();
  let count = 0;

  for (let n = 2; n <= N; n++) {
    let isPrime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) count++;
  }

  const timeMs = Math.round(performance.now() - start);
  return {
    primes: count,
    timeMs,
    primesPerSec: Math.round((count / timeMs) * 1000),
  };
}

function benchmarkMemory(): { sizeMB: number; timeMs: number; throughputMBps: number } {
  const sizeMB = BENCHMARK_MEMORY_SIZE_MB;
  const size = sizeMB * 1024 * 1024;
  const start = performance.now();

  // Allocate, write, read, deallocate
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i += 4096) {
    buf[i] = i & 0xff;
  }
  // Read back
  let sum = 0;
  for (let i = 0; i < size; i += 4096) {
    sum += buf[i];
  }

  const timeMs = Math.round(performance.now() - start);
  return {
    sizeMB,
    timeMs,
    throughputMBps: Math.round((sizeMB / timeMs) * 1000 * 100) / 100,
  };
}

function benchmarkDisk(): { sizeMB: number; writeMs: number; readMs: number; writeMBps: number; readMBps: number } {
  ensureDir();
  const sizeMB = BENCHMARK_DISK_SIZE_MB;
  const size = sizeMB * 1024 * 1024;
  const tmpFile = path.join(CONFIG_DIR, '.benchmark-tmp');
  const data = Buffer.alloc(size, 0x42);

  // Write
  const writeStart = performance.now();
  fs.writeFileSync(tmpFile, data);
  const writeMs = Math.round(performance.now() - writeStart);

  // Read
  const readStart = performance.now();
  fs.readFileSync(tmpFile);
  const readMs = Math.round(performance.now() - readStart);

  // Cleanup
  try {
    fs.unlinkSync(tmpFile);
  } catch {
    // ignore
  }

  return {
    sizeMB,
    writeMs,
    readMs,
    writeMBps: Math.round((sizeMB / writeMs) * 1000 * 100) / 100,
    readMBps: Math.round((sizeMB / readMs) * 1000 * 100) / 100,
  };
}

export const GET: RequestHandler = async () => {
  return json(readResults());
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body._action === 'run') {
    const benchmark = body.benchmark as string;
    let result: any = {};

    if (benchmark === 'cpu' || benchmark === 'all') {
      result.cpu = benchmarkCPU();
    }
    if (benchmark === 'memory' || benchmark === 'all') {
      result.memory = benchmarkMemory();
    }
    if (benchmark === 'disk' || benchmark === 'all') {
      result.disk = benchmarkDisk();
    }

    // Save full results if running all
    if (benchmark === 'all' && result.cpu && result.memory && result.disk) {
      const entry: BenchmarkResult = {
        id: crypto.randomUUID().slice(0, 8),
        timestamp: new Date().toISOString(),
        ...result,
      };
      const results = readResults();
      results.unshift(entry);
      // Keep last 50
      writeResults(results.slice(0, 50));
      return json(entry, { status: 201 });
    }

    return json(result);
  }

  return json({ error: 'Invalid action' }, { status: 400 });
};

export const DELETE: RequestHandler = async () => {
  writeResults([]);
  return json({ ok: true });
};
