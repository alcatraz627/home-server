import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { execSync } from 'node:child_process';
import os from 'node:os';
import type { RequestHandler } from './$types';
import { sanitizeShellArg } from '$lib/server/security';

interface TraceHop {
  server: string;
  serverIp: string;
  responseTime: number;
  answers: { name: string; type: string; value: string; ttl: number }[];
  authority: { name: string; type: string; value: string; ttl: number }[];
  additional: { name: string; type: string; value: string; ttl: number }[];
  flags: string;
  status: string;
  queryType: string;
  msgSize: number;
}

function parseDig(output: string): TraceHop[] {
  const hops: TraceHop[] = [];
  // Split by "Received" to separate each response
  const sections = output.split(/^;; Received/m);

  // Or better: split by ";; ->>HEADER<<-" which starts each response
  const headerSections = output.split(/^;; ->>HEADER<<-/m).filter((s) => s.trim());

  for (const section of headerSections) {
    const hop: TraceHop = {
      server: '',
      serverIp: '',
      responseTime: 0,
      answers: [],
      authority: [],
      additional: [],
      flags: '',
      status: '',
      queryType: '',
      msgSize: 0,
    };

    // Parse flags and status from first line
    const flagMatch = section.match(/opcode:\s*\w+,\s*status:\s*(\w+),.*flags:\s*([^;]+)/);
    if (flagMatch) {
      hop.status = flagMatch[1];
      hop.flags = flagMatch[2].trim();
    }

    // Parse server
    const serverMatch = section.match(/^;; SERVER:\s*([^\s#]+)#(\d+)/m);
    if (serverMatch) {
      hop.serverIp = serverMatch[1];
      hop.server = serverMatch[1];
    }

    // Parse query time
    const timeMatch = section.match(/^;; Query time:\s*(\d+)\s*msec/m);
    if (timeMatch) {
      hop.responseTime = parseInt(timeMatch[1], 10);
    }

    // Parse MSG SIZE
    const sizeMatch = section.match(/^;; MSG SIZE\s+rcvd:\s*(\d+)/m);
    if (sizeMatch) {
      hop.msgSize = parseInt(sizeMatch[1], 10);
    }

    // Parse ANSWER SECTION
    const answerMatch = section.match(/;; ANSWER SECTION:\n([\s\S]*?)(?=\n;; |$)/);
    if (answerMatch) {
      hop.answers = parseRecordSection(answerMatch[1]);
    }

    // Parse AUTHORITY SECTION
    const authMatch = section.match(/;; AUTHORITY SECTION:\n([\s\S]*?)(?=\n;; |$)/);
    if (authMatch) {
      hop.authority = parseRecordSection(authMatch[1]);
    }

    // Parse ADDITIONAL SECTION
    const addMatch = section.match(/;; ADDITIONAL SECTION:\n([\s\S]*?)(?=\n;; |$)/);
    if (addMatch) {
      hop.additional = parseRecordSection(addMatch[1]);
    }

    // Parse query type
    const queryMatch = section.match(/^;(\S+)\.\s+IN\s+(\w+)/m);
    if (queryMatch) {
      hop.queryType = queryMatch[2];
    }

    if (hop.serverIp || hop.answers.length || hop.authority.length) {
      hops.push(hop);
    }
  }

  return hops;
}

function parseRecordSection(text: string): { name: string; type: string; value: string; ttl: number }[] {
  const records: { name: string; type: string; value: string; ttl: number }[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;
    // Format: name TTL IN TYPE value
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 5) {
      const name = parts[0];
      const ttl = parseInt(parts[1], 10) || 0;
      // parts[2] = IN
      const type = parts[3];
      const value = parts.slice(4).join(' ');
      records.push({ name, type, value, ttl });
    }
  }
  return records;
}

function reverseLookup(ip: string): string {
  try {
    const safe = sanitizeShellArg(ip);
    const out = execSync(`dig +short -x ${safe} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 3000,
    });
    return out.trim().replace(/\.$/, '') || '';
  } catch {
    return '';
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const { domain, type = 'A' } = await request.json();

  if (!domain) {
    return json({ error: 'domain is required' }, { status: 400 });
  }

  const safeDomain = sanitizeShellArg(domain);
  const safeType = sanitizeShellArg(type);

  try {
    // Run dig +trace to get the full resolution path
    const traceOutput = execSync(`dig +trace +all ${safeDomain} ${safeType} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 15000,
    });

    const hops = parseDig(traceOutput);

    // Enrich with reverse DNS for each server
    for (const hop of hops) {
      if (hop.serverIp && hop.serverIp !== '127.0.0.1') {
        const rdns = reverseLookup(hop.serverIp);
        if (rdns) hop.server = rdns;
      }
    }

    // Also do a final direct lookup for comparison
    const directOutput = execSync(`dig +noall +answer +authority +stats ${safeDomain} ${safeType} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000,
    });

    return json({
      domain,
      type,
      hops,
      raw: traceOutput,
      hopCount: hops.length,
    });
  } catch (e: any) {
    return json({ error: e.message || 'DNS trace failed' }, { status: 500 });
  }
};
