import { getDb } from './client';
import { uuid } from '@/src/utils/id';
import type { StravaActivity } from '@/src/strava/api';

export type SportsGoalRow = {
  id: string;
  type: 'weekly_distance_km';
  target_number: number;
  created_at: string;
  updated_at: string;
};

export type StravaActivityRow = {
  id: number;
  name: string | null;
  type: string | null;
  sport_type: string | null;
  start_date: string | null;
  distance: number | null;
  moving_time: number | null;
  elapsed_time: number | null;
  total_elevation_gain: number | null;
  average_speed: number | null;
  kudos_count: number | null;
  synced_at: string;
};

export function getWeeklyDistanceGoalKm() {
  const db = getDb();
  const row = db.getAllSync<SportsGoalRow>(
    `SELECT id, type, target_number, created_at, updated_at
     FROM sports_goals
     WHERE type = 'weekly_distance_km'
     LIMIT 1`
  )[0];
  return row?.target_number ?? null;
}

export function setWeeklyDistanceGoalKm(targetKm: number) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.getAllSync<{ id: string }>(
    `SELECT id FROM sports_goals WHERE type = 'weekly_distance_km' LIMIT 1`
  )[0];
  if (existing?.id) {
    db.runSync(`UPDATE sports_goals SET target_number = ?, updated_at = ? WHERE id = ?`, targetKm, now, existing.id);
    return;
  }
  db.runSync(
    `INSERT INTO sports_goals (id, type, target_number, created_at, updated_at)
     VALUES (?, 'weekly_distance_km', ?, ?, ?)`,
    uuid(),
    targetKm,
    now,
    now
  );
}

export function upsertStravaActivities(activities: StravaActivity[]) {
  const db = getDb();
  const syncedAt = new Date().toISOString();
  for (const a of activities) {
    db.runSync(
      `INSERT OR REPLACE INTO strava_activities
        (id, name, type, sport_type, start_date, distance, moving_time, elapsed_time,
         total_elevation_gain, average_speed, kudos_count, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      a.id,
      a.name ?? null,
      a.type ?? null,
      a.sport_type ?? null,
      a.start_date ?? null,
      a.distance ?? null,
      a.moving_time ?? null,
      a.elapsed_time ?? null,
      a.total_elevation_gain ?? null,
      a.average_speed ?? null,
      a.kudos_count ?? null,
      syncedAt
    );
  }
}

export function listRecentStravaActivities(limit = 20) {
  const db = getDb();
  return db.getAllSync<StravaActivityRow>(
    `SELECT id, name, type, sport_type, start_date, distance, moving_time, elapsed_time,
            total_elevation_gain, average_speed, kudos_count, synced_at
     FROM strava_activities
     ORDER BY start_date DESC
     LIMIT ?`,
    limit
  );
}

