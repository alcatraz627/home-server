import { json } from '@sveltejs/kit';
import { getTaskStatuses, saveTaskConfig, deleteTaskConfig, runTask, getSystemDiskUsage } from '$lib/server/operator';
import { unscheduleTask, getScheduledTaskCount } from '$lib/server/scheduler';
import type { TaskConfig } from '$lib/server/operator';
import type { RequestHandler } from './$types';

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
    id: body.id || Math.random().toString(36).slice(2, 10),
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
  return json(config, { status: 201 });
};

/** Trigger a task run */
export const PUT: RequestHandler = async ({ request }) => {
  const { taskId } = await request.json();
  try {
    const run = await runTask(taskId);
    return json(run);
  } catch (err: any) {
    return json({ error: err.message }, { status: 400 });
  }
};

/** Delete a task config and unschedule its cron job */
export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  unscheduleTask(id);
  await deleteTaskConfig(id);
  return new Response(null, { status: 204 });
};
