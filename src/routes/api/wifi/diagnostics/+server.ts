import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import os from 'os';
import {
  WIFI_DIAG_GATEWAY_TIMEOUT_MS,
  WIFI_DIAG_PING_TIMEOUT_MS,
  WIFI_DIAG_DNS_TIMEOUT_MS,
  WIFI_DIAG_TRACEROUTE_TIMEOUT_MS,
  WIFI_DIAG_INTERNET_TIMEOUT_MS,
  WIFI_DIAG_INTERNET_MAX_TIME_SECS,
} from '$lib/constants/limits';

interface DiagResult {
  test: string;
  status: 'pass' | 'fail' | 'warn';
  output: string;
  latency?: number;
}

function runCmd(cmd: string, timeout = 10000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    exec(cmd, { timeout }, (err, stdout, stderr) => {
      resolve({ stdout: stdout?.toString() || '', stderr: stderr?.toString() || '', code: err?.code ?? 0 });
    });
  });
}

function getGateway(): Promise<string> {
  const platform = os.platform();
  return new Promise(async (resolve) => {
    try {
      if (platform === 'darwin') {
        const { stdout } = await runCmd('netstat -rn | grep default | head -1', WIFI_DIAG_GATEWAY_TIMEOUT_MS);
        const gw = stdout.trim().split(/\s+/)[1];
        resolve(gw || '');
      } else {
        const { stdout } = await runCmd(
          "ip route | grep default | head -1 | awk '{print $3}'",
          WIFI_DIAG_GATEWAY_TIMEOUT_MS,
        );
        resolve(stdout.trim());
      }
    } catch {
      resolve('');
    }
  });
}

export const POST: RequestHandler = async ({ request }) => {
  const { test } = await request.json();
  const results: DiagResult[] = [];

  const gateway = await getGateway();

  if (test === 'ping' || test === 'all') {
    if (gateway) {
      const { stdout, code } = await runCmd(`ping -c 4 -W 2 ${gateway} 2>&1`, WIFI_DIAG_PING_TIMEOUT_MS);
      const avgMatch = stdout.match(/avg\s*=\s*([\d.]+)/);
      results.push({
        test: 'Ping Gateway',
        status: code === 0 ? 'pass' : 'fail',
        output: stdout.trim().split('\n').slice(-2).join('\n'),
        latency: avgMatch ? parseFloat(avgMatch[1]) : undefined,
      });
    } else {
      results.push({ test: 'Ping Gateway', status: 'fail', output: 'No default gateway found' });
    }
  }

  if (test === 'dns' || test === 'all') {
    // Test DNS resolution
    const dnsTargets = ['google.com', 'cloudflare.com'];
    for (const target of dnsTargets) {
      const start = Date.now();
      const { stdout, code } = await runCmd(`nslookup ${target} 2>&1 | head -6`, WIFI_DIAG_DNS_TIMEOUT_MS);
      const elapsed = Date.now() - start;
      results.push({
        test: `DNS: ${target}`,
        status: code === 0 && stdout.includes('Address') ? 'pass' : 'fail',
        output: stdout.trim().split('\n').slice(0, 4).join('\n'),
        latency: elapsed,
      });
    }
  }

  if (test === 'traceroute' || test === 'all') {
    if (gateway) {
      const platform = os.platform();
      const cmd = platform === 'darwin' ? `traceroute -m 5 -w 2 ${gateway} 2>&1` : `tracepath -m 5 ${gateway} 2>&1`;
      const { stdout } = await runCmd(cmd, WIFI_DIAG_TRACEROUTE_TIMEOUT_MS);
      results.push({
        test: 'Traceroute to Gateway',
        status: 'pass',
        output: stdout.trim(),
      });
    } else {
      results.push({ test: 'Traceroute to Gateway', status: 'fail', output: 'No default gateway found' });
    }
  }

  if (test === 'internet' || test === 'all') {
    // Quick HTTP connectivity test
    const start = Date.now();
    const { stdout, code } = await runCmd(
      `curl -s -o /dev/null -w "%{http_code}" --max-time ${WIFI_DIAG_INTERNET_MAX_TIME_SECS} https://1.1.1.1`,
      WIFI_DIAG_INTERNET_TIMEOUT_MS,
    );
    const elapsed = Date.now() - start;
    const httpCode = parseInt(stdout.trim());
    results.push({
      test: 'Internet (HTTPS)',
      status: httpCode >= 200 && httpCode < 400 ? 'pass' : 'fail',
      output: `HTTP ${httpCode || 'timeout'}`,
      latency: elapsed,
    });
  }

  return json({ results, gateway });
};
