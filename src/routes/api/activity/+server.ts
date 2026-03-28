import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readActivity } from '$lib/server/activity';

export const GET: RequestHandler = async ({ url }) => {
  const all = readActivity();
  const module = url.searchParams.get('module');
  const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
  const filtered = module ? all.filter((e) => e.module === module) : all;
  return json(filtered.slice(0, limit));
};
