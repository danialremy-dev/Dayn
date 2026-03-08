import { getDb } from './client';
import { uuid } from '@/src/utils/id';

export type AppointmentRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function listUpcomingAppointments(limit = 50) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.getAllSync<AppointmentRow>(
    `SELECT id, title, starts_at, ends_at, location, notes, created_at, updated_at
     FROM appointments
     WHERE starts_at >= ?
     ORDER BY starts_at ASC
     LIMIT ?`,
    now,
    limit
  );
}

export function addAppointment(input: {
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  location?: string;
  notes?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO appointments (id, title, starts_at, ends_at, location, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    uuid(),
    input.title,
    input.startsAt.toISOString(),
    input.endsAt ? input.endsAt.toISOString() : null,
    input.location?.trim() ? input.location.trim() : null,
    input.notes?.trim() ? input.notes.trim() : null,
    now,
    now
  );
}

