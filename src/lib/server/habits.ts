import crypto from 'node:crypto';
import fs from 'node:fs';
import { PATHS } from './paths';
import { createLogger } from './logger';

export interface Habit {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
  archived?: boolean;
}

export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD
}

const log = createLogger('habits');

function readJson<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeJson<T>(file: string, data: T[]) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function readHabits(): Habit[] {
  return readJson<Habit>(PATHS.habits);
}

export function readHabitLogs(): HabitLog[] {
  return readJson<HabitLog>(PATHS.habitLogs);
}

export function createHabit(name: string, description = '', color = ''): Habit {
  const habit: Habit = {
    id: crypto.randomUUID().slice(0, 8),
    name,
    description: description || undefined,
    color: color || undefined,
    createdAt: new Date().toISOString(),
  };
  const all = readHabits();
  all.push(habit);
  writeJson(PATHS.habits, all);
  log.info('Habit created', { id: habit.id, name });
  return habit;
}

export function updateHabit(id: string, updates: Partial<Omit<Habit, 'id' | 'createdAt'>>): Habit | null {
  const all = readHabits();
  const idx = all.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  Object.assign(all[idx], updates);
  writeJson(PATHS.habits, all);
  return all[idx];
}

export function deleteHabit(id: string): boolean {
  const habits = readHabits();
  const filtered = habits.filter((h) => h.id !== id);
  if (filtered.length === habits.length) return false;
  writeJson(PATHS.habits, filtered);
  // Also remove all logs for this habit
  const logs = readHabitLogs().filter((l) => l.habitId !== id);
  writeJson(PATHS.habitLogs, logs);
  log.info('Habit deleted', { id });
  return true;
}

export function logHabit(habitId: string, date: string): boolean {
  const logs = readHabitLogs();
  const exists = logs.some((l) => l.habitId === habitId && l.date === date);
  if (exists) return false; // already logged
  logs.push({ habitId, date });
  writeJson(PATHS.habitLogs, logs);
  return true;
}

export function unlogHabit(habitId: string, date: string): boolean {
  const logs = readHabitLogs();
  const filtered = logs.filter((l) => !(l.habitId === habitId && l.date === date));
  if (filtered.length === logs.length) return false;
  writeJson(PATHS.habitLogs, filtered);
  return true;
}
