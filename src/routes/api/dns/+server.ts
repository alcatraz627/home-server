import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import dns from 'node:dns';
import { promisify } from 'node:util';
import type { RequestHandler } from './$types';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveMx = promisify(dns.resolveMx);
const resolveCname = promisify(dns.resolveCname);
const resolveTxt = promisify(dns.resolveTxt);
const resolveNs = promisify(dns.resolveNs);
const resolveSoa = promisify(dns.resolveSoa);

async function resolveRecord(domain: string, type: string): Promise<any[]> {
  try {
    switch (type) {
      case 'A':
        return await resolve4(domain);
      case 'AAAA':
        return await resolve6(domain);
      case 'MX': {
        const mx = await resolveMx(domain);
        return mx.map((r) => `${r.priority} ${r.exchange}`);
      }
      case 'CNAME':
        return await resolveCname(domain);
      case 'TXT': {
        const txt = await resolveTxt(domain);
        return txt.map((r) => r.join(''));
      }
      case 'NS':
        return await resolveNs(domain);
      case 'SOA': {
        const soa = await resolveSoa(domain);
        return [
          `${soa.nsname} ${soa.hostmaster} (serial: ${soa.serial}, refresh: ${soa.refresh}, retry: ${soa.retry}, expire: ${soa.expire}, minttl: ${soa.minttl})`,
        ];
      }
      default:
        return [];
    }
  } catch (err: unknown) {
    return [`Error: ${errorCode(err) || errorMessage(err)}`];
  }
}

async function resolveWithDNS(
  domain: string,
  type: string,
  server?: string,
): Promise<{ provider: string; server: string; records: any[]; time: number }> {
  const providerNames: Record<string, string> = {
    '8.8.8.8': 'Google',
    '1.1.1.1': 'Cloudflare',
    default: 'System Default',
  };

  const resolver = new dns.Resolver();
  if (server && server !== 'default') {
    resolver.setServers([server]);
  }

  const start = performance.now();
  let records: any[];

  try {
    switch (type) {
      case 'A':
        records = await promisify(resolver.resolve4.bind(resolver))(domain);
        break;
      case 'AAAA':
        records = await promisify(resolver.resolve6.bind(resolver))(domain);
        break;
      case 'MX': {
        const mx = await promisify(resolver.resolveMx.bind(resolver))(domain);
        records = mx.map((r: any) => `${r.priority} ${r.exchange}`);
        break;
      }
      case 'CNAME':
        records = await promisify(resolver.resolveCname.bind(resolver))(domain);
        break;
      case 'TXT': {
        const txt = await promisify(resolver.resolveTxt.bind(resolver))(domain);
        records = txt.map((r: any) => r.join(''));
        break;
      }
      case 'NS':
        records = await promisify(resolver.resolveNs.bind(resolver))(domain);
        break;
      case 'SOA': {
        const soa = await promisify(resolver.resolveSoa.bind(resolver))(domain);
        records = [`${soa.nsname} ${soa.hostmaster} (serial: ${soa.serial})`];
        break;
      }
      default:
        records = [];
    }
  } catch (err: unknown) {
    records = [`Error: ${errorCode(err) || errorMessage(err)}`];
  }

  const time = Math.round(performance.now() - start);
  return {
    provider: providerNames[server || 'default'] || server || 'System Default',
    server: server || 'default',
    records,
    time,
  };
}

export const POST: RequestHandler = async ({ request }) => {
  const { domain, type } = await request.json();

  if (!domain || !type) {
    return json({ error: 'Domain and type are required' }, { status: 400 });
  }

  const servers = ['8.8.8.8', '1.1.1.1', 'default'];
  const results = await Promise.all(servers.map((s) => resolveWithDNS(domain, type, s)));

  return json({ domain, type, results });
};
