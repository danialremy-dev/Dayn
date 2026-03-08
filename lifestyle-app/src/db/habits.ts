import { getDb } from './client';
import { uuid } from '@/src/utils/id';

export type HabitRow = {
  id: string;
  name: string;
  schedule_mask: number;
  target_per_day: number;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type HabitWithTodayStatus = {
  id: string;
  name: string;
  isDoneToday: boolean;
};

// Bitmask: Mon=1 Tue=2 Wed=4 Thu=8 Fri=16 Sat=32 Sun=64 (default: 127 => every day)
function dayBit(day: string) {
  // day is yyyy-MM-dd; parse without timezone shifts by appending local time
  const d = new Date(`${day}T12:00:00`);
  const js = d.getDay(); // 0=Sun..6=Sat
  if (js === 0) return 64;
  return 1 << (js - 1);
}

export function getHabitsForToday(day: string) {
  const db = getDb();
  const bit = dayBit(day);

  const rows = db.getAllSync<{ id: string; name: string; done_id: string | null }>(
    `SELECT h.id, h.name, l.id as done_id
     FROM habits h
     LEFT JOIN habit_logs l
       ON l.habit_id = h.id AND l.day = ?
     WHERE h.is_active = 1 AND (h.schedule_mask & ?) != 0
     ORDER BY h.created_at DESC`,
    day,
    bit
  );

  return rows.map((r) => ({ id: r.id, name: r.name, isDoneToday: !!r.done_id })) satisfies HabitWithTodayStatus[];
}

export function addHabit(input: { name: string; scheduleMask?: number; targetPerDay?: number }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO habits (id, name, schedule_mask, target_per_day, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    uuid(),
    input.name,
    input.scheduleMask ?? 127,
    input.targetPerDay ?? 1,
    now,
    now
  );
}

export function toggleHabitForDay(habitId: string, day: string) {
  const db = getDb();
  const existing = db.getAllSync<{ id: string }>(
    `SELECT id FROM habit_logs WHERE habit_id = ? AND day = ? LIMIT 1`,
    habitId,
    day
  )[0];

  if (existing?.id) {
    db.runSync(`DELETE FROM habit_logs WHERE id = ?`, existing.id);
    return;
  }

  db.runSync(
    `INSERT INTO habit_logs (id, habit_id, day, count, created_at) VALUES (?, ?, ?, 1, ?)`,
    uuid(),
    habitId,
    day,
    new Date().toISOString()
  );
}

export function listHabits() {
  const db = getDb();
  return db.getAllSync<HabitRow>(
    `SELECT id, name, schedule_mask, target_per_day, is_active, created_at, updated_at
     FROM habits
     ORDER BY created_at DESC`
  );
}

