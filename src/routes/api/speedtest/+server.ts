import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import type { RequestHandler } from './$types';
import {
  SPEEDTEST_DEFAULT_SIZE_KB,
  SPEEDTEST_MAX_SIZE_KB,
  SPEEDTEST_DOWNLOAD_SIZE_BYTES,
  SPEEDTEST_UPLOAD_SIZE_BYTES,
  SPEEDTEST_PING_COUNT,
  SPEEDTEST_CURL_MAX_TIME_SECS,
  SPEEDTEST_CURL_TIMEOUT_MS,
  SPEEDTEST_LATENCY_TIMEOUT_MS,
} from '$lib/constants/limits';

/** GET: generate random blob for download speed test */
export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action');

  if (action === 'ping') {
    return json({ ts: Date.now() });
  }

  if (action === 'download') {
    const sizeKB = parseInt(url.searchParams.get('size') || String(SPEEDTEST_DEFAULT_SIZE_KB));
    const size = Math.min(sizeKB, SPEEDTEST_MAX_SIZE_KB) * 1024; // max 10MB
    const data = crypto.randomBytes(size);
    return new Response(data, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
        'Cache-Control': 'no-store',
      },
    });
  }

  if (action === 'external') {
    try {
      // Download test: fetch 10MB from Cloudflare
      const dlStart = Date.now();
      const dlOut = execSync(
        `curl -s -o /dev/null -w "%{speed_download}" --max-time ${SPEEDTEST_CURL_MAX_TIME_SECS} https://speed.cloudflare.com/__down?bytes=${SPEEDTEST_DOWNLOAD_SIZE_BYTES} 2>/dev/null`,
        { encoding: 'utf-8', timeout: SPEEDTEST_CURL_TIMEOUT_MS },
      );
      const dlTime = Date.now() - dlStart;
      const dlBytesPerSec = parseFloat(dlOut.trim()) || 0;
      const dlMbps = (dlBytesPerSec * 8) / 1_000_000;

      // Upload test: send 2MB to Cloudflare
      const ulStart = Date.now();
      const ulOut = execSync(
        `curl -s -o /dev/null -w "%{speed_upload}" --max-time ${SPEEDTEST_CURL_MAX_TIME_SECS} -X POST --data-binary @/dev/urandom https://speed.cloudflare.com/__up 2>/dev/null | head -c ${SPEEDTEST_UPLOAD_SIZE_BYTES}`,
        { encoding: 'utf-8', timeout: SPEEDTEST_CURL_TIMEOUT_MS, shell: '/bin/sh' },
      );
      const ulTime = Date.now() - ulStart;
      const ulBytesPerSec = parseFloat(ulOut.trim()) || 0;
      const ulMbps = (ulBytesPerSec * 8) / 1_000_000;

      // Latency: ping Cloudflare
      let extLatency = 0;
      try {
        const pingOut = execSync(`ping -c ${SPEEDTEST_PING_COUNT} -W 2 1.1.1.1 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: SPEEDTEST_LATENCY_TIMEOUT_MS,
        });
        const avgMatch = pingOut.match(/avg\s*=\s*([\d.]+)/);
        extLatency = avgMatch ? Math.round(parseFloat(avgMatch[1])) : 0;
      } catch {}

      return json({
        download: Math.round(dlMbps * 100) / 100,
        upload: Math.round(ulMbps * 100) / 100,
        latency: extLatency,
        server: 'Cloudflare (speed.cloudflare.com)',
        downloadTime: dlTime,
        uploadTime: ulTime,
      });
    } catch (e: unknown) {
      return json({ error: errorMessage(e) || 'External speed test failed' }, { status: 500 });
    }
  }

  return json({ error: 'Invalid action' }, { status: 400 });
};

/** POST: receive upload blob for upload speed test */
export const POST: RequestHandler = async ({ request }) => {
  const start = Date.now();
  const data = await request.arrayBuffer();
  const elapsed = Date.now() - start;

  return json({
    receivedBytes: data.byteLength,
    serverTime: elapsed,
    ts: Date.now(),
  });
};
