import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { api, BASE } from '../helpers/api';

/**
 * UI smoke tests — verify all pages render without 500 errors.
 * These test server-side rendering (SSR) by fetching each page's HTML.
 */

const PAGES = [
  '/',
  '/files',
  '/processes',
  '/terminal',
  '/lights',
  '/peripherals',
  '/tailscale',
  '/wifi',
  '/packets',
  '/network',
  '/wol',
  '/dns',
  '/dns-trace',
  '/ports',
  '/services',
  '/tasks',
  '/backups',
  '/keeper',
  '/bookmarks',
  '/kanban',
  '/notes',
  '/apps',
  '/qr',
  '/speedtest',
  '/clipboard',
  '/screenshots',
  '/benchmarks',
  '/docker',
  '/databases',
  '/logs',
  '/docs',
  '/notifications',
  '/showcase',
  '/status',
];

describe('Page rendering (SSR)', () => {
  for (const page of PAGES) {
    it(`${page} renders without error`, async () => {
      const res = await fetch(`${BASE}${page}`, {
        headers: { Accept: 'text/html' },
      });
      assert.ok(res.status < 500, `${page} returned ${res.status} — should not be a server error`);
      const html = await res.text();
      assert.ok(html.includes('</html>'), `${page} should return valid HTML`);
      // Check it doesn't contain a raw error stack
      assert.ok(!html.includes('Error: '), `${page} should not show raw error messages in HTML`);
    });
  }
});

describe('Page titles', () => {
  it('dashboard has title', async () => {
    const res = await fetch(`${BASE}/`, { headers: { Accept: 'text/html' } });
    const html = await res.text();
    assert.ok(html.includes('<title>'), 'should have a title tag');
  });

  it('notes page has correct title', async () => {
    const res = await fetch(`${BASE}/notes`, { headers: { Accept: 'text/html' } });
    const html = await res.text();
    assert.ok(html.includes('Notes'), 'notes page should mention Notes');
  });
});

describe('Static assets', () => {
  it('favicon.svg exists', async () => {
    const res = await fetch(`${BASE}/favicon.svg`);
    assert.equal(res.status, 200);
  });

  it('xterm.css exists', async () => {
    const res = await fetch(`${BASE}/xterm.css`);
    assert.equal(res.status, 200);
  });
});

describe('API CORS & Security headers', () => {
  it('API responses have security headers', async () => {
    const res = await fetch(`${BASE}/api/system`);
    assert.ok(res.headers.get('x-content-type-options'), 'should have X-Content-Type-Options');
    assert.ok(res.headers.get('x-frame-options'), 'should have X-Frame-Options');
    assert.ok(res.headers.get('referrer-policy'), 'should have Referrer-Policy');
  });
});
