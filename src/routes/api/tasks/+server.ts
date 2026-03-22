import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { getTaskStatuses, saveTaskConfig, deleteTaskConfig, runTask, getSystemDiskUsage } from '$lib/server/operator';
import { unscheduleTask, getScheduledTaskCount } from '$lib/server/scheduler';
import type { TaskConfig } from '$lib/server/operator';
import type { RequestHandler } from './$types';
import { createLogger } from '$lib/server/logger';

const log = createLogger('api:tasks');

/** Get all task statuses + disk usage + scheduled cron count */
export const GET: RequestHandler = async () => {
  const statuses = await getTaskStatuses();
  const disk = getSystemDiskUsage();
  const scheduledCount = getScheduledTaskCount();
  return json({ statuses, disk, scheduledCount });
};

/** Create or update a task config */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const config: TaskConfig = {
    id: body.id || crypto.randomUUID().slice(0, 8),
    name: body.name,
    command: body.command,
    cwd: body.cwd || undefined,
    schedule: body.schedule || null,
    timeout: body.timeout || 300,
    maxRetries: body.maxRetries ?? 3,
    notify: body.notify ?? true,
    enabled: body.enabled ?? true,
  };
  await saveTaskConfig(config);
  log.info('Task config saved', { id: config.id, name: config.name });
  return json(config, { status: 201 });
};

/** Trigger a task run */
export const PUT: RequestHandler = async ({ request }) => {
  const { taskId } = await request.json();
  try {
    const run = await runTask(taskId);
    log.info('Task run triggered', { taskId });
    return json(run);
  } catch (err: any) {
    log.error('Task run failed', { taskId, error: err.message });
    return json({ error: err.message }, { status: 400 });
  }
};

/** Delete a task config and unschedule its cron job */
export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  log.info('Task config deleted', { id });
  unscheduleTask(id);
  await deleteTaskConfig(id);
  return new Response(null, { status: 204 });
};
