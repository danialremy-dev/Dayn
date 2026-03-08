import { getDb } from './client';
import { uuid } from '@/src/utils/id';

export type TodoRow = {
  id: string;
  title: string;
  day: string; // yyyy-MM-dd
  is_done: 0 | 1;
  created_at: string;
  updated_at: string;
};

export function getTodosForDay(day: string) {
  const db = getDb();
  return db.getAllSync<TodoRow>(
    `SELECT id, title, day, is_done, created_at, updated_at
     FROM todos
     WHERE day = ?
     ORDER BY is_done ASC, created_at DESC`,
    day
  );
}

export function addTodo(input: { title: string; day: string }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO todos (id, title, day, is_done, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
    uuid(),
    input.title,
    input.day,
    now,
    now
  );
}

export function toggleTodoDone(id: string, isDone: boolean) {
  const db = getDb();
  const now = new Date().toISOString();
  db.runSync(`UPDATE todos SET is_done = ?, updated_at = ? WHERE id = ?`, isDone ? 1 : 0, now, id);
}

